#!/usr/bin/env node
/*
 * MOA build script:
 * 1) Assembles src/index.html (Toss-style refined UI + Google Sync + PWA + In-app updater) -> dist/index.html
 * 2) Copies static assets (manifest, sw, version, icons, firebase-sync) to dist/
 *
 * Usage: node scripts/build.cjs
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const srcHtml = path.join(root, 'src', 'index.html');
const distDir = path.join(root, 'dist');
const distHtml = path.join(distDir, 'index.html');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// 1. Copy src/index.html to dist/index.html
let html = fs.readFileSync(srcHtml, 'utf8');
fs.writeFileSync(distHtml, html, 'utf8');

// 2. Copy static files to dist/
const filesToCopy = [
  'firebase-sync.js',
  'manifest.webmanifest',
  'sw.js',
  'version.json',
  'moa-icon.png'
];

filesToCopy.forEach(file => {
  const srcP = path.join(root, 'src', file);
  const dstP = path.join(root, 'dist', file);
  if (fs.existsSync(srcP)) {
    fs.copyFileSync(srcP, dstP);
  }
});

console.log(
  '✅ Successfully built dist/index.html from Toss-style refined UI (' +
  (html.length / 1024).toFixed(1) + ' KB)'
);
