const cors = require("cors");
const express = require("express");
const server = require("http").createServer();
const WSServer = require("ws").Server;
const { createDownloadDirectory, CLIENTS, getUniqueID } = require("./utils/helpers");

const app = express();
const port = process.env.PORT || 4000;

createDownloadDirectory();

app.use(express.static("public"));
app.use(express.json());

app.use(cors({ exposedHeaders: ["Content-Disposition"] }));
app.use((_, res, next) => {
  res.header("Cross-Origin-Opener-Policy", "same-origin");
  res.header("Cross-Origin-Embedder-Policy", "require-corp");
  res.header("Access-Control-Allow-Origin", "https://shirokatake.github.io");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
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
