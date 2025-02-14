const { existsSync } = require('fs');
const path = require('path');

// Helper function to format character count
function formatCharCount(count) {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return count.toString();
}

function checkChapterExists(fileName, chapterName) {
  const bookDir = path.join('./output', fileName);
  const fileToCheck = path.join(bookDir, `${chapterName.replace(/[^a-zA-Z0-9]/g, '_')}.txt`);
  return existsSync(fileToCheck);
}

function formatChapterInfo(chapters, bookChapters, minContentLength, fileName) {
  const COLUMNS = 2;
  let columns = Array(COLUMNS).fill().map(() => []);
  
  // Distribute chapters into columns
  let visibleChapterCount = 0;
  const displayToRealMap = new Map();
  const realToDisplayMap = new Map();
  
  chapters.forEach((num, index) => {
    const chapter = bookChapters[num-1];
    const contentLength = chapter.content.length;
    if (contentLength >= minContentLength) {
      visibleChapterCount++;
      displayToRealMap.set(visibleChapterCount, num);
      realToDisplayMap.set(num, visibleChapterCount);
      
      const chapterName = chapter.name.slice(0, 45) + (chapter.name.length > 45 ? '...' : '');
      const exists = checkChapterExists(fileName, chapter.name);
      const prefix = exists ? '\x1b[32m' : '';
      const suffix = exists ? '\x1b[0m' : '';
      const chapterNum = visibleChapterCount.toString().padStart(2);
      const sizeInfo = formatCharCount(contentLength).padStart(7);
      const warningSymbol = contentLength > 100000 ? '⚠️' : '  ';
      
      // Распределяем по колонкам: чётные в правую, нечётные в левую
      const columnIndex = (visibleChapterCount - 1) % COLUMNS;
      columns[columnIndex].push(`${prefix}[${chapterNum}] ${warningSymbol} ${sizeInfo} — ${chapterName}${suffix}`);
    }
  });

  // Format columns with padding
  const columnWidth = 75;
  let result = '\n';
  
  // Combine rows from all columns
  const maxRows = Math.max(...columns.map(col => col.length));
  for (let rowIndex = 0; rowIndex < maxRows; rowIndex++) {
    const rowContent = columns.map(column => {
      const content = column[rowIndex] || '';
      return content.padEnd(columnWidth);
    }).join('   ');
    
    if (rowContent.trim()) {
      result += rowContent + '\n';
    }
  }
  
  return {
    formattedText: result,
    displayToRealMap,
    realToDisplayMap
  };
}

function getValidChapterNumbers(chapters, minContentLength = 500) {
  const excludeChapters = ['COPYRIGHT', 'CONTENTS', 'NOTES', 'ACKNOWLEDGMENTS', 'INDEX'];
  
  return chapters
    .map((chapter, index) => ({ 
      index: index + 1, 
      length: chapter.content.length,
      name: chapter.name 
    }))
    .filter(chapter => 
      chapter.length >= minContentLength && 
      !excludeChapters.includes(chapter.name.toUpperCase())
    )
    .map(chapter => chapter.index);
}

function mapDisplayNumberToReal(displayNumber, displayToRealMap) {
  return displayToRealMap.get(displayNumber);
}

function mapRealNumberToDisplay(realNumber, realToDisplayMap) {
  return realToDisplayMap.get(realNumber);
}

module.exports = {
  formatChapterInfo,
  getValidChapterNumbers,
  mapDisplayNumberToReal,
  mapRealNumberToDisplay
}; 