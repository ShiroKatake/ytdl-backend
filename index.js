const contentDisposition = require("content-disposition");
const cors = require("cors");
const cp = require("child_process");
const express = require("express");
const ffmpeg = require("ffmpeg-static");
const fs = require("fs");
const options = {
  key: fs.readFileSync("./localhost-key.pem"),
  cert: fs.readFileSync("./localhost.pem"),
};
const server = require("https").createServer(options);
const WSServer = require("ws").Server;
const ytdl = require("ytdl-core");
const ytsr = require("ytsr");
const ytpl = require("ytpl");

const CLIENTS = [];

const app = express();
const port = process.env.PORT || 4000;

const wss = new WSServer({ server: server, clientTracking: true });

const reqOptions = {
  requestOptions: {
    headers: {
      Cookie:
        "CONSENT=YES+DE.de+V14+BX; VISITOR_INFO1_LIVE=kYpNG7OoCbY; PREF=al=de&f4=4000000; SID=3geAZGdQt9hIJxt0ST2xySpK_6yaw0kvNarw6v9JTDpZQoKQ5FK1nYqc3dXGQzpM4GRWbA.; __Secure-3PSID=3geAZGdQt9hIJxt0ST2xySpK_6yaw0kvNarw6v9JTDpZQoKQ_zINvfbB7jPNTk2I3oTLYg.; HSID=ApvJR6aSSMIpzAioX; SSID=A4qjlas1kBmX90vX0; APISID=uKTdp7kEoR-Th5wk/Ajvd4cTFRNTvsnnPY; SAPISID=h6Tyds3npH_icpOT/Ae34WsO4j7jVpaLFp; __Secure-3PAPISID=h6Tyds3npH_icpOT/Ae34WsO4j7jVpaLFp; LOGIN_INFO=AFmmF2swRQIhAOZ3RDhhitXMYTD-meEWipRIFho5YaO05aGgteYU2w9SAiA-OKgaB64v_a2AWsOfiJk1JJW6miXXu64EibIGjReNdg:QUQ3MjNmeGs2UTRLWDVYNDNnUVNGRFQ0bThEeGl0ZVpJd2haQldweWpJbFNLTEMtNlJHRmJGTlE2SDc3Rkdyb282elprUllkQnRqc0RJYnNiUzhYNnJ3MENBYjNkcmo2dnFqTFNtMDJCTTJBdV9MMlNvYmdiS2xaOFZvUjFsTk5OX0xFZGQ2M2x1SFZKbEZFSFJ1Z3RXeUxfXzNGZmxsZTdkV3dFWFBOUElMN1B0T0pKemw2aU1F; YSC=hgmjViK_jxo; SIDCC=AJi4QfHbV2YQFgcCjOAOdQG0JWvpGtoxBGtAhNp3rJyU223hoL_CV6Aj3BrLOiQYlZEgVrCwg1I; __Secure-3PSIDCC=AJi4QfGrxA6SlqFGd46AK01jAKdxmwFHWC9u4uFW1t4dnB3lhPCZ-3Gr-Bv2E5LK55HMANtVMQ",
    },
  },
};

const dir = "public";
const subDir = "uploads";

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
}
if (!fs.existsSync(`${dir}/${subDir}`)) {
  fs.mkdirSync(`${dir}/${subDir}`);
}

app.use(express.static("public"));

app.use(cors({ exposedHeaders: ["Content-Disposition"] }));
app.use(express.json());

app.use((_, res, next) => {
  res.header("Cross-Origin-Opener-Policy", "same-origin");
  res.header("Cross-Origin-Embedder-Policy", "require-corp");
  res.header("Access-Control-Allow-Origin", "https://shirokatake.github.io/ytdl-frontend/");
  next();
});

server.on("request", app);

server.listen(port, () => console.log(`Server is running on port ${port}`));

app.get("/suggestions", async (req, res) => {
  const { search } = req.query;
  const options = {
    q: search,
    part: "snippet",
    type: "video",
  };
  try {
    const filters = await ytsr.getFilters(options.q);
    const filter = filters.get("Type").get("Video");
    const searchResults = await ytsr(filter.url, { limit: 5 });
    return res.status(200).json({ success: true, data: searchResults.items });
  } catch (error) {
    return res.status(400).send({ success: false, error });
  }
});

app.get("/metainfo", async (req, res) => {
  const { url } = req.query;
  if (!ytdl.validateID(url) && !ytdl.validateURL(url)) {
    return res.status(400).json({ success: false, error: "No valid YouTube Id!" });
  }
  try {
    const result = await ytdl.getBasicInfo(url, reqOptions);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.log(error);
    return res.status(400).send("Something went wrong when trying to fetch the YouTube link.");
  }
});

const sanitizeFileName = str => {
  return str.replace(/[/\\?%*:|"<>]/g, "");
};

wss.getUniqueID = function () {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + "-" + s4();
};

wss.on("connection", ws => {
  ws.id = wss.getUniqueID();
  CLIENTS[ws.id] = ws;
  ws.send(ws.id);
});

app.post("/download", async (req, res) => {
  const { v: url, format: f = "mp4" } = req.query;

  if (!ytdl.validateID(url) && !ytdl.validateURL(url)) {
    return res.status(400).json({ success: false, error: "No valid YouTube Id!" });
  }

  const tracker = {
    audio: { downloaded: 0, total: 0 },
    video: { downloaded: 0, total: 0 },
  };

  const formats = ["mp4", "mp3", "mov", "flv"];
  let format = f;
  if (formats.includes(f)) {
    format = f;
  }

  try {
    const result = await ytdl.getBasicInfo(url, reqOptions);
    const {
      videoDetails: { title },
    } = result;

    const outputName = `${sanitizeFileName(title)}.${format}`;
    const outputPath = `${dir}/${subDir}/${Date.now()}_${outputName}`;
    res.setHeader("Content-disposition", contentDisposition(`${outputName}`));

    //prettier-ignore
    const audioEncodeConfig = [
      // Remove ffmpeg's console spamming
      "-loglevel", "8", "-hide_banner",
      // Redirect/Enable progress messages
      '-progress', 'pipe:3',
      // Set inputs
      "-i", "pipe:4",
      // Set audio bitrate
      "-b:a", `128k`,
      // Define output file
      `${outputPath}`,
    ];

    //prettier-ignore
    const videoEncodeConfig = [
      // Remove ffmpeg's console spamming
      "-loglevel", "8", "-hide_banner",
      // Redirect/Enable progress messages
      '-progress', 'pipe:3',
      // Set inputs
      "-i", "pipe:4",
      "-i", "pipe:5",
      // Map audio & video from streams
      "-map", "0:a",
      "-map", "1:v",
      // Keep encoding
      "-c:v", "copy",
      // Define output file
      `${outputPath}`,
    ];

    //prettier-ignore
    const encodeOptions = {
      windowsHide: true,
      stdio: [
        /* Standard: stdin, stdout, stderr */
        "inherit", "inherit", "inherit",
        "pipe", "pipe", "pipe",
      ],
    };

    let ffmpegProcess;

    if (format == "mp3") {
      // Download stream
      const audio = ytdl(url, { quality: "highestaudio" }).on("progress", (_, downloaded, total) => {
        tracker.audio = { downloaded, total };
      });

      // Start the ffmpeg child process
      ffmpegProcess = cp.spawn(ffmpeg, audioEncodeConfig, encodeOptions);

      // Pipe downloaded streams into ffmpeg
      audio.pipe(ffmpegProcess.stdio[4]);
    }

    if (format != "mp3") {
      // Download stream
      const audio = ytdl(url, { quality: "highestaudio" }).on("progress", (_, downloaded, total) => {
        tracker.audio = { downloaded, total };
      });
      const video = ytdl(url, { quality: "highestvideo" }).on("progress", (_, downloaded, total) => {
        tracker.video = { downloaded, total };
      });

      // Start the ffmpeg child process
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

app.get("/playlist", async (req, res) => {
  try {
    const { pl: url } = req.query;
    const playlist = await ytpl(url);
    return res.status(200).json({ success: true, data: playlist });
  } catch (error) {
    return res.status(400).send({ success: false, error });
  }
});
