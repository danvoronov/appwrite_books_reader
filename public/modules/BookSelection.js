// Модуль выбора книг
import { Utils } from './Utils.js';

export class BookSelection {
    constructor(bookProcessor) {
        this.bp = bookProcessor;
    }

    async loadBooks() {
        try {
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
            return true;
        } catch (error) {
            console.error('Ошибка загрузки книг:', error);
            Utils.showError('booksContainer', `Не удалось загрузить список книг: ${error.message}`);
            return true; // Устанавливаем флаг даже при ошибке
        }
    }

    renderBooks(books, lastBook) {
        const container = document.getElementById('booksContainer');
        
        if (books.length === 0) {
            container.innerHTML = '<div class="error">Книги не найдены. Проверьте папку ../epub/</div>';
            return;
        }

        let html = '<div class="book-grid">';
        
        books.forEach(bookItem => {
            const book = typeof bookItem === 'string' ? bookItem : bookItem.name;
            const hasNotes = typeof bookItem === 'object' && !!bookItem.hasNotes;
            const isLast = book === lastBook;
            html += `
                <div class="book-item ${isLast ? 'last-book' : ''}" data-book="${book}">
                    <h3>${book} ${hasNotes ? '<span style=\"font-size:0.8em; color:#2ecc71\">● notes</span>' : ''}</h3>
                    <div class="book-actions">
                        <button class="btn book-btn book-btn-load" data-book="${book}" data-force="false">Load</button>
                        <button class="btn btn-secondary book-btn book-btn-reread" data-book="${book}" data-force="true">Reread</button>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;

        this.attachBookEventListeners(container);
    }

    attachBookEventListeners(container) {
        // Обработчики кликов на кнопки
        container.querySelectorAll('.book-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const bookName = btn.dataset.book;
                const forceEpub = btn.dataset.force === 'true';
                this.bp.openBookDirectly(bookName, forceEpub);
            });
        });
        
        // Обработчики кликов на название книги (работает как Load)
        container.querySelectorAll('.book-item h3').forEach(title => {
            title.style.cursor = 'pointer';
            title.addEventListener('click', (e) => {
                e.stopPropagation();
                const bookItem = title.closest('.book-item');
                const bookName = bookItem.dataset.book;
                this.bp.openBookDirectly(bookName, false);
            });
        });
    }

    async selectBook(bookName, forceEpub = false) {
        try {
            this.bp.bookData = null;
            document.getElementById('bookInfo').innerHTML = '';
            document.getElementById('chaptersContainer').innerHTML = '<div class="loading">Загружаем информацию о главах...</div>';
            
            this.bp.showStep(2);

            const response = await fetch('/api/book/info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    bookName: bookName,
                    forceEpub: forceEpub
                })
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Ошибка загрузки информации о книге');
            }

            this.bp.bookData = data;
            this.renderBookInfo();
            
            return data;
        } catch (error) {
            Utils.showError('chaptersContainer', error.message);
            console.error('Error loading book:', error);
            throw error;
        }
    }

    renderBookInfo() {
        const container = document.getElementById('bookInfo');
        const processedCount = this.bp.bookData.chapters.filter(ch => ch.exists).length;
        const hasProcessed = processedCount > 0;
        
        container.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <div style="flex: 1;">
                    <strong>📚 ${this.bp.bookData.book.title}</strong> 
                    <span class="book-stats">• Всего: ${this.bp.bookData.book.chaptersCount} глав • Доступно: ${this.bp.bookData.chapters.length} • Уже обработано: ${processedCount}</span>
                </div>
                ${hasProcessed ? '<button class="btn btn-secondary" id="downloadSummaryBtn" style="padding: 6px 12px; font-size: 0.85rem;">📥 Скачать саммари</button>' : ''}
            </div>
        `;
        
        if (hasProcessed) {
            setTimeout(() => {
                const btn = document.getElementById('downloadSummaryBtn');
                if (btn) {
                    btn.addEventListener('click', () => this.bp.downloadSummary());
                }
            }, 0);
        }
    }
}
