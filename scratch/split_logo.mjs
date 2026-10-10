import fs from 'fs';

// Read the transcript or write the full SVG path
const transcriptPath = 'C:/Users/HP/.gemini/antigravity-ide/brain/f3b90e62-3a1c-472c-92a1-b91259234371/.system_generated/logs/transcript_full.jsonl';
const lines = fs.readFileSync(transcriptPath, 'utf8').trim().split('\n');

let svgText = '';
for (const line of lines) {
  try {
    const data = JSON.parse(line);
    if (data.content && data.content.includes('<svg') && data.content.includes('viewBox="0 0 2135 737"')) {
      const match = data.content.match(/<svg[\s\S]*?<\/svg>/);
      if (match) {
        svgText = match[0];
        break;
      }
    }
  } catch (e) {}
}

if (!svgText) {
  console.error('Could not find SVG in transcript');
  process.exit(1);
}

console.log('Found SVG, length:', svgText.length);

// Extract the path 'd' attribute
const dMatch = svgText.match(/d="([^"]+)"/);
if (!dMatch) {
  console.error('No d attribute found');
  process.exit(1);
}

const d = dMatch[1];
// Split subpaths starting with M
const subpaths = d.split(/(?=M\s)/).filter(Boolean);
console.log('Total subpaths:', subpaths.length);

// For each subpath, find bounding box
const iconSubpaths = [];
const textSubpaths = [];

let iconBounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
let allBounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };

subpaths.forEach((sp, idx) => {
  const nums = sp.match(/-?[\d.]+/g)?.map(Number) || [];
  let sMinX = Infinity, sMaxX = -Infinity, sMinY = Infinity, sMaxY = -Infinity;
  for (let i = 0; i < nums.length; i += 2) {
    const x = nums[i];
    const y = nums[i+1];
    if (x !== undefined && y !== undefined) {
      if (x < sMinX) sMinX = x;
      if (x > sMaxX) sMaxX = x;
      if (y < sMinY) sMinY = y;
      if (y > sMaxY) sMaxY = y;
    }
  }

  if (sMinX < allBounds.minX) allBounds.minX = sMinX;
  if (sMaxX > allBounds.maxX) allBounds.maxX = sMaxX;
  if (sMinY < allBounds.minY) allBounds.minY = sMinY;
  if (sMaxY > allBounds.maxY) allBounds.maxY = sMaxY;

  // The emblem/icon is on the left side (x < 550)
  if (sMaxX < 550) {
    iconSubpaths.push(sp);
    if (sMinX < iconBounds.minX) iconBounds.minX = sMinX;
    if (sMaxX > iconBounds.maxX) iconBounds.maxX = sMaxX;
    if (sMinY < iconBounds.minY) iconBounds.minY = sMinY;
    if (sMaxY > iconBounds.maxY) iconBounds.maxY = sMaxY;
  } else {
    textSubpaths.push(sp);
  }
});

console.log('Icon subpaths:', iconSubpaths.length, 'Text subpaths:', textSubpaths.length);
console.log('All bounds:', allBounds);
console.log('Icon bounds:', iconBounds);

// Let's create public/logo.svg and public/logo-icon.svg
fs.writeFileSync('public/logo.svg', svgText);

// For icon SVG, we can give it padding around iconBounds
const padding = 20;
const iconW = (iconBounds.maxX - iconBounds.minX) + padding * 2;
const iconH = (iconBounds.maxY - iconBounds.minY) + padding * 2;
const iconMinX = iconBounds.minX - padding;
const iconMinY = iconBounds.minY - padding;

const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${iconMinX} ${iconMinY} ${iconW} ${iconH}" width="${iconW}" height="${iconH}">
  <path d="${iconSubpaths.join(' ')}" stroke="none" fill="currentColor" fill-rule="evenodd" />
</svg>`;

fs.writeFileSync('public/logo-icon.svg', iconSvg);

// Save full logo with fill="currentColor" as well
const fullSvgCurrentColor = svgText
  .replace('fill="#000000"', 'fill="currentColor"')
  .replace('viewBox="0 0 2135 737"', `viewBox="50 ${allBounds.minY - 20} ${allBounds.maxX - 30} ${allBounds.maxY - allBounds.minY + 40}"`);

fs.writeFileSync('public/logo-full.svg', fullSvgCurrentColor);

console.log('Saved public/logo.svg, public/logo-icon.svg, and public/logo-full.svg');
