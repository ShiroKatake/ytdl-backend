const express = require("express");
const router = express.Router();
const contentDisposition = require("content-disposition");
const cp = require("child_process");
const ffmpeg = require("ffmpeg-static");
const fs = require("fs");
const ytdl = require("ytdl-core");
const { audioEncodeConfig, encodeOptions, videoEncodeConfig } = require("../utils/ffmpeg");
const { getUniqueID, generateDownloadPath, CLIENTS } = require("../utils/helpers");

router.post("/download", async (req, res) => {
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

module.exports = router;
