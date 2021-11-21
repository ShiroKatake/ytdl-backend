const contentDisposition = require("content-disposition");
const cors = require("cors");
const cp = require("child_process");
const express = require("express");
const ffmpeg = require("ffmpeg-static");
const fs = require("fs");
const ytdl = require("ytdl-core");
const searchYoutube = require("youtube-api-v3-search");

const app = express();
const port = process.env.PORT || 4000;
const YOUTUBE_KEY = require("./youtube_key");

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

app.use(cors());
app.use(express.json());

app.use((_, res, next) => {
  res.header("Cross-Origin-Opener-Policy", "same-origin");
  res.header("Cross-Origin-Embedder-Policy", "require-corp");
  next();
});

app.listen(port, () => console.log(`Server is running on port ${port}`));

app.get("/suggestions", async (req, res) => {
  const { search } = req.query;
  const options = {
    q: search,
    part: "snippet",
    type: "video",
  };
  try {
    const data = await searchYoutube(YOUTUBE_KEY, options);
    if (data.error) {
      return res
        .status(403)
        .send(
          "This app was limited to 100 searches (in total) per day. This is due to YouTube's restriction on search API. Contact the developer of this app for more information."
        );
    } else {
      const { items } = data;
      return res.status(200).json({ success: true, data: items });
    }
  } catch (error) {
    return res.status(400).json({ success: false, error });
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
    return res.status(400).json({ success: false, error });
  }
});

const sanitizeString = str => {
  return str.replace(/[/\\?%*:|"<>]/g, "");
};

app.get("/download", async (req, res) => {
  const { v: url, format: f = "mp4" } = req.query;
  if (!ytdl.validateID(url) && !ytdl.validateURL(url)) {
    return res.status(400).json({ success: false, error: "No valid YouTube Id!" });
  }

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
    res.setHeader("Content-disposition", contentDisposition(`${title}.${format}`));

    if (format == "mp3") {
      const audio = ytdl(url, { quality: "highestaudio" });
      const outputName = `${sanitizeString(title)}.${format}`;
      const outputPath = `${dir}/${subDir}/${Date.now()}_${outputName}`;

      //prettier-ignore
      // Start the ffmpeg child process
      const ffmpegProcess = cp.spawn(ffmpeg,
        [
          // Remove ffmpeg's console spamming
          "-loglevel", "8", "-hide_banner",
          // Set inputs
          "-i", "pipe:4",
          // Set audio bitrate
          "-b:a", `128k`,
          // Define output file
          `${outputPath}`,
        ],
        {
          windowsHide: true,
          stdio: [
            /* Standard: stdin, stdout, stderr */
            "inherit", "inherit", "inherit",
            "pipe", "pipe", "pipe",
          ],
        }
      );
      ffmpegProcess.on("close", () => {
        //console.log(output);
        res.download(outputPath, outputName, err => {
          if (err) throw err;
          fs.unlinkSync(outputPath);
          //console.log("done");
        });
      });

      audio.pipe(ffmpegProcess.stdio[4]);
    }

    if (format != "mp3") {
      const audio = ytdl(url, { quality: "highestaudio" });
      const video = ytdl(url, { quality: "highestvideo" });
      const outputName = `${sanitizeString(title)}.${format}`;
      const outputPath = `${dir}/${subDir}/${Date.now()}_${outputName}`;

      //prettier-ignore
      // Start the ffmpeg child process
      const ffmpegProcess = cp.spawn(ffmpeg,
        [
          // Remove ffmpeg's console spamming
          "-loglevel", "8", "-hide_banner",
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
        ],
        {
          windowsHide: true,
          stdio: [
            /* Standard: stdin, stdout, stderr */
            "inherit", "inherit", "inherit",
            "pipe", "pipe", "pipe",
          ],
        }
      );
      ffmpegProcess.on("close", () => {
        //console.log(output);
        res.download(outputPath, outputName, err => {
          if (err) throw err;
          fs.unlinkSync(outputPath);
          //console.log("done");
        });
      });

      audio.pipe(ffmpegProcess.stdio[4]);
      video.pipe(ffmpegProcess.stdio[5]);
    }
  } catch (err) {
    console.log("error ", err);
    res.redirect(`http://${req.headers.host}?error=downloadError`);
  }
});
