import { Command } from '../../../core/src/command.abstract';
import { TwitterApi } from 'twitter-api-v2';
import axios from 'axios';

export class PublishTweet extends Command {
    command = 'publishTweet';
    schema = {
        type: 'object',
        properties: {
            text: { type: 'string' },
            mediaUrls: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        url: { type: 'string' },
                        type: { type: 'string', enum: ['image', 'video', 'gif'] },
                    },
                    required: ['url', 'type'],
                },
            },
        },
        required: ['text'],
    };
    instruction = `
    # Publish a tweet
    This command publishes a tweet to Twitter.
    `;

    private twitterClient: TwitterApi;

    constructor(twitterClient: TwitterApi) {
        super();
        this.twitterClient = twitterClient;
    }

    private getMimeType(mediaType: 'image' | 'video' | 'gif'): string {
        switch (mediaType) {
            case 'image':
                return 'image/jpeg';
            case 'video':
                return 'video/mp4';
            case 'gif':
                return 'image/gif';
            default:
                throw new Error('Unsupported media type');
        }
    }

    async execute(params: { text: string; mediaUrls?: { url: string; type: 'image' | 'video' | 'gif' }[] }): Promise<unknown> {
        const { text, mediaUrls } = params;
        let mediaIds: string[] = [];
        let tweet: unknown;
        if (!text) {
            throw new Error('Text is required to publish a tweet');
        }
        if (mediaUrls && mediaUrls.length > 4) {
            throw new Error('You can only upload 4 media files per tweet');
        }
        if (mediaUrls && mediaUrls.length > 0) {
            mediaIds = await Promise.all(
                mediaUrls.map(async (media: { url: string; type: 'image' | 'video' | 'gif' }) => {
                    const response = await axios.get(media.url, { responseType: 'arraybuffer' });
                    const mediaData = Buffer.from(response.data, 'binary');
                    const options: { mimeType: string; longVideo?: boolean } = { mimeType: this.getMimeType(media.type) };
                    if (media.type === 'video') {
                        options.longVideo = true;
                    }
                    return await this.twitterClient.v1.uploadMedia(mediaData, options);
                }),
            );
        }
        if (mediaIds.length > 4) {
            throw new Error('You can only upload 4 media files per tweet');
        }
        if (mediaIds.length > 0 && mediaIds.length <= 4) {
            tweet = await this.twitterClient.v2.tweet(text, { media: { media_ids: mediaIds as any } });
        } else {
            tweet = await this.twitterClient.v2.tweet(text);
        }
        if (!tweet) {
            throw new Error('Failed to publish tweet');
        }
        return tweet;
    }
}
