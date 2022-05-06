const express = require("express");
const server = require("http").createServer();
const WSServer = require("ws").Server;
const { createDownloadDirectory, CLIENTS, getUniqueID } = require("./utils/helpers");

const app = express();
const port = process.env.PORT || 4000;

createDownloadDirectory();

app.use(express.static("public"));
app.use(express.json());

app.use((_, res, next) => {
  res.set('Access-Control-Allow-Origin', 'http://localhost:3000');
  // res.set('Access-Control-Allow-Origin', 'https://shirokatake.github.io');
  res.set('Access-Control-Allow-Methods', 'GET');
  res.set('Access-Control-Allow-Headers', '*');
  next();
});

server.on("request", app);
server.listen(port, () => console.log(`Server is running on port ${port}`));

const wss = new WSServer({ server: server, clientTracking: true });
wss.on("connection", ws => {
  ws.id = getUniqueID();
  CLIENTS[ws.id] = ws;
  ws.send(ws.id);
});

const suggestions = require("./routes/suggestions");
const metainfo = require("./routes/metainfo");
const playlist = require("./routes/playlist");
const download = require("./routes/download");

app.use(suggestions);
app.use(metainfo);
app.use(playlist);
app.use(download);

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