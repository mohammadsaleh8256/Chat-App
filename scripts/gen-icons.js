// Generate simple PNG icons for PWA
/* eslint-disable @typescript-eslint/no-require-imports */
const sharp = require('sharp');
const path = require('path');

async function main() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
      <rect width="512" height="512" fill="#0ea5b8" rx="100"/>
      <path d="M256 100 L256 412 M156 200 L356 200 M156 280 L300 280 M156 360 L280 360"
            stroke="white" stroke-width="36" stroke-linecap="round"/>
      <circle cx="256" cy="100" r="20" fill="white"/>
    </svg>
  `;
  await sharp(Buffer.from(svg)).resize(192, 192).png().toFile(path.join(__dirname, '..', 'public', 'icon-192.png'));
  await sharp(Buffer.from(svg)).resize(512, 512).png().toFile(path.join(__dirname, '..', 'public', 'icon-512.png'));
  console.log('Icons generated');
}
main().catch((e) => { console.error(e); process.exit(1); });
