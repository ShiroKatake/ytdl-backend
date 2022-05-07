import express, { json } from "express";
import http from "http";
import { WebSocketServer } from "ws";
import { createDownloadDirectory, CLIENTS, getUniqueID } from "./utils/helpers.js";

// server setup
const server = http.createServer();

const app = express();
const port = process.env.PORT || 4000;

createDownloadDirectory();

app.use(express.static("public"));
app.use(json());

app.use((_, res, next) => {
  res.set('Access-Control-Allow-Origin', 'http://localhost:3000');
  // res.set('Access-Control-Allow-Origin', 'https://shirokatake.github.io');
  res.set('Access-Control-Allow-Methods', 'GET');
  res.set('Access-Control-Allow-Headers', '*');
  next();
});

const wss = new WebSocketServer({ server: server, clientTracking: true });
wss.on("connection", ws => {
  ws.id = getUniqueID();
  CLIENTS[ws.id] = ws;
  ws.send(ws.id);
});
wss.on("close", ws => {
  console.log("closed");
});

// routing
import suggestions from "./routes/suggestions.js";
import metainfo from "./routes/metainfo.js";
import playlist from "./routes/playlist.js";
import download from "./routes/download.js";

app.use(suggestions);
app.use(metainfo);
app.use(playlist);
app.use(download);

// worker test
import Queue from 'bull';
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const workQueue = new Queue('work', REDIS_URL);

app.post('/job', async (_, res) => {
  const job = await workQueue.add();
  res.json({ id: job.id });
});

app.get('/job/:id', async (req, res) => {
  let id = req.params.id;
  let job = await workQueue.getJob(id);

  if (job === null) {
    res.status(404).end();
  } else {
    let state = await job.getState();
    let progress = job._progress;
    let reason = job.failedReason;
    res.json({ id, state, progress, reason });
  }
});

workQueue.on('global:completed', (jobId, result) => {
  console.log(`Job ${jobId} completed with result ${result}`);
});

server.on("request", app);
server.listen(port, () => console.log(`Server is running on port ${port}`));