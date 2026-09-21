const fs = require('fs');
const cp = require('child_process');

const files = cp.execSync('git ls-files').toString().split('\n').filter(Boolean);
const badFiles = [];

for (const file of files) {
  try {
    const text = fs.readFileSync(file, 'utf8');
    if (text.includes('ðŸ') || text.includes('dY`') || text.includes('dYs-') || text.includes('dY"')) {
      badFiles.push(file);
    }
  } catch(e) {}
}

console.log(badFiles.join('\n'));
