import assert from 'assert';
import { randomUUID } from 'crypto';
import { Command } from './command.abstract';
import winston from 'winston';

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'debug',
    format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => `${timestamp} ${level}: ${message}`)
    ),
    transports: [
        new winston.transports.Console(),
    ],
});

export class RemoteWorker {
    private TICK_RATE: number = 1;
    private tick: number = 0;
    private previous: number = this.hrtimeMs();
    private tickLengthMs: number = (1000 * 5) / this.TICK_RATE;

    private GRAPHQL_ENDPOINT: string;
    private ID: string;
    private API_KEY: string | undefined;
    public SESSION_ID: string | undefined;
    private VERSION: string | undefined;
    private STATE: Record<string, any>;
    executing: any;
    // specific context for runnign worker, like crucial information about the underlaying library usage, preferable options and return values formats
    WORKER_COMMAND_REQUEST_INSTRUCTION: string;

    public updateState(newState: Record<string, any>) {
        this.STATE = newState;
    }

    private supportedCommands: Command[] = [];

    constructor({ tickRate = 1, commandContext = '' } = {}) {
        this.GRAPHQL_ENDPOINT = process.env.GRAPHQL_ENDPOINT || 'http://localhost:3030/graphql';
        this.ID = process.env.WORKER_ID || randomUUID();
        this.API_KEY = process.env.API_KEY;
        this.TICK_RATE = tickRate;
        this.STATE = {
            progress: [],
        };
        this.WORKER_COMMAND_REQUEST_INSTRUCTION = commandContext;
        assert.ok(this.GRAPHQL_ENDPOINT, 'GRAPHQL_ENDPOINT is not defined');
        logger.info(`This is a new worker with ID: ${this.ID}`);
    }

    async createRemoteWorker() {
        const mutation = `#graphql
          mutation createRemoteWorker($id: String!, $status: RemoteWorkerStatus!) {
            createRemoteWorker(data: { id: $id, status: $status }) {
              id
              status
              supported_commands {
                command
                schema
                instruction
              }
              state {
                session_id
              }
            }
          }
        `;

        const variables = {
            id: this.ID,
            status: 'online',
        };

        const result = await this.graphqlRequest(mutation, variables);
        if (result.errors && result.errors.length > 0) {
            logger.error('Error creating worker:', result.errors);
        }
        this.setSessionId(result.data.createRemoteWorker.state.session_id);
        this.initCommands(result.data.createRemoteWorker.supported_commands);
        logger.debug(`Worker created with ID: ${this.ID} and session ID: ${this.SESSION_ID}`);
    }

    init() {
        this.initCommands();
        this.pollServer();
        this.loop();
    }

    async getServerState() {
        const query = `#graphql
          query GetWorkerStatus($id: String!) {
            remoteWorker(id: $id) {
              id
              status
              state
            }
          }
        `;

        const variables = { id: this.ID };
        const result = await this.graphqlRequest(query, variables);
        if (result.errors && result.errors.length > 0) {
            logger.error('Error getting worker status:', result.errors);
        }
        this.STATE = result.data.remoteWorker.state;
        this.setSessionId(this.STATE!.session_id);
        logger.debug(`Server state: ${JSON.stringify(this.STATE, null, 2)}`);
    }

    async updateStateWithCommandResult() {
        const mutation = `
            mutation updateWorkerState($remoteWorkerId: ID!, $sessionState: JSONObject!) {
                updateWorkerState(remoteWorkerId: $remoteWorkerId, sessionState: $sessionState)
            }
        `;

        const variables = {
            remoteWorkerId: this.ID,
            sessionState: this.STATE,
        };

        const result = await this.graphqlRequest(mutation, variables);
        this.STATE = result.data.updateWorkerState;
        this.setSessionId(this.STATE!.session_id);
    }

    private hrtimeMs() {
        const time = process.hrtime();
        return time[0] * 1000 + time[1] / 1000000;
    }

    private loop() {
        setTimeout(() => this.loop(), this.tickLengthMs);
        const now = this.hrtimeMs();
        const delta = (now - this.previous) / 1000;
        logger.debug(`Tick: ${this.tick}, Delta: ${delta}`);
        this.processCommandQueue();
        this.previous = now;
        this.tick++;
    }

    // Convert command names to camelCase method names
    private toCamelCase(command: string): string {
        return command.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
    }

    private pollServer() {
        // Poll server for state
        setInterval(() => this.getServerState(), 5000);
    }

    // Register and validate commands dynamically
    private initCommands(commands: Command[] = []) {
        commands = Array.isArray(commands) ? commands : [];
        commands.forEach((cmd) => {
            const handlerName = this.toCamelCase(cmd.command);
            if (typeof (this as any)[handlerName] !== 'function') {
                logger.warn(`No handler implemented for command: ${cmd.command}`);
            } else {
                logger.info(`Handler found for command: ${cmd.command}`);
            }
        });
        // assert start and stop commands are supported
        // assert.ok(commands.some((cmd) => cmd.command === 'start'), 'start command is not implemented');
        // assert.ok(commands.some((cmd) => cmd.command === 'stop'), 'stop command is not implemented');
    }

    public registerCommand(command: Command) {
        this.supportedCommands = Array.from(new Set([...this.supportedCommands, command]));
    }

    // Process the task queue
    private async processCommandQueue() {
        // Ensure command_queue exists in state
        if (!this.STATE?.command_queue || !Array.isArray(this.STATE.command_queue)) {
            logger.warn('No command queue found in state.');
            return;
        }
        if (this.STATE.command_queue.length === 0 && this.STATE.user_prompt && !this.executing) {
            const nextCommand = await this.getNextCommand();
            this.STATE.command_queue.push(nextCommand);
        }

        // Process each task in the queue
        if (this.STATE.command_queue.length > 0) {
            logger.debug('Processing command queue:', this.STATE.command_queue);
            const task = this.STATE.command_queue.shift();
            if (!task && this.STATE.progress.length > 0) {
                // finish processing
                logger.debug('Finished processing all commands');
                await this.updateStateWithCommandResult();
                return;
            }
            if (this.STATE?.executing) {
                logger.debug('Waiting for previous command to finish executing');
                return;
            }
            // check that if progress has more than 5 failed commands fail
            if (this.STATE.progress.length > 30 || this.STATE.progress.filter((progress: any) => progress.status === 'failed').length > 5) {
                // fail task and push to progress
                this.STATE.progress.push({
                    command: task.command,
                    status: 'failed',
                    error: 'Task took too long to complete'
                });
                // update server state
                await this.updateStateWithCommandResult();
                this.executing = undefined;
                await this.createRemoteWorker();
                return;
            }

            logger.debug('Processing task:', task);
            try {
                logger.debug(`Processing command: ${task.command}`);
                this.executing = task.command;
                await this.executeCommand(task.command, task.params);
                // Optionally update progress in state
            } catch (error) {
                logger.error(`Error processing command: ${task?.command}`, error);
                if (!this.STATE.progress) {
                    this.STATE.progress = [];
                    this.STATE.active_task = undefined
                }

                this.STATE.progress.push({
                    command: task.command,
                    status: 'failed',
                    error: (error as any).message || error
                });
            }
            finally {
                await this.updateStateWithCommandResult();
                this.executing = undefined
              
                // if last command was stop reset the state 
            }
        }
    }

    private async getNextCommand() {
        const previousStep = this.STATE!.progress[this.STATE!.progress.length - 2];
        const currentStep = this.STATE!.progress[this.STATE!.progress.length - 1];
        let currentStepPrompt = currentStep ? ` * current step is: ${JSON.stringify({
            commmand: currentStep?.command,
            status: currentStep?.status,
            result: currentStep?.result,
            ...(currentStep?.progress_data_state && { progress_data_state: currentStep.progress_data_state })
        }) || 'N/A'}` : ''
        let previousStepPrompt = previousStep ? `  * Previous step is: ${JSON.stringify({
            commmand: previousStep?.command,
            status: previousStep?.status,
            result: previousStep?.result,
            ...(previousStep?.progress_data_state && { progress_data_state: previousStep.progress_data_state })
        }) || 'N/A'}` : ''


        // make clone of the state.progress and remove images
        // check if progress_data_state in any of the results
        const progress = `   # Context:
            - Current progress state is following
              * All commands exectuted with results are 
                ${this.STATE!.progress.map((progress: any) => `
                    ** Command: ${progress.command}
                    ** Status: ${progress.status}
                    `).join('\n')}


              ${currentStepPrompt}
              ${previousStepPrompt}             
              `


        const prompt = `
            # Instruction
             - You need to evaluate if ${this.STATE!.user_prompt} is fulfilled based on the progress state
             # If its not fulfilled you need to complete the following steps
                1. Use state from previous step to extract the data or selectors to interact to get closes to your goal
                2. Find the best way to move forward based on the current state

             - YOU are NOT LAZY and will try to make sure all steps are completed successfully

            ${progress}

            ${this.WORKER_COMMAND_REQUEST_INSTRUCTION}

            # Output
            - You can only use data available in the state to generate the next command parameters and nothing else
            - Next command JSON object to be executed with parameters 
            - Stop command if more than 3 failed commands in progress state 
            - Stop If user prompt is fulfilled based on the progress state
        `
        // Fetch the next command from the server
        // use  createWorkerCompletion(prompt: String!, worker_id: ID ) mutation
        const mutation = `#graphql
            mutation createWorkerCompletion($prompt: String!, $worker_id: ID!) {
                createWorkerCompletion(prompt: $prompt, worker_id: $worker_id) {
                    completion
                    cost
                }
            }
        `;
        const variables = {
            prompt,
            worker_id: this.ID,
        };

        const result = await this.graphqlRequest(mutation, variables);
        if (result.errors && result.errors.length > 0) {
            logger.error('Error getting next command:', result.errors);
        }
        const nextCommand = result.data.createWorkerCompletion.completion;
        return nextCommand;
    }


    public async executeCommand(command: string, params: any) {
        const handlerName = this.toCamelCase(command);
        if (typeof (this as any)[handlerName] !== 'function') {
            logger.warn(`No handler implemented for command: ${command}`);
        } else {
            logger.debug(`Executing command: ${command}`);

            const result = await (this as any)[handlerName](params);
            // check if progress already has element with progress_data_state
            if (result.progress_data_state && this.STATE!.progress.some((progress: any) => progress.progress_data_state)) {
                // delete that element progress_data_state
                for (const step of (this.STATE?.progress || [])) {
                    if (step.progress_data_state) {
                        delete step.progress_data_state;
                    }
                }
            }

            this.STATE!.progress.push({
                command,
                status: 'success',
                ...(typeof result === 'object' ? result : { result }),
            })
        }
    }

    setSessionId(session_id: string) {
        this.SESSION_ID = session_id;
    }

    // New helper method to perform GraphQL requests with retry logic
    private async graphqlRequest(query: string, variables: any, maxRetries = 3, retryDelay = 2000): Promise<any> {
        let attempt = 0;
        while (attempt < maxRetries) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            try {
                attempt++;
                const response = await fetch(this.GRAPHQL_ENDPOINT, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-fm-key': `${this.API_KEY}`,
                    },
                    body: JSON.stringify({ query, variables }),
                    signal: controller.signal,
                });
                clearTimeout(timeout);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return await response.json();
            } catch (error: any) {
                clearTimeout(timeout);
                logger.error(`GraphQL request attempt ${attempt} failed:`, error);
                if (attempt < maxRetries) {
                    logger.info(`Retrying in ${retryDelay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                } else {
                    logger.error('All GraphQL request attempts failed.');
                    throw error;
                }
            }
        }
    }
}

