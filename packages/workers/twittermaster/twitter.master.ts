import { RemoteWorker } from '../../core/src/register-worker';
import { TwitterApi } from 'twitter-api-v2';
import { Command } from '../../core/src/command.abstract';
import { PublishTweet } from './commands/publishTweet';

class Start extends Command {
    command = 'start';
    schema = {
        type: 'object',
        properties: {
            sessions: { type: 'object' },
            session_id: { type: 'string' },
        },
        required: ['sessions'],
    };
    instruction = `
    # Start a new session
    This command starts a new session and returns a session id.
    `;
    async execute(params: any): Promise<Record<string, any>> {
        const { sessions, session_id } = params;
        const newSessionId = session_id || Date.now().toString();
        sessions[newSessionId] = {};
        return { session_id: newSessionId };
    }
}

class Stop extends Command {
    command = 'stop';
    schema = {
        type: 'object',
        properties: {
            session_id: { type: 'string' },
        },
        required: ['session_id'],
    };
    instruction = `
    # Stop the session
    This command stops the current session.
    `;
    async execute(params: any): Promise<any> {
        // Implementation for stopping a session
        return { stopped: true };
    }
}

class TwitterMaster extends RemoteWorker {
    sessions: Record<string, any>;
    twitterClient: TwitterApi;

    constructor() {
        super({
            commandContext: `
            # Twitter API Guide
            This worker uses the Twitter API to publish posts to Twitter.
            `,
        });
        this.sessions = {};
        this.twitterClient = new TwitterApi({
            // bearer_token: process.env.TWITTER_BEARER_TOKEN!
            appKey: process.env.TWITTER_APP_KEY!,
            appSecret: process.env.TWITTER_APP_SECRET!,
            accessToken: process.env.TWITTER_ACCESS_TOKEN!,
            accessSecret: process.env.TWITTER_TOKEN_SECRET!,
        });
        // Register command handlers
        this.registerCommand(new Start());
        this.registerCommand(new Stop());
        this.registerCommand(new PublishTweet(this.twitterClient));
    }
}

export const twitterMaster = new TwitterMaster();

twitterMaster.init();
