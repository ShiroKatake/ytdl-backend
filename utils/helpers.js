import { existsSync, mkdirSync } from "fs";

export const CLIENTS = [];

export const dir = "public";
export const subDir = "uploads";
export const createDownloadDirectory = () => {
  if (!existsSync(dir)) {
    mkdirSync(dir);
  }
  if (!existsSync(`${dir}/${subDir}`)) {
    mkdirSync(`${dir}/${subDir}`);
  }
};

export const generateDownloadPath = outputName => {
  return `${dir}/${subDir}/${outputName}`;
};

export const getUniqueID = () => {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + "-" + s4();
};
