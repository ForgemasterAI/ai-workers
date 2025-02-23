"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JiraClient = void 0;
const axios_1 = __importDefault(require("axios"));
class JiraClient {
    constructor(token, cloudId) {
        if (!token || !cloudId) {
            throw new Error('JIRA_TOKEN and JIRA_CLOUD_ID must be provided');
        }
        this.instance = axios_1.default.create({
            baseURL: `https://api.atlassian.com/ex/jira/${cloudId}`,
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
        });
    }
    async listProjects() {
        const response = await this.instance.get('/project');
        return response.data;
    }
    async getProject(projectId) {
        const response = await this.instance.get(`/project/${projectId}`);
        return response.data;
    }
    async listIssues(projectId) {
        const response = await this.instance.get('/search', { params: { jql: `project=${projectId}` } });
        return response.data;
    }
    async createIssue({ projectId, summary, description }) {
        const payload = {
            fields: {
                project: { key: projectId },
                summary,
                description,
                issuetype: { name: 'Task' },
            },
        };
        const response = await this.instance.post('/issue', payload);
        return response.data;
    }
}
exports.JiraClient = JiraClient;
