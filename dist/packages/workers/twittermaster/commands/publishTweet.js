"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublishTweet = void 0;
const command_abstract_1 = require("../../../core/src/command.abstract");
const axios_1 = __importDefault(require("axios"));
class PublishTweet extends command_abstract_1.Command {
    constructor(twitterClient) {
        super();
        this.command = 'publishTweet';
        this.schema = {
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
        this.instruction = `
    # Publish a tweet
    This command publishes a tweet to Twitter.
    `;
        this.twitterClient = twitterClient;
    }
    getMimeType(mediaType) {
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
    async execute(params) {
        const { text, mediaUrls } = params;
        let mediaIds = [];
        let tweet;
        if (!text) {
            throw new Error('Text is required to publish a tweet');
        }
        if (mediaUrls && mediaUrls.length > 4) {
            throw new Error('You can only upload 4 media files per tweet');
        }
        if (mediaUrls && mediaUrls.length > 0) {
            mediaIds = await Promise.all(mediaUrls.map(async (media) => {
                const response = await axios_1.default.get(media.url, { responseType: 'arraybuffer' });
                const mediaData = Buffer.from(response.data, 'binary');
                const options = { mimeType: this.getMimeType(media.type) };
                if (media.type === 'video') {
                    options.longVideo = true;
                }
                return await this.twitterClient.v1.uploadMedia(mediaData, options);
            }));
        }
        if (mediaIds.length > 4) {
            throw new Error('You can only upload 4 media files per tweet');
        }
        if (mediaIds.length > 0 && mediaIds.length <= 4) {
            tweet = await this.twitterClient.v2.tweet(text, { media: { media_ids: mediaIds } });
        }
        else {
            tweet = await this.twitterClient.v2.tweet(text);
        }
        if (!tweet) {
            throw new Error('Failed to publish tweet');
        }
        return tweet;
    }
}
exports.PublishTweet = PublishTweet;
