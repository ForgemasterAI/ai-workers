import { Command } from '../../../../core/src/command.abstract';
import { JiraClient } from '../jira.client';

export class GetProjectDetails extends Command {
    command = 'getProjectDetails';
    schema = {
        type: 'object',
        properties: {
            projectId: { type: 'string' },
        },
        required: ['projectId'],
    };
    instruction = `
    # Get Project Details
    Retrieves detailed information for a specified Jira project.
    `;

    private jiraClient: JiraClient;

    constructor(jiraClient: JiraClient) {
        super();
        this.jiraClient = jiraClient;
    }

    async execute(params: { projectId: string }): Promise<any> {
        const { projectId } = params;
        if (!projectId) {
            throw new Error('projectId is required');
        }
        return await this.jiraClient.getProject(projectId);
    }
}
