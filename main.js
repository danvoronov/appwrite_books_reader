const { getEpubMetadata } = require('./src/openEpub');
const { ensureOutputDirectory, writeBookTitle } = require('./src/fileUtils');
const { formatChapterInfo, getValidChapterNumbers, mapDisplayNumberToReal } = require('./src/chapterFormatter');
const { getChapterSelection, getChaptersToProcess } = require('./src/userInput');
const { processChapters } = require('./src/bookProcessor');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const argv = yargs(hideBin(process.argv))
  .option('n', {
    alias: 'number',
    describe: 'Chapter number to process',
    type: 'number'
  })
  .argv;

const fileName = '4000weeks';

(async () => {
  try {
    ensureOutputDirectory();
    
    const book = await getEpubMetadata(fileName);
    writeBookTitle(fileName, book.title);

    const chapterNumbers = getValidChapterNumbers(book.chapters);
    const formattedInfo = formatChapterInfo(chapterNumbers, book.chapters, 500);
    
    let chaptersToGenerate;
    if (argv.n !== undefined) {
      // If chapter number is provided via command line
      console.log('Available display numbers:', Array.from(formattedInfo.displayToRealMap.keys()));
      
      if (!formattedInfo.displayToRealMap.has(argv.n)) {
        throw new Error(`Invalid chapter number: ${argv.n}. Available numbers: ${Array.from(formattedInfo.displayToRealMap.keys()).join(', ')}`);
      }
      
      const realChapterNumber = formattedInfo.displayToRealMap.get(argv.n);
      chaptersToGenerate = [realChapterNumber];

      await processChapters(book, fileName, chaptersToGenerate);
    } else {
      // повторять этот цикл, пока не будет введено 666
      while (true) {  
        const selectedChapters = await getChapterSelection(formattedInfo.formattedText, chapterNumbers, formattedInfo.displayToRealMap);
        chaptersToGenerate = getChaptersToProcess(selectedChapters, chapterNumbers, formattedInfo.displayToRealMap);
        await processChapters(book, fileName, chaptersToGenerate);
        if (chaptersToGenerate === '666') {
          break;
        }
      }
      
    }
    

    
  } catch (error) {
    console.error('Произошла ошибка:', error);
  }
})();
