const { writeFileSync, existsSync, mkdirSync } = require('fs');

function ensureOutputDirectory(outputDir = './output') {
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir);
  }
}

function writeChapterOutput(fileName, index, chapterName, json) {
  const cardsText = json.chapter_cards.map(card => `\t### ${card.topic}\n\t\t${card.cards.join('\n\t\t')}`).join('\n\n');
  
  writeFileSync(
    `./output/${fileName}_ans_${index}.txt`,
    `## ${chapterName}\n\t${json.chapter_summary}\n${cardsText}`
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