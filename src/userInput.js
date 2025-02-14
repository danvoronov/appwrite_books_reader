const readline = require('readline');
const { existsSync } = require('fs');
const path = require('path');

async function confirmOverwrite(rl, chapterName) {
  return new Promise((resolve) => {
    rl.question(`\n⚠️  Глава "${chapterName}" уже существует!\n❓ Хотите перезаписать? [Д/н]: `, (answer) => {
      const trimmedAnswer = answer.trim().toLowerCase();
      // Если пустой ответ или 'д' - значит "да"
      resolve(trimmedAnswer === '' || trimmedAnswer === 'д');
    });
  });
}

function checkChapterExists(fileName, chapterName) {
  const bookDir = path.join('./output', fileName);
  const fileToCheck = path.join(bookDir, `${chapterName.replace(/[^a-zA-Z0-9]/g, '_')}.txt`);
  return existsSync(fileToCheck);
}

async function getChapterSelection(chaptersDisplay, chapterNumbers, displayToRealMap, allOption = '0', fileName, bookChapters) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  while (true) {
    const menu = `
╭──────────────────────────────────────────╮
│            Выберите главу                │
├──────────────────────────────────────────┤
${chaptersDisplay}╰──────────────────────────────────────────╯
🔍 Введите номер главы или ${allOption} для всех: `;

    const answer = await new Promise((resolve) => {
      rl.question(menu, (answer) => resolve(answer));
    });

    const trimmedAnswer = answer.trim().toLowerCase();
    
    if (trimmedAnswer === allOption) {
      rl.close();
      return allOption;
    }

    const displayNum = parseInt(trimmedAnswer, 10);
    const realNum = displayToRealMap.get(displayNum);
    
    if (isNaN(displayNum) || !realNum || !chapterNumbers.includes(realNum)) {
      console.log('\n❌ Некорректный ввод. Попробуйте еще раз.');
      continue;
    }

    // Проверяем существование файла
    const chapter = bookChapters[realNum - 1];
    if (checkChapterExists(fileName, chapter.name)) {
      const shouldOverwrite = await confirmOverwrite(rl, chapter.name);
      if (!shouldOverwrite) {
        console.log('\n↩️  Выберите другую главу');
        continue;
      }
    }

    rl.close();
    return realNum.toString();
  }
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