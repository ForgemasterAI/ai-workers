// ...existing code...
import { Command } from '../../../../core/src/command.abstract';

export class ListIssues extends Command {
    command = 'listIssues';
    schema = {
        type: 'object',
        properties: {
            projectId: { type: 'string' },
        },
        required: ['projectId'],
    };
    instruction = `
    # List Jira Issues
    Lists all issues for a specified Jira project.
    `;

    private jiraClient: any;

    constructor(jiraClient: any) {
        super();
        this.jiraClient = jiraClient;
    }

    async execute(params: { projectId: string }): Promise<any> {
        const { projectId } = params;
        if (!projectId) {
            throw new Error('projectId is required');
        }
        // Assume jiraClient has a method 'listIssues' that fetches issues for a project
        return await this.jiraClient.listIssues(projectId);
    }
}
// ...existing code...
