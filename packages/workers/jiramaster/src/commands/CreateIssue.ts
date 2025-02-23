import { Command } from '../../../../core/src/command.abstract';

export class CreateIssue extends Command {
    command = 'createIssue';
    schema = {
        type: 'object',
        properties: {
            projectId: { type: 'string' },
            summary: { type: 'string' },
            description: { type: 'string' },
        },
        required: ['projectId', 'summary'],
    };
    instruction = `
    # Create Jira Issue
    Creates a new issue in the specified Jira project.
    `;

    private jiraClient: any;

    constructor(jiraClient: any) {
        super();
        this.jiraClient = jiraClient;
    }

    async execute(params: { projectId: string; summary: string; description?: string }): Promise<any> {
        const { projectId, summary, description } = params;
        if (!projectId || !summary) {
            throw new Error('projectId and summary are required');
        }
        // Assume jiraClient has a method 'createIssue' to create a new issue
        return await this.jiraClient.createIssue({ projectId, summary, description });
    }
}
