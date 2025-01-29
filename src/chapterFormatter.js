function formatChapterInfo(chapters, bookChapters, minContentLength) {
  const COLUMNS = 3;
  const rows = Math.ceil(chapters.length / COLUMNS);
  let columns = Array(COLUMNS).fill().map(() => []);
  
  // Distribute chapters into columns
  let visibleChapterCount = 0;
  const displayToRealMap = new Map();
  const realToDisplayMap = new Map();
  
  chapters.forEach((num, index) => {
    const columnIndex = Math.floor(index / rows);
    if (columnIndex < COLUMNS) {
      const chapter = bookChapters[num-1];
      const chapterName = chapter.name.slice(0, 30) + (chapter.name.length > 30 ? '...' : '');
      const contentLength = chapter.content.length;
      if (contentLength >= minContentLength) {
        visibleChapterCount++;
        displayToRealMap.set(visibleChapterCount, num);
        realToDisplayMap.set(num, visibleChapterCount);
        columns[columnIndex].push(`[${visibleChapterCount.toString().padStart(2)}] ${chapterName} (${contentLength})`);
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
  return chapters
    .map((chapter, index) => ({ 
      index: index + 1, 
      length: chapter.content.length,
      name: chapter.name 
    }))
    .filter(chapter => chapter.length >= minContentLength)
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