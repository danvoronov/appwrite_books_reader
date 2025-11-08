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

function findNextVersion(bookDir, baseName) {
  const fs = require('fs');
  let version = 1;
  
  // Ищем максимальный номер версии
  while (true) {
    const versionedFile = path.join(bookDir, `${baseName}.v${version}.txt`);
    if (!existsSync(versionedFile)) {
      return version;
    }
    version++;
  }
}

function writeChapterOutput(dirName, index, chapterName, json) {
  if (!json || !json.chapter_cards || !json.chapter_cards.length) {
    return false;
  }
  
  const cardsText = json.chapter_cards.map(card => `\t### ${card.topic}\n\t\t${card.cards.join('\n\t\t')}`).join('\n\n');
  const content = `## ${chapterName}\n\t${json.chapter_summary}\n\n${cardsText}\n\n`

  // превратим chapterName в название файла для виндовс убрал пробелы и спецсимволы
  const baseName = chapterName.replace(/[^a-zA-Z0-9]/g, '_');
  const fileToWrite = baseName + '.txt';

  const bookDir = ensureBookDirectory(dirName);
  const filePath = path.join(bookDir, fileToWrite);
  
  if (existsSync(filePath)) {
    // Файл существует - создаем версию
    const version = findNextVersion(bookDir, baseName);
    const versionedFilePath = path.join(bookDir, `${baseName}.v${version}.txt`);
    
    // Копируем старый файл в версию
    const fs = require('fs');
    const oldContent = fs.readFileSync(filePath, 'utf8');
    fs.writeFileSync(versionedFilePath, oldContent);
    
    // Записываем новую версию в основной файл
    writeFileSync(filePath, content);
  } else {
    writeFileSync(filePath, content);
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
    
    // Проверяем что глава существует
    if (!chapter || !chapter.name) {
      continue;
    }
    
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

function writeJsonOutput(dirName, chapterName, json, suffix = 'tags') {
  const fs = require('fs');
  if (!json) return false;
  const baseName = chapterName.replace(/[^a-zA-Z0-9]/g, '_');
  const fileToWrite = `${baseName}.${suffix}.json`;
  const bookDir = ensureBookDirectory(dirName);
  const filePath = path.join(bookDir, fileToWrite);

  if (existsSync(filePath)) {
    // version old file
    let v = 1;
    while (existsSync(path.join(bookDir, `${baseName}.${suffix}.v${v}.json`))) v++;
    const versioned = path.join(bookDir, `${baseName}.${suffix}.v${v}.json`);
    const oldContent = fs.readFileSync(filePath, 'utf8');
    fs.writeFileSync(versioned, oldContent);
  }
  writeFileSync(filePath, JSON.stringify(json, null, 2));
  return filePath;
}

module.exports = {
  ensureOutputDirectory,
  ensureBookDirectory,
  writeChapterOutput,
  writeBookTitle,
  createCombinedCardsFile,
  setDisplayOrder,
  writeJsonOutput
}; 