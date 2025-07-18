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
    console.log(`Проверяем путь: ${path.resolve(testPath)}`);
    if (existsSync(testPath)) {
      bookDir = testPath;
      console.log(`Найдена папка: ${path.resolve(bookDir)}`);
      break;
    }
  }
  
  if (!bookDir) {
    console.log(`Папка для книги "${bookName}" не найдена ни по одному из путей`);
    return { hasExisting: false, chapters: [] };
  }
  
  try {
    const allFiles = readdirSync(bookDir);
    console.log(`Все файлы в папке: ${allFiles.join(', ')}`);
    
    const mdFiles = allFiles.filter(file => file.endsWith('.md'));
    console.log(`Файлы .md: ${mdFiles.join(', ')}`);
    
    const files = mdFiles.filter(file => !file.startsWith('_')); // Исключаем дубликаты с префиксом _
    console.log(`Файлы .md без префикса _: ${files.join(', ')}`);
    
    if (files.length === 0) {
      console.log(`В папке ${bookDir} нет подходящих .md файлов`);
      return { hasExisting: false, chapters: [] };
    }
    
    console.log(`Найдены markdown файлы: ${files.length}`);
    
    // Читаем содержимое файлов и извлекаем информацию о главах
    const chapters = files
      .map((file, index) => {
        const filePath = path.join(bookDir, file);
        const content = readFileSync(filePath, 'utf8');
        
        // Фильтруем главы меньше 5кб
        if (content.length < 5000) {
          return null;
        }
        
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
      })
      .filter(chapter => chapter !== null);
    
    console.log(`Загружено ${chapters.length} глав (размер >= 5кб)`);
    
    return { hasExisting: true, chapters, bookDir };
    
  } catch (error) {
    console.log(`Ошибка при чтении папки ${bookDir}:`, error.message);
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