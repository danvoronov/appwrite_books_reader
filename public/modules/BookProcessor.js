// Главный класс приложения - координатор всех модулей
import { Utils } from './Utils.js';
import { UrlRouter } from './UrlRouter.js';
import { BookSelection } from './BookSelection.js';
import { ChapterManager } from './ChapterManager.js';
import { ChapterReader } from './ChapterReader.js';
import { ProcessingManager } from './ProcessingManager.js';

export class BookProcessor {
    constructor() {
        // Состояние приложения
        this.selectedBook = null;
        this.bookData = null;
        this.selectedChapters = new Set();
        this.sessionId = Utils.generateSessionId();
        this.booksLoaded = false;
        this.currentChapter = null;
        this.forceEpubMode = false;
        
        // Инициализация модулей
        this.urlRouter = new UrlRouter(this);
        this.bookSelection = new BookSelection(this);
        this.chapterManager = new ChapterManager(this);
        this.chapterReader = new ChapterReader(this);
        this.processingManager = new ProcessingManager(this);
        
        // Запуск
        this.initializeEventListeners();
        this.loadBooks();
        this.handleUrlRouting();
    }

    initializeEventListeners() {
        // Навигация
        document.getElementById('processBtn')?.addEventListener('click', () => this.prepareForProcessing());
        document.getElementById('stopProcessingBtn')?.addEventListener('click', () => this.processingManager.stopProcessing());
        document.getElementById('backToBooks')?.addEventListener('click', () => this.backToBooks());
        document.getElementById('closeModal')?.addEventListener('click', () => this.processingManager.closeProcessingModal());
        
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
        document.getElementById('fontInc')?.addEventListener('click', () => this.chapterReader.changeReaderFontSize(0.05));
        document.getElementById('fontDec')?.addEventListener('click', () => this.chapterReader.changeReaderFontSize(-0.05));
        document.getElementById('lhInc')?.addEventListener('click', () => this.chapterReader.changeReaderLineHeight(0.1));
        document.getElementById('lhDec')?.addEventListener('click', () => this.chapterReader.changeReaderLineHeight(-0.1));
        document.getElementById('requestTagsBtn')?.addEventListener('click', () => this.chapterReader.requestTagsForCurrentChapter());
        document.getElementById('nextChapterBtn')?.addEventListener('click', () => this.chapterReader.loadNextChapter());

        // Кнопки выбора глав
        document.getElementById('selectAllBtn')?.addEventListener('click', () => this.chapterManager.selectAllChapters());
        document.getElementById('selectProcessedBtn')?.addEventListener('click', () => this.chapterManager.selectProcessedChapters());
        document.getElementById('deselectAllBtn')?.addEventListener('click', () => this.chapterManager.deselectAllChapters());
    }

    showStep(stepNumber) {
        document.querySelectorAll('.step').forEach(step => step.classList.remove('active'));
        document.getElementById(`step${stepNumber}`)?.classList.add('active');
        
        const params = new URLSearchParams(window.location.search);
        if (stepNumber === 1) {
            window.history.pushState({}, '', '/');
        } else if (stepNumber === 2 && this.selectedBook) {
            params.set('book', this.selectedBook);
            params.delete('chapter');
            
            if (this.selectedChapters.size > 0) {
                const chaptersArray = Array.from(this.selectedChapters).sort((a, b) => a - b);
                params.set('chapters', chaptersArray.join(','));
            } else {
                params.delete('chapters');
            }
            window.history.pushState({}, '', '?' + params.toString());
        }
    }

    backToBooks() {
        this.showStep(1);
        this.urlRouter.clearBookFromUrl();
        this.selectedBook = null;
        document.title = 'REM by Gemini - Веб Версия';
    }

    async loadBooks() {
        this.booksLoaded = await this.bookSelection.loadBooks();
    }

    async openBookDirectly(bookName, forceEpub = false) {
        this.selectedBook = bookName;
        this.forceEpubMode = forceEpub;
        this.urlRouter.updateBookUrl(bookName);
        await this.selectBook();
    }

    async selectBook() {
        if (!this.selectedBook) return;
        
        try {
            this.bookData = await this.bookSelection.selectBook(this.selectedBook, this.forceEpubMode);
            this.chapterManager.renderChapters();
        } catch (error) {
            console.error('Error in selectBook:', error);
        }
    }

    handleUrlRouting() {
        setTimeout(() => this.chapterReader.applyReaderTypography(), 0);
        this.urlRouter.handleInitialRoute(() => this.booksLoaded);
    }

    openChapterReader(chapter) {
        this.showStep(3);
        this.chapterReader.loadChapterContent(chapter);
        this.currentChapter = chapter;
    }

    prepareForProcessing() {
        this.processingManager.prepareForProcessing();
    }

    updateProcessButton() {
        this.chapterManager.updateProcessButton();
    }

    downloadSummary() {
        this.processingManager.downloadSummary();
    }
}
