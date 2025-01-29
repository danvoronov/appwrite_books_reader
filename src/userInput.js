const readline = require('readline');

async function getChapterSelection(chaptersDisplay, chapterNumbers, allOption = '0') {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(
      `Какую главу сгенерировать?\n${chaptersDisplay}\nВведите номер главы или ${allOption} для всех: `,
      (answer) => {
        rl.close();
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
      }
    );
  });
}

function getChaptersToProcess(selectedChapters, chapterNumbers, allOption = '0') {
  return selectedChapters === allOption ? chapterNumbers : [parseInt(selectedChapters, 10)];
}

module.exports = {
  getChapterSelection,
  getChaptersToProcess
}; 