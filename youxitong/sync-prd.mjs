import fs from 'node:fs';
import path from 'node:path';

const projectDir = path.dirname(new URL(import.meta.url).pathname);
const prdPath = path.join(projectDir, 'PRD.md');
const htmlPath = path.join(projectDir, 'index.html');
const prd = fs.readFileSync(prdPath, 'utf8');
const html = fs.readFileSync(htmlPath, 'utf8');
const start = '<textarea id="prdMdSource" style="display:none">';
const end = '</textarea>';
const startIndex = html.indexOf(start);
const endIndex = html.indexOf(end, startIndex);

if (startIndex < 0 || endIndex < 0) {
  throw new Error('PRD textarea not found');
}

const synced = html.slice(0, startIndex + start.length) + prd + html.slice(endIndex);
fs.writeFileSync(htmlPath, synced);
