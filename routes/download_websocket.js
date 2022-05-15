import cp from "child_process";
import ffmpeg from "ffmpeg-static";
import fs from "fs";
import ytdl from "ytdl-core";
import { audioEncodeConfig, encodeOptions, videoEncodeConfig } from "../utils/ffmpeg.js";
import { generateDownloadPath, getUniqueID } from "../utils/helpers.js";

const download = (req, ws) => {
  // ws.send("hi");
  const { v: url, format: format } = req;
  if (!ytdl.validateID(url) && !ytdl.validateURL(url)) {
    ws.send({ success: false, error: "Not a valid YouTube Id!" });
  }

  const tracker = {
    audio: { downloaded: 0, total: 0 },
    video: { downloaded: 0, total: 0 },
  };

  const outputName = `${url}_${getUniqueID()}_${Date.now()}.${format}`;
  const outputPath = generateDownloadPath(outputName);

  try {
    let ffmpegProcess;
    let ffmpegConfig = [];

    if (format == "mp3") {
      // Download stream
      const audio = ytdl(url, { quality: "highestaudio" }).on("progress", (_, downloaded, total) => {
        tracker.audio = { downloaded, total };
      });

      // Start the ffmpeg child process
      ffmpegConfig.push(...audioEncodeConfig, outputPath);
      ffmpegProcess = cp.spawn(ffmpeg, ffmpegConfig, encodeOptions);

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
      ffmpegConfig.push(...videoEncodeConfig, outputPath);
      ffmpegProcess = cp.spawn(ffmpeg, ffmpegConfig, encodeOptions);

      // Pipe downloaded streams into ffmpeg
      audio.pipe(ffmpegProcess.stdio[4]);
      video.pipe(ffmpegProcess.stdio[5]);
    }

    ffmpegProcess.stdio[3].on("data", () => {
      ws.send(
        JSON.stringify({
          downloaded: tracker.audio.downloaded + tracker.video.downloaded,
          total: tracker.audio.total + tracker.video.total,
        })
      );
    });

    ffmpegProcess.on("close", async () => {
      const buffer = fs.readFileSync(outputPath);
      await ws.send(buffer);
      fs.unlinkSync(outputPath);
      // ws.close();
    });
  } catch (err) {
    fs.unlinkSync(outputPath);
    // console.log("error ", err);
    ws.send({ success: false, error: "Download failed . . ." });
  }
};

export default download;
