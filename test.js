import { URL } from "url";
import * as fs from "fs/promises";

const parseUrl = new URL(
  "https://musescore.com/static/musescore/scoredata/g/d619ce509f78fb1a0b925be70fa09c722d218128/score_0.svg?no-cache=1715689499 у меня должен быть filePath = scorre_0.svg",
);

console.log(parseUrl.pathname.split("/").at(-1));

fs.mkdir("cock");
