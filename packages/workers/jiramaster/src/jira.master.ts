import { RemoteWorker } from '../../../core/src/register-worker';
import { Command } from '../../../core/src/command.abstract';
import { ListProjects } from './commands/ListProjects';
import { GetProjectDetails } from './commands/GetProjectDetails';
import { CreateIssue } from './commands/CreateIssue';
import { ListIssues } from './commands/ListIssues';
import { JiraClient } from './jira.client';

class Start extends Command {
    command = 'start';
    schema = {
        type: 'object',
        properties: {
            sessions: { type: 'object' },
            session_id: { type: 'string' },
        },
        required: ['sessions'],
    };
    instruction = `
    # Start a new session
    This command starts a new session and returns a session id.
    `;
    async execute(params: { sessions: Record<string, unknown>; session_id?: string }): Promise<{ session_id: string }> {
        const { sessions, session_id } = params;
        const newSessionId = session_id || Date.now().toString();
        sessions[newSessionId] = {};
        return { session_id: newSessionId };
    }
}

class Stop extends Command {
    command = 'stop';
    schema = {
        type: 'object',
        properties: {
            session_id: { type: 'string' },
        },
        required: ['session_id'],
    };
    instruction = `
    # Stop the session
    This command stops the current session.
    `;
    async execute(_params: { session_id: string }): Promise<{ stopped: boolean }> {
        // Implementation for stopping a session
        return { stopped: true };
    }
}

export class JiraMaster extends RemoteWorker {
    sessions: Record<string, unknown>;
    jiraClient: JiraClient;
    token: string;
    cloudId: string;

    constructor(token: string, cloudId: string) {
        super({
            commandContext: `
            # Jira API Guide
            This worker uses the Jira API to interact with Jira
            `,
        });
        this.token = token;
        this.cloudId = cloudId;

        this.sessions = {};
        this.jiraClient = new JiraClient(this.token, this.cloudId);

        // Register command handlers
        this.registerCommand(new Start());
        this.registerCommand(new Stop());
        this.registerCommand(new GetProjectDetails(this.jiraClient));
        this.registerCommand(new CreateIssue(this.jiraClient));
        this.registerCommand(new ListIssues(this.jiraClient));
        this.registerCommand(new ListProjects(this.jiraClient));
    }
}
