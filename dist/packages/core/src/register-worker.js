"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RemoteWorker = void 0;
const winston_1 = __importDefault(require("winston"));
// Conditionally import assert. In browser, use custom assert function.
let assertFn;
if (typeof process !== 'undefined' && process.env) {
    // Node environment: use Node's assert module
    assertFn = require('assert');
}
else {
    // Browser environment: simple assert implementation
    assertFn = {
        ok: (cond, msg) => {
            if (!cond)
                throw new Error(msg);
        },
    };
}
// Determine if environment is Browser
const isBrowser = typeof window !== 'undefined';
// UUID generator function that works in both environments
function generateUUID() {
    if (!isBrowser) {
        // Node environment: use crypto.randomUUID from static import
        return require('crypto').randomUUID();
    }
    else if (window.crypto && window.crypto.randomUUID) {
        return window.crypto.randomUUID();
    }
    else {
        throw new Error('No UUID generation available.');
    }
}
// Setup logger: if in browser, fallback to console
const logger = isBrowser
    ? {
        debug: console.debug.bind(console),
        info: console.info.bind(console),
        warn: console.warn.bind(console),
        error: console.error.bind(console),
        level: 'debug',
    }
    : winston_1.default.createLogger({
        level: process.env.LOG_LEVEL || 'debug',
        format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.timestamp(), winston_1.default.format.printf(({ timestamp, level, message }) => `${timestamp} ${level}: ${message}`)),
        transports: [new winston_1.default.transports.Console()],
    });
class RemoteWorker {
    updateState(newState) {
        this.STATE = newState;
    }
    constructor({ tickRate = 1, commandContext = '', fmJwt = undefined } = {}) {
        this.TICK_RATE = 1;
        this.tick = 0;
        this.previous = this.hrtimeMs();
        this.tickLengthMs = (1000 * 5) / this.TICK_RATE;
        this.supportedCommands = [];
        // Use conditional environment access for process.env
        this.GRAPHQL_ENDPOINT =
            (typeof process !== 'undefined' && process.env && process.env.GRAPHQL_ENDPOINT) || 'http://localhost:3030/graphql';
        this.ID = (typeof process !== 'undefined' && process.env && process.env.WORKER_ID) || generateUUID();
        this.API_KEY = (typeof process !== 'undefined' && process.env && process.env.API_KEY) || undefined;
        this.FM_JWT = fmJwt;
        this.TICK_RATE = tickRate;
        this.STATE = {
            progress: [],
        };
        this.WORKER_COMMAND_REQUEST_INSTRUCTION = commandContext;
        assertFn.ok(this.GRAPHQL_ENDPOINT, 'GRAPHQL_ENDPOINT is not defined');
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
              state
            }
          }
        `;
        const variables = { id: this.ID };
        const result = await this.graphqlRequest(query, variables, 2000).catch((error) => {
            logger.error('Error getting worker status:', error);
            return { data: { remoteWorker: {} } };
        });
        if (result.errors && result.errors.length > 0) {
            logger.error('Error getting worker status:', result.errors);
        }
        if (!result.data.remoteWorker) {
            logger.error('No worker found in getServerState');
            return;
        }
        this.STATE = result.data.remoteWorker.state;
        this.setSessionId(this.STATE.session_id);
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
        if (!this.STATE?.progress || !this.STATE?.session_id) {
            logger.error('State or session_id not found in updateStateWithCommandResult');
            return;
        }
        const result = await this.graphqlRequest(mutation, variables);
        this.STATE = result.data.updateWorkerState;
        this.setSessionId(this.STATE.session_id);
        // if stop command is issued, reset the session
    }
    hrtimeMs() {
        const time = typeof process !== 'undefined' && process.hrtime ? process.hrtime() : [Date.now(), 0];
        return time[0] * 1000 + time[1] / 1000000;
    }
    loop() {
        setTimeout(() => this.loop(), this.tickLengthMs);
        const now = this.hrtimeMs();
        const delta = (now - this.previous) / 1000;
        logger.debug(`Tick: ${this.tick}, Delta: ${delta}`);
        this.processCommandQueue();
        this.previous = now;
        this.tick++;
    }
    // Convert command names to camelCase method names
    toCamelCase(command) {
        return command.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
    }
    pollServer() {
        // Poll server for state
        setInterval(() => this.getServerState(), 5000);
    }
    // Register and validate commands dynamically
    initCommands(commands = []) {
        commands = Array.isArray(commands) ? commands : [];
        commands.forEach((cmd) => {
            const handlerName = this.toCamelCase(cmd.command);
            if (typeof this[handlerName] !== 'function') {
                logger.warn(`No handler implemented for command: ${cmd.command}`);
            }
            else {
                logger.info(`Handler found for command: ${cmd.command}`);
            }
        });
        // assert start and stop commands are supported
        // assert.ok(commands.some((cmd) => cmd.command === 'start'), 'start command is not implemented');
        // assert.ok(commands.some((cmd) => cmd.command === 'stop'), 'stop command is not implemented');
    }
    registerCommand(command) {
        // Register command with toCamelCase name
        const handlerName = this.toCamelCase(command.command);
        this[handlerName] = command.execute.bind(command);
        this.supportedCommands.push(command);
    }
    // Process the task queue
    async processCommandQueue() {
        // Ensure command_queue exists in state
        if (!this.STATE?.command_queue || !Array.isArray(this.STATE.command_queue)) {
            logger.warn('No command queue found in state.');
        }
        if (this.STATE.command_queue?.length === 0 && this.STATE.user_prompt && !this.executing) {
            // Fetch the next command from the server
            const nextCommand = await this.getNextCommand();
            this.STATE.command_queue.push(nextCommand);
        }
        // Process each task in the queue
        else if (this.STATE.command_queue?.length > 0) {
            logger.debug('Processing command queue:', this.STATE.command_queue);
            const task = this.STATE.command_queue.shift();
            logger.debug(`Processing command: ${JSON.stringify(task, null, 2)}`);
            try {
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
                const failedLength = this.STATE.progress.filter((progress) => progress.status === 'failed').length;
                // check that if progress has more than 5 failed commands fail
                if (this.STATE.progress.length > 30 || failedLength > 1) {
                    // fail task and push to progress
                    this.STATE.progress.push({
                        command: task.command,
                        status: 'failed',
                        error: 'Task took too long to complete',
                    });
                    if (failedLength > 1) {
                        this.STATE.progress.push({
                            command: 'stop',
                            status: 'success',
                            error: 'Task took too long to complete',
                        });
                    }
                    // update server state
                    await this.updateStateWithCommandResult();
                }
                else {
                    logger.debug(`Processing command: ${task.command}`);
                    this.executing = task.command;
                    await this.executeCommand(task.command, task.params);
                }
                // Optionally update progress in state
            }
            catch (error) {
                logger.error(`Error processing command: ${task?.command}`, error);
                if (!this.STATE.progress) {
                    this.STATE.progress = [];
                    this.STATE.active_task = undefined;
                }
                this.STATE.progress.push({
                    command: task?.command,
                    status: 'failed',
                    error: error.message || error,
                });
            }
            finally {
                await this.updateStateWithCommandResult();
                this.executing = undefined;
                if (task?.command === 'stop') {
                    if (this.STATE?.progress.some((progress) => progress.command === 'stop')) {
                        this.STATE = {
                            ...this.STATE,
                            progress: [],
                            command_queue: [],
                            user_prompt: '',
                        };
                    }
                }
            }
        }
    }
    async getNextCommand() {
        const previousStep = this.STATE.progress[this.STATE.progress.length - 2];
        const currentStep = this.STATE.progress[this.STATE.progress.length - 1];
        const currentStepPrompt = currentStep
            ? ` * current step is: ${JSON.stringify({
                commmand: currentStep?.command,
                status: currentStep?.status,
                result: currentStep?.result,
                ...(currentStep?.progress_data_state && { progress_data_state: currentStep.progress_data_state }),
            }) || 'N/A'}`
            : '';
        const previousStepPrompt = previousStep
            ? `  * Previous step is: ${JSON.stringify({
                commmand: previousStep?.command,
                status: previousStep?.status,
                result: previousStep?.result,
                ...(previousStep?.progress_data_state && { progress_data_state: previousStep.progress_data_state }),
            }) || 'N/A'}`
            : '';
        // make clone of the state.progress and remove images
        // check if progress_data_state in any of the results
        const progress = `   # Context:
            - Current progress state is following
              * All commands exectuted with results are 
                ${this.STATE.progress.map((progress) => `
                    ** Command: ${progress.command}
                    ** Status: ${progress.status}
                    `).join('\n')}


              ${currentStepPrompt}
              ${previousStepPrompt}             
              `;
        const prompt = `
            # Instruction
             - You need to evaluate if ${this.STATE.user_prompt} is fulfilled based on the progress state
             # IF IT NOT FULFILLED YOU NEED TO FOLLOW THE FOLLOWING STEPS
                1. Use state from previous step to extract the data or selectors to interact to get closes to your goal
                2. Find the best way to move forward based on the current state

             - YOU are NOT LAZY and will try to make sure all steps are completed successfully
             - YOU WILL AVOID ANY UNNECESSARY STEPS AND WILL NOT REPEAT ANY STEPS UNLESS NECESSARY
             - IF TASK IS COMPLETED YOU WILL ISSUE STOP COMMAND

            ${progress}

            ${this.WORKER_COMMAND_REQUEST_INSTRUCTION}

            # Output
            - You can only use data available in the state to generate the next command parameters and nothing else
            - Next command JSON object to be executed with parameters 
            - Stop command if more than 3 failed commands in progress state 
            - Stop If user prompt is fulfilled based on the progress state
        `;
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
    async executeCommand(command, params) {
        const handlerName = this.toCamelCase(command);
        if (typeof this[handlerName] !== 'function') {
            logger.warn(`No handler implemented for command: ${command}`);
        }
        else {
            logger.debug(`Executing command: ${command}`);
            const result = await this[handlerName](params);
            // check if progress already has element with progress_data_state
            if (result.progress_data_state && this.STATE.progress.some((progress) => progress.progress_data_state)) {
                // delete that element progress_data_state
                for (const step of this.STATE?.progress || []) {
                    if (step.progress_data_state) {
                        delete step.progress_data_state;
                    }
                }
            }
            this.STATE.progress.push({
                command,
                status: 'success',
                ...(typeof result === 'object' ? result : { result }),
            });
        }
    }
    setSessionId(session_id) {
        this.SESSION_ID = session_id;
    }
    // New helper method to perform GraphQL requests with retry logic
    async graphqlRequest(query, variables, maxRetries = 3, retryDelay = 5000) {
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
                        ...(this.API_KEY && { 'x-fm-key': `${this.API_KEY}` }),
                        ...(this.FM_JWT && { Authorization: `Bearer ${this.FM_JWT}` }),
                    },
                    body: JSON.stringify({ query, variables }),
                    signal: controller.signal,
                });
                clearTimeout(timeout);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return await response.json();
            }
            catch (error) {
                clearTimeout(timeout);
                logger.error(`GraphQL request attempt ${attempt} failed:`, error);
                if (attempt < maxRetries) {
                    logger.info(`Retrying in ${retryDelay}ms...`);
                    await new Promise((resolve) => setTimeout(resolve, retryDelay));
                }
                else {
                    logger.error('All GraphQL request attempts failed.');
                    throw error;
                }
            }
        }
    }
}
exports.RemoteWorker = RemoteWorker;
