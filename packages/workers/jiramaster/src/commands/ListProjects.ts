import { Command } from '../../../../core/src/command.abstract';
import { JiraClient } from '../jira.client';

export class ListProjects extends Command {
    command = 'listProjects';
    schema = { type: 'object', properties: {} };
    instruction = `
  # List Jira Projects
  Lists all available Jira projects.
  `;

    private jiraClient: JiraClient;

    constructor(jiraClient: JiraClient) {
        super();
        this.jiraClient = jiraClient;
    }

    async execute(_params: Record<string, never>): Promise<any> {
        return await this.jiraClient.listProjects();
    }
}
