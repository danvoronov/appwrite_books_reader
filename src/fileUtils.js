const { writeFileSync, existsSync, mkdirSync } = require('fs');

function ensureOutputDirectory(outputDir = './output') {
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir);
  }
}

function writeChapterOutput(fileName, index, chapterName, content) {
  writeFileSync(
    `./output/${fileName}_ans_${index}.txt`,
    `## ${chapterName}\n\n${content}`
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