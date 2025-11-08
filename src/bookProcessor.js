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
          // Ждем немного перед следующей попыткой
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        
        if (!success) {
          return false;
        }

        // Wait between chapters to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 4000));
        return true;
      } catch (error) {
        if (attempt === maxRetries) {
          console.error(`Ошибка обработки главы ${index}:`, error.message);
          return false;
        }
        // Ждем немного перед следующей попыткой
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  } else {
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