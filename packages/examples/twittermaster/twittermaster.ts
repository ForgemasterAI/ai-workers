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
    
    private getMimeType(mediaType: 'image' | 'video' | 'gif'): string {
        switch (mediaType) {
            case 'image':
                return 'image/jpeg'; // adjust if needed
            case 'video':
                return 'video/mp4';
            case 'gif':
                return 'image/gif';
            default:
                throw new Error('Unsupported media type');
        }
    }




    async publishTweet(params: { text: string, mediaUrls?: { url: string, type: 'image' | 'video' | 'gif' }[] }) {
        const { text, mediaUrls } = params;
        let mediaIds: any[] = [];
        let tweet;
        assert.ok(text, 'Text is required to publish a tweet');
        debugger
        if (mediaUrls && mediaUrls.length > 0) {
            mediaIds = await Promise.all(mediaUrls.map(async (media) => {
                const response = await axios.get(media.url, { responseType: 'arraybuffer' });
                const mediaData = Buffer.from(response.data, 'binary');
                const options: any = { mimeType: this.getMimeType(media.type) };
                if(media.type === 'video') {
                    options.longVideo = true;
                }
                debugger
                const mediaId = await this.twitterClient.v1.uploadMedia(mediaData, options);
                return mediaId;
            }));
        }
        if(mediaIds.length > 4) {
            throw new Error('You can only upload 4 media files per tweet');
        }
        if(mediaIds.length > 0) {
            tweet = await this.twitterClient.v2.tweet(text, {
                media: {
                    media_ids: mediaIds as [string]
                }
            });
            
        }else{
            tweet = await this.twitterClient.v2.tweet(text);
        }

        return tweet;
    }
}

export const twitterMaster = new TwitterMaster();

// run the worker
twitterMaster.init();