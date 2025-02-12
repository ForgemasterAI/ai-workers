import http from 'http';
import express from 'express';
import cors from 'cors';

import health from './routes/health';
import { remoteWorker } from '@forgemaster-workers/core/src/examples/puppetmaster';

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