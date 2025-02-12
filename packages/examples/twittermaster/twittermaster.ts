import { RemoteWorker } from '../../core/src/register-worker';
import { TwitterApi } from 'twitter-api-v2';
import axios from 'axios';
import assert from 'assert';
import { Command } from '../../core/src/command.abstract';

class Start extends Command{
    command = 'start';
    schema = {
        type: 'object',
        properties: {
            sessions: {
                type: 'object'
            },
            session_id: {
                type: 'string'
            }
        },
        required: ['sessions']
    }
    instruction = `
    # Start a new session
    This command starts a new session and returns a session id.
    `;
    async execute(params: any) {
        const { sessions, session_id } = params;
        const newSessionId = session_id || Date.now().toString();
        sessions[newSessionId] = {};
        return {
            session_id: newSessionId
        };
    }
}

class TwitterMaster extends RemoteWorker {
    sessions: Record<string, any>;
    twitterClient: TwitterApi;

    constructor() {
        super({
            commandContext:`
            # Twitter API Guide
                This worker uses the Twitter API to publish posts to Twitter.
            `
        });
        this.sessions = {};
        this.twitterClient = new TwitterApi({
            appKey: process.env.TWITTER_APP_KEY!,
            appSecret: process.env.TWITTER_APP_SECRET!,
            accessToken: process.env.TWITTER_ACCESS_TOKEN!,
            accessSecret: process.env.TWITTER_TOKEN_SECRET!
        });
        
    }

    async start(params: any) {
        const { session_id } = await new Start().execute({
            sessions: this.sessions,
            ...(this.SESSION_ID ? { session_id: this.SESSION_ID } : {})
        });
      
        this.setSessionId(session_id);
        return session_id;
    }
    

    async stop(params: any) {
      // reset the session id
      delete this.SESSION_ID;
      delete this.sessions[params.session_id];

      return {
         stopped: true
      };
    }


    async uploadMedia(params: { mediaUrl: string, mediaType: 'image' | 'video' | 'gif' }) {
        const { mediaUrl, mediaType } = params;
        const response = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
        const mediaData = Buffer.from(response.data, 'binary');
        const mediaId = await this.twitterClient.v1.uploadMedia(mediaData, { type: mediaType });
        return mediaId;
    }

    async publishTweet(params: { text: string, mediaUrls?: { url: string, type: 'image' | 'video' | 'gif' }[] }) {
        const { text, mediaUrls } = params;
        let mediaIds: string[] = [];
        let tweet;
        assert.ok(text, 'Text is required to publish a tweet');
        if (mediaUrls && mediaUrls.length > 0) {
            mediaIds = await Promise.all(mediaUrls.map(async (media) => {
                const response = await axios.get(media.url, { responseType: 'arraybuffer' });
                const mediaData = Buffer.from(response.data, 'binary');
                const mediaId = await this.twitterClient.v1.uploadMedia(mediaData, { type: media.type });
                return mediaId;
            }));
        }
        if(mediaIds.length > 4) {
            throw new Error('You can only upload 4 media files per tweet');
        }
        if(mediaIds.length > 0) {
            tweet = await this.twitterClient.v1.tweet(text, { media_ids: mediaIds.join(',') });
            
        }else{
            tweet = await this.twitterClient.v1.tweet(text);
        }

        return tweet;
    }
}

export const twitterMaster = new TwitterMaster();

// run the worker
twitterMaster.init();