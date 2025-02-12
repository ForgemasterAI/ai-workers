import http from 'http';
import express from 'express';
import cors from 'cors';

import health from './routes/health';
import { RemoteWorker } from '../../core/src/register-worker';

const remoteWorker = new RemoteWorker({
    commandContext:`
        # Puppeteer Selectors Guide

        CSS Selectors: Puppeteer supports standard CSS selectors across its APIs.
        Non-CSS Selectors: These include custom pseudo-elements with a -p prefix:
        - XPath Selectors (-p-xpath): Use XPath expressions to query elements. example: '::-p-xpath(//h2)');

        - Text Selectors (-p-text): Select minimal elements containing specific text, even in shadow roots example: 'div ::-p-text(Checkout)'
        

    - ARIA Selectors (-p-aria): Find elements using accessible names and roles, resolving relationships in the accessibility tree. example '::-p-aria(Submit)'
    `            
});

const app = express();

const port = Number(process.env.PORT) || 9882;
const host = process.env.HOST || 'localhost';

app.use(cors());
app.use(express.json());

app.use('/health', health);

const server = http.createServer(app);

remoteWorker.init();

server.listen(port, host, () => {
    console.log(`Server running at http://${host}:${port}`);
});