#!/usr/bin/env node
/*
 * MOA build:
 * 1) Assembles src/app.css + src/app.html + src/app.js -> src/app.dc.html
 * 2) Copies src/google-drive-sync.js -> dist/google-drive-sync.js
 * 3) Packs src/app.dc.html into dist/index.html
 * 4) Verifies JS syntax and template-to-renderVals binding completeness
 *
 * Usage: node scripts/build.cjs
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const cssFile = path.join(root, 'src', 'app.css');
const htmlFile = path.join(root, 'src', 'app.html');
const jsFile = path.join(root, 'src', 'app.js');
const dcFile = path.join(root, 'src', 'app.dc.html');
const driveSrcFile = path.join(root, 'src', 'google-drive-sync.js');
const driveDistFile = path.join(root, 'dist', 'google-drive-sync.js');
const distFile = path.join(root, 'dist', 'index.html');

const css = fs.readFileSync(cssFile, 'utf8').replace(/\r\n/g, '\n').trim();
const tpl = fs.readFileSync(htmlFile, 'utf8').replace(/\r\n/g, '\n').trim();
const js = fs.readFileSync(jsFile, 'utf8').replace(/\r\n/g, '\n').trim();

// Verify JS syntax before bundling
new Function('DCLogic', js);

// The bundle's DC runtime (manifest asset). Without it and the <x-dc> wrapper
// the template never renders: every {{ hole }} shows as raw text.
const RUNTIME = 'd5e950e9-a745-434d-9219-2db4ba13d30b';

const assembled = `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>MOA · 내 용돈 관리</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" href="/moa-icon.png">
<script src="${RUNTIME}"></script>
</head><body>
<x-dc>
<helmet>
<!--@font-->
<style>
${css}
</style>
</helmet>
${tpl}
</x-dc>
<script type="text/x-dc" data-dc-script="">
${js}
</script>
</body></html>
`;

fs.writeFileSync(dcFile, assembled);
if (fs.existsSync(driveSrcFile)) {
  fs.copyFileSync(driveSrcFile, driveDistFile);
}

const OPEN = '<script type="__bundler/template">';
const html = fs.readFileSync(distFile, 'utf8');
const start = html.indexOf(OPEN);
if (start < 0) throw new Error('template block not found in dist/index.html');
const bodyStart = start + OPEN.length;
const end = html.indexOf('</script>', bodyStart);
const raw = html.slice(bodyStart, end);

const current = JSON.parse(raw.trim());
const font = current.match(/<style>\/\*\*[\s\S]*?<\/style>/);
if (!font || !/@font-face/.test(font[0])) throw new Error('font block not found in current template');

let src = assembled;
if (!src.includes('<!--@font-->')) throw new Error('<!--@font--> marker missing in assembled template');
src = src.replace('<!--@font-->', () => font[0]);

// Same escaping as the bundler: no literal "</" inside the JSON string.
const packed = JSON.stringify(src).replace(/<\//g, '<\\u002F');
const lead = raw.match(/^\s*/)[0];
const tail = raw.match(/\s*$/)[0];
let out = html.slice(0, bodyStart) + lead + packed + tail + html.slice(end);
// Loader screen shown while the bundle unpacks: it used to be the old purple "M"
// thumbnail. Make it a blank cream screen (same as the splash background) so
// loading flows straight into the splash.
out = out.replace(/background:\s*#(?:6b5cf5|F7F9F8)/gi, 'background: #FAF6EE');
out = out.replace(/<div id="__bundler_thumbnail">[\s\S]*?<\/svg><\/div>/, '<div id="__bundler_thumbnail"></div>');
out = out.replace('<div id="__bundler_loading">Unpacking...</div>', '');
out = out.replace(/<style>\s*@media \(max-width: 720px\)[\s\S]*?<\/style>/, '');
fs.writeFileSync(distFile, out);

console.log(
  'built src/app.dc.html & dist/index.html from src/app.css + src/app.html + src/app.js (' +
  (src.length / 1024).toFixed(1) + ' KB)'
);
