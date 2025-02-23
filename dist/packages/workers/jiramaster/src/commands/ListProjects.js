"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListProjects = void 0;
const command_abstract_1 = require("../../../../core/src/command.abstract");
class ListProjects extends command_abstract_1.Command {
    constructor(jiraClient) {
        super();
        this.command = 'listProjects';
        this.schema = { type: 'object', properties: {} };
        this.instruction = `
  # List Jira Projects
  Lists all available Jira projects.
  `;
        this.jiraClient = jiraClient;
    }
    async execute(_params) {
        return await this.jiraClient.listProjects();
    }
}
exports.ListProjects = ListProjects;
