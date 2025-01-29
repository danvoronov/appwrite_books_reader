const { writeFileSync, existsSync, mkdirSync } = require('fs');
const path = require('path');

function ensureOutputDirectory(outputDir = './output') {
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir);
  }
}

function ensureBookDirectory(fileName) {
  const bookDir = path.join('./output', fileName);
  if (!existsSync(bookDir)) {
    mkdirSync(bookDir);
  }
  return bookDir;
}

function writeChapterOutput(fileName, index, chapterName, json) {
  const bookDir = ensureBookDirectory(fileName);
  const cardsText = json.chapter_cards.map(card => `\t### ${card.topic}\n\t\t${card.cards.join('\n\t\t')}`).join('\n\n');
  
  writeFileSync(
    path.join(bookDir, `ans_${index}.txt`),
    `## ${chapterName}\n\t${json.chapter_summary}\n\n${cardsText}`
  );
}

function writeBookTitle(fileName, title) {
  const bookDir = ensureBookDirectory(fileName);
  writeFileSync(path.join(bookDir, `ans_0.txt`), `# ${title}\n\n`);
}

module.exports = {
  ensureOutputDirectory,
  ensureBookDirectory,
  writeChapterOutput,
  writeBookTitle
}; 