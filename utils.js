import * as fs from "fs/promises";
import { createWriteStream } from "fs";
import { get } from "https";
import { URL } from "url";
import { join } from "path";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function waitLink(parentElem, selector) {
  return new Promise((resolve) => {
    let interval = setInterval(async () => {
      const elem = parentElem.locator(selector);
      const link = await elem.getAttribute("src");

      if (link !== null) {
        clearInterval(interval);
        resolve(link);
      }
    }, 150);
  });
}

export async function downloadImage(dirName, dowloadUrl) {
  const fileName = getFileName(dowloadUrl);
  const filePath = join(__dirname, dirName, fileName);

  return new Promise((resolve, reject) => {
    const file = createWriteStream(filePath);
    get(dowloadUrl, (res) => {
      if (res.statusCode !== 200) {
        reject(
          `Failed to download image. Status code ${res.statusCode} for file`,
        );
      }

      res.pipe(file);

      res.once("finish", () => {
        file.close(() => {
          resolve(filePath);
        });
      });

      res.once('end', () => {
        file.close(() => {
          resolve(filePath);
        });
      })
    }).on("error", (err) => {
      console.error(`Error during download ${filePath}: `, err);
      file.close();
    });
  });
}

export function getFileName(dowloadUrl) {
  const parsedUrl = new URL(dowloadUrl);
  const fileName = parsedUrl.pathname.split("/").at(-1);
  return fileName;
}

export function formatTitle(str) {
  return str.replace(/[\s\-\~()]+/g, "_");
}

export async function dirExists(dirName) {
  try {
    await fs.access(join(__dirname, dirName));
    return true;
  } catch {
    return false;
  }
}

export async function createDir(dirName) {
  await fs.mkdir(dirName);
}
