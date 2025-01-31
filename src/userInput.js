const readline = require('readline');

async function getChapterSelection(chaptersDisplay, chapterNumbers, displayToRealMap, allOption = '0') {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(
      `\nВКакую главу сгенерировать?\n${chaptersDisplay}\nВведите номер главы или ${allOption} для всех: `,
      (answer) => {
        rl.close();
        const trimmedAnswer = answer.trim().toLowerCase();
        
        if (trimmedAnswer === allOption) {
          resolve(allOption);
        } else {
          const displayNum = parseInt(trimmedAnswer, 10);
          const realNum = displayToRealMap.get(displayNum);
          
          if (isNaN(displayNum) || !realNum || !chapterNumbers.includes(realNum)) {
            console.log('Некорректный ввод. Используем первую доступную главу.');
            resolve(displayToRealMap.get(1).toString());
          } else {
            resolve(realNum.toString());
          }
        }
      }
    );
  });
}

function getChaptersToProcess(selectedChapters, chapterNumbers, displayToRealMap, allOption = '0') {
  if (selectedChapters === allOption) {
    return chapterNumbers;
  }
  
  const realChapterNum = parseInt(selectedChapters, 10);
  return [realChapterNum];
}

module.exports = {
  getChapterSelection,
  getChaptersToProcess
}; 