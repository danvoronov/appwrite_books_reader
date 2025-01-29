const { getEpubMetadata } = require('./src/openEpub');
const { ensureOutputDirectory, writeBookTitle } = require('./src/fileUtils');
const { formatChapterInfo, getValidChapterNumbers } = require('./src/chapterFormatter');
const { getChapterSelection, getChaptersToProcess } = require('./src/userInput');
const { processChapters } = require('./src/bookProcessor');

const fileName = '4000weeks';

(async () => {
  try {
    ensureOutputDirectory();
    
    const book = await getEpubMetadata(fileName);
    writeBookTitle(fileName, book.title);

    const chapterNumbers = getValidChapterNumbers(book.chapters);
    const chaptersDisplay = formatChapterInfo(chapterNumbers, book.chapters, 500);
    
    const selectedChapters = await getChapterSelection(chaptersDisplay, chapterNumbers);
    const chaptersToGenerate = getChaptersToProcess(selectedChapters, chapterNumbers);
    
    await processChapters(book, fileName, chaptersToGenerate);
    
  } catch (error) {
    console.error('Произошла ошибка:', error);
  }
})();
