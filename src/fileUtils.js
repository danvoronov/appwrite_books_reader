const { writeFileSync, existsSync, mkdirSync, readdirSync, readFileSync } = require('fs');
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
    console.log(`\n❌ ${chapterName} -- пустые данные. Пробуем еще раз...`)
    return false;
  }
  
  const cardsText = json.chapter_cards.map(card => `\t### ${card.topic}\n\t\t${card.cards.join('\n\t\t')}`).join('\n\n');
  const content = `## ${chapterName}\n\t${json.chapter_summary}\n\n${cardsText}\n\n`

  // превратим chapterName в название файла для виндовс убрал пробелы и спецсимволы
  const fileToWrite = chapterName.replace(/[^a-zA-Z0-9]/g, '_')+'.txt';

  const bookDir = ensureBookDirectory(dirName);
  const filePath = path.join(bookDir, fileToWrite);
  if (existsSync(filePath)) {
    writeFileSync(path.join(bookDir, '_'+fileToWrite), content);
    console.log(`\n📝 Дубликат ${fileToWrite} -- записан`)
  } else {
    writeFileSync(filePath, content);
    console.log(`\n✅ ${fileToWrite} -- записан`)
  }
  return true;
}

let bookTitle = '';
let bookChapters = [];
let displayOrder = new Map(); // Добавляем хранение порядка отображения

function writeBookTitle(fileName, title, chapters) {
  bookTitle = title;
  bookChapters = chapters;
}

// Добавляем функцию для сохранения порядка отображения
function setDisplayOrder(displayToRealMap) {
  displayOrder = new Map();
  for (const [display, real] of displayToRealMap.entries()) {
    const chapter = bookChapters[real - 1];
    const normalizedName = chapter.name.replace(/[^a-zA-Z0-9]/g, '_');
    displayOrder.set(normalizedName, display);
  }
}

function createCombinedCardsFile(fileName) {
  const bookDir = path.join('./output', fileName);
  if (!existsSync(bookDir)) return;

  const files = readdirSync(bookDir)
    .filter(file => file.endsWith('.txt'))
    .map(file => {
      const content = readFileSync(path.join(bookDir, file), 'utf8');
      // Получаем название главы из первой строки (после ##)
      const firstLine = content.split('\n')[0];
      const chapterName = firstLine.replace(/^## /, '').trim();
      
      // Ищем соответствующую главу в displayOrder
      const matchingChapter = bookChapters.find(ch => ch.name === chapterName);
      if (!matchingChapter) return { filename: file, order: 999999 };
      
      const normalizedName = matchingChapter.name.replace(/[^a-zA-Z0-9]/g, '_');
      return {
        filename: file,
        order: displayOrder.get(normalizedName) ?? 999999,
        chapterName // сохраняем для отладки
      };
    })
    .sort((a, b) => a.order - b.order);

  // Начинаем с заголовка книги
  let combinedContent = `# ${bookTitle}\n\n`;
  
  files.forEach(file => {
    const content = readFileSync(path.join(bookDir, file.filename), 'utf8');
    combinedContent += content + '\n\n';
  });

  const combinedFilePath = path.join('./output', `${fileName}_cards.md`);
  writeFileSync(combinedFilePath, combinedContent.trim());
  console.log(`\n📚 Создан общий файл: ${fileName}_cards.md`);
}

module.exports = {
  ensureOutputDirectory,
  ensureBookDirectory,
  writeChapterOutput,
  writeBookTitle,
  createCombinedCardsFile,
  setDisplayOrder
}; 