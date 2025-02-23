"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateIssue = void 0;
const command_abstract_1 = require("../../../../core/src/command.abstract");
class CreateIssue extends command_abstract_1.Command {
    constructor(jiraClient) {
        super();
        this.command = 'createIssue';
        this.schema = {
            type: 'object',
            properties: {
                projectId: { type: 'string' },
                summary: { type: 'string' },
                description: { type: 'string' },
            },
            required: ['projectId', 'summary'],
        };
        this.instruction = `
    # Create Jira Issue
    Creates a new issue in the specified Jira project.
    `;
        this.jiraClient = jiraClient;
    }
    async execute(params) {
        const { projectId, summary, description } = params;
        if (!projectId || !summary) {
            throw new Error('projectId and summary are required');
        }
        // Assume jiraClient has a method 'createIssue' to create a new issue
        return await this.jiraClient.createIssue({ projectId, summary, description });
    }
}
exports.CreateIssue = CreateIssue;
