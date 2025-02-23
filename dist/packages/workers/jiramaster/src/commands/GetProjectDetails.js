"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetProjectDetails = void 0;
const command_abstract_1 = require("../../../../core/src/command.abstract");
class GetProjectDetails extends command_abstract_1.Command {
    constructor(jiraClient) {
        super();
        this.command = 'getProjectDetails';
        this.schema = {
            type: 'object',
            properties: {
                projectId: { type: 'string' },
            },
            required: ['projectId'],
        };
        this.instruction = `
    # Get Project Details
    Retrieves detailed information for a specified Jira project.
    `;
        this.jiraClient = jiraClient;
    }
    async execute(params) {
        const { projectId } = params;
        if (!projectId) {
            throw new Error('projectId is required');
        }
        return await this.jiraClient.getProject(projectId);
    }
}
exports.GetProjectDetails = GetProjectDetails;
