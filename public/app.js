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
        this.loadSystemInstruction();
        this.handleUrlRouting();
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    initializeEventListeners() {
        // Кнопки навигации
        document.getElementById('processBtn').addEventListener('click', () => this.prepareForProcessing());
        document.getElementById('startProcessingBtn').addEventListener('click', () => this.startProcessing());
        document.getElementById('stopProcessingBtn').addEventListener('click', () => this.stopProcessing());
        document.getElementById('backToBooks').addEventListener('click', () => this.backToBooks());
        document.getElementById('backToChapters').addEventListener('click', () => this.showStep(2));
        document.getElementById('startNewProcess').addEventListener('click', () => this.showStep(2));

        // Кнопки выбора глав
        document.getElementById('selectAllBtn').addEventListener('click', () => this.selectAllChapters());
        document.getElementById('selectProcessedBtn').addEventListener('click', () => this.selectProcessedChapters());
        document.getElementById('deselectAllBtn').addEventListener('click', () => this.deselectAllChapters());

        // Кнопки системной инструкции
        document.getElementById('editSystemInstruction').addEventListener('click', () => this.editSystemInstruction());
        document.getElementById('resetSystemInstruction').addEventListener('click', () => this.resetSystemInstruction());
        document.getElementById('saveSystemInstruction').addEventListener('click', () => this.saveSystemInstruction());
        document.getElementById('cancelEditSystemInstruction').addEventListener('click', () => this.cancelEditSystemInstruction());
        
        // Кнопка открытия файла
        document.getElementById('openFileBtn').addEventListener('click', () => this.openCurrentFile());
    }

    showStep(stepNumber) {
        // Скрываем все шаги
        document.querySelectorAll('.step').forEach(step => step.classList.remove('active'));
        
        // Показываем нужный шаг
        document.getElementById(`step${stepNumber}`).classList.add('active');
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
        
        if (bookFromUrl) {
            // Ждем загрузки книг, затем открываем нужную
            const checkBooksLoaded = () => {
                if (this.booksLoaded) {
                    const decodedBookName = decodeURIComponent(bookFromUrl);
                    this.openBookDirectly(decodedBookName);
                } else {
                    setTimeout(checkBooksLoaded, 100);
                }
            };
            checkBooksLoaded();
        }

        // Обработчик кнопки "Назад" браузера
        window.addEventListener('popstate', (event) => {
            if (event.state && event.state.book) {
                this.openBookDirectly(event.state.book);
            } else {
                // Возвращаемся к списку книг
                this.showStep(1);
                const url = new URL(window.location);
                url.searchParams.delete('book');
                window.history.replaceState({}, '', url);
            }
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
        container.innerHTML = `<strong>📚 ${this.bookData.book.title}</strong> <span class="book-stats">• Всего: ${this.bookData.book.chaptersCount} глав • Доступно: ${this.bookData.chapters.length} • Уже обработано: ${processedCount}</span>`;
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

        // Добавляем обработчики кликов
        container.querySelectorAll('.chapter-item').forEach(item => {
            item.addEventListener('click', () => this.toggleChapter(item));
        });

        this.selectedChapters.clear();
        this.updateProcessButton();
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
    }

    selectAllChapters() {
        this.selectedChapters.clear();
        document.querySelectorAll('.chapter-item').forEach(item => {
            const chapterNum = parseInt(item.dataset.chapter);
            this.selectedChapters.add(chapterNum);
            item.classList.add('selected');
        });
        this.updateProcessButton();
    }

    deselectAllChapters() {
        this.selectedChapters.clear();
        document.querySelectorAll('.chapter-item').forEach(item => {
            item.classList.remove('selected');
        });
        this.updateProcessButton();
    }

    selectProcessedChapters() {
        this.selectedChapters.clear();
        document.querySelectorAll('.chapter-item').forEach(item => {
            // Проверяем, есть ли класс 'exists' (обработанная глава)
            if (item.classList.contains('exists')) {
                const chapterNum = parseInt(item.dataset.chapter);
                this.selectedChapters.add(chapterNum);
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
        this.updateProcessButton();
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
        if (this.selectedChapters.size === 0) return;

        this.showStep(3);
        this.clearProgressLog();
        this.clearResults();
        this.hideProgressBar();
        
        // Инициализируем счетчики
        this.totalChapters = this.selectedChapters.size;
        this.processedChapters = 0;
        this.currentChapterProgress = 0;
        
        // Активируем кнопку запуска
        document.getElementById('startProcessingBtn').disabled = false;
        document.getElementById('stopProcessingBtn').disabled = true;
        
        this.addToProgressLog(`📋 Готово к обработке ${this.selectedChapters.size} глав`);
        this.addToProgressLog('💡 Нажмите "Запустить обработку" для начала');
        
        // Показываем выбранные главы
        const chaptersArray = Array.from(this.selectedChapters);
        chaptersArray.forEach(chapterNum => {
            const chapter = this.bookData.chapters.find(c => c.realNumber === chapterNum);
            if (chapter) {
                this.addToProgressLog(`   • Глава ${chapter.displayNumber}: ${chapter.name}`);
            }
        });
    }

    async startProcessing() {
        if (this.selectedChapters.size === 0) return;

        // Блокируем кнопки
        document.getElementById('startProcessingBtn').disabled = true;
        document.getElementById('stopProcessingBtn').disabled = false;
        this.processingActive = true;

        // Показываем прогресс-бар
        this.showProgressBar();
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

            document.getElementById('startNewProcess').disabled = false;
            
        } catch (error) {
            this.addToProgressLog(`❌ Ошибка: ${error.message}`);
        } finally {
            this.processingActive = false;
            document.getElementById('startProcessingBtn').disabled = false;
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
        
        document.getElementById('startProcessingBtn').disabled = false;
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
                // Отображаем результат главы (основной способ)
                this.showChapterResult(data.chapterNumber, data.chapterName, data.data);
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

    // Методы для работы с системной инструкцией
    async loadSystemInstruction() {
        try {
            const response = await fetch('/api/system-instruction');
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Ошибка загрузки системной инструкции');
            }

            this.originalSystemInstruction = data.systemInstruction;
            this.displaySystemInstruction(data.systemInstruction);
        } catch (error) {
            console.error('Ошибка загрузки системной инструкции:', error);
            document.getElementById('systemInstructionViewer').innerHTML = 
                `<div class="error">Ошибка загрузки: ${error.message}</div>`;
        }
    }

    displaySystemInstruction(instruction) {
        const viewer = document.getElementById('systemInstructionViewer');
        // Показываем первые 200 символов + сокращение
        const preview = instruction.length > 200 ? 
            instruction.substring(0, 200) + '\n\n... (показано 200 из ' + instruction.length + ' символов) ...' : 
            instruction;
        viewer.textContent = preview;
    }

    editSystemInstruction() {
        const viewer = document.getElementById('systemInstructionViewer');
        const editor = document.getElementById('systemInstructionEditor');
        const controls = document.querySelector('.system-instruction-editor-controls');
        
        editor.value = this.originalSystemInstruction;
        
        viewer.style.display = 'none';
        editor.style.display = 'block';
        controls.style.display = 'flex';
    }

    cancelEditSystemInstruction() {
        const viewer = document.getElementById('systemInstructionViewer');
        const editor = document.getElementById('systemInstructionEditor');
        const controls = document.querySelector('.system-instruction-editor-controls');
        
        viewer.style.display = 'block';
        editor.style.display = 'none';
        controls.style.display = 'none';
    }

    async saveSystemInstruction() {
        const editor = document.getElementById('systemInstructionEditor');
        const newInstruction = editor.value;
        
        if (!newInstruction.trim()) {
            alert('Системная инструкция не может быть пустой');
            return;
        }

        try {
            const response = await fetch('/api/system-instruction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ systemInstruction: newInstruction })
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Ошибка сохранения');
            }

            this.originalSystemInstruction = newInstruction;
            this.displaySystemInstruction(newInstruction);
            this.cancelEditSystemInstruction();
            
            this.addToProgressLog(`✅ Системная инструкция сохранена (резервная копия: ${data.backupFile})`);
        } catch (error) {
            alert(`Ошибка сохранения: ${error.message}`);
        }
    }

    async resetSystemInstruction() {
        if (!confirm('Вы уверены, что хотите перезагрузить системную инструкцию из файла?')) {
            return;
        }

        await this.loadSystemInstruction();
        this.addToProgressLog('🔄 Системная инструкция перезагружена из файла');
    }

    // Методы для отображения результатов
    showChapterResult(chapterNumber, chapterName, data) {
        const container = document.getElementById('resultContainer');
        
        // Удаляем placeholder если есть
        const placeholder = container.querySelector('.result-placeholder');
        if (placeholder) {
            placeholder.remove();
        }

        const resultHtml = this.generateChapterResultHtml(chapterNumber, chapterName, data);
        container.insertAdjacentHTML('beforeend', resultHtml);
        
        // Прокручиваем к новому результату
        const newResult = container.lastElementChild;
        newResult.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        // Сохраняем информацию о последнем обработанном файле и показываем кнопку
        this.lastProcessedChapter = { chapterNumber, chapterName };
        document.getElementById('openFileBtn').style.display = 'inline-block';
    }
    
    async openCurrentFile() {
        if (!this.lastProcessedChapter || !this.selectedBook) {
            alert('Нет обработанных файлов для открытия');
            return;
        }
        
        try {
            const response = await fetch('/api/open-file', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bookName: this.selectedBook,
                    chapterName: this.lastProcessedChapter.chapterName
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Ошибка открытия файла');
            }
            
            this.addToProgressLog(`📂 Файл открыт: ${data.filePath}`);
        } catch (error) {
            alert(`Ошибка открытия файла: ${error.message}`);
            this.addToProgressLog(`❌ Ошибка открытия файла: ${error.message}`);
        }
    }

    generateChapterResultHtml(chapterNumber, chapterName, data) {
        let cardsHtml = '';
        
        if (data.chapter_cards && data.chapter_cards.length > 0) {
            data.chapter_cards.forEach(theme => {
                let cardsListHtml = '';
                theme.cards.forEach(card => {
                    const [question, answer] = card.split(' >> ');
                    cardsListHtml += `
                        <div class="flashcard">
                            <div class="flashcard-question">${question}</div>
                            <div class="flashcard-answer">${answer}</div>
                        </div>
                    `;
                });

                cardsHtml += `
                    <div class="card-theme">
                        <div class="card-theme-header">${theme.topic}</div>
                        <div class="card-list">${cardsListHtml}</div>
                    </div>
                `;
            });
        }

        return `
            <div class="chapter-result">
                <div class="chapter-result-header">
                    Глава ${chapterNumber}: ${chapterName}
                </div>
                <div class="chapter-result-content">
                    <div class="chapter-summary">
                        <strong>Краткое содержание:</strong><br>
                        ${data.chapter_summary || 'Краткое содержание не создано'}
                    </div>
                    <div class="chapter-cards">
                        ${cardsHtml}
                    </div>
                </div>
            </div>
        `;
    }

    clearResults() {
        const container = document.getElementById('resultContainer');
        container.innerHTML = `
            <div class="result-placeholder">
                Здесь будут отображаться результаты обработки глав...
            </div>
        `;
    }

    // Методы для управления прогресс-баром
    showProgressBar() {
        document.getElementById('progressBarContainer').style.display = 'block';
    }

    hideProgressBar() {
        document.getElementById('progressBarContainer').style.display = 'none';
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