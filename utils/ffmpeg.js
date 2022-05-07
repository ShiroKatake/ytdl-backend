//prettier-ignore
export const audioEncodeConfig = [
  // Remove ffmpeg's console spamming
  "-loglevel", "8", "-hide_banner",
  // Redirect/Enable progress messages
  '-progress', 'pipe:3',
  // Set inputs
  "-i", "pipe:4",
  // Set audio bitrate
  "-b:a", `128k`,
];

//prettier-ignore
export const videoEncodeConfig = [
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
];

//prettier-ignore
export const encodeOptions = {
  windowsHide: true,
  stdio: [
    /* Standard: stdin, stdout, stderr */
    "inherit", "inherit", "inherit",
    "pipe", "pipe", "pipe",
  ],
};
