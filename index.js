import http from "http";
import { WebSocketServer } from "ws";
import express, { json } from "express";
import { createDownloadDirectory } from "./utils/helpers.js";

// routing
import suggestions from "./routes/suggestions.js";
import metainfo from "./routes/metainfo.js";
import playlist from "./routes/playlist.js";
import download from "./routes/download.js";

// server setup
const server = http.createServer();
const app = express();
const port = process.env.PORT || 4000;

createDownloadDirectory();

app.use(express.static("public"));
app.use(json());
app.use((req, res, next) => {
  const allowedOrigins = [
    // "http://localhost:3000", 
    "https://shirokatake.github.io",
    "https://shirokatake-ytdl-frontend-test.herokuapp.com"
  ];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.set("Access-Control-Allow-Methods", "GET");
  res.set("Access-Control-Allow-Headers", "*");
  next();
});

app.use(suggestions);
app.use(metainfo);
app.use(playlist);

const wss = new WebSocketServer({ server: server, clientTracking: true });
wss.on("connection", ws => {
  ws.on("message", (data) => {
    download(JSON.parse(data), ws);
  });
});

server.on("request", app);
server.listen(port, () => console.log(`Server is running on port ${port}`));