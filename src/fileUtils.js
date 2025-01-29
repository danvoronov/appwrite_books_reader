const { writeFileSync, existsSync, mkdirSync } = require('fs');

function ensureOutputDirectory(outputDir = './output') {
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir);
  }
}

function writeChapterOutput(fileName, index, chapterName, json) {
  writeFileSync(
    `./output/${fileName}_ans_${index}.txt`,
    `## ${chapterName}\n\n${JSON.stringify(json)}`
  );
}

function writeBookTitle(fileName, title) {
  writeFileSync(`./output/${fileName}_ans_0.txt`, `# ${title}\n\n`);
}

module.exports = {
  ensureOutputDirectory,
  writeChapterOutput,
  writeBookTitle
}; 