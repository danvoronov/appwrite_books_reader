const { writeFileSync, existsSync, mkdirSync} = require('fs');
const { getEpubMetadata } = require('./src/openEpub');
const { run } = require('./src/llm');

const fileName = '4000weeks';

(async () => {
  try {
    // Проверяем и создаем директорию output если она не существует
    const outputDir = './output';
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir);
    }
    
    const book = await getEpubMetadata(fileName)
    writeFileSync(`./output/${fileName}_ans_0.txt`, `# ${book.title}\n\n`);

    // Filter chapters with content length >= 30 and create their numbers array
    const MIN_CONTENT_LENGTH = 500;  // Увеличим минимальный размер до 500 символов
    const chapterNumbers = book.chapters
      .map((chapter, index) => ({ 
        index: index + 1, 
        length: chapter.content.length,
        name: chapter.name 
      }))
      .filter(chapter => chapter.length >= MIN_CONTENT_LENGTH)
      .map(chapter => chapter.index);

    const allOption = '0';

    // Format chapters in three columns
    const formatChapterInfo = (chapters) => {
      const COLUMNS = 3;
      const rows = Math.ceil(chapters.length / COLUMNS);
      let columns = Array(COLUMNS).fill().map(() => []);
      
      // Distribute chapters into columns
      chapters.forEach((num, index) => {
        const columnIndex = Math.floor(index / rows);
        if (columnIndex < COLUMNS) {
          const chapter = book.chapters[num-1];
          const chapterName = chapter.name.slice(0, 30) + (chapter.name.length > 30 ? '...' : '');
          const contentLength = chapter.content.length;
          if (contentLength >= MIN_CONTENT_LENGTH) {
            columns[columnIndex].push(`${num.toString().padStart(2)}: ${chapterName} (${contentLength})`);
          }
        }
      });

      // Format columns with padding
      const columnWidth = 55;
      let result = '';
      
      // Combine rows from all columns
      for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
        const rowContent = columns.map(column => 
          (column[rowIndex] || '').padEnd(columnWidth)
        ).join('');
        if (rowContent.trim()) {  // Добавляем строку только если в ней есть содержимое
          result += rowContent + '\n';
        }
      }
      
      return result;
    };

    const chaptersDisplay = formatChapterInfo(chapterNumbers);

    const selectedChapters = await new Promise((resolve) => {
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      readline.question(`Какую главу сгенерировать?\n${chaptersDisplay}\nВведите номер главы или ${allOption} для всех: `, (answer) => {
        readline.close();
        const trimmedAnswer = answer.trim().toLowerCase();
        
        if (trimmedAnswer === allOption) {
          resolve(allOption);
        } else {
          const num = parseInt(trimmedAnswer, 10);
          if (isNaN(num) || !chapterNumbers.includes(num)) {
            console.log('Некорректный ввод. Используем первую доступную главу.');
            resolve(chapterNumbers[0].toString());
          } else {
            resolve(trimmedAnswer);
          }
        }
      });
    });

    const chaptersToGenerate = selectedChapters === allOption ? chapterNumbers : [parseInt(selectedChapters, 10)];

    for (let index of chaptersToGenerate) {
      if (index > 0 && index <= book.chapters.length) {
        console.log({index})
        try {
          const chapterContent = book.chapters[index - 1].content;
          const generatedText = await run(chapterContent);

          writeFileSync(`./output/${fileName}_ans_${index}.txt`, `## ${book.chapters[index - 1].name}\n\n` + generatedText);

          await new Promise(resolve => setTimeout(resolve, 4000));
        } catch (error) {
          console.error(`Ошибка при обработке главы ${index}:`, error);
        }
      } else {
        console.log(`Глава ${index} не существует.`);
      }
    }
  } catch (error) {
    console.error('Произошла ошибка:', error);
  }
})();
