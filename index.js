import { chromium } from "playwright";
import * as fs from "fs/promises";
import {
  dirExists,
  waitLink,
  formatTitle,
  createDir,
  downloadImage,
} from "./utils.js";
import path from "path";
import { fileURLToPath } from "url";
import svg2img from "svg2img";
import { promisify } from "util";
import { PDFDocument, rgb } from "pdf-lib";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

parseAllSheets(["url1", "url2", "url3", "urln"]);

async function parseAllSheets(urls) {
  if (Array.isArray(urls)) {
    const promises = [];

    for (const url of urls) {
      promises.push(
        parse(url).catch((e) => {
          console.error(`Error during parsing ${url}: `, e);
        }),
      );
    }

    await Promise.all(promises);
    return;
  }

  await parse(urls).catch((e) => {
    console.error(`Error during parsing ${urls}: `, e);
  });
}

async function parse(url) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url, {
    waitUntil: "domcontentloaded",
  });

  const elems = await page.locator(".EEnGW").all();
  const links = [];

  for (const elem of elems) {
    await elem.scrollIntoViewIfNeeded();
    const link = await waitLink(elem, "img");
    links.push(link);
  }

  const title = await page.title();

  await browser.close();

  const formattedTitle = formatTitle(title);

  const dirAlreadyExists = await dirExists(formattedTitle);

  if (!dirAlreadyExists) {
    await createDir(formattedTitle);
  }

  let promises = [];

  for (const link of links) {
    promises.push(downloadImage(formattedTitle, link));
  }

  await Promise.all(promises);

  const promisedSvg2Img = promisify(svg2img);
  promises = [];

  const pngPaths = [];

  const svgPaths = await fs.readdir(path.join(__dirname, formattedTitle));

  for (const svgPath of svgPaths) {
    const svgFullPath = path.join(__dirname, formattedTitle, svgPath);

    if (svgFullPath.includes(".png")) {
      pngPaths.push(svgFullPath);
      continue;
    }

    const pngFullPath = svgFullPath.replace(".svg", ".png");

    pngPaths.push(pngFullPath);

    promises.push(
      promisedSvg2Img(svgFullPath)
        .then((output) => {
          return fs.writeFile(pngFullPath, output);
        })
        .then(() => {
          return fs.unlink(svgFullPath);
        }),
    );
  }

  await Promise.all(promises);

  promises = [];
  const pdfPaths = [];

  for (const pngPath of pngPaths) {
    let createdInstance;
    const pdfFullPath = pngPath.replace(".png", ".pdf");
    pdfPaths.push(pdfFullPath);

    promises.push(
      convertImageToPdf(pngPath, pdfFullPath).then(() => {
        return fs.unlink(pngPath);
      }),
    );
  }

  await Promise.all(promises);

  await mergeAndSavePDFs(
    pdfPaths,
    path.join(__dirname, formattedTitle, "output.pdf"),
  );
}

async function convertImageToPdf(imagePath, pdfPath) {
  const image = await fs.readFile(imagePath);

  const pdfDoc = await PDFDocument.create();

  const page = pdfDoc.addPage([600, 800]);

  const imageEmbed = await pdfDoc.embedPng(image);

  const { width, height } = imageEmbed.scaleToFit(
    page.getWidth(),
    page.getHeight(),
  );

  // Draw the image on the PDF page.
  page.drawImage(imageEmbed, {
    x: page.getWidth() / 2 - width / 2, // Center the image horizontally.
    y: page.getHeight() / 2 - height / 2, // Center the image vertically.
    width,
    height,
    color: rgb(0, 0, 0), // Set the image color to black.
  });

  const pdfBytes = await pdfDoc.save();

  await fs.writeFile(pdfPath, pdfBytes);
}

async function mergePDFs(pdfPaths, outputPath) {
  const mergedPdf = await PDFDocument.create();

  for (const pdfPath of pdfPaths) {
    const pdfBytes = await fs.readFile(pdfPath);
    const pdf = await PDFDocument.load(pdfBytes);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }

  const mergedPdfBytes = await mergedPdf.save();
  await fs.writeFile(outputPath, mergedPdfBytes);

  return outputPath;
}

async function mergeAndSavePDFs(pdfPaths, outputPath) {
  const promises = [];
  try {
    const mergedFileName = await mergePDFs(pdfPaths, outputPath);
    console.log(
      "PDFs merged successfully. Merged file saved at:",
      mergedFileName,
    );

    pdfPaths.forEach((pdfPath) => {
      promises.push(fs.unlink(pdfPath));
    });

    await Promise.all(promises);

    return mergedFileName;
  } catch (error) {
    console.error("Error merging PDFs:", error);
    throw error;
  }
}
