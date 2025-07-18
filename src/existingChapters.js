const { existsSync, readdirSync, readFileSync } = require('fs');
const path = require('path');

const OUTPUT_BASE_PATH = 'D:\\Nextcloud\\Coding\\REM\\epub2chapters\\output';

function checkExistingChapters(bookName) {
  const bookDir = path.join(OUTPUT_BASE_PATH, bookName);
  
  if (!existsSync(bookDir)) {
    return { hasExisting: false, chapters: [] };
  }
  
  try {
    const files = readdirSync(bookDir)
      .filter(file => file.endsWith('.txt'))
      .filter(file => !file.startsWith('_')); // Исключаем дубликаты с префиксом _
    
    if (files.length === 0) {
      return { hasExisting: false, chapters: [] };
    }
    
    console.log(`\n📁 Найдена папка с обработанными главами: ${bookDir}`);
    console.log(`📄 Найдено ${files.length} текстовых файлов`);
    
    // Читаем содержимое файлов и извлекаем информацию о главах
    const chapters = files.map((file, index) => {
      const filePath = path.join(bookDir, file);
      const content = readFileSync(filePath, 'utf8');
      
      // Извлекаем название главы из первой строки (после ##)
      const lines = content.split('\n');
      const titleLine = lines.find(line => line.startsWith('## '));
      const chapterName = titleLine ? titleLine.replace(/^## /, '').trim() : file.replace('.txt', '');
      
      return {
        name: chapterName,
        id: `existing_${index + 1}`,
        content: content,
        fileName: file
      };
    });
    
    return { hasExisting: true, chapters, bookDir };
    
  } catch (error) {
    console.log(`⚠️ Ошибка при чтении папки ${bookDir}:`, error.message);
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