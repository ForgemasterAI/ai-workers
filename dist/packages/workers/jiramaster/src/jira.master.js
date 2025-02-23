"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JiraMaster = void 0;
const register_worker_1 = require("../../../core/src/register-worker");
const command_abstract_1 = require("../../../core/src/command.abstract");
const ListProjects_1 = require("./commands/ListProjects");
const GetProjectDetails_1 = require("./commands/GetProjectDetails");
const CreateIssue_1 = require("./commands/CreateIssue");
const ListIssues_1 = require("./commands/ListIssues");
const jira_client_1 = require("./jira.client");
class Start extends command_abstract_1.Command {
    constructor() {
        super(...arguments);
        this.command = 'start';
        this.schema = {
            type: 'object',
            properties: {
                sessions: { type: 'object' },
                session_id: { type: 'string' },
            },
            required: ['sessions'],
        };
        this.instruction = `
    # Start a new session
    This command starts a new session and returns a session id.
    `;
    }
    async execute(params) {
        const { sessions, session_id } = params;
        const newSessionId = session_id || Date.now().toString();
        sessions[newSessionId] = {};
        return { session_id: newSessionId };
    }
}
class Stop extends command_abstract_1.Command {
    constructor() {
        super(...arguments);
        this.command = 'stop';
        this.schema = {
            type: 'object',
            properties: {
                session_id: { type: 'string' },
            },
            required: ['session_id'],
        };
        this.instruction = `
    # Stop the session
    This command stops the current session.
    `;
    }
    async execute(_params) {
        // Implementation for stopping a session
        return { stopped: true };
    }
}
class JiraMaster extends register_worker_1.RemoteWorker {
    constructor(token, cloudId) {
        super({
            commandContext: `
            # Jira API Guide
            This worker uses the Jira API to interact with Jira
            `,
        });
        this.token = token;
        this.cloudId = cloudId;
        this.sessions = {};
        this.jiraClient = new jira_client_1.JiraClient(this.token, this.cloudId);
        // Register command handlers
        this.registerCommand(new Start());
        this.registerCommand(new Stop());
        this.registerCommand(new GetProjectDetails_1.GetProjectDetails(this.jiraClient));
        this.registerCommand(new CreateIssue_1.CreateIssue(this.jiraClient));
        this.registerCommand(new ListIssues_1.ListIssues(this.jiraClient));
        this.registerCommand(new ListProjects_1.ListProjects(this.jiraClient));
    }
}
exports.JiraMaster = JiraMaster;
