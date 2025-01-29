const fs = require('fs');
const path = require('path');

const in_folder = './output/Привычки'
const folderPath = path.join(__dirname, in_folder);

fs.readdir(folderPath, (err, files) => {
  if (err) {
    console.error("Не удалось прочитать папку:", err);
    return;
  }
  let allModifiedData = '';
  let processedFiles = 0;

  files.sort((a, b) => {
    const getNumber = (filename) => {
      const match = filename.match(/_(\d+)\.txt$/);
      return match ? parseInt(match[1], 10) : -1;
    };
    return getNumber(a) - getNumber(b);
  });

  console.log(files)

  files.forEach(file => {
    const filePath = path.join(folderPath, file);
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        console.error("Не удалось прочитать файл:", file, err);
        return;
      }
      const mdFilePath = path.join('D://Nextcloud/Coding/REM/gemini/output/Привычки_md', `${path.parse(file).name}.md`);

      const lines = data.split('\n');
      if (lines.length > 1 && lines[1].trim() === '') {
        lines.splice(1, 1);
      }
      const modifiedLines = lines.map((line, index) => {
        if (index === 0) {
          return line;
        } else {
          return `\t${line}`;
        }
      });
      const modifiedData = modifiedLines.join('\n');
      allModifiedData += modifiedData + '\n\n';

      fs.writeFile(mdFilePath, modifiedData, (err) => {
        if (err) {
          console.error("Не удалось сохранить файл:", mdFilePath, err);
          return;
        }
        console.log(`Файл ${file} успешно преобразован в ${path.parse(file).name}.md`);
      });

      processedFiles++;

      if (processedFiles === files.length) {
        const mdFilePath = path.join('D://Nextcloud/Coding/REM/gemini/output', 'all_habits.md');
        fs.writeFile(mdFilePath, allModifiedData.trim(), (err) => {
          if (err) {
            console.error("Не удалось сохранить файл:", mdFilePath, err);
            return;
          }
          console.log(`Все файлы успешно преобразованы и сохранены в ${mdFilePath}`);
        });
      }
    });
  });
});
