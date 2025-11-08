class BookProcessor {
    constructor() {
        this.selectedBook = null;
        this.bookData = null;
        this.selectedChapters = new Set();
        this.ws = null;
        this.sessionId = this.generateSessionId();
        this.booksLoaded = false;
        this.processingActive = false;
        this.totalChapters = 0;
        this.processedChapters = 0;
        this.currentChapterProgress = 0;
        
        this.initializeEventListeners();
        this.loadBooks();
        this.handleUrlRouting();
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    initializeEventListeners() {
        // Инициализация настроек читалки
        try {
            const savedFs = localStorage.getItem('readerFontSize');
            const savedLh = localStorage.getItem('readerLineHeight');
            this.readerFontSize = savedFs ? parseFloat(savedFs) : 1.1; // rem
            this.readerLineHeight = savedLh ? parseFloat(savedLh) : 1.8;
        } catch (_) {
            this.readerFontSize = 1.1;
            this.readerLineHeight = 1.8;
        }
        // Кнопки навигации
        document.getElementById('processBtn').addEventListener('click', () => this.prepareForProcessing());
        document.getElementById('stopProcessingBtn').addEventListener('click', () => this.stopProcessing());
        document.getElementById('backToBooks').addEventListener('click', () => this.backToBooks());
        document.getElementById('closeModal').addEventListener('click', () => this.closeProcessingModal());
        
        // Кнопка назад из читалки
        const backFromReaderBtn = document.getElementById('backToChaptersFromReader');
        if (backFromReaderBtn) {
            backFromReaderBtn.addEventListener('click', () => {
                const params = new URLSearchParams(window.location.search);
                params.delete('chapter');
                window.history.pushState({}, '', '?' + params.toString());
                this.showStep(2);
            });
        }
        
        // Контролы типографики читалки
        const fontInc = document.getElementById('fontInc');
        const fontDec = document.getElementById('fontDec');
        const lhInc = document.getElementById('lhInc');
        const lhDec = document.getElementById('lhDec');
        if (fontInc) fontInc.addEventListener('click', () => this.changeReaderFontSize(0.05));
        const requestTagsBtn = document.getElementById('requestTagsBtn');
        if (requestTagsBtn) requestTagsBtn.addEventListener('click', () => this.requestTagsForCurrentChapter());
        if (fontDec) fontDec.addEventListener('click', () => this.changeReaderFontSize(-0.05));
        if (lhInc) lhInc.addEventListener('click', () => this.changeReaderLineHeight(0.1));
        if (lhDec) lhDec.addEventListener('click', () => this.changeReaderLineHeight(-0.1));

        // Кнопки выбора глав
        document.getElementById('selectAllBtn').addEventListener('click', () => this.selectAllChapters());
        document.getElementById('selectProcessedBtn').addEventListener('click', () => this.selectProcessedChapters());
        document.getElementById('deselectAllBtn').addEventListener('click', () => this.deselectAllChapters());
    }

    showStep(stepNumber) {
        // Скрываем все шаги
        document.querySelectorAll('.step').forEach(step => step.classList.remove('active'));
        
        // Показываем нужный шаг
        document.getElementById(`step${stepNumber}`).classList.add('active');
        
        // Обновляем URL (только для шагов 1 и 2)
        const params = new URLSearchParams(window.location.search);
        if (stepNumber === 1) {
            // Шаг 1 - главная страница
            window.history.pushState({}, '', '/');
        } else if (stepNumber === 2 && this.selectedBook) {
            // Шаг 2 - выбор глав
            params.set('book', this.selectedBook);
            params.delete('chapter'); // Убираем параметр chapter если возвращаемся к списку
            // Если есть выбранные главы, добавляем их в URL
            if (this.selectedChapters.size > 0) {
                const chaptersArray = Array.from(this.selectedChapters).sort((a, b) => a - b);
                params.set('chapters', chaptersArray.join(','));
            } else {
                params.delete('chapters');
            }
            window.history.pushState({}, '', '?' + params.toString());
        }
        // Шаг 3 обновляет URL в loadChapterContent
    }

    backToBooks() {
        this.showStep(1);
        // Очищаем URL от параметра книги
        const url = new URL(window.location);
        url.searchParams.delete('book');
        window.history.pushState({}, '', url);
        this.selectedBook = null;
        
        // Возвращаем оригинальный заголовок
        document.title = 'REM by Gemini - Веб Версия';
    }

    async loadBooks() {
        try {
            // Сначала проверяем здоровье сервера
            const healthResponse = await fetch('/api/health');
            if (!healthResponse.ok) {
                throw new Error('Сервер недоступен');
            }

            const response = await fetch('/api/books');
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Ошибка загрузки книг');
            }

            this.renderBooks(data.books, data.lastBook);
            this.booksLoaded = true;
        } catch (error) {
            console.error('Ошибка загрузки книг:', error);
            this.showError('booksContainer', `Не удалось загрузить список книг: ${error.message}`);
            this.booksLoaded = true; // Устанавливаем флаг даже при ошибке
        }
    }

    renderBooks(books, lastBook) {
        const container = document.getElementById('booksContainer');
        
        if (books.length === 0) {
            container.innerHTML = '<div class="error">Книги не найдены. Проверьте папку ../epub/</div>';
            return;
        }

        let html = '<div class="book-grid">';
        
        books.forEach(book => {
            const isLast = book === lastBook;
            html += `
                <div class="book-item ${isLast ? 'last-book' : ''}" data-book="${book}">
                    <h3>${book}</h3>
                    <div class="book-actions">
                        <button class="btn book-btn book-btn-load" data-book="${book}" data-force="false">Load</button>
                        <button class="btn btn-secondary book-btn book-btn-reread" data-book="${book}" data-force="true">Reread</button>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;

        // Добавляем обработчики кликов на кнопки
        container.querySelectorAll('.book-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const bookName = btn.dataset.book;
                const forceEpub = btn.dataset.force === 'true';
                this.openBookDirectly(bookName, forceEpub);
            });
        });
        
        // Добавляем обработчики кликов на название книги (работает как Load)
        container.querySelectorAll('.book-item h3').forEach(title => {
            title.style.cursor = 'pointer';
            title.addEventListener('click', (e) => {
                e.stopPropagation();
                const bookItem = title.closest('.book-item');
                const bookName = bookItem.dataset.book;
                this.openBookDirectly(bookName, false); // false = как кнопка Load
            });
        });
    }


    async openBookDirectly(bookName, forceEpub = false) {
        this.selectedBook = bookName;
        this.forceEpubMode = forceEpub;
        
        // Обновляем URL
        this.updateUrl(bookName);
        
        // Сразу открываем книгу
        await this.selectBook();
    }


    updateUrl(bookName) {
        const url = new URL(window.location);
        url.searchParams.set('book', encodeURIComponent(bookName));
        window.history.pushState({ book: bookName }, '', url);
        
        // Обновляем заголовок страницы
        document.title = `REM by Gemini - ${bookName}`;
    }

    handleUrlRouting() {
        const urlParams = new URLSearchParams(window.location.search);
        const bookFromUrl = urlParams.get('book');
        const chaptersFromUrl = urlParams.get('chapters');
        const chapterParam = urlParams.get('chapter');
        
        if (bookFromUrl) {
            // Применим типографику на всякий случай
            setTimeout(() => this.applyReaderTypography(), 0);
            // Ждем загрузки книг, затем открываем нужную
            const checkBooksLoaded = () => {
                if (this.booksLoaded) {
                    const decodedBookName = decodeURIComponent(bookFromUrl);
                    this.openBookDirectly(decodedBookName).then(() => {
                        // Восстанавливаем выбранные главы из URL
                        if (chaptersFromUrl) {
                            const chapterNums = chaptersFromUrl.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
                            this.selectedChapters.clear();
                            chapterNums.forEach(num => this.selectedChapters.add(num));
                            
                            // Обновляем визуальное выделение
                            setTimeout(() => {
                                document.querySelectorAll('.chapter-item').forEach(item => {
                                    const chapterNum = parseInt(item.dataset.chapter);
                                    if (this.selectedChapters.has(chapterNum)) {
                                        item.classList.add('selected');
                                    }
                                });
                                this.updateProcessButton();
                            }, 200);
                        }
                        
                        // Если указан параметр chapter — сразу открыть читалку
                        if (chapterParam) {
                            const chNum = parseInt(chapterParam);
                            if (!isNaN(chNum)) {
                                const chapter = this.bookData.chapters.find(c => c.displayNumber === chNum || c.realNumber === chNum);
                                if (chapter) {
                                    this.openChapterReader(chapter);
                                }
                            }
                        }
                    });
                } else {
                    setTimeout(checkBooksLoaded, 100);
                }
            };
            checkBooksLoaded();
        }

        // Обработчик кнопки "Назад" браузера
        window.addEventListener('popstate', (event) => {
            // Перезагружаем страницу для корректной обработки URL
            window.location.reload();
        });
    }

    async selectBook() {
        if (!this.selectedBook) return;

        const forceEpub = this.forceEpubMode || false;
        
        try {
            // Очищаем предыдущие данные
            this.bookData = null;
            document.getElementById('bookInfo').innerHTML = '';
            
            // Показываем загрузку
            document.getElementById('chaptersContainer').innerHTML = '<div class="loading">Загружаем информацию о главах...</div>';
            this.showStep(2);

            const response = await fetch('/api/book/info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    bookName: this.selectedBook,
                    forceEpub: forceEpub
                })
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Ошибка загрузки информации о книге');
            }

            this.bookData = data;
            this.renderBookInfo();
            this.renderChapters();
        } catch (error) {
            this.showError('chaptersContainer', error.message);
            console.error('Error loading book:', error);
        }
    }

    renderBookInfo() {
        const container = document.getElementById('bookInfo');
        const processedCount = this.bookData.chapters.filter(ch => ch.exists).length;
        const hasProcessed = processedCount > 0;
        
        container.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <div style="flex: 1;">
                    <strong>📚 ${this.bookData.book.title}</strong> 
                    <span class="book-stats">• Всего: ${this.bookData.book.chaptersCount} глав • Доступно: ${this.bookData.chapters.length} • Уже обработано: ${processedCount}</span>
                </div>
                ${hasProcessed ? '<button class="btn btn-secondary" id="downloadSummaryBtn" style="padding: 6px 12px; font-size: 0.85rem;">📥 Скачать саммари</button>' : ''}
            </div>
        `;
        
        // Добавляем обработчик для кнопки скачивания
        if (hasProcessed) {
            setTimeout(() => {
                const btn = document.getElementById('downloadSummaryBtn');
                if (btn) {
                    btn.addEventListener('click', () => this.downloadSummary());
                }
            }, 0);
        }
    }

    renderChapterList(chaptersList) {
        const columns = 3;
        const rowCount = Math.ceil(chaptersList.length / columns);
        
        let html = `
            <div class="chapter-group">
                <div class="chapters-grid" style="grid-template-rows: repeat(${rowCount}, auto);">
        `;
        
        chaptersList.forEach(chapter => {
            const sizeInfo = this.formatSize(chapter.contentLength);
            const warningSymbol = chapter.contentLength > 100000 ? '⚠️ ' : '';
            const existsEmoji = chapter.exists ? '📗 ' : '';
            
            html += `
                <div class="chapter-item ${chapter.exists ? 'exists' : ''}" data-chapter="${chapter.realNumber}">
                    <div class="chapter-title">
                        <span class="chapter-number">[${chapter.displayNumber}]</span>
                        <span class="chapter-exists">${existsEmoji}</span>
                        <span class="chapter-name">${chapter.name}</span>
                        <span class="chapter-size">${warningSymbol}${sizeInfo}</span>
                        <button class="chapter-process-btn" data-chapter="${chapter.realNumber}" title="Читать главу">📖</button>
                    </div>
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
        return html;
    }

    renderChapters() {
        const container = document.getElementById('chaptersContainer');
        
        if (this.bookData.chapters.length === 0) {
            container.innerHTML = '<div class="error">Главы для обработки не найдены</div>';
            return;
        }

        const chapters = this.bookData.chapters;
        
        // Разделяем главы на: до групп, группы, после групп
        const chaptersBeforeGroups = [];
        const grouped = {};
        const chaptersAfterGroups = [];
        
        let firstGroupIndex = chapters.findIndex(ch => ch.group);
        let lastGroupIndex = -1;
        for (let i = chapters.length - 1; i >= 0; i--) {
            if (chapters[i].group) {
                lastGroupIndex = i;
                break;
            }
        }
        
        chapters.forEach((chapter, idx) => {
            if (chapter.group) {
                // Глава с группой
                if (!grouped[chapter.group]) {
                    grouped[chapter.group] = [];
                }
                grouped[chapter.group].push(chapter);
            } else {
                // Глава без группы
                if (idx < firstGroupIndex) {
                    chaptersBeforeGroups.push(chapter);
                } else {
                    chaptersAfterGroups.push(chapter);
                }
            }
        });

        let html = '<div class="chapters-container">';
        
        // Рендерим главы ДО групп
        if (chaptersBeforeGroups.length > 0) {
            html += this.renderChapterList(chaptersBeforeGroups);
        }
        
        // Отображаем группы
        Object.keys(grouped).forEach(groupName => {
            const groupChapters = grouped[groupName];
            const columns = 3;
            // Заголовок занимает всю первую строку grid
            const totalItems = 1 + groupChapters.length; // 1 заголовок + главы
            const rowCount = Math.ceil(totalItems / columns);
            
            html += `
                <div class="chapter-group">
                    <div class="chapters-grid-with-header" style="grid-template-rows: repeat(${rowCount}, auto);">
                        <div class="group-header-inline">📂 ${groupName}</div>
            `;
            
            groupChapters.forEach(chapter => {
                const sizeInfo = this.formatSize(chapter.contentLength);
                const warningSymbol = chapter.contentLength > 100000 ? '⚠️ ' : '';
                const existsEmoji = chapter.exists ? '📗 ' : '';
                
                html += `
                    <div class="chapter-item ${chapter.exists ? 'exists' : ''}" data-chapter="${chapter.realNumber}">
                        <div class="chapter-title">
                            <span class="chapter-number">[${chapter.displayNumber}]</span>
                            <span class="chapter-exists">${existsEmoji}</span>
                            <span class="chapter-name">${chapter.name}</span>
                            <span class="chapter-size">${warningSymbol}${sizeInfo}</span>
                            <button class="chapter-process-btn" data-chapter="${chapter.realNumber}" title="Читать главу">📖</button>
                        </div>
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        });
        
        // Рендерим главы ПОСЛЕ групп
        if (chaptersAfterGroups.length > 0) {
            html += this.renderChapterList(chaptersAfterGroups);
        }
        
        html += '</div>';
        container.innerHTML = html;

        // Добавляем обработчики кликов на главы
        container.querySelectorAll('.chapter-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // Не обрабатываем клик если нажали на кнопку процесса
                if (e.target.classList.contains('chapter-process-btn')) {
                    return;
                }
                this.toggleChapter(item);
            });
        });
        
        // Добавляем обработчики на кнопки просмотра главы
        container.querySelectorAll('.chapter-process-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const chapterNum = parseInt(btn.dataset.chapter);
                const chapter = this.bookData.chapters.find(c => c.realNumber === chapterNum);
                if (chapter) {
                    this.openChapterReader(chapter);
                }
            });
        });

        this.selectedChapters.clear();
        this.updateProcessButton();
    }
    
    processOneChapter(chapterNum) {
        // Выбираем только эту главу
        this.selectedChapters.clear();
        this.selectedChapters.add(chapterNum);
        
        // Обновляем визуальное выделение
        document.querySelectorAll('.chapter-item').forEach(item => {
            const itemChapterNum = parseInt(item.dataset.chapter);
            if (itemChapterNum === chapterNum) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
        
        // Сразу переходим к обработке
        this.prepareForProcessing();
    }
    
    openChapterReader(chapter) {
        // Переходим к читалке в том же окне
        this.showStep(3);
        this.loadChapterContent(chapter);
        this.currentChapter = chapter;
    }
    
    async loadChapterContent(chapter) {
        const buildSummaryHtml = (summary) => {
            if (!summary) return '';
            const safe = window.marked ? window.marked.parse(summary) : summary.replace(/</g,'&lt;').replace(/\n/g,'<br>');
            return `
                <div class=\"reader-summary\">
                    <div class=\"reader-summary-body\">${safe}</div>
                </div>
            `;
        };
        const container = document.getElementById('readerMain');
        const summaryEl = document.getElementById('readerSummary');
        const metaEl = document.getElementById('readerMeta');
        const chapterSelect = document.getElementById('readerChapterSelect');
        const bookTitleSmall = document.getElementById('readerBookTitleSmall');
        if (!chapterSelect || !bookTitleSmall) {
            return;
        }
        // Устанавливаем название книги (серым)
        bookTitleSmall.textContent = `— ${this.bookData.book.title}`;
        // Наполняем select списком глав, если пустой или длина не совпадает
        if (chapterSelect.options.length !== this.bookData.chapters.length) {
            chapterSelect.innerHTML = '';
            this.bookData.chapters.forEach((ch) => {
                const opt = document.createElement('option');
                opt.value = String(ch.realNumber);
                opt.textContent = `[${ch.displayNumber}] ${ch.name}`;
                chapterSelect.appendChild(opt);
            });
        }
        // Выбираем текущую главу
        chapterSelect.value = String(chapter.realNumber);
        // Обработчик смены главы
        chapterSelect.onchange = () => {
            const val = parseInt(chapterSelect.value, 10);
            const target = this.bookData.chapters.find(c => c.realNumber === val);
            this.currentChapter = target;
            if (target) {
                this.currentChapter = target;
                this.loadChapterContent(target);
            }
        };
        // Показываем состояния загрузки сразу, чтобы не оставался старый контент
        container.innerHTML = '<div class="loading">⏳ Загружаем текст главы...</div>';
        if (summaryEl) {
            summaryEl.innerHTML = '<div class="reader-summary"><div class="reader-summary-body">Загрузка...</div></div>';
            summaryEl.style.display = '';
        }
        if (metaEl) {
            metaEl.textContent = 'Загрузка...';
            metaEl.style.display = '';
        }
        
        // Обновляем URL
        const params = new URLSearchParams(window.location.search);
        params.set('book', this.selectedBook);
        params.set('chapter', chapter.displayNumber);
        window.history.pushState({}, '', '?' + params.toString());
        
        try {
            // 1) Пытаемся получить саммари из обработанного файла (если есть)
            let summaryHtml = '';
            try {
                const sumResp = await fetch('/api/get-chapter-content', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ bookName: this.selectedBook, chapterName: chapter.name })
                });
                if (sumResp.ok) {
                    const sumData = await sumResp.json(); // { content }
                    const summary = this.extractSummaryFromProcessed(sumData.content);
                    if (summary && summary.trim().length > 0) {
                        summaryHtml = buildSummaryHtml(summary.trim());
                    }
                }
            } catch (e) { /* ignore */ }

            const response = await fetch('/api/get-chapter-raw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    bookName: this.selectedBook,
                    chapterIndex: chapter.realNumber
                })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Ошибка загрузки главы');
            let html = (window.marked ? window.marked.parse(data.content) : data.content);
            html = this.rewriteEpubUrls(html, this.selectedBook);
            if (summaryEl) {
                if (summaryHtml) {
                    summaryEl.innerHTML = summaryHtml;
                    summaryEl.style.display = '';
                } else {
                    summaryEl.innerHTML = '';
                    summaryEl.style.display = 'none';
                }
            }
            // Инфо-строка под саммари
            if (metaEl) {
                const formatNumber = (n) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
                const chars = data.content ? data.content.length : 0;
                const approxTokens = Math.max(1, Math.round(chars / 4));
                const tokensK = Math.max(1, Math.round(approxTokens / 1000));
                metaEl.textContent = `Длина текста: ${formatNumber(chars)} символов, ${tokensK}к токенов`;
                metaEl.style.display = '';
            }
            container.innerHTML = html;
            // Применяем типографику читалки после вставки
            this.applyReaderTypography();
            
        } catch (error) {
            container.innerHTML = `<div class="error">❌ Ошибка загрузки: ${error.message}</div>`;
        }
    }

    formatSize(bytes) {
        if (bytes >= 1000) {
            return `${(bytes / 1000).toFixed(1)}k`;
        }
        return `${bytes} символов`;
    }

    toggleChapter(item) {
        const chapterNum = parseInt(item.dataset.chapter);
        
        if (this.selectedChapters.has(chapterNum)) {
            this.selectedChapters.delete(chapterNum);
            item.classList.remove('selected');
        } else {
            this.selectedChapters.add(chapterNum);
            item.classList.add('selected');
        }
        
        this.updateProcessButton();
        this.updateUrlWithChapters();
    }

    selectAllChapters() {
        const allItems = document.querySelectorAll('.chapter-item');
        const totalCount = allItems.length;
        const selectedCount = this.selectedChapters.size;
        
        // Если все выбраны - снимаем выбор, иначе - выбираем все
        if (selectedCount === totalCount) {
            // Снять все
            this.selectedChapters.clear();
            allItems.forEach(item => {
                item.classList.remove('selected');
            });
        } else {
            // Выбрать все
            this.selectedChapters.clear();
            allItems.forEach(item => {
                const chapterNum = parseInt(item.dataset.chapter);
                this.selectedChapters.add(chapterNum);
                item.classList.add('selected');
            });
        }
        this.updateProcessButton();
        this.updateUrlWithChapters();
    }

    deselectAllChapters() {
        this.selectedChapters.clear();
        document.querySelectorAll('.chapter-item').forEach(item => {
            item.classList.remove('selected');
        });
        this.updateProcessButton();
        this.updateUrlWithChapters();
    }

    selectProcessedChapters() {
        // Проверяем, выбраны ли сейчас обработанные главы
        const processedItems = Array.from(document.querySelectorAll('.chapter-item.exists'));
        const unprocessedItems = Array.from(document.querySelectorAll('.chapter-item:not(.exists)'));
        
        const processedSelected = processedItems.some(item => {
            const chapterNum = parseInt(item.dataset.chapter);
            return this.selectedChapters.has(chapterNum);
        });
        
        this.selectedChapters.clear();
        
        if (processedSelected) {
            // Переключаемся на необработанные
            unprocessedItems.forEach(item => {
                const chapterNum = parseInt(item.dataset.chapter);
                this.selectedChapters.add(chapterNum);
                item.classList.add('selected');
            });
            processedItems.forEach(item => {
                item.classList.remove('selected');
            });
        } else {
            // Выбираем обработанные
            processedItems.forEach(item => {
                const chapterNum = parseInt(item.dataset.chapter);
                this.selectedChapters.add(chapterNum);
                item.classList.add('selected');
            });
            unprocessedItems.forEach(item => {
                item.classList.remove('selected');
            });
        }
        
        this.updateProcessButton();
        this.updateUrlWithChapters();
    }
    
    updateUrlWithChapters() {
        if (!this.selectedBook) return;
        
        const params = new URLSearchParams(window.location.search);
        params.set('book', this.selectedBook);
        params.delete('processing');
        
        if (this.selectedChapters.size > 0) {
            const chaptersArray = Array.from(this.selectedChapters).sort((a, b) => a - b);
            params.set('chapters', chaptersArray.join(','));
        } else {
            params.delete('chapters');
        }
        
        window.history.replaceState({}, '', '?' + params.toString());
    }

    updateProcessButton() {
        const btn = document.getElementById('processBtn');
        btn.disabled = this.selectedChapters.size === 0;
        const count = this.selectedChapters.size;
        const text = count === 0 ? 'Обработать 0 глав' : 
                     count === 1 ? 'Обработать 1 главу' :
                     count < 5 ? `Обработать ${count} главы` :
                     `Обработать ${count} глав`;
        btn.textContent = text;
    }

    prepareForProcessing() {
        if (this.selectedChapters.size === 0) {
            alert('Выберите хотя бы одну главу для обработки');
            return;
        }

        // Открываем модальное окно вместо перехода на шаг 3
        this.openProcessingModal();
    }
    
    openProcessingModal() {
        const modal = document.getElementById('processingModal');
        modal.style.display = 'block';
        
        this.clearProgressLog();
        
        // Инициализируем счетчики
        this.totalChapters = this.selectedChapters.size;
        this.processedChapters = 0;
        this.currentChapterProgress = 0;
        
        document.getElementById('stopProcessingBtn').disabled = false;
        
        this.addToProgressLog(`📋 Начинаем обработку ${this.selectedChapters.size} глав`);
        
        // Показываем выбранные главы
        const chaptersArray = Array.from(this.selectedChapters);
        chaptersArray.forEach(chapterNum => {
            const chapter = this.bookData.chapters.find(c => c.realNumber === chapterNum);
            if (chapter) {
                this.addToProgressLog(`   • Глава ${chapter.displayNumber}: ${chapter.name}`);
            }
        });
        
        // Автоматически начинаем обработку
        setTimeout(() => this.startProcessing(), 500);
    }
    
    closeProcessingModal() {
        const modal = document.getElementById('processingModal');
        modal.style.display = 'none';
        
        // Останавливаем обработку если она идёт
        if (this.processingActive) {
            this.stopProcessing();
        }
    }

    async startProcessing() {
        if (this.selectedChapters.size === 0) return;

        this.processingActive = true;
        document.getElementById('stopProcessingBtn').disabled = false;

        this.updateProgressBar(0, 'Начинаем обработку...', '', '');
        this.addToProgressLog('🚀 Запускаем обработку...');
        
        // Устанавливаем WebSocket соединение
        this.connectWebSocket();

        try {
            const chaptersArray = Array.from(this.selectedChapters);
            
            const response = await fetch('/api/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bookName: this.selectedBook,
                    chapters: chaptersArray,
                    sessionId: this.sessionId
                })
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Ошибка обработки');
            }

            // Показываем итоговые результаты
            this.addToProgressLog('');
            this.addToProgressLog('📊 Итоговые результаты:');
            
            let successCount = 0;
            data.results.forEach(result => {
                const status = result.success ? '✅' : '❌';
                this.addToProgressLog(`${status} Глава ${result.chapterNumber}: ${result.chapterName}`);
                if (result.success) successCount++;
                if (result.error) {
                    this.addToProgressLog(`   Ошибка: ${result.error}`);
                }
            });

            // Финальное обновление прогресс-бара
            this.updateProgressBar(100, 'Обработка завершена!', 
                `Готово: ${successCount}/${this.totalChapters} глав`, 'Завершено');
            
        } catch (error) {
            this.addToProgressLog(`❌ Ошибка: ${error.message}`);
        } finally {
            this.processingActive = false;
            document.getElementById('stopProcessingBtn').disabled = true;
            
            if (this.ws) {
                this.ws.close();
            }
        }
    }

    stopProcessing() {
        this.processingActive = false;
        if (this.ws) {
            this.ws.close();
        }
        
        // Обновляем прогресс-бар
        const progress = this.calculateProgress();
        this.updateProgressBar(progress, 'Обработка остановлена', 
            `Остановлено на ${this.processedChapters}/${this.totalChapters}`, 'Прервано');
        
        document.getElementById('stopProcessingBtn').disabled = true;
        this.addToProgressLog('⏹️ Обработка остановлена пользователем');
    }


    connectWebSocket() {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}/ws?sessionId=${this.sessionId}`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            if (data.type === 'progress') {
                // Оптимизируем отображение прогресса получения символов
                if (data.message.includes('Received characters:')) {
                    this.updateCharacterProgress(data.message);
                    // Обновляем прогресс-бар для получения символов
                    this.setChapterProgress('receiving', data.message);
                    const progress = this.calculateProgress();
                    const characters = data.message.match(/[\d.]+k?/)?.[0] || '';
                    this.updateProgressBar(progress, 'Получаем ответ от AI...', 
                        `Глава ${this.processedChapters + 1}/${this.totalChapters}`, 
                        `${characters} символов`);
                } else {
                    this.addToProgressLog(data.message);
                    
                    // Обновляем прогресс-бар в зависимости от сообщения
                    if (data.message.includes('Обрабатываем главу')) {
                        this.setChapterProgress('start');
                        const progress = this.calculateProgress();
                        const chapterMatch = data.message.match(/(\d+)\/(\d+)/);
                        if (chapterMatch) {
                            this.updateProgressBar(progress, 'Подготавливаем главу...', 
                                `Глава ${chapterMatch[1]}/${chapterMatch[2]}`, 'Подготовка');
                        }
                    } else if (data.message.includes('Sending request')) {
                        this.setChapterProgress('request');
                        const progress = this.calculateProgress();
                        this.updateProgressBar(progress, 'Отправляем запрос к AI...', 
                            `Глава ${this.processedChapters + 1}/${this.totalChapters}`, 'Запрос отправлен');
                    }
                }
            } else if (data.type === 'error') {
                this.addToProgressLog(data.message);
            } else if (data.type === 'success') {
                this.addToProgressLog(data.message);
                
                // Завершение обработки главы
                this.setChapterProgress('complete');
                this.processedChapters++;
                const progress = this.calculateProgress();
                this.updateProgressBar(progress, 'Глава обработана успешно!', 
                    `Завершено ${this.processedChapters}/${this.totalChapters}`, 'Готово');
                
                // НЕ отображаем результат здесь - ждем chapter_result
            } else if (data.type === 'chapter_result') {
                // Результаты больше не отображаем в модальном окне, только в логе
                this.addToProgressLog(`✅ Глава ${data.chapterNumber} (${data.chapterName}) обработана успешно`);
            }
        };

        this.ws.onerror = (error) => {
            this.addToProgressLog('❌ Ошибка соединения WebSocket');
        };
    }

    clearProgressLog() {
        document.getElementById('progressLog').innerHTML = '';
    }

    addToProgressLog(message) {
        const log = document.getElementById('progressLog');
        const timestamp = new Date().toLocaleTimeString();
        log.innerHTML += `[${timestamp}] ${message}\n`;
        log.scrollTop = log.scrollHeight;
    }

    updateCharacterProgress(message) {
        const log = document.getElementById('progressLog');
        const lines = log.innerHTML.split('\n');
        
        // Ищем последнюю строку с прогрессом символов
        let lastProgressIndex = -1;
        for (let i = lines.length - 1; i >= 0; i--) {
            if (lines[i].includes('Received characters:')) {
                lastProgressIndex = i;
                break;
            }
        }
        
        const timestamp = new Date().toLocaleTimeString();
        const newLine = `[${timestamp}] ${message}`;
        
        if (lastProgressIndex !== -1) {
            // Обновляем последнюю строку прогресса
            lines[lastProgressIndex] = newLine;
            log.innerHTML = lines.join('\n');
        } else {
            // Добавляем новую строку
            log.innerHTML += newLine + '\n';
        }
        
        log.scrollTop = log.scrollHeight;
    }

    showError(containerId, message) {
        const container = document.getElementById(containerId);
        container.innerHTML = `<div class="error">❌ ${message}</div>`;
    }


    
    
    rewriteEpubUrls(html, bookName) {
        try {
            const wrapper = document.createElement('div');
            wrapper.innerHTML = html;
            // Картинки
            wrapper.querySelectorAll('img').forEach(img => {
                const src = img.getAttribute('src');
                if (!src) return;
                const clean = src.replace(/^\/+/, '');
                img.setAttribute('src', `/api/epub-asset?book=${encodeURIComponent(bookName)}&href=${encodeURIComponent(clean)}`);
                img.style.maxWidth = '100%';
                img.style.height = 'auto';
            });
            // Ссылки
            wrapper.querySelectorAll('a').forEach(a => {
                const href = a.getAttribute('href');
                if (!href) return;
                const clean = href.replace(/^\/+/, '');
                a.setAttribute('href', `/api/epub-asset?book=${encodeURIComponent(bookName)}&href=${encodeURIComponent(clean)}`);
                a.setAttribute('target', '_blank');
                a.setAttribute('rel', 'noopener noreferrer');
            });
            return wrapper.innerHTML;
        } catch (e) {
            return html;
        }
    }

    extractSummaryFromProcessed(fileContent) {
        try {
            const lines = fileContent.split(/\r?\n/);
            let inSummary = false;
            const out = [];
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (line.trim().startsWith('## ')) {
                    // Заголовок главы — после него начинается summary
                    inSummary = true;
                    continue;
                }
                if (line.trim().startsWith('### ')) {
                    // Начались карточки — summary закончилось
                    break;
                }
                if (inSummary) out.push(line);
            }
            return out.join('\n').trim();
        } catch (e) { return ''; }
    }

    applyReaderTypography() {
        const main = document.getElementById('readerMain');
        if (main) {
            main.style.fontSize = `${this.readerFontSize}rem`;
            main.style.lineHeight = String(this.readerLineHeight);
        }
    }

    changeReaderFontSize(delta) {
        const minFs = 0.8, maxFs = 1.6;
        this.readerFontSize = Math.min(maxFs, Math.max(minFs, (this.readerFontSize || 1.1) + delta));
        this.applyReaderTypography();
        try { localStorage.setItem('readerFontSize', String(this.readerFontSize)); } catch(_) {}
    }

    changeReaderLineHeight(delta) {
        const minLh = 1.2, maxLh = 2.2;
        this.readerLineHeight = Math.min(maxLh, Math.max(minLh, (this.readerLineHeight || 1.8) + delta));
        this.applyReaderTypography();
        try { localStorage.setItem('readerLineHeight', String(this.readerLineHeight)); } catch(_) {}
    }

    async requestTagsForCurrentChapter() {
        const status = document.getElementById('requestTagsStatus');
        const btn = document.getElementById('requestTagsBtn');
        const setStatus = (msg, color = '#666') => { if (status) { status.textContent = msg; status.style.color = color; } };
        try {
            if (!this.selectedBook || !this.currentChapter) {
                setStatus('Нет выбранной главы', '#c00');
                return;
            }
            if (btn) { btn.textContent = 'Разметка...'; btn.disabled = true; }
            setStatus('Отправка запроса...');

            const response = await fetch('/api/tags/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bookName: this.selectedBook,
                    chapterIndex: this.currentChapter.realNumber
                })
            });
            setStatus('Получение ответа...');
            const text = await response.text();
            setStatus('Парсинг результата...');
            let data = {};
            try { data = JSON.parse(text); } catch(parseErr) { throw new Error('Невалидный JSON ответа сервера'); }
            if (!response.ok) throw new Error(data.error || 'Ошибка запроса');
            setStatus('Сохранение...');
            setStatus(`Готово: сохранено в ${data.filePath}`, '#0a0');
            setTimeout(() => setStatus(''), 5000);
        } catch (e) {
            setStatus(`Ошибка: ${e.message}`, '#c00');
        } finally {
            if (btn) { btn.textContent = 'Разметить'; btn.disabled = false; }
        }
    }

    async downloadSummary() {
        if (!this.selectedBook || !this.bookData) return;
        
        try {
            // Запрашиваем саммари с сервера
            const response = await fetch('/api/get-summaries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bookName: this.selectedBook })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Ошибка получения саммари');
            }
            
            // Сортируем саммари по порядку глав в TOC
            const sortedSummaries = [];
            
            // Проходим по главам в правильном порядке
            this.bookData.chapters.forEach(chapter => {
                if (chapter.exists) {
                    // Нормализуем имя главы для поиска
                    const normalizedChapterName = chapter.name.replace(/\s+/g, '_');
                    
                    // Ищем соответствующее саммари
                    const summary = data.summaries.find(s => {
                        const normalizedSummaryName = s.fileName.replace(/\.(txt|md)$/, '').replace(/^\d+\s*-\s*/, '');
                        return normalizedSummaryName.includes(normalizedChapterName) || 
                               normalizedChapterName.includes(normalizedSummaryName) ||
                               s.chapterName === chapter.name;
                    });
                    
                    if (summary) {
                        sortedSummaries.push(summary);
                    }
                }
            });
            
            // Создаем markdown файл
            const markdown = sortedSummaries.map(s => `## ${s.chapterName}\n${s.summary}\n`).join('\n');
            
            // Создаем blob и скачиваем
            const blob = new Blob([markdown], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${this.selectedBook}_summary.md`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            console.log('✅ Саммари скачано');
        } catch (error) {
            alert(`Ошибка скачивания саммари: ${error.message}`);
            console.error('Error downloading summary:', error);
        }
    }



    updateProgressBar(progress, text, chapterInfo = '', chapterProgress = '') {
        const progressFill = document.getElementById('progressBarFill');
        const progressText = document.getElementById('progressText');
        const progressPercentage = document.getElementById('progressPercentage');
        const currentChapter = document.getElementById('currentChapter');
        const chapterProgressElement = document.getElementById('chapterProgress');

        progressFill.style.width = `${progress}%`;
        progressText.textContent = text;
        progressPercentage.textContent = `${Math.round(progress)}%`;
        currentChapter.textContent = chapterInfo;
        chapterProgressElement.textContent = chapterProgress;
    }

    calculateProgress() {
        if (this.totalChapters === 0) return 0;
        
        // Каждая глава составляет равную долю от общего прогресса
        const chapterWeight = 100 / this.totalChapters;
        const completedProgress = this.processedChapters * chapterWeight;
        const currentProgress = this.currentChapterProgress * chapterWeight;
        
        return Math.min(completedProgress + currentProgress, 100);
    }

    setChapterProgress(phase, characters = '') {
        // Фазы обработки главы:
        // 0.0 - начало
        // 0.2 - отправка запроса  
        // 0.3-0.9 - получение символов (зависит от количества)
        // 1.0 - завершение
        
        switch (phase) {
            case 'start':
                this.currentChapterProgress = 0.0;
                break;
            case 'request':
                this.currentChapterProgress = 0.2;
                break;
            case 'receiving':
                // Прогресс от 0.3 до 0.9 в зависимости от количества символов
                // Предполагаем, что средняя глава ~8k символов
                const charCount = parseInt(characters.replace(/[^0-9.]/g, '')) || 0;
                const estimatedTotal = 8000; // примерный размер главы
                const receiveProgress = Math.min(charCount / estimatedTotal, 1.0);
                this.currentChapterProgress = 0.3 + (receiveProgress * 0.6);
                break;
            case 'complete':
                this.currentChapterProgress = 1.0;
                break;
        }
    }
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    new BookProcessor();
});