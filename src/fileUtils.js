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

function writeBookTitle(fileName, title) {
  bookTitle = title; // Сохраняем заголовок книги для использования в createCombinedCardsFile
}

function createCombinedCardsFile(fileName) {
  const bookDir = path.join('./output', fileName);
  if (!existsSync(bookDir)) return;

  // Определяем порядок специальных глав
  const specialChaptersOrder = {
    'INTRODUCTION': 0,
    'CONCLUSION': 999999 // Гарантируем, что будет в конце
  };

  const files = readdirSync(bookDir)
    .filter(file => file.endsWith('.txt'))
    .sort((a, b) => {
      const nameA = a.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
      const nameB = b.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();

      // Проверяем, являются ли файлы специальными главами
      const orderA = specialChaptersOrder[nameA.replace('.txt', '')] ?? -1;
      const orderB = specialChaptersOrder[nameB.replace('.txt', '')] ?? -1;

      // Если оба файла специальные, сортируем по их порядку
      if (orderA >= 0 && orderB >= 0) {
        return orderA - orderB;
      }

      // Если только один файл специальный
      if (orderA >= 0) return orderA;
      if (orderB >= 0) return -orderB;

      // Для обычных глав ищем номера
      const numA = parseInt(a.match(/\d+/)?.[0] || '0');
      const numB = parseInt(b.match(/\d+/)?.[0] || '0');
      
      // Если у обоих есть номера, сортируем по ним
      if (numA && numB) {
        return numA - numB;
      }

      // Если номер есть только у одного, приоритет файлу с номером
      if (numA) return 1;
      if (numB) return -1;

      // Если нет номеров, сортируем по алфавиту
      return nameA.localeCompare(nameB);
    });

  // Начинаем с заголовка книги
  let combinedContent = `# ${bookTitle}\n\n`;
  
  files.forEach(file => {
    const content = readFileSync(path.join(bookDir, file), 'utf8');
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
  createCombinedCardsFile
}; 