"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PupperMaster = void 0;
const register_worker_1 = require("../../../core/src/register-worker");
const commands_1 = require("./commands");
class PupperMaster extends register_worker_1.RemoteWorker {
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
    async start(params) {
        const { session_id } = await new commands_1.Start({
            sessions: this.sessions,
            ...(this.SESSION_ID ? { session_id: this.SESSION_ID } : {}),
        }).execute(params);
        this.setSessionId(session_id);
        return session_id;
    }
    async stop(params) {
        const result = await new commands_1.Stop(this.sessions).execute({ ...params, session_id: this.SESSION_ID });
        // reset the session id
        delete this.SESSION_ID;
        delete this.sessions[params.session_id];
        return result;
    }
    async click(params) {
        return new commands_1.Click(this.sessions).execute({ ...params, session_id: this.SESSION_ID });
    }
    async type(params) {
        return new commands_1.Type(this.sessions).execute({ ...params, session_id: this.SESSION_ID });
    }
    async extractCleanHtml(params) {
        return new commands_1.ExtractCleanHtml(this.sessions).execute({ ...params, session_id: this.SESSION_ID });
    }
    async navigate(params) {
        return new commands_1.Navigate(this.sessions).execute({ ...params, session_id: this.SESSION_ID });
    }
    async select(params) {
        return new commands_1.Select(this.sessions).execute({ ...params, session_id: this.SESSION_ID });
    }
}
exports.PupperMaster = PupperMaster;
