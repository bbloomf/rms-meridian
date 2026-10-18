// Writes the logo out as standalone SVG files: web/logo.svg (emblem and
// wordmark, with the ink filter and hatching embedded) and web/favicon.svg.
// Run with `npm run logo` after changing logo.ts.

import { writeFileSync } from "node:fs";
import { INK_DEFS } from "./ink.ts";
import { emblem, mark, wordmark } from "./logo.ts";

const defs = INK_DEFS.match(/<defs>[\s\S]*<\/defs>/)![0];
const palette = `--navy:#12213a;--paper:#f6efdc;--ink:#2b241c;--brass:#b08d57;--brass-2:#d8b77a;--red:#9a2f2a;--display:Limelight,Didot,Georgia,serif;--body:'EB Garamond',Garamond,Georgia,serif`;
const fonts = "https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,600;1,400&family=Limelight&display=swap";

const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 340" width="800" height="680" style="${palette}" color="#2b241c">
  <title>RMS Meridian</title>
  <style>@import url("${fonts.replaceAll("&", "&amp;")}");</style>
  ${defs}
  ${emblem("RMS Meridian", ' x="102" y="0" width="208" height="208"')}
  <g transform="translate(0 220)">${wordmark()}</g>
</svg>
`;

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${mark().replace(/^<svg[^>]*>|<\/svg>$/g, "")}</svg>
`;

writeFileSync(new URL("../../web/logo.svg", import.meta.url), logo);
writeFileSync(new URL("../../web/favicon.svg", import.meta.url), favicon);
console.log("Wrote web/logo.svg and web/favicon.svg");
