const fastify = require('fastify')({ logger: true });
const path = require('path');

// Регистрируем плагины
fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, 'public'),
  prefix: '/'
});

fastify.register(require('@fastify/formbody'));
fastify.register(require('@fastify/websocket'));

// Импортируем наши модули
const { getAvailableBooks, getLastSelectedBook, saveLastSelectedBook } = require('./src/bookSelector');
const { getEpubMetadata } = require('./src/openEpub');
const { ensureOutputDirectory, writeBookTitle, createCombinedCardsFile, setDisplayOrder } = require('./src/fileUtils');
const { formatChapterInfo, getValidChapterNumbers } = require('./src/chapterFormatter');
const { processChapters } = require('./src/bookProcessor');
const { checkExistingChapters, createBookFromExistingChapters } = require('./src/existingChapters');

// Хранилище активных сессий
const sessions = new Map();

// WebSocket для real-time обновлений
fastify.register(async function (fastify) {
  fastify.get('/ws', { websocket: true }, (connection, req) => {
    const sessionId = req.query.sessionId;
    if (sessionId) {
      sessions.set(sessionId, connection);
      connection.socket.on('close', () => {
        sessions.delete(sessionId);
      });
    }
  });
});

// API Routes

// Получить системную инструкцию
fastify.get('/api/system-instruction', async (request, reply) => {
  try {
    const fs = require('fs');
    const systemInstruction = fs.readFileSync('./data/systemInstruction.txt', 'utf8');
    return { systemInstruction };
  } catch (error) {
    reply.code(500).send({ error: error.message });
  }
});

// Сохранить системную инструкцию
fastify.post('/api/system-instruction', async (request, reply) => {
  try {
    const { systemInstruction } = request.body;
    
    if (!systemInstruction) {
      return reply.code(400).send({ error: 'System instruction is required' });
    }

    const fs = require('fs');
    // Создаем резервную копию
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = `./data/systemInstruction_backup_${timestamp}.txt`;
    fs.copyFileSync('./data/systemInstruction.txt', backupFile);
    
    // Сохраняем новую инструкцию
    fs.writeFileSync('./data/systemInstruction.txt', systemInstruction);
    
    return { success: true, backupFile };
  } catch (error) {
    reply.code(500).send({ error: error.message });
  }
});

// Открыть файл в Windows
fastify.post('/api/open-file', async (request, reply) => {
  try {
    const { bookName, chapterName } = request.body;
    const { exec } = require('child_process');
    const fs = require('fs');
    
    if (!bookName || !chapterName) {
      return reply.code(400).send({ error: 'Book name and chapter name are required' });
    }
    
    // Формируем путь к файлу
    const outputDir = path.join('./output', bookName);
    const filePath = path.join(outputDir, `${chapterName}.md`);
    
    // Проверяем существование файла
    if (!fs.existsSync(filePath)) {
      return reply.code(404).send({ error: 'Файл не найден: ' + filePath });
    }
    
    // Получаем абсолютный путь
    const absolutePath = path.resolve(filePath);
    
    // Открываем файл в Windows (с помощью ассоциированной программы)
    exec(`start "" "${absolutePath}"`, (error) => {
      if (error) {
        console.error('Ошибка открытия файла:', error);
      }
    });
    
    return { success: true, filePath: absolutePath };
  } catch (error) {
    reply.code(500).send({ error: error.message });
  }
});

// Health check
fastify.get('/api/health', async (request, reply) => {
  try {
    const books = getAvailableBooks();
    return { 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      booksCount: books.length,
      version: '1.0.0'
    };
  } catch (error) {
    reply.code(500).send({ 
      status: 'ERROR', 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Получить список доступных книг
fastify.get('/api/books', async (request, reply) => {
  try {
    const books = getAvailableBooks();
    const lastBook = getLastSelectedBook();
    return { books, lastBook };
  } catch (error) {
    reply.code(500).send({ error: error.message });
  }
});

// Получить информацию о книге и главах
fastify.post('/api/book/info', async (request, reply) => {
  try {
    const { bookName, forceEpub = false } = request.body;
    
    if (!bookName) {
      return reply.code(400).send({ error: 'Book name is required' });
    }

    ensureOutputDirectory();
    
    // Всегда читаем из epub для получения полного списка глав
    const book = await getEpubMetadata(bookName);
    
    // Проверяем существующие обработанные главы
    const existingResult = checkExistingChapters(bookName);
    
    // Создаем объединенный список глав (из epub + существующие файлы, которых нет в epub)
    const allChapters = [...book.chapters];
    let nextId = book.chapters.length + 1;
    
    // Добавляем главы из существующих файлов, которых нет в epub
    if (existingResult.hasExisting) {
      existingResult.chapters.forEach(existingChapter => {
        const normalizedExistingName = existingChapter.name.replace(/\s+/g, '_');
        const foundInEpub = book.chapters.some(epubChapter => {
          const normalizedEpubName = epubChapter.name.replace(/\s+/g, '_');
          return normalizedEpubName === normalizedExistingName;
        });
        
        if (!foundInEpub) {
          // Эта глава есть в output, но нет в epub (возможно, была отфильтрована как < 5кб)
          allChapters.push({
            name: existingChapter.name,
            content: existingChapter.content,
            group: null // Главы из файлов без группы
          });
        }
      });
    }
    
    const chapterNumbers = getValidChapterNumbers(allChapters);
    const formattedInfo = formatChapterInfo(chapterNumbers, allChapters, 500, bookName);
    
    // Записываем заголовок книги и ВСЕ главы (включая добавленные из файлов)
    writeBookTitle(bookName, book.title, allChapters);
    setDisplayOrder(formattedInfo.displayToRealMap);
    
    // Сохраняем последнюю выбранную книгу
    saveLastSelectedBook(bookName);
    
    return {
      book: {
        title: book.title,
        chaptersCount: allChapters.length
      },
      chapters: chapterNumbers.map(num => {
        const chapter = allChapters[num - 1];
        
        // Проверяем что глава существует
        if (!chapter || !chapter.name || !chapter.content) {
          console.error(`Chapter ${num} is invalid:`, chapter);
          return null;
        }
        
        const displayNum = formattedInfo.realToDisplayMap.get(num);
        // Нормализуем имена для сравнения
        const normalizedChapterName = chapter.name.replace(/\s+/g, '_');
        const exists = existingResult.hasExisting && existingResult.chapters.some(c => {
          const normalizedExistingName = c.name.replace(/\s+/g, '_');
          return normalizedExistingName === normalizedChapterName;
        });
        return {
          realNumber: num,
          displayNumber: displayNum,
          name: chapter.name,
          contentLength: chapter.content.length,
          exists: exists,
          group: chapter.group || null
        };
      }).filter(ch => ch !== null), // Убираем невалидные главы
      displayToRealMap: Object.fromEntries(formattedInfo.displayToRealMap)
    };
  } catch (error) {
    console.error('❌ Error in /api/book/info:', error.message);
    console.error('Stack trace:', error.stack);
    reply.code(500).send({ error: error.message });
  }
});

// Обработать главы
fastify.post('/api/process', async (request, reply) => {
  try {
    const { bookName, chapters, sessionId } = request.body;
    
    if (!bookName || !chapters || !Array.isArray(chapters)) {
      return reply.code(400).send({ error: 'Book name and chapters array are required' });
    }

    // Получаем WebSocket соединение для уведомлений
    const wsConnection = sessions.get(sessionId);
    
    const sendProgress = (message) => {
      if (wsConnection) {
        wsConnection.socket.send(JSON.stringify({ type: 'progress', message }));
      }
    };

    // Загружаем книгу
    sendProgress('Загружаем данные книги...');
    const existingResult = checkExistingChapters(bookName);
    let book;
    
    if (existingResult.hasExisting) {
      book = createBookFromExistingChapters(bookName, existingResult.chapters);
    } else {
      book = await getEpubMetadata(bookName);
    }

    writeBookTitle(bookName, book.title, book.chapters);

    // Обрабатываем главы
    sendProgress(`Начинаем обработку ${chapters.length} глав...`);
    
    const results = [];
    for (let i = 0; i < chapters.length; i++) {
      const chapterNum = chapters[i];
      const chapter = book.chapters[chapterNum - 1];
      
      sendProgress(`Обрабатываем главу ${i + 1}/${chapters.length}: ${chapter.name}`);
      
      try {
        const result = await processChapterWithProgress(book, bookName, chapterNum, wsConnection);
        results.push({ 
          chapterNumber: chapterNum, 
          chapterName: chapter.name,
          success: result.success,
          data: result.data
        });
        
        if (result.success) {
          sendProgress(`✅ Глава "${chapter.name}" обработана успешно`);
          // Отправляем результат для отображения в правой колонке
          if (wsConnection) {
            wsConnection.socket.send(JSON.stringify({
              type: 'chapter_result',
              chapterNumber: chapterNum,
              chapterName: chapter.name,
              data: result.data
            }));
          }
        } else {
          sendProgress(`❌ Ошибка при обработке главы "${chapter.name}"`);
        }
      } catch (error) {
        sendProgress(`❌ Ошибка при обработке главы "${chapter.name}": ${error.message}`);
        results.push({ 
          chapterNumber: chapterNum, 
          chapterName: chapter.name,
          success: false,
          error: error.message 
        });
      }
    }

    // Создаем объединенный файл
    sendProgress('Создаем объединенный файл...');
    createCombinedCardsFile(bookName);
    sendProgress('✅ Обработка завершена!');

    return { success: true, results };
  } catch (error) {
    const wsConnection = sessions.get(request.body.sessionId);
    if (wsConnection) {
      wsConnection.socket.send(JSON.stringify({ 
        type: 'error', 
        message: `Ошибка: ${error.message}` 
      }));
    }
    reply.code(500).send({ error: error.message });
  }
});

// Функция для обработки одной главы с прогрессом
async function processChapterWithProgress(book, fileName, index, wsConnection, maxRetries = 3) {
  const { runWithProgress, reloadSystemInstruction } = require('./src/llmWeb');
  const { writeChapterOutput } = require('./src/fileUtils');
  
  // Перезагружаем системную инструкцию на случай изменений
  reloadSystemInstruction();
  
  if (index > 0 && index <= book.chapters.length) {
    const chapter = book.chapters[index - 1];
    
    const sendProgress = (data) => {
      if (wsConnection) {
        wsConnection.socket.send(JSON.stringify(data));
      }
    };
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const generatedJSON = await runWithProgress(chapter.content, sendProgress);
        
        if (!generatedJSON || !generatedJSON.chapter_summary) {
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }
          return { success: false, data: null };
        }
        
        const success = writeChapterOutput(fileName, index, chapter.name, generatedJSON);
        
        if (!success && attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        
        if (!success) {
          return { success: false, data: null };
        }

        await new Promise(resolve => setTimeout(resolve, 4000));
        return { success: true, data: generatedJSON };
      } catch (error) {
        sendProgress({ type: 'error', message: `Attempt ${attempt} failed: ${error.message}` });
        if (attempt === maxRetries) {
          return { success: false, data: null };
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
  return { success: false, data: null };
}

// Статический маршрут для главной страницы
fastify.get('/', async (request, reply) => {
  return reply.sendFile('index.html');
});

// Запуск сервера
const start = async () => {
  try {
    await fastify.listen({ port: 3456, host: '0.0.0.0' });
    console.log('🚀 Веб-сервер запущен на http://localhost:3456');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();