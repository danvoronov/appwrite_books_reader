// Управление URL и маршрутизацией
export class UrlRouter {
    constructor(bookProcessor) {
        this.bp = bookProcessor;
        this.setupPopStateHandler();
    }

    updateBookUrl(bookName) {
        const url = new URL(window.location);
        url.searchParams.set('book', encodeURIComponent(bookName));
        window.history.pushState({ book: bookName }, '', url);
        document.title = `REM by Gemini - ${bookName}`;
    }

    updateWithChapters(bookName, selectedChapters) {
        const params = new URLSearchParams(window.location.search);
        params.set('book', bookName);
        params.delete('processing');
        
        if (selectedChapters.size > 0) {
            const chaptersArray = Array.from(selectedChapters).sort((a, b) => a - b);
            params.set('chapters', chaptersArray.join(','));
        } else {
            params.delete('chapters');
        }
        
        window.history.replaceState({}, '', '?' + params.toString());
    }

    updateChapterUrl(bookName, chapterDisplayNumber) {
        const params = new URLSearchParams(window.location.search);
        params.set('book', bookName);
        params.set('chapter', chapterDisplayNumber);
        window.history.pushState({}, '', '?' + params.toString());
    }

    clearBookFromUrl() {
        const url = new URL(window.location);
        url.searchParams.delete('book');
        window.history.pushState({}, '', url);
    }

    getUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        return {
            book: urlParams.get('book'),
            chapters: urlParams.get('chapters'),
            chapter: urlParams.get('chapter')
        };
    }

    setupPopStateHandler() {
        window.addEventListener('popstate', () => {
            window.location.reload();
        });
    }

    async handleInitialRoute(booksLoaded) {
        const { book, chapters, chapter } = this.getUrlParams();
        
        if (!book) return;

        // Ждем загрузки книг
        await this.waitForBooks(booksLoaded);

        const decodedBookName = decodeURIComponent(book);
        await this.bp.openBookDirectly(decodedBookName);

        // Восстанавливаем выбранные главы
        if (chapters) {
            this.restoreSelectedChapters(chapters);
        }

        // Открываем конкретную главу если указана
        if (chapter) {
            this.openChapterByParam(chapter);
        }
    }

    waitForBooks(booksLoadedCallback) {
        return new Promise((resolve) => {
            const check = () => {
                if (booksLoadedCallback()) {
                    resolve();
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }

    restoreSelectedChapters(chaptersParam) {
        const chapterNums = chaptersParam.split(',')
            .map(n => parseInt(n.trim()))
            .filter(n => !isNaN(n));
        
        this.bp.selectedChapters.clear();
        chapterNums.forEach(num => this.bp.selectedChapters.add(num));
        
        setTimeout(() => {
            document.querySelectorAll('.chapter-item').forEach(item => {
                const chapterNum = parseInt(item.dataset.chapter);
                if (this.bp.selectedChapters.has(chapterNum)) {
                    item.classList.add('selected');
                }
            });
            this.bp.updateProcessButton();
        }, 200);
    }

    openChapterByParam(chapterParam) {
        const chNum = parseInt(chapterParam);
        if (isNaN(chNum)) return;

        const chapter = this.bp.bookData.chapters.find(
            c => c.displayNumber === chNum || c.realNumber === chNum
        );
        
        if (chapter) {
            this.bp.openChapterReader(chapter);
        }
    }
}
