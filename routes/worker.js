const throng = require('throng');
const Queue = require("bull");
const cp = require("child_process");
const ffmpeg = require("ffmpeg-static");
const fs = require("fs");
const ytdl = require("ytdl-core");
const { audioEncodeConfig, encodeOptions, videoEncodeConfig } = require("../utils/ffmpeg");
const { generateDownloadPath, getUniqueID, CLIENTS } = require("../utils/helpers");

// Connect to a local redis instance locally, and the Heroku-provided URL in production
const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

// Spin up multiple processes to handle jobs to take advantage of more CPU cores
// See: https://devcenter.heroku.com/articles/node-concurrency for more info
const workers = process.env.WEB_CONCURRENCY || 2;

// The maximum number of jobs each worker should process at once. This will need
// to be tuned for your application. If each job is mostly waiting on network 
// responses it can be much higher. If each job is CPU-intensive, it might need
// to be much lower.
const maxJobsPerWorker = 20;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function start() {
  // Connect to the named work queue
  let workQueue = new Queue('work', REDIS_URL);

  workQueue.process(maxJobsPerWorker, async (job) => {
    // Start of transfer
    const { v: url, format: format } = job.data;
    if (!ytdl.validateID(url) && !ytdl.validateURL(url)) {
      return res.status(400).json({ success: false, error: "Not a valid YouTube Id!" });
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
        CLIENTS[job.data.uid].send(
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
      fs.unlinkSync(outputPath);
      // console.log("error ", err);
      return res.status(400).json({ success: false, error: "Download failed . . ." });
    }
    CLIENTS[job.data.uid].close();
    // End of transfer

    // This is an example job that just slowly reports on progress
    // while doing no work. Replace this with your own job logic.
    let progress = 0;

    // throw an error 5% of the time
    if (Math.random() < 0.05) {
      throw new Error("This job failed!")
    }

    while (progress < 100) {
      await sleep(400);
      progress += 1;
      job.progress(progress)
    }

    // A job can return values that will be stored in Redis as JSON
    // This return value is unused in this demo application.
    return { value: "This will be stored" };
  });
}

// Initialize the clustered worker process
// See: https://devcenter.heroku.com/articles/node-concurrency for more info
throng({ workers, start });