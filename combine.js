const fs = require('fs');
const path = require('path');

const outputDir = 'output';
const allText = [];

fs.readdirSync(outputDir).forEach(file => {
  const filePath = path.join(outputDir, file);
  const fileContent = fs.readFileSync(filePath, 'utf8');
  allText.push(fileContent);
});

const allTextCombined = allText.join('\n\n');

fs.writeFileSync('all.txt', allTextCombined);
