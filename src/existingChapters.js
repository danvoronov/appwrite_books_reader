const { existsSync, readdirSync, readFileSync } = require('fs');
const path = require('path');

const OUTPUT_BASE_PATH = '../epub2chapters/output';

function checkExistingChapters(bookName) {
  // Пробуем разные варианты путей
  const possiblePaths = [
    path.join(OUTPUT_BASE_PATH, bookName),
    path.join('./output', bookName),
    path.join('../output', bookName),
    path.join('../../epub2chapters/output', bookName)
  ];
  
  let bookDir = null;
  
  // Ищем существующую папку
  for (const testPath of possiblePaths) {
    if (existsSync(testPath)) {
      bookDir = testPath;
      break;
    }
  }
  
  if (!bookDir) {
    return { hasExisting: false, chapters: [] };
  }
  
  try {
    const allFiles = readdirSync(bookDir);
    
    // Поддерживаем как .txt, так и .md файлы
    const txtFiles = allFiles.filter(file => file.endsWith('.txt') || file.endsWith('.md'));
    const files = txtFiles.filter(file => !file.startsWith('_')); // Исключаем дубликаты с префиксом _
    
    if (files.length === 0) {
      return { hasExisting: false, chapters: [] };
    }
    
    // Читаем содержимое файлов и извлекаем информацию о главах
    const chapters = files.map((file, index) => {
        const filePath = path.join(bookDir, file);
        const content = readFileSync(filePath, 'utf8');
        
        // Извлекаем название главы из первой строки (после ##)
        const lines = content.split('\n');
        const titleLine = lines.find(line => line.startsWith('## '));
        const chapterName = titleLine ? titleLine.replace(/^## /, '').trim() : file.replace(/\.(txt|md)$/, '');
        
        return {
          name: chapterName,
          id: `existing_${index + 1}`,
          content: content,
          fileName: file
        };
      });
    
    return { hasExisting: true, chapters, bookDir };
    
  } catch (error) {
    console.error(`Ошибка чтения папки ${bookDir}:`, error.message);
    return { hasExisting: false, chapters: [] };
  }
}

function createBookFromExistingChapters(bookName, chapters) {
  // Создаем объект книги в том же формате, что возвращает getEpubMetadata
  return {
    title: `${bookName} (из готовых файлов)`,
    chapters: chapters
  };
}

module.exports = {
  checkExistingChapters,
  createBookFromExistingChapters,
  OUTPUT_BASE_PATH
};