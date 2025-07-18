const { getEpubMetadata } = require('./src/openEpub');
const { ensureOutputDirectory, writeBookTitle, createCombinedCardsFile, setDisplayOrder } = require('./src/fileUtils');
const { formatChapterInfo, getValidChapterNumbers, mapDisplayNumberToReal } = require('./src/chapterFormatter');
const { getChapterSelection, getChaptersToProcess } = require('./src/userInput');
const { processChapters } = require('./src/bookProcessor');
const { selectBook } = require('./src/bookSelector');
const { checkExistingChapters, createBookFromExistingChapters } = require('./src/existingChapters');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const argv = yargs(hideBin(process.argv))
  .option('n', {
    alias: 'number',
    describe: 'Chapter number to process',
    type: 'number'
  })
  .option('book', {
    alias: 'b',
    describe: 'Book name to process (skip selection)',
    type: 'string'
  })
  .option('force-epub', {
    alias: 'f',
    describe: 'Force reading from epub file even if processed chapters exist',
    type: 'boolean'
  })
  .argv;

(async () => {
  try {
    ensureOutputDirectory();
    
    // Выбираем книгу: либо из параметра командной строки, либо интерактивно
    let fileName;
    if (argv.book) {
      fileName = argv.book;
      console.log(`Используется книга из параметра: ${fileName}`);
    } else {
      fileName = await selectBook();
    }
    
    // Проверяем, есть ли уже обработанные главы
    const existingResult = checkExistingChapters(fileName);
    let book;
    
    if (existingResult.hasExisting && !argv['force-epub']) {
      console.log(`\nИспользуем готовые главы из папки: ${existingResult.bookDir}`);
      console.log(`Для принудительного чтения из epub используйте флаг --force-epub`);
      book = createBookFromExistingChapters(fileName, existingResult.chapters);
    } else {
      if (existingResult.hasExisting && argv['force-epub']) {
        console.log(`\nПринудительное чтение из epub файла (найдены готовые главы, но используется --force-epub)`);
      } else {
        console.log(`\nОбработанные главы не найдены, читаем из epub файла...`);
      }
      book = await getEpubMetadata(fileName);
    }
    
    writeBookTitle(fileName, book.title, book.chapters);

    const chapterNumbers = getValidChapterNumbers(book.chapters);
    const formattedInfo = formatChapterInfo(chapterNumbers, book.chapters, 500, fileName);
    setDisplayOrder(formattedInfo.displayToRealMap);
    
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
      createCombinedCardsFile(fileName);
    } else {
      while (true) {  
        const selectedChapters = await getChapterSelection(formattedInfo.formattedText, chapterNumbers, formattedInfo.displayToRealMap, '0', fileName, book.chapters);
        chaptersToGenerate = getChaptersToProcess(selectedChapters, chapterNumbers, formattedInfo.displayToRealMap);
        await processChapters(book, fileName, chaptersToGenerate);
        createCombinedCardsFile(fileName);
      }
    }
    
  } catch (error) {
    console.error('Произошла ошибка:', error.message);
    process.exit(1);
  }
})();