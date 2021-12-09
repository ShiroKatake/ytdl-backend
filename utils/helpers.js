const fs = require("fs");
const CLIENTS = [];

const sanitizeFileName = str => {
  return str.replace(/[/\\?%*:|"<>]/g, "");
};

const dir = "public";
const subDir = "uploads";
const createDownloadDirectory = () => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
  if (!fs.existsSync(`${dir}/${subDir}`)) {
    fs.mkdirSync(`${dir}/${subDir}`);
  }
};

const generateDownloadPath = outputName => {
  return `${dir}/${subDir}/${outputName}`;
};

const getUniqueID = () => {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + "-" + s4();
};

module.exports.CLIENTS = CLIENTS;
module.exports.createDownloadDirectory = createDownloadDirectory;
module.exports.generateDownloadPath = generateDownloadPath;
module.exports.getUniqueID = getUniqueID;
