// Управление главами (выбор, рендеринг списка)
import { Utils } from './Utils.js';

export class ChapterManager {
    constructor(bookProcessor) {
        this.bp = bookProcessor;
    }

    renderChapters() {
        const container = document.getElementById('chaptersContainer');
        
        if (this.bp.bookData.chapters.length === 0) {
            container.innerHTML = '<div class="error">Главы для обработки не найдены</div>';
            return;
        }

        const chapters = this.bp.bookData.chapters;
        const { chaptersBeforeGroups, grouped, chaptersAfterGroups } = this.groupChapters(chapters);

        let html = '<div class="chapters-container">';
        
        if (chaptersBeforeGroups.length > 0) {
            html += this.renderChapterList(chaptersBeforeGroups);
        }
        
        Object.keys(grouped).forEach(groupName => {
            html += this.renderChapterGroup(groupName, grouped[groupName]);
        });
        
        if (chaptersAfterGroups.length > 0) {
            html += this.renderChapterList(chaptersAfterGroups);
        }
        
        html += '</div>';
        container.innerHTML = html;

        this.attachChapterEventListeners(container);
        this.bp.selectedChapters.clear();
        this.updateProcessButton();
    }

    groupChapters(chapters) {
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
                if (!grouped[chapter.group]) {
                    grouped[chapter.group] = [];
                }
                grouped[chapter.group].push(chapter);
            } else {
                if (idx < firstGroupIndex) {
                    chaptersBeforeGroups.push(chapter);
                } else {
                    chaptersAfterGroups.push(chapter);
                }
            }
        });

        return { chaptersBeforeGroups, grouped, chaptersAfterGroups };
    }

    renderChapterList(chaptersList) {
        const columns = 3;
        const rowCount = Math.ceil(chaptersList.length / columns);
        
        let html = `
            <div class="chapter-group">
                <div class="chapters-grid" style="grid-template-rows: repeat(${rowCount}, auto);">
        `;
        
        chaptersList.forEach(chapter => {
            html += this.renderChapterItem(chapter);
        });
        
        html += `
                </div>
            </div>
        `;
        return html;
    }

    renderChapterGroup(groupName, groupChapters) {
        const columns = 3;
        const totalItems = 1 + groupChapters.length;
        const rowCount = Math.ceil(totalItems / columns);
        
        let html = `
            <div class="chapter-group">
                <div class="chapters-grid-with-header" style="grid-template-rows: repeat(${rowCount}, auto);">
                    <div class="group-header-inline">📂 ${groupName}</div>
        `;
        
        groupChapters.forEach(chapter => {
            html += this.renderChapterItem(chapter);
        });
        
        html += `
                </div>
            </div>
        `;
        return html;
    }

    renderChapterItem(chapter) {
        const sizeInfo = Utils.formatSize(chapter.contentLength);
        const warningSymbol = chapter.contentLength > 100000 ? '⚠️ ' : '';
        const tagsEmoji = chapter.hasTags ? '🏷️ ' : '';
        const summaryEmoji = chapter.exists ? '📝 ' : '';
        
        return `
            <div class="chapter-item ${chapter.exists ? 'exists' : ''}" data-chapter="${chapter.realNumber}">
                <div class="chapter-title">
                    <span class="chapter-number">[${chapter.displayNumber}]</span>
                    <span class="chapter-exists">${tagsEmoji}${summaryEmoji}</span>
                    <span class="chapter-name">${chapter.name}</span>
                    <span class="chapter-size">${warningSymbol}${sizeInfo}</span>
                    <button class="chapter-process-btn" data-chapter="${chapter.realNumber}" title="Читать главу">📖</button>
                </div>
            </div>
        `;
    }

    attachChapterEventListeners(container) {
        // Клики на главы
        container.querySelectorAll('.chapter-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('chapter-process-btn')) {
                    return;
                }
                this.toggleChapter(item);
            });
        });
        
        // Кнопки просмотра главы
        container.querySelectorAll('.chapter-process-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const chapterNum = parseInt(btn.dataset.chapter);
                const chapter = this.bp.bookData.chapters.find(c => c.realNumber === chapterNum);
                if (chapter) {
                    this.bp.openChapterReader(chapter);
                }
            });
        });
    }

    toggleChapter(item) {
        const chapterNum = parseInt(item.dataset.chapter);
        
        if (this.bp.selectedChapters.has(chapterNum)) {
            this.bp.selectedChapters.delete(chapterNum);
            item.classList.remove('selected');
        } else {
            this.bp.selectedChapters.add(chapterNum);
            item.classList.add('selected');
        }
        
        this.updateProcessButton();
        this.bp.urlRouter.updateWithChapters(this.bp.selectedBook, this.bp.selectedChapters);
    }

    selectAllChapters() {
        const allItems = document.querySelectorAll('.chapter-item');
        const totalCount = allItems.length;
        const selectedCount = this.bp.selectedChapters.size;
        
        if (selectedCount === totalCount) {
            this.bp.selectedChapters.clear();
            allItems.forEach(item => item.classList.remove('selected'));
        } else {
            this.bp.selectedChapters.clear();
            allItems.forEach(item => {
                const chapterNum = parseInt(item.dataset.chapter);
                this.bp.selectedChapters.add(chapterNum);
                item.classList.add('selected');
            });
        }
        this.updateProcessButton();
        this.bp.urlRouter.updateWithChapters(this.bp.selectedBook, this.bp.selectedChapters);
    }

    deselectAllChapters() {
        this.bp.selectedChapters.clear();
        document.querySelectorAll('.chapter-item').forEach(item => {
            item.classList.remove('selected');
        });
        this.updateProcessButton();
        this.bp.urlRouter.updateWithChapters(this.bp.selectedBook, this.bp.selectedChapters);
    }

    selectProcessedChapters() {
        const processedItems = Array.from(document.querySelectorAll('.chapter-item.exists'));
        const unprocessedItems = Array.from(document.querySelectorAll('.chapter-item:not(.exists)'));
        
        const processedSelected = processedItems.some(item => {
            const chapterNum = parseInt(item.dataset.chapter);
            return this.bp.selectedChapters.has(chapterNum);
        });
        
        this.bp.selectedChapters.clear();
        
        if (processedSelected) {
            unprocessedItems.forEach(item => {
                const chapterNum = parseInt(item.dataset.chapter);
                this.bp.selectedChapters.add(chapterNum);
                item.classList.add('selected');
            });
            processedItems.forEach(item => item.classList.remove('selected'));
        } else {
            processedItems.forEach(item => {
                const chapterNum = parseInt(item.dataset.chapter);
                this.bp.selectedChapters.add(chapterNum);
                item.classList.add('selected');
            });
            unprocessedItems.forEach(item => item.classList.remove('selected'));
        }
        
        this.updateProcessButton();
        this.bp.urlRouter.updateWithChapters(this.bp.selectedBook, this.bp.selectedChapters);
    }

    updateProcessButton() {
        const btn = document.getElementById('processBtn');
        if (!btn) return;
        
        btn.disabled = this.bp.selectedChapters.size === 0;
        const count = this.bp.selectedChapters.size;
        const text = count === 0 ? 'Обработать 0 глав' : 
                     count === 1 ? 'Обработать 1 главу' :
                     count < 5 ? `Обработать ${count} главы` :
                     `Обработать ${count} глав`;
        btn.textContent = text;
    }
}
