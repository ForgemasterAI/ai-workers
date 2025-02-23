import { RemoteWorker } from '../../core/src/register-worker';
import { Click, ExtractCleanHtml, Navigate, Select, Start, Stop, Type } from './commands';

class PupperMaster extends RemoteWorker {
    sessions: Record<string, any>;
    constructor() {
        super({
            commandContext: `
            # Puppeteer Selectors Guide

                CSS Selectors: Puppeteer supports standard CSS selectors across its APIs.
                Non-CSS Selectors: These include custom pseudo-elements with a -p prefix:
                - XPath Selectors (-p-xpath): Use XPath expressions to query elements. example: '::-p-xpath(//h2)');

                - Text Selectors (-p-text): Select minimal elements containing specific text, even in shadow roots example: 'div ::-p-text(Checkout)'
                

            - ARIA Selectors (-p-aria): Find elements using accessible names and roles, resolving relationships in the accessibility tree. example '::-p-aria(Submit)'
            `,
        });
        this.sessions = {};
    }

    async start(params: any) {
        const { session_id } = await new Start({
            sessions: this.sessions,
            ...(this.SESSION_ID ? { session_id: this.SESSION_ID } : {}),
        }).execute(params);

        this.setSessionId(session_id);
        return session_id;
    }

    async stop(params: any) {
        const result = await new Stop(this.sessions).execute({ ...params, session_id: this.SESSION_ID });
        // reset the session id
        delete this.SESSION_ID;
        delete this.sessions[params.session_id as string];
        return result;
    }

    async click(params: any) {
        return new Click(this.sessions).execute({ ...params, session_id: this.SESSION_ID });
    }

    async type(params: any) {
        return new Type(this.sessions).execute({ ...params, session_id: this.SESSION_ID });
    }
    async extractCleanHtml(params: any) {
        return new ExtractCleanHtml(this.sessions).execute({ ...params, session_id: this.SESSION_ID });
    }
    async navigate(params: any) {
        return new Navigate(this.sessions).execute({ ...params, session_id: this.SESSION_ID });
    }

    async select(params: any) {
        return new Select(this.sessions).execute({ ...params, session_id: this.SESSION_ID });
    }
}

export const remoteWorker = new PupperMaster();
