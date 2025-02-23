"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListIssues = void 0;
// ...existing code...
const command_abstract_1 = require("../../../../core/src/command.abstract");
class ListIssues extends command_abstract_1.Command {
    constructor(jiraClient) {
        super();
        this.command = 'listIssues';
        this.schema = {
            type: 'object',
            properties: {
                projectId: { type: 'string' },
            },
            required: ['projectId'],
        };
        this.instruction = `
    # List Jira Issues
    Lists all issues for a specified Jira project.
    `;
        this.jiraClient = jiraClient;
    }
    async execute(params) {
        const { projectId } = params;
        if (!projectId) {
            throw new Error('projectId is required');
        }
        // Assume jiraClient has a method 'listIssues' that fetches issues for a project
        return await this.jiraClient.listIssues(projectId);
    }
}
exports.ListIssues = ListIssues;
// ...existing code...
