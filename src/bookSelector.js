const { readdirSync, existsSync, readFileSync, writeFileSync } = require('fs');
const readline = require('readline');
const path = require('path');

const LAST_BOOK_FILE = './last_book.json';

function getAvailableBooks() {
  const epubDir = '../epub';
  
  if (!existsSync(epubDir)) {
    throw new Error(`Папка ${epubDir} не найдена!`);
  }
  
  try {
    const files = readdirSync(epubDir);
    const epubFiles = files
      .filter(file => file.toLowerCase().endsWith('.epub'))
      .map(file => file.replace('.epub', ''));
    
    if (epubFiles.length === 0) {
      throw new Error(`В папке ${epubDir} не найдено .epub файлов!`);
    }
    
    return epubFiles;
  } catch (error) {
    throw new Error(`Ошибка при чтении папки ${epubDir}: ${error.message}`);
  }
}

function getLastSelectedBook() {
  try {
    if (existsSync(LAST_BOOK_FILE)) {
      const data = readFileSync(LAST_BOOK_FILE, 'utf8');
      const parsed = JSON.parse(data);
      return parsed.lastBook;
    }
  } catch (error) {
    console.log('Не удалось прочитать последнюю выбранную книгу:', error.message);
  }
  return null;
}

function saveLastSelectedBook(bookName) {
  try {
    const data = { lastBook: bookName, timestamp: new Date().toISOString() };
    writeFileSync(LAST_BOOK_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.log('Не удалось сохранить последнюю выбранную книгу:', error.message);
  }
}

async function selectBook() {
  const books = getAvailableBooks();
  const lastBook = getLastSelectedBook();
  
  console.log('\n📚 Доступные книги:');
  console.log('┌─────┬─────────────────────────────────────────────┐');
  console.log('│  №  │                 Название                    │');
  console.log('├─────┼─────────────────────────────────────────────┤');
  
  // Показываем последнюю книгу как вариант 0
  if (lastBook && books.includes(lastBook)) {
    console.log(`│  0  │ ${lastBook.padEnd(43)} │ ⭐ (последняя)`);
    console.log('├─────┼─────────────────────────────────────────────┤');
  }
  
  books.forEach((book, index) => {
    const displayIndex = index + 1;
    const isLast = book === lastBook ? ' (последняя)' : '';
    const truncatedName = book.length > 35 ? book.substring(0, 32) + '...' : book;
    console.log(`│ ${displayIndex.toString().padStart(3)} │ ${(truncatedName + isLast).padEnd(43)} │`);
  });
  
  console.log('└─────┴─────────────────────────────────────────────┘');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  while (true) {
    const prompt = lastBook && books.includes(lastBook) 
      ? '\n🎯 Введите номер книги (0 для последней, Enter для последней): '
      : '\n🎯 Введите номер книги: ';
    
    const answer = await new Promise((resolve) => {
      rl.question(prompt, (answer) => resolve(answer));
    });
    
    const trimmedAnswer = answer.trim();
    
    // Если пустой ввод и есть последняя книга - выбираем её
    if (trimmedAnswer === '' && lastBook && books.includes(lastBook)) {
      rl.close();
      console.log(`\n✅ Выбрана книга: ${lastBook}`);
      return lastBook;
    }
    
    // Если введён 0 и есть последняя книга
    if (trimmedAnswer === '0' && lastBook && books.includes(lastBook)) {
      rl.close();
      console.log(`\n✅ Выбрана книга: ${lastBook}`);
      return lastBook;
    }
    
    const bookIndex = parseInt(trimmedAnswer, 10);
    
    if (isNaN(bookIndex) || bookIndex < 1 || bookIndex > books.length) {
      console.log('\n❌ Некорректный номер. Попробуйте ещё раз.');
      continue;
    }
    
    const selectedBook = books[bookIndex - 1];
    rl.close();
    
    // Сохраняем выбранную книгу
    saveLastSelectedBook(selectedBook);
    
    console.log(`\n✅ Выбрана книга: ${selectedBook}`);
    return selectedBook;
  }
}

module.exports = {
  selectBook,
  getAvailableBooks,
  getLastSelectedBook,
  saveLastSelectedBook
};