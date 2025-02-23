"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.twitterMaster = void 0;
const register_worker_1 = require("../../core/src/register-worker");
const twitter_api_v2_1 = require("twitter-api-v2");
const command_abstract_1 = require("../../core/src/command.abstract");
const publishTweet_1 = require("./commands/publishTweet");
class Start extends command_abstract_1.Command {
    constructor() {
        super(...arguments);
        this.command = 'start';
        this.schema = {
            type: 'object',
            properties: {
                sessions: { type: 'object' },
                session_id: { type: 'string' },
            },
            required: ['sessions'],
        };
        this.instruction = `
    # Start a new session
    This command starts a new session and returns a session id.
    `;
    }
    async execute(params) {
        const { sessions, session_id } = params;
        const newSessionId = session_id || Date.now().toString();
        sessions[newSessionId] = {};
        return { session_id: newSessionId };
    }
}
class Stop extends command_abstract_1.Command {
    constructor() {
        super(...arguments);
        this.command = 'stop';
        this.schema = {
            type: 'object',
            properties: {
                session_id: { type: 'string' },
            },
            required: ['session_id'],
        };
        this.instruction = `
    # Stop the session
    This command stops the current session.
    `;
    }
    async execute(_params) {
        // Implementation for stopping a session
        return { stopped: true };
    }
}
class TwitterMaster extends register_worker_1.RemoteWorker {
    constructor() {
        super({
            commandContext: `
            # Twitter API Guide
            This worker uses the Twitter API to publish posts to Twitter.
            `,
        });
        this.sessions = {};
        this.twitterClient = new twitter_api_v2_1.TwitterApi({
            // bearer_token: process.env.TWITTER_BEARER_TOKEN!
            appKey: process.env.TWITTER_APP_KEY,
            appSecret: process.env.TWITTER_APP_SECRET,
            accessToken: process.env.TWITTER_ACCESS_TOKEN,
            accessSecret: process.env.TWITTER_TOKEN_SECRET,
        });
        // Register command handlers
        this.registerCommand(new Start());
        this.registerCommand(new Stop());
        this.registerCommand(new publishTweet_1.PublishTweet(this.twitterClient));
    }
}
exports.twitterMaster = new TwitterMaster();
exports.twitterMaster.init();
