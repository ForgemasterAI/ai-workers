import axios, { AxiosInstance } from 'axios';

export class JiraClient {
    private instance: AxiosInstance;

    constructor(token: string, cloudId: string) {
        if (!token || !cloudId) {
            throw new Error('JIRA_TOKEN and JIRA_CLOUD_ID must be provided');
        }
        this.instance = axios.create({
            baseURL: `https://api.atlassian.com/ex/jira/${cloudId}`,
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
        });
    }

    async listProjects(): Promise<any> {
        const response = await this.instance.get('/project');
        return response.data;
    }

    async getProject(projectId: string): Promise<any> {
        const response = await this.instance.get(`/project/${projectId}`);
        return response.data;
    }

    async listIssues(projectId: string): Promise<any> {
        const response = await this.instance.get('/search', { params: { jql: `project=${projectId}` } });
        return response.data;
    }

    async createIssue({ projectId, summary, description }: { projectId: string; summary: string; description?: string }): Promise<any> {
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
