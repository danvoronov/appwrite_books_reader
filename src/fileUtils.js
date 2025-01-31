const { writeFileSync, existsSync, mkdirSync } = require('fs');
const path = require('path');

function ensureOutputDirectory(outputDir = './output') {
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir);
  }
}

function ensureBookDirectory(fileName) {
  ensureOutputDirectory()
  const bookDir = path.join('./output', fileName);
  if (!existsSync(bookDir)) {
    mkdirSync(bookDir);
  }
  return bookDir;
}

function writeChapterOutput(dirName, index, chapterName, json) {
  if (!json || !json.chapter_cards || !json.chapter_cards.length) {
    console.log(`${chapterName} -- пустые данные. Не пишем`)
    return
  }
  
  const cardsText = json.chapter_cards.map(card => `\t### ${card.topic}\n\t\t${card.cards.join('\n\t\t')}`).join('\n\n');
  const content = `## ${chapterName}\n\t${json.chapter_summary}\n\n${cardsText}\n\n`

  // превратим chapterName в название файла для виндовс убрал пробелы и спецсимволы
  const fileToWrite = chapterName.replace(/[^a-zA-Z0-9]/g, '_')+'.txt';

  const bookDir = ensureBookDirectory(dirName);
  const filePath = path.join(bookDir, fileToWrite);
  if (existsSync(filePath)) {
    writeFileSync(path.join(bookDir, '_'+fileToWrite), content);
    console.log(`Дубликат ${fileToWrite} -- записан`)
  } else {
    writeFileSync(filePath, content);
    console.log(`${fileToWrite} -- записан`)
  }
  console.log(`\n\n`)
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