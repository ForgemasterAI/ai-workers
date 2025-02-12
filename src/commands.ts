import  { Browser, Page, DEFAULT_INTERCEPT_RESOLUTION_PRIORITY } from 'puppeteer';
import * as cheerio from 'cheerio';
import { Command } from './core/command.abstract';
import AdBlockPlugin from 'puppeteer-extra-plugin-adblocker';
import StealthPlugin  from 'puppeteer-extra-plugin-stealth';
import puppeteer from 'puppeteer-extra';

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function pageScreenShotToBase64(page: Page) {
    const screenshot = await page.screenshot({ encoding: 'base64' });
    return screenshot;
}

export class Start extends Command {
    sessions: Record<string, any>;
    constructor(sessions: Record<string, any>) {
        super();
        this.sessions = sessions;
    }
    command = 'start';
    schema = {
        type: 'object',
        properties: {
            url: { type: 'string' },
            screen: { type: 'string', enum: ['desktop', 'mobile', 'iphone', 'ipad'] }
        },
        required: ['url']
    };
    instruction = 'Navigates to the specified URL';
    expected_output = {
        type: 'object',
        properties: {
            session_id: { type: 'string' },
            url: { type: 'string' }
        }
    };

    async execute(params: any): Promise<Record<string, any>> {
        let screen = params.screen ?? 'desktop';
        puppeteer.use(StealthPlugin())
        puppeteer.use(
            AdBlockPlugin({
              // Optionally enable Cooperative Mode for several request interceptors
              interceptResolutionPriority: DEFAULT_INTERCEPT_RESOLUTION_PRIORITY
            })
          )
          
        const browser = await puppeteer.launch({
            headless: false
        });

        const page = await browser.newPage();
  
        const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
        'AppleWebKit/537.36 (KHTML, like Gecko) ' +
        'Chrome/92.0.4515.107 Safari/537.36';
        await page.setUserAgent(userAgent);

        // Remove the navigator.webdriver flag
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });
        // set screen size
        switch(screen) {
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
    
        const session_id = params?.session_id ??  Math.random().toString(36).substring(7);
        
        this.sessions[session_id] = { browser, page };
        

        return {
            screen,
            session_id
         };
    }
}

export class Stop extends Command {
    sessions: Record<string, any>;
    constructor(sessions: Record<string, any>) {
        super();
        this.sessions = sessions;
    }
    command = 'stop';
    schema = {
        type: 'object',
        properties: {
            session_id: { type: 'string' }
        },
        required: ['session_id']
    };
    instruction = 'Stops the browser session';

    async execute({session_id}): Promise<any> {
        // close page
        const   progress_data_state = await new ExtractCleanHtml(this.sessions).execute({ selector: 'html', session_id });
        await this.sessions[session_id]?.page?.close();
        
        this.sessions[session_id].page = undefined

        return {
            stopped: true
        };
    }
}

export class Click extends Command {
    sessions: Record<string, any>;
    constructor(sessions: Record<string, any>) {
        super();
        this.sessions = sessions;
    }
    command = 'click';
    schema = {
        type: 'object',
        properties: {
            selector: { type: 'string' }
        },
        required: ['selector']
    };
    instruction = 'Clicks on the specified element';
    expected_output = {
        type: 'boolean',
        description: 'True if the element was clicked, false otherwise'
    };

    async execute({selector, session_id}: any): Promise<Record<string, any>> {
        const page = this.sessions[session_id].page;
        const previousUrl = page.url();
        await page.click(selector,  { waitUntil: ['domcontentloaded', 'networkidle2'] });
        await new Promise(resolve => setTimeout(resolve, 1000));
        const currentUrl = page.url();
        let progress_data_state = undefined;


        const url_change = previousUrl !== currentUrl ? {
            from: previousUrl,
            to: currentUrl
        } : undefined;

        if(url_change) {
            progress_data_state = await new ExtractCleanHtml(this.sessions).execute({ selector: 'html', session_id });
            console.log('HTML:', progress_data_state);
        }
        
        return {
            clicked: true,
            selector,
            ...(url_change && { url_change }),
            ...(progress_data_state && { progress_data_state })
        };
    }
}

export class Navigate extends Command {
    sessions: Record<string, any>;
    constructor(sessions: Record<string, any>) {
        super();
        this.sessions = sessions;
    }
    command = 'navigate';
    schema = {
        type: 'object',
        properties: {
            session_id: { type: 'string' },
            url: { type: 'string' }
        },
        required: ['session_id', 'url']
    };
    instruction = 'Navigates to the specified URL';
    expected_output = {
        type: 'string',
        description: 'The URL the browser navigated to'
    };

    async execute(params: any): Promise<Record<string, any>>{
        
        if(!this.sessions?.[params.session_id]?.page || !this.sessions?.[params.session_id]) {
            // start sessions
            await new Start(this.sessions).execute({
                session_id: params.session_id,
            });
            console.log('Session started');
        }
        
        const page = this.sessions[params.session_id].page;
        await page.goto(params.url, { waitUntil: ['domcontentloaded', 'networkidle2'] } );
        await new Promise(resolve => setTimeout(resolve, 1000));
        const {progress_data_state, screenshot} = await new ExtractCleanHtml(this.sessions).execute({ selector: 'html', session_id: params.session_id });
        console.info('HTML:', progress_data_state);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return {
            url: page.url(),
            progress_data_state,
        }
    }
}

export class Type extends Command {
    sessions: Record<string, any>;
    constructor(sessions: Record<string, any>) {
        super();
        this.sessions = sessions;
    }
    command = 'type';
    schema = {
        type: 'object',
        properties: {
            selector: { type: 'string' },
            text: { type: 'string' }
        },
        required: ['selector', 'text']
    };
    instruction = 'Types the specified text into the specified element';
    expected_output = {
        type: 'boolean',
        description: 'True if the text was typed, false otherwise'
    };

    async execute(params: any): Promise<Record<string, any>>{
        
        const page = this.sessions[params.session_id].page;
        const randomDelay = () => Math.floor(Math.random() * 150) + 100;
        const text = params.text;
        await page.focus(params.selector);
        // clean input before typing
        await page.$eval(params.selector, (el: any) => el.value = '');
        // type 
        await page.type(params.selector, text, { delay: randomDelay() });
        // make screenshot after typing
        return {
            typed: params.text,
        };
    }
}

export class Select extends Command {
    sessions: Record<string, any>;
    constructor(sessions: Record<string, any>) {
        super();
        this.sessions = sessions;
    }
    command = 'select';
    schema = {
        type: 'object',
        properties: {
            selector: { type: 'string' },
            value: { type: 'string' }
        },
        required: ['selector', 'value']
    };
    instruction = 'Selects the specified value from the specified dropdown';
    expected_output = {
        type: 'boolean',
        description: 'True if the value was selected, false otherwise'
    };

    async execute(params: any): Promise<any> {
        const page = this.sessions[params.session_id].page;
        await page.select(params.selector, params.value);
        return {
            selected: params.value
        };
    }
}

export class ExtractCleanHtml extends Command {
    command = 'extractCleanHtml';
    schema = {};
    instruction = 'Extracts the clean HTML content of the page';
    expected_output = {
        type: 'string',
        description: 'The clean HTML content of the element'
    };
    sessions: Record<string, any>;

    constructor(sessions: Record<string, any>) {
        super();
        this.sessions = sessions;
    }

    async execute(params: any): Promise<Record<string, any>>{
        const page = this.sessions[params.session_id].page
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


export default {
    Start,
    Stop,
    Click,
    Type,
    Navigate,
    Select,
    ExtractCleanHtml
}