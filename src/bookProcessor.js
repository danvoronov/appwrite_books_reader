const { run } = require('./llm');
const { writeChapterOutput } = require('./fileUtils');

async function processChapter(book, fileName, index, maxRetries = 3) {
  if (index > 0 && index <= book.chapters.length) {
    const chapter = book.chapters[index - 1];
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const generatedJSON = await run(chapter.content);
        const success = writeChapterOutput(fileName, index, chapter.name, generatedJSON);
        
        if (!success && attempt < maxRetries) {
          console.log(`\n🔄 Попытка ${attempt + 1} из ${maxRetries}...`);
          // Ждем немного перед следующей попыткой
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        
        if (!success) {
          console.log(`\n❌ Все попытки исчерпаны для главы ${chapter.name}`);
          return false;
        }

        // Wait between chapters to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 4000));
        return true;
      } catch (error) {
        console.error(`\n⚠️ Ошибка при обработке главы ${index} (попытка ${attempt}):`, error);
        if (attempt === maxRetries) {
          return false;
        }
        // Ждем немного перед следующей попыткой
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  } else {
    console.log(`\n❌ Глава ${index} не существует.`);
    return false;
  }
}

async function processChapters(book, fileName, chaptersToProcess) {
  const results = [];
  for (const index of chaptersToProcess) {
    const success = await processChapter(book, fileName, index);
    results.push({ index, success });
  }
  return results;
}

module.exports = {
  processChapter,
  processChapters
}; 