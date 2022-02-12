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

app.all('*', function (req, res, next) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', '*');
  res.set('Access-Control-Allow-Headers', '*');

  if (req.method == 'OPTIONS') return res.send(200);

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
