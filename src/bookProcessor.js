const { run } = require('./llm');
const { writeChapterOutput } = require('./fileUtils');

async function processChapter(book, fileName, index) {
  if (index > 0 && index <= book.chapters.length) {
    try {
      const chapter = book.chapters[index - 1];
      const generatedJSON = await run(chapter.content);
      
      writeChapterOutput(fileName, index, chapter.name, generatedJSON);
      
      // Wait between chapters to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 4000));
      return true;
    } catch (error) {
      console.error(`Ошибка при обработке главы ${index}:`, error);
      return false;
    }
  } else {
    console.log(`Глава ${index} не существует.`);
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