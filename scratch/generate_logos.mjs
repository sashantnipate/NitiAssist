import fs from 'fs';

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

const dMatch = svgText.match(/d="([^"]+)"/);
const d = dMatch[1];
const subpaths = d.split(/(?=M\s)/).filter(Boolean);

const iconSubpaths = [];
const allSubpaths = subpaths;

subpaths.forEach((sp) => {
  const nums = sp.match(/-?[\d.]+/g)?.map(Number) || [];
  let sMaxX = -Infinity;
  for (let i = 0; i < nums.length; i += 2) {
    if (nums[i] > sMaxX) sMaxX = nums[i];
  }
  if (sMaxX < 550) {
    iconSubpaths.push(sp);
  }
});

console.log('Icon subpaths:', iconSubpaths.length, 'Total subpaths:', allSubpaths.length);

// Trimmed viewBoxes:
// Icon: bounds minX: 73, maxX: 532.88, minY: 125.65, maxY: 642
// width = 460, height = 516.35
// With 15px padding: x = 58, y = 110, w = 490, h = 546
const iconViewBox = "58 110 490 546";

// Full: bounds minX: 73, maxX: 2084, minY: 125.65, maxY: 642
// width = 2011, height = 516.35
// With 20px padding: x = 53, y = 110, w = 2050, h = 546
const fullViewBox = "53 110 2050 546";

const makeSvg = (subpathsArr, viewBox, fill) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="${fill}">
  <path d="${subpathsArr.join(' ')}" stroke="none" fill-rule="evenodd" />
</svg>`;

// Write the files
fs.writeFileSync('public/logo.svg', makeSvg(allSubpaths, fullViewBox, '#000000'));
fs.writeFileSync('public/logo-dark.svg', makeSvg(allSubpaths, fullViewBox, '#ffffff'));

fs.writeFileSync('public/logo-icon.svg', makeSvg(iconSubpaths, iconViewBox, '#000000'));
fs.writeFileSync('public/logo-icon-dark.svg', makeSvg(iconSubpaths, iconViewBox, '#ffffff'));

console.log('Successfully generated all logo SVGs in public/');
