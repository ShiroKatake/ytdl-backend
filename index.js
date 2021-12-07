const contentDisposition = require("content-disposition");
const cors = require("cors");
const cp = require("child_process");
const express = require("express");
const ffmpeg = require("ffmpeg-static");
const fs = require("fs");
const server = require("http").createServer();
const WSServer = require("ws").Server;
const ytdl = require("ytdl-core");
const { audioEncodeConfig, encodeOptions, videoEncodeConfig } = require("./utils/ffmpeg");
const { getUniqueID, createDownloadDirectory, generateDownloadPath } = require("./utils/helpers");

const suggestionsRoute = require("./routes/suggestions");
const metainfo = require("./routes/metainfo");
const playlist = require("./routes/playlist");

const CLIENTS = [];

const app = express();
const port = process.env.PORT || 4000;

createDownloadDirectory();

app.use(express.static("public"));
app.use(express.json());

app.use(cors({ exposedHeaders: ["Content-Disposition"] }));
app.use((_, res, next) => {
  res.header("Cross-Origin-Opener-Policy", "same-origin");
  res.header("Cross-Origin-Embedder-Policy", "require-corp");
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

app.use(suggestionsRoute);
app.use(metainfo);
app.use(playlist);

app.post("/download", async (req, res) => {
  const { v: url, format: format } = req.query;
  if (!ytdl.validateID(url) && !ytdl.validateURL(url)) {
    return res.status(400).json({ success: false, error: "Not a valid YouTube Id!" });
  }

  const tracker = {
    audio: { downloaded: 0, total: 0 },
    video: { downloaded: 0, total: 0 },
  };

  try {
    const outputName = `${Date.now()}_${getUniqueID()}.${format}`;
    const outputPath = generateDownloadPath(outputName);
    res.setHeader("Content-disposition", contentDisposition(`${outputName}`));

    let ffmpegProcess;

    if (format == "mp3") {
      // Download stream
      const audio = ytdl(url, { quality: "highestaudio" }).on("progress", (_, downloaded, total) => {
        tracker.audio = { downloaded, total };
      });

      // Start the ffmpeg child process
      audioEncodeConfig.push(outputPath);
      ffmpegProcess = cp.spawn(ffmpeg, audioEncodeConfig, encodeOptions);

      // Pipe downloaded streams into ffmpeg
      audio.pipe(ffmpegProcess.stdio[4]);
    }

    if (format == "mp4") {
      // Download stream
      const audio = ytdl(url, { quality: "highestaudio" }).on("progress", (_, downloaded, total) => {
        tracker.audio = { downloaded, total };
      });
      const video = ytdl(url, { quality: "highestvideo" }).on("progress", (_, downloaded, total) => {
        tracker.video = { downloaded, total };
      });

      // Start the ffmpeg child process
      videoEncodeConfig.push(outputPath);
      ffmpegProcess = cp.spawn(ffmpeg, videoEncodeConfig, encodeOptions);

      // Pipe downloaded streams into ffmpeg
      audio.pipe(ffmpegProcess.stdio[4]);
      video.pipe(ffmpegProcess.stdio[5]);
    }

    ffmpegProcess.stdio[3].on("data", () => {
      CLIENTS[req.body.uid].send(
        JSON.stringify({
          downloaded: tracker.audio.downloaded + tracker.video.downloaded,
          total: tracker.audio.total + tracker.video.total,
        })
      );
    });

    ffmpegProcess.on("close", async () => {
      res.download(outputPath, outputName, async err => {
        if (err) throw err;
        fs.unlinkSync(outputPath);
        res.end();
        //console.log("done");
      });
    });
  } catch (err) {
    console.log("error ", err);
    res.redirect(`http://${req.headers.host}?error=downloadError`);
  }
});
