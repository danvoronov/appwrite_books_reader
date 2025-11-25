const fastify = require('fastify')({ logger: true });
const path = require('path');

// Регистрируем плагины
fastify.register(require('@fastify/static'), { // public assets
  root: path.join(__dirname, 'public'),
  prefix: '/'
});

// Отдаём экспорт Moon+ Reader напрямую, чтобы фронт мог читать /moonreader_notes.json
fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, 'output'),
  prefix: '/out/',
  decorateReply: false
});

fastify.register(require('@fastify/formbody'));
fastify.register(require('@fastify/websocket'));

// Импортируем наши модули
const { getAvailableBooks, getLastSelectedBook, saveLastSelectedBook } = require('./src/bookSelector');
const { ensureOutputDirectory, writeBookTitle, setDisplayOrder, createCombinedCardsFile } = require('./src/fileUtils');
const { getEpubMetadata } = require('./src/openEpub');
const { checkExistingChapters, createBookFromExistingChapters } = require('./src/existingChapters');
const { formatChapterInfo, getValidChapterNumbers } = require('./src/chapterFormatter');

// WebSocket настраивается ниже в fastify.register

// Получить лог обработки (возвращает объект)
fastify.get('/api/log', async (request, reply) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const logPath = path.join(__dirname, 'output', 'REFACTORING_CHANGELOG.md');
    if (!fs.existsSync(logPath)) {
      return { success: true, log: 'Лог отсутствует' };
    }
    const content = fs.readFileSync(logPath, 'utf8');
    return { success: true, log: content };
  } catch (error) {
    reply.code(500).send({ error: error.message });
  }
});

// Удалены дублирующиеся регистрации и импорты ниже

// Хранилище активных сессий
const sessions = new Map();

// WebSocket для real-time обновлений
fastify.register(async function (fastify) {
  fastify.get('/ws', { websocket: true }, (connection, req) => {
    const sessionId = req.query.sessionId;
    console.log('🔌 WebSocket подключение, sessionId:', sessionId);
    
    if (sessionId) {
      sessions.set(sessionId, connection);
      console.log('✅ WebSocket сессия зарегистрирована:', sessionId, '| Всего активных сессий:', sessions.size);
      
      connection.socket.on('close', () => {
        sessions.delete(sessionId);
        console.log('🔌 WebSocket сессия закрыта:', sessionId, '| Осталось активных сессий:', sessions.size);
      });
      
      connection.socket.on('error', (error) => {
        console.error('❌ WebSocket ошибка для сессии', sessionId, ':', error);
      });
    } else {
      console.warn('⚠️ WebSocket подключение без sessionId');
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

// Удалено: get-chapter-html (возврат к markdown-потоку)
/* fastify.post('/api/get-chapter-html', async (request, reply) => {
  try {
    const { bookName, chapterHref, chapterId, chapterIndex } = request.body;
    const { EPub } = require('epub2');
    
    if (!bookName) {
      return reply.code(400).send({ error: 'Book name is required' });
    }
    
    // Открываем EPUB напрямую (не через markdown-обработчик)
    const epubPath = `../epub/${bookName}.epub`;
    const epub = await EPub.createAsync(epubPath);

    let html = null;

    // 1) Если есть ID — пробуем по нему
    if (chapterId) {
      try {
        html = await epub.getChapterAsync(chapterId);
      } catch (_) {}
    }

    // 2) Если по ID не получилось — пробуем найти по href
    if (!html && chapterHref) {
      const hrefNoAnchor = chapterHref.split('#')[0];
      const entry = Object.entries(epub.manifest).find(([, item]) => item.href === hrefNoAnchor || item.href.endsWith(hrefNoAnchor));
      if (entry) {
        const [manifestId] = entry;
        try {
          html = await epub.getChapterAsync(manifestId);
        } catch (_) {}
      }
    }

    // 3) Если ничего — попробуем через getEpubMetadata и индекс (fallback)
    if (!html && chapterIndex) {
      const book = await getEpubMetadata(bookName);
      if (book && book.chapters && book.chapters[chapterIndex - 1]) {
        html = book.chapters[chapterIndex - 1].content; // может быть markdown, но хоть что-то
      }
    }

    if (!html) {
      return reply.code(404).send({ error: 'Не удалось получить содержимое главы' });
    }

    return { html };
  } catch (error) {
    console.error('Error getting chapter html:', error);
    reply.code(500).send({ error: error.message });
  }
}); */

// Получить исходный текст главы из epub для читалки (markdown fallback)
fastify.post('/api/get-chapter-raw', async (request, reply) => {
  try {
    const { bookName, chapterIndex } = request.body;
    
    if (!bookName || !chapterIndex) {
      return reply.code(400).send({ error: 'Book name and chapter index are required' });
    }
    
    const book = await getEpubMetadata(bookName);
    if (!book || !book.chapters || chapterIndex < 1 || chapterIndex > book.chapters.length) {
      return reply.code(404).send({ error: 'Глава не найдена' });
    }
    const chapter = book.chapters[chapterIndex - 1];
    return { content: chapter.content };
  } catch (error) {
    console.error('Error getting chapter raw:', error);
    reply.code(500).send({ error: error.message });
  }
});

// Отдать ресурс из EPUB (картинки, стили)
fastify.get('/api/epub-asset', async (request, reply) => {
  try {
    const bookName = request.query.book;
    let href = request.query.href;
    if (!bookName || !href) {
      return reply.code(400).send({ error: 'book and href are required' });
    }
    href = href.replace(/^\/+/, '');
    const { EPub } = require('epub2');
    const epub = await EPub.createAsync(`../epub/${bookName}.epub`);
    const manifestEntry = Object.entries(epub.manifest).find(([id, item]) => item.href === href || item.href.endsWith(href));
    if (!manifestEntry) return reply.code(404).send({ error: 'Asset not found' });
    const [id, item] = manifestEntry;
    let data;
    try {
      data = await epub.getFileAsync(id);
    } catch (e) {
      return reply.code(404).send({ error: 'Asset read error' });
    }
    const ext = (item.href.split('.').pop() || '').toLowerCase();
    const typeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', svg: 'image/svg+xml', css: 'text/css', html: 'text/html' };
    const ctype = item['media-type'] || typeMap[ext] || 'application/octet-stream';
    reply.header('Content-Type', ctype).send(data);
  } catch (error) {
    console.error('epub-asset error:', error);
    reply.code(500).send({ error: error.message });
  }
});

// Получить содержимое главы для читалки
fastify.post('/api/get-chapter-content', async (request, reply) => {
  try {
    const { bookName, chapterName } = request.body;
    const fs = require('fs');
    
    if (!bookName || !chapterName) {
      return reply.code(400).send({ error: 'Book name and chapter name are required' });
    }
    
    const outputDir = path.join('./output', bookName);
    
    if (!fs.existsSync(outputDir)) {
      return reply.code(404).send({ error: 'Папка с главами не найдена' });
    }
    
    // Нормализуем имя главы для поиска файла
    const normalizedChapterName = chapterName.replace(/\s+/g, '_');
    
    // Ищем файл
    const files = fs.readdirSync(outputDir)
      .filter(f => (f.endsWith('.txt') || f.endsWith('.md')) && !f.startsWith('_'));
    
    const file = files.find(f => {
      const fileBaseName = f.replace(/\.(txt|md)$/, '').replace(/^\d+\s*-\s*/, '');
      return fileBaseName.includes(normalizedChapterName) || normalizedChapterName.includes(fileBaseName);
    });
    
    if (!file) {
      return reply.code(404).send({ error: 'Файл главы не найден' });
    }
    
    const filePath = path.join(outputDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    return { content };
  } catch (error) {
    console.error('Error getting chapter content:', error);
    reply.code(500).send({ error: error.message });
  }
});

// Получить саммари всех обработанных глав
fastify.post('/api/get-summaries', async (request, reply) => {
  try {
    const { bookName } = request.body;
    const fs = require('fs');
    
    if (!bookName) {
      return reply.code(400).send({ error: 'Book name is required' });
    }
    
    const outputDir = path.join('./output', bookName);
    
    if (!fs.existsSync(outputDir)) {
      return reply.code(404).send({ error: 'Папка с главами не найдена' });
    }
    
    // Читаем все файлы
    const files = fs.readdirSync(outputDir)
      .filter(f => (f.endsWith('.txt') || f.endsWith('.md')) && !f.startsWith('_'))
      .sort();
    
    const summaries = [];
    
    for (const file of files) {
      const filePath = path.join(outputDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Извлекаем название главы и саммари
      const lines = content.split('\n');
      let chapterName = file.replace(/\.(txt|md)$/, '');
      let summary = '';
      
      // Ищем название главы (строка начинается с ##)
      const titleLine = lines.find(line => line.trim().startsWith('## '));
      if (titleLine) {
        chapterName = titleLine.replace(/^##\s*/, '').trim();
      }
      
      // Извлекаем саммари (текст между ## и ###)
      let inSummary = false;
      for (const line of lines) {
        if (line.trim().startsWith('## ')) {
          inSummary = true;
          continue;
        }
        if (line.trim().startsWith('### ')) {
          break; // Начались карточки
        }
        if (inSummary && line.trim()) {
          summary += line + '\n';
        }
      }
      
      summaries.push({
        fileName: file,
        chapterName,
        summary: summary.trim()
      });
    }
    
    return { summaries };
  } catch (error) {
    console.error('Error getting summaries:', error);
    reply.code(500).send({ error: error.message });
  }
});

// Tags: request and save JSON
fastify.post('/api/tags/request', async (request, reply) => {
  const startTs = Date.now();
  try {
    const { bookName, chapterIndex } = request.body || {};
    fastify.log.info({ bookName, chapterIndex }, 'tags/request: start');
    if (!bookName || !chapterIndex) {
      fastify.log.warn('tags/request: missing bookName or chapterIndex');
      return reply.code(400).send({ error: 'Book name and chapter index are required' });
    }
    const { getEpubMetadata } = require('./src/openEpub');
    const { writeJsonOutput } = require('./src/fileUtils');
    const { runWithInstructionFile } = require('./src/llmWeb');

    const metaTs = Date.now();
    const book = await getEpubMetadata(bookName);
    fastify.log.info({ dt: Date.now()-metaTs }, 'tags/request: got metadata');
    if (!book || !book.chapters || chapterIndex < 1 || chapterIndex > book.chapters.length) {
      fastify.log.warn('tags/request: chapter not found');
      return reply.code(404).send({ error: 'Глава не найдена' });
    }
    const chapter = book.chapters[chapterIndex - 1];
    fastify.log.info({ name: chapter.name, len: (chapter.content||'').length }, 'tags/request: chapter ready');

    // Run LLM with tag system instruction
    const instructionPath = './data/tag_systemInstruction.txt';
    const llmStart = Date.now();
    const data = await runWithInstructionFile(chapter.content, instructionPath, (evt) => {
      try { fastify.log.info({ evt }, 'tags/request: llm progress'); } catch(_) { console.log('LLM:', evt); }
    });
    fastify.log.info({ dt: Date.now()-llmStart }, 'tags/request: llm done');

    // Save JSON
    const saveStart = Date.now();
    const filePath = writeJsonOutput(bookName, chapter.name, data, 'tags');
    fastify.log.info({ dt: Date.now()-saveStart, filePath }, 'tags/request: saved');
    if (!filePath) {
      fastify.log.error('tags/request: failed to save');
      return reply.code(500).send({ error: 'Не удалось сохранить результат' });
    }
    const totalDt = Date.now()-startTs;
    fastify.log.info({ totalDt }, 'tags/request: done');
    return { success: true, filePath };
  } catch (error) {
    try { fastify.log.error(error, 'tags/request: error'); } catch(_) { console.error(error); }
    reply.code(500).send({ error: error.message });
  }
});

// Get tags JSON for chapter
fastify.post('/api/tags/get', async (request, reply) => {
  try {
    const { bookName, chapterName } = request.body || {};
    if (!bookName || !chapterName) {
      return reply.code(400).send({ error: 'bookName and chapterName required' });
    }
    const { ensureBookDirectory } = require('./src/fileUtils');
    const path = require('path');
    const fs = require('fs');
    const bookDir = ensureBookDirectory(bookName);
    const baseName = chapterName.replace(/[^a-zA-Z0-9]/g, '_');
    const filePath = path.join(bookDir, `${baseName}.tags.json`);
    if (!fs.existsSync(filePath)) {
      return reply.code(404).send({ error: 'Tags not found' });
    }
    const content = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(content);
    return { success: true, data: json, filePath };
  } catch (error) {
    request.log.error(error);
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
    // augment with notes index
    const fs = require('fs');
    let index = [];
    try {
      const raw = fs.readFileSync('./output/moonreader_index.json','utf8');
      index = JSON.parse(raw);
    } catch(_) {}
    const notesMap = new Map(index.map(x => [x.linkedEpub?.name || x.book, x]));
    const booksInfo = books.map(name => ({ name, hasNotes: !!notesMap.get(name) }));
    return { books: booksInfo, lastBook };
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
        const path = require('path');
        const fs = require('fs');
        const bookDir = path.join('./output', bookName);
        const baseName = chapter.name.replace(/[^a-zA-Z0-9]/g, '_');
        const hasTags = fs.existsSync(path.join(bookDir, `${baseName}.tags.json`));
        return {
          realNumber: num,
          displayNumber: displayNum,
          name: chapter.name,
          href: chapter.href || null,
          contentLength: chapter.content.length,
          exists: exists,
          hasTags: hasTags,
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
    console.log('📥 /api/process запрос получен:', { bookName, chapters, sessionId });
    
    if (!bookName || !chapters || !Array.isArray(chapters)) {
      console.error('❌ Некорректный запрос: отсутствуют обязательные поля');
      return reply.code(400).send({ error: 'Book name and chapters array are required' });
    }

    // Получаем WebSocket соединение для уведомлений
    const wsConnection = sessions.get(sessionId);
    console.log('🔍 WebSocket соединение для sessionId', sessionId, ':', wsConnection ? 'найдено' : 'НЕ НАЙДЕНО');
    
    const sendProgress = (message) => {
      console.log('📤 Отправка прогресса:', message);
      if (wsConnection) {
        try {
          wsConnection.socket.send(JSON.stringify({ type: 'progress', message }));
          console.log('✅ Прогресс отправлен успешно');
        } catch (error) {
          console.error('❌ Ошибка отправки прогресса:', error);
        }
      } else {
        console.warn('⚠️ WebSocket не найден, сообщение не отправлено');
      }
    };

    // Загружаем книгу
    console.log('📚 Загружаем данные книги:', bookName);
    sendProgress('Загружаем данные книги...');
    const existingResult = checkExistingChapters(bookName);
    let book;
    
    if (existingResult.hasExisting) {
      console.log('📖 Используем существующие главы');
      book = createBookFromExistingChapters(bookName, existingResult.chapters);
    } else {
      console.log('📖 Читаем метаданные из EPUB');
      book = await getEpubMetadata(bookName);
    }
    console.log('✅ Книга загружена, глав:', book.chapters.length);

    writeBookTitle(bookName, book.title, book.chapters);

    // Обрабатываем главы
    console.log('🔄 Начинаем обработку глав, количество:', chapters.length);
    sendProgress(`Начинаем обработку ${chapters.length} глав...`);
    
    const results = [];
    for (let i = 0; i < chapters.length; i++) {
      const chapterNum = chapters[i];
      const chapter = book.chapters[chapterNum - 1];
      
      console.log(`\n📖 Обработка главы ${i + 1}/${chapters.length}: #${chapterNum} "${chapter.name}"`);
      sendProgress(`Обрабатываем главу ${i + 1}/${chapters.length}: ${chapter.name}`);
      
      try {
        const startTime = Date.now();
        const result = await processChapterWithProgress(book, bookName, chapterNum, wsConnection);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        
        results.push({ 
          chapterNumber: chapterNum, 
          chapterName: chapter.name,
          success: result.success,
          data: result.data
        });
        
        if (result.success) {
          console.log(`✅ Глава "${chapter.name}" обработана успешно за ${elapsed}с`);
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
          console.error(`❌ Ошибка при обработке главы "${chapter.name}"`);
          sendProgress(`❌ Ошибка при обработке главы "${chapter.name}"`);
        }
      } catch (error) {
        console.error(`❌ Исключение при обработке главы "${chapter.name}":`, error);
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
    console.log('📝 Создаем объединенный файл...');
    sendProgress('Создаем объединенный файл...');
    createCombinedCardsFile(bookName);
    sendProgress('✅ Обработка завершена!');
    
    console.log('🏁 Обработка завершена, результаты:', results.map(r => ({ chapter: r.chapterNumber, success: r.success })));
    return { success: true, results };
  } catch (error) {
    console.error('❌ Критическая ошибка в /api/process:', error);
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
  
  console.log(`🔧 processChapterWithProgress вызвана для главы ${index}`);
  
  // Перезагружаем системную инструкцию на случай изменений
  reloadSystemInstruction();
  console.log('🔄 Системная инструкция перезагружена');
  
  if (index > 0 && index <= book.chapters.length) {
    const chapter = book.chapters[index - 1];
    console.log(`📖 Обработка главы: "${chapter.name}", длина контента: ${chapter.content.length} символов`);
    
    const sendProgress = (data) => {
      console.log('📤 sendProgress:', data.type, '-', data.message?.substring(0, 100));
      if (wsConnection) {
        try {
          wsConnection.socket.send(JSON.stringify(data));
        } catch (error) {
          console.error('❌ Ошибка отправки через WebSocket:', error);
        }
      } else {
        console.warn('⚠️ WebSocket не доступен в sendProgress');
      }
    };
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Попытка ${attempt}/${maxRetries} для главы ${index}`);
        const generatedJSON = await runWithProgress(chapter.content, sendProgress);
        console.log(`✅ LLM вернул результат для главы ${index}, есть chapter_summary:`, !!generatedJSON?.chapter_summary);
        
        if (!generatedJSON || !generatedJSON.chapter_summary) {
          console.warn(`⚠️ Пустой или некорректный ответ от LLM для главы ${index}`);
          if (attempt < maxRetries) {
            console.log(`⏳ Ожидание перед повторной попыткой...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }
          return { success: false, data: null };
        }
        
        console.log(`💾 Сохраняем результат главы ${index} в файл...`);
        const success = writeChapterOutput(fileName, index, chapter.name, generatedJSON);
        console.log(`💾 Результат сохранения главы ${index}:`, success);
        
        if (!success && attempt < maxRetries) {
          console.log(`⏳ Ошибка сохранения, ожидание перед повторной попыткой...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        
        if (!success) {
          console.error(`❌ Не удалось сохранить главу ${index} после всех попыток`);
          return { success: false, data: null };
        }

        console.log(`⏳ Пауза 4с между главами...`);
        await new Promise(resolve => setTimeout(resolve, 4000));
        console.log(`✅ Глава ${index} полностью обработана`);
        return { success: true, data: generatedJSON };
      } catch (error) {
        console.error(`❌ Ошибка при попытке ${attempt} обработки главы ${index}:`, error);
        sendProgress({ type: 'error', message: `Attempt ${attempt} failed: ${error.message}` });
        if (attempt === maxRetries) {
          console.error(`❌ Все попытки исчерпаны для главы ${index}`);
          return { success: false, data: null };
        }
        console.log(`⏳ Ожидание перед повторной попыткой...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  } else {
    console.error(`❌ Некорректный индекс главы: ${index}, доступно глав: ${book.chapters.length}`);
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