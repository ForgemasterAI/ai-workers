"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExtractCleanHtml = exports.Select = exports.Type = exports.Navigate = exports.Click = exports.Stop = exports.Start = void 0;
const puppeteer_1 = require("puppeteer");
const cheerio = __importStar(require("cheerio"));
const command_abstract_1 = require("../../core/src/command.abstract");
const puppeteer_extra_plugin_adblocker_1 = __importDefault(require("puppeteer-extra-plugin-adblocker"));
const puppeteer_extra_plugin_stealth_1 = __importDefault(require("puppeteer-extra-plugin-stealth"));
const puppeteer_extra_1 = __importDefault(require("puppeteer-extra"));
class Start extends command_abstract_1.Command {
    constructor(sessions) {
        super();
        this.command = 'start';
        this.schema = {
            type: 'object',
            properties: {
                url: { type: 'string' },
                screen: { type: 'string', enum: ['desktop', 'mobile', 'iphone', 'ipad'] },
            },
            required: ['url'],
        };
        this.instruction = 'Navigates to the specified URL';
        this.expected_output = {
            type: 'object',
            properties: {
                session_id: { type: 'string' },
                url: { type: 'string' },
            },
        };
        this.sessions = sessions;
    }
    async execute(params) {
        const screen = params.screen ?? 'desktop';
        puppeteer_extra_1.default.use((0, puppeteer_extra_plugin_stealth_1.default)());
        puppeteer_extra_1.default.use((0, puppeteer_extra_plugin_adblocker_1.default)({
            // Optionally enable Cooperative Mode for several request interceptors
            interceptResolutionPriority: puppeteer_1.DEFAULT_INTERCEPT_RESOLUTION_PRIORITY,
        }));
        const browser = await puppeteer_extra_1.default.launch({
            headless: false,
        });
        const page = await browser.newPage();
        const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' + 'AppleWebKit/537.36 (KHTML, like Gecko) ' + 'Chrome/92.0.4515.107 Safari/537.36';
        await page.setUserAgent(userAgent);
        // Remove the navigator.webdriver flag
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });
        // set screen size
        switch (screen) {
            case 'desktop':
                await page.setViewport({ width: 1920, height: 1080 });
                break;
            case 'mobile':
                await page.setViewport({ width: 375, height: 812 });
                break;
            case 'iphone':
                await page.setViewport({ width: 375, height: 667 });
                break;
            case 'ipad':
                await page.setViewport({ width: 768, height: 1024 });
                break;
            default:
                await page.setViewport({ width: 1920, height: 1080 });
                break;
        }
        const session_id = params?.session_id ?? Math.random().toString(36).substring(7);
        this.sessions[session_id] = { browser, page };
        return {
            screen,
            session_id,
        };
    }
}
exports.Start = Start;
class Stop extends command_abstract_1.Command {
    constructor(sessions) {
        super();
        this.command = 'stop';
        this.schema = {
            type: 'object',
            properties: {
                session_id: { type: 'string' },
            },
            required: ['session_id'],
        };
        this.instruction = 'Stops the browser session';
        this.sessions = sessions;
    }
    async execute({ session_id }) {
        // close page
        if (this.sessions[session_id]?.page) {
            await new ExtractCleanHtml(this.sessions).execute({ selector: 'html', session_id });
            await this.sessions[session_id]?.page?.close();
            this.sessions[session_id].page = undefined;
        }
        return {
            stopped: true,
        };
    }
}
exports.Stop = Stop;
class Click extends command_abstract_1.Command {
    constructor(sessions) {
        super();
        this.command = 'click';
        this.schema = {
            type: 'object',
            properties: {
                selector: { type: 'string' },
            },
            required: ['selector'],
        };
        this.instruction = 'Clicks on the specified element';
        this.expected_output = {
            type: 'boolean',
            description: 'True if the element was clicked, false otherwise',
        };
        this.sessions = sessions;
    }
    async execute({ selector, session_id }) {
        const page = this.sessions[session_id].page;
        const previousUrl = page.url();
        await page.click(selector, { waitUntil: ['domcontentloaded', 'networkidle2'] });
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const currentUrl = page.url();
        let progress_data_state = undefined;
        const url_change = previousUrl !== currentUrl
            ? {
                from: previousUrl,
                to: currentUrl,
            }
            : undefined;
        if (url_change) {
            progress_data_state = await new ExtractCleanHtml(this.sessions).execute({ selector: 'html', session_id });
            console.log('HTML:', progress_data_state);
        }
        return {
            clicked: true,
            selector,
            ...(url_change && { url_change }),
            ...(progress_data_state && { progress_data_state }),
        };
    }
}
exports.Click = Click;
class Navigate extends command_abstract_1.Command {
    constructor(sessions) {
        super();
        this.command = 'navigate';
        this.schema = {
            type: 'object',
            properties: {
                session_id: { type: 'string' },
                url: { type: 'string' },
            },
            required: ['session_id', 'url'],
        };
        this.instruction = 'Navigates to the specified URL';
        this.expected_output = {
            type: 'string',
            description: 'The URL the browser navigated to',
        };
        this.sessions = sessions;
    }
    async execute(params) {
        if (!this.sessions?.[params.session_id]?.page || !this.sessions?.[params.session_id]) {
            // start sessions
            await new Start(this.sessions).execute({
                session_id: params.session_id,
            });
            console.log('Session started');
        }
        const page = this.sessions[params.session_id].page;
        await page.goto(params.url, { waitUntil: ['domcontentloaded', 'networkidle2'] });
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const { progress_data_state, screenshot: _screenshot } = await new ExtractCleanHtml(this.sessions).execute({
            selector: 'html',
            session_id: params.session_id,
        });
        console.info('HTML:', progress_data_state);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return {
            url: page.url(),
            progress_data_state,
        };
    }
}
exports.Navigate = Navigate;
class Type extends command_abstract_1.Command {
    constructor(sessions) {
        super();
        this.command = 'type';
        this.schema = {
            type: 'object',
            properties: {
                selector: { type: 'string' },
                text: { type: 'string' },
            },
            required: ['selector', 'text'],
        };
        this.instruction = 'Types the specified text into the specified element';
        this.expected_output = {
            type: 'boolean',
            description: 'True if the text was typed, false otherwise',
        };
        this.sessions = sessions;
    }
    async execute(params) {
        const page = this.sessions[params.session_id].page;
        const randomDelay = () => Math.floor(Math.random() * 150) + 100;
        const text = params.text;
        await page.focus(params.selector);
        // clean input before typing
        await page.$eval(params.selector, (el) => (el.value = ''));
        // type
        await page.type(params.selector, text, { delay: randomDelay() });
        // make screenshot after typing
        return {
            typed: params.text,
        };
    }
}
exports.Type = Type;
class Select extends command_abstract_1.Command {
    constructor(sessions) {
        super();
        this.command = 'select';
        this.schema = {
            type: 'object',
            properties: {
                selector: { type: 'string' },
                value: { type: 'string' },
            },
            required: ['selector', 'value'],
        };
        this.instruction = 'Selects the specified value from the specified dropdown';
        this.expected_output = {
            type: 'boolean',
            description: 'True if the value was selected, false otherwise',
        };
        this.sessions = sessions;
    }
    async execute(params) {
        const page = this.sessions[params.session_id].page;
        await page.select(params.selector, params.value);
        return {
            selected: params.value,
        };
    }
}
exports.Select = Select;
class ExtractCleanHtml extends command_abstract_1.Command {
    constructor(sessions) {
        super();
        this.command = 'extractCleanHtml';
        this.schema = {};
        this.instruction = 'Extracts the clean HTML content of the page';
        this.expected_output = {
            type: 'string',
            description: 'The clean HTML content of the element',
        };
        this.sessions = sessions;
    }
    async execute(params) {
        const page = this.sessions[params.session_id].page;
        const html = await page.content();
        const $ = cheerio.load(html);
        $('img[src^="data:image/"]').remove();
        $('svg').remove();
        $('script').remove();
        $('head').remove();
        $('[style]').removeAttr('style');
        $('[jsdata]').remove();
        // Remove all <style> tags
        $('style').remove();
        // Remove class attributes from all elements
        $('*[class]').removeAttr('class');
        const screenshot = await page.screenshot({ encoding: 'base64' });
        return {
            progress_data_state: $.html().toString(),
            screenshot,
        };
    }
}
exports.ExtractCleanHtml = ExtractCleanHtml;
exports.default = {
    Start,
    Stop,
    Click,
    Type,
    Navigate,
    Select,
    ExtractCleanHtml,
};
