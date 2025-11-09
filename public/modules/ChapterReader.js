// Читалка глав с поддержкой тегов и аннотаций
import { Utils } from './Utils.js';

export class ChapterReader {
    constructor(bookProcessor) {
        this.bp = bookProcessor;
        this.readerFontSize = this.loadTypographySetting('readerFontSize', 1.1);
        this.readerLineHeight = this.loadTypographySetting('readerLineHeight', 1.8);
    }

    loadTypographySetting(key, defaultValue) {
        try {
            const saved = localStorage.getItem(key);
            return saved ? parseFloat(saved) : defaultValue;
        } catch (_) {
            return defaultValue;
        }
    }

    applyReaderTypography() {
        const main = document.getElementById('readerMain');
        if (main) {
            main.style.fontSize = `${this.readerFontSize}rem`;
            main.style.lineHeight = `${this.readerLineHeight}`;
        }
    }

    changeReaderFontSize(delta) {
        this.readerFontSize = Math.max(0.8, Math.min(2.0, this.readerFontSize + delta));
        this.applyReaderTypography();
        try {
            localStorage.setItem('readerFontSize', this.readerFontSize);
        } catch (_) {}
    }

    changeReaderLineHeight(delta) {
        this.readerLineHeight = Math.max(1.2, Math.min(2.5, this.readerLineHeight + delta));
        this.applyReaderTypography();
        try {
            localStorage.setItem('readerLineHeight', this.readerLineHeight);
        } catch (_) {}
    }

    async loadChapterContent(chapter) {
        const container = document.getElementById('readerMain');
        const summaryEl = document.getElementById('readerSummary');
        const metaEl = document.getElementById('readerMeta');
        const chapterSelect = document.getElementById('readerChapterSelect');
        const bookTitleSmall = document.getElementById('readerBookTitleSmall');
        const sideEl = document.getElementById('readerSide');
        
        if (!chapterSelect || !bookTitleSmall) return;

        // Сразу очищаем правую колонку
        if (sideEl) sideEl.innerHTML = '';

        bookTitleSmall.textContent = `— ${this.bp.bookData.book.title}`;
        this.populateChapterSelect(chapterSelect, chapter);
        
        // Показываем загрузку
        container.innerHTML = '<div class="loading">⏳ Загружаем текст главы...</div>';
        if (summaryEl) {
            summaryEl.innerHTML = '<div class="reader-summary"><div class="reader-summary-body">Загрузка...</div></div>';
            summaryEl.style.display = '';
        }
        if (metaEl) {
            metaEl.textContent = 'Загрузка...';
            metaEl.style.display = '';
        }
        
        this.bp.urlRouter.updateChapterUrl(this.bp.selectedBook, chapter.displayNumber);
        
        try {
            // Сначала загружаем контент, потом саммари и теги параллельно
            const chapterData = await this.fetchChapterRaw(chapter);
            const [summaryHtml, tags] = await Promise.all([
                this.fetchSummary(chapter),
                this.fetchTags(chapter, chapterData)
            ]);

            let html = this.processChapterHtml(chapterData.content);
            
            // Аннотируем HTML тегами если есть
            if (tags && tags.terms && tags.terms.length > 0) {
                html = this.annotateHtml(html, chapterData.content, tags);
                this.renderRightTags(tags, html);
            } else {
                this.renderRightTags({ terms: [], comments: [] }, html);
            }

            // Отображаем контент
            if (summaryEl) {
                if (summaryHtml) {
                    summaryEl.innerHTML = summaryHtml;
                    summaryEl.style.display = '';
                } else {
                    summaryEl.innerHTML = '';
                    summaryEl.style.display = 'none';
                }
            }

            if (metaEl) {
                metaEl.textContent = this.buildMetaInfo(chapterData.content, tags);
                metaEl.style.display = '';
            }

            container.innerHTML = html;
            this.applyReaderTypography();
            
        } catch (error) {
            container.innerHTML = `<div class="error">❌ Ошибка загрузки: ${error.message}</div>`;
        }
    }

    populateChapterSelect(chapterSelect, currentChapter) {
        if (chapterSelect.options.length !== this.bp.bookData.chapters.length) {
            chapterSelect.innerHTML = '';
            this.bp.bookData.chapters.forEach((ch) => {
                const opt = document.createElement('option');
                opt.value = String(ch.realNumber);
                opt.textContent = `[${ch.displayNumber}] ${ch.name}`;
                chapterSelect.appendChild(opt);
            });
        }
        
        chapterSelect.value = String(currentChapter.realNumber);
        
        chapterSelect.onchange = () => {
            const val = parseInt(chapterSelect.value, 10);
            const target = this.bp.bookData.chapters.find(c => c.realNumber === val);
            if (target) {
                this.bp.currentChapter = target;
                this.loadChapterContent(target);
            }
        };
    }

    async fetchSummary(chapter) {
        try {
            const sumResp = await fetch('/api/get-chapter-content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    bookName: this.bp.selectedBook, 
                    chapterName: chapter.name 
                })
            });
            
            if (sumResp.ok) {
                const sumData = await sumResp.json();
                const summary = this.extractSummaryFromProcessed(sumData.content);
                if (summary && summary.trim().length > 0) {
                    return this.buildSummaryHtml(summary.trim());
                }
            }
        } catch (e) {
            console.warn('Summary fetch failed:', e);
        }
        return '';
    }

    async fetchChapterRaw(chapter) {
        const response = await fetch('/api/get-chapter-raw', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                bookName: this.bp.selectedBook,
                chapterIndex: chapter.realNumber
            })
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Ошибка загрузки главы');
        }
        return data;
    }

    async fetchTags(chapter, chapterData) {
        try {
            const tagResp = await fetch('/api/tags/get', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    bookName: this.bp.selectedBook, 
                    chapterName: chapter.name 
                })
            });
            
            if (tagResp.ok) {
                const tagJson = await tagResp.json();
                return this.processTags(tagJson, chapterData);
            }
        } catch (e) {
            console.warn('Tags fetch failed:', e);
        }
        return null;
    }

    processTags(tagJson, chapterData) {
        const raw = chapterData.content;
        const top = tagJson?.data || tagJson;
        
        // Собираем термы
        const terms = this.collectAndProcessTerms(top, raw);
        
        // Собираем комментарии
        const comments = this.collectComments(top, raw, terms);
        
        return { terms, comments };
    }

    collectAndProcessTerms(node, raw) {
        const collected = this.collectTerms(node);
        const typed = this.assignTypes(node);
        const terms = this.toRanges(typed, raw);
        return terms.map((it, i) => ({ ...it, _rid: i, type: it._type || undefined }));
    }

    collectTerms(node, out = []) {
        try {
            if (!node) return out;
            if (Array.isArray(node)) {
                if (node.length && typeof node[0] === 'string') return out;
                for (const it of node) this.collectTerms(it, out);
            } else if (typeof node === 'object') {
                const hasRange = Object.prototype.hasOwnProperty.call(node, 's') && 
                                Object.prototype.hasOwnProperty.call(node, 'e');
                if (hasRange) out.push(node);
                for (const k of Object.keys(node)) this.collectTerms(node[k], out);
            }
        } catch(_) {}
        return out;
    }

    assignTypes(node, parentKey = '', typed = []) {
        if (!node) return typed;
        if (Array.isArray(node)) {
            for (const it of node) this.assignTypes(it, parentKey, typed);
        } else if (typeof node === 'object') {
            const keys = Object.keys(node);
            const isRange = keys.includes('s') && keys.includes('e');
            if (isRange) {
                typed.push({ ...node, _type: parentKey });
            }
            for (const k of keys) this.assignTypes(node[k], k, typed);
        }
        return typed;
    }

    toRanges(list, raw) {
        const res = [];
        let lastIdx = 0;
        
        for (const it of list) {
            const sText = String(it.s || '');
            const eText = String(it.e || '');
            let sIdx = raw.indexOf(sText, lastIdx);
            if (sIdx === -1) sIdx = raw.indexOf(sText, 0);
            let ePos = raw.indexOf(eText, sIdx >= 0 ? sIdx + sText.length : 0);
            
            if (sIdx >= 0 && ePos >= 0) {
                const eIdx = ePos + eText.length;
                // Сохраняем все поля включая 't' (текст термина)
                res.push({ 
                    ...it, 
                    s: sIdx, 
                    e: eIdx, 
                    _sText: sText, 
                    _eText: eText,
                    t: it.t || '' // явно сохраняем текст термина
                });
                lastIdx = eIdx;
            }
        }
        return res;
    }

    collectComments(node, raw, terms) {
        const comments = [];
        const collectCommentNodes = (n) => {
            if (!n) return;
            if (Array.isArray(n)) return n.forEach(collectCommentNodes);
            if (typeof n === 'object') {
                if (Object.prototype.hasOwnProperty.call(n, 'a') && 
                    Object.prototype.hasOwnProperty.call(n, 't')) {
                    comments.push({ a: String(n.a||''), t: String(n.t||'') });
                }
                Object.values(n).forEach(collectCommentNodes);
            }
        };
        collectCommentNodes(node);
        
        let cIdx = 0;
        return comments.map(c => {
            const aText = (c.a || '').trim();
            let pos = aText ? raw.indexOf(aText) : -1;
            let anchorId = '';
            
            if (pos >= 0) {
                anchorId = `tag_c_${cIdx++}`;
                terms.push({ 
                    s: pos, 
                    e: pos + aText.length, 
                    a: '', 
                    type: 'comment', 
                    _anchorId: anchorId, 
                    _isAnchorOnly: true 
                });
            }
            
            return { t: c.t, a: c.a, anchorId, _pos: pos };
        });
    }

    buildSummaryHtml(summary) {
        const safe = window.marked ? window.marked.parse(summary) : summary.replace(/</g,'&lt;').replace(/\n/g,'<br>');
        return `
            <div class="reader-summary">
                <div class="reader-summary-body">${safe}</div>
            </div>
        `;
    }

    processChapterHtml(content) {
        let html = window.marked ? window.marked.parse(content) : content;
        html = this.separateFooter(html);
        return this.rewriteEpubUrls(html, this.bp.selectedBook);
    }

    separateFooter(html) {
        // Находим горизонтальную линию <hr>, после которой идет футер
        const hrMatch = html.match(/(<hr\s*\/?>)/i);
        if (!hrMatch) return html;
        
        const hrIndex = html.indexOf(hrMatch[0]);
        const beforeHr = html.slice(0, hrIndex);
        const afterHr = html.slice(hrIndex + hrMatch[0].length);
        
        // Оборачиваем футер в div с классом для стилизации
        return `${beforeHr}<hr><div class="chapter-footer">${afterHr}</div>`;
    }

    annotateHtml(htmlStr, raw, tags) {
        try {
            const rangesWithIds = tags.terms;
            return this.annotateInHtml(htmlStr, raw, rangesWithIds);
        } catch (err) {
            console.warn('Annotate HTML failed, fallback', err);
            return htmlStr;
        }
    }

    annotateInHtml(htmlStr, raw, ranges) {
        let result = htmlStr;
        const byStart = [...ranges].sort((a,b) => b.s - a.s);
        
        for (const r of byStart) {
            const sText = r._sText || raw.slice(r.s, Math.min(r.s + 80, r.e));
            const eText = r._isAnchorOnly ? '' : (r._eText || raw.slice(Math.max(r.e - 80, r.s), r.e));
            const sRe = new RegExp(Utils.escapeRegex(sText));
            const sMatch = result.match(sRe);
            
            if (!sMatch) continue;
            
            const sIdxHtml = result.indexOf(sMatch[0]);
            
            if (r._isAnchorOnly) {
                const idAttr = r._anchorId ? ` id="${r._anchorId}"` : '';
                const before = result.slice(0, sIdxHtml);
                const after = result.slice(sIdxHtml);
                result = `${before}<span${idAttr} class="tag-comment-emoji">💬</span>${after}`;
                continue;
            }
            
            const afterS = result.slice(sIdxHtml + sMatch[0].length);
            const eRe = new RegExp(Utils.escapeRegex(eText));
            const eMatch = afterS.match(eRe);
            
            if (!eMatch) continue;
            
            const eIdxHtml = sIdxHtml + sMatch[0].length + afterS.indexOf(eMatch[0]) + eMatch[0].length;
            const middle = result.slice(sIdxHtml + sMatch[0].length, eIdxHtml - eMatch[0].length);
            const typeClass = r.type ? ` type-${String(r.type)}` : '';
            const spanId = r._anchorId ? r._anchorId : (Number.isFinite(r._rid) ? `tag_${r._rid}` : '');
            const idAttr = spanId ? ` id="${spanId}"` : '';
            const replacement = `<span${idAttr} class="tag-underline${typeClass}">${sMatch[0]}${middle}${eMatch[0]}</span>`;
            result = result.slice(0, sIdxHtml) + replacement + result.slice(eIdxHtml);
        }
        return result;
    }

    renderRightTags(tagData, htmlStr) {
        const layout = () => {
            const main = document.getElementById('readerMain');
            const side = document.getElementById('readerSide');
            if (!side || !main) return;
            
            const mainRect = main.getBoundingClientRect();
            const anchors = {};
            const spans = main.querySelectorAll('[id^="tag_"], .tag-comment-emoji[id]');
            spans.forEach(el => { anchors[el.id] = el.getBoundingClientRect(); });
            
            const cards = Array.from(side.querySelectorAll('.tag-right-item'));
            cards.forEach(card => {
                const anchorId = card.getAttribute('data-anchor');
                if (!anchorId || !anchors[anchorId]) return;
                const ar = anchors[anchorId];
                const top = ar.top - mainRect.top + side.scrollTop;
                card.style.top = `${Math.max(0, Math.floor(top))}px`;
            });
            
            cards.sort((a,b) => (parseInt(a.style.top)||0) - (parseInt(b.style.top)||0));
            let lastBottom = -Infinity;
            cards.forEach(card => {
                const t = parseInt(card.style.top)||0;
                const h = card.getBoundingClientRect().height;
                if (t < lastBottom + 4) {
                    card.style.top = `${lastBottom + 4}px`;
                }
                lastBottom = (parseInt(card.style.top)||0) + h;
            });
        };
        
        const bind = () => {
            layout();
            window.addEventListener('resize', layout);
            const main = document.getElementById('readerMain');
            if (main) main.addEventListener('scroll', layout, { passive: true });
            const side = document.getElementById('readerSide');
            if (side) side.addEventListener('scroll', layout, { passive: true });
        };
        setTimeout(bind, 0);
        
        const side = document.getElementById('readerSide');
        if (!side) return;
        
        const terms = tagData && Array.isArray(tagData.terms) ? tagData.terms : [];
        const comments = tagData && Array.isArray(tagData.comments) ? tagData.comments : [];
        
        if (!terms.length && !comments.length) {
            side.innerHTML='';
            return;
        }
        
        const safe = (s) => Utils.escapeHtml(s || '');
        
        // Собираем элементы для сортировки по позиции в тексте
        const items = [];
        
        terms.forEach((t, i) => {
            if (t._isAnchorOnly) return; // технический якорь не показываем
            
            const type = (t.type || '').toLowerCase();
            const ru = { def: 'Определение', ex: 'История', tip: 'Совет', q: 'Сомнительное' };
            const chip = `<span class="tag-type-chip ${type}">${ru[type] || type || 'Метка'}</span>`;
            const text = safe(t.t || '');
            const anchor = Number.isFinite(t._rid) ? `tag_${t._rid}` : '';
            
            items.push({
                order: t.s ?? 0,
                html: `<div class="tag-right-item" data-anchor="${anchor}">${chip}<span>${text}</span></div>`
            });
        });
        
        comments.forEach((c) => {
            if (!c.anchorId) return;
            const text = safe(c.t || 'Комментарий');
            items.push({
                order: c._pos ?? 0,
                html: `<div class="tag-right-item quote" data-anchor="${c.anchorId}">${text}</div>`
            });
        });
        
        // Сортируем по позиции в тексте
        items.sort((a, b) => a.order - b.order);
        side.innerHTML = items.map(it => it.html).join('');
    }

    rewriteEpubUrls(html, bookName) {
        return html.replace(/src="([^"]+)"/g, (match, url) => {
            if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')) {
                return match;
            }
            const encodedBook = encodeURIComponent(bookName);
            const encodedUrl = encodeURIComponent(url);
            return `src="/api/epub-resource?book=${encodedBook}&path=${encodedUrl}"`;
        });
    }

    extractSummaryFromProcessed(fileContent) {
        const summaryMatch = fileContent.match(/^##\s*Summary\s*\n([\s\S]*?)(?=\n##\s|\n$)/m);
        return summaryMatch ? summaryMatch[1].trim() : '';
    }

    buildMetaInfo(content, tags) {
        const chars = content ? content.length : 0;
        const approxTokens = Math.max(1, Math.round(chars / 4));
        const tokensK = Math.max(1, Math.round(approxTokens / 1000));
        
        const tagStats = this.calculateTagStats(tags);
        
        return `Длина текста: ${Utils.formatNumber(chars)} символов, ${tokensK}к токенов${tagStats}`;
    }

    calculateTagStats(tags) {
        try {
            const terms = tags && Array.isArray(tags.terms) ? tags.terms : [];
            const comments = tags && Array.isArray(tags.comments) ? tags.comments : [];
            const total = terms.length + comments.length;
            
            if (!total) return '';
            
            const ru = { 
                def: 'определения', 
                ex: 'истории', 
                tip: 'советы', 
                q: 'сомнительное', 
                comment: 'комментарии' 
            };
            const byType = { def: 0, ex: 0, tip: 0, q: 0, comment: 0 };
            
            terms.forEach(item => {
                const k = (item.type || '').toLowerCase();
                if (byType.hasOwnProperty(k)) byType[k]++;
            });
            byType.comment = comments.length;
            
            const parts = Object.entries(byType)
                .filter(([_,v]) => v > 0)
                .map(([k,v]) => `${ru[k] || k}: ${v}`)
                .join(', ');
            
            return `. Теги: ${total}${parts ? ' (' + parts + ')' : ''}`;
        } catch(_) { 
            return ''; 
        }
    }

    showToast(message, isError = false) {
        const toast = document.createElement('div');
        toast.className = 'toast' + (isError ? ' error' : '');
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    loadNextChapter() {
        if (!this.bp.bookData || !this.bp.currentChapter) return;
        
        const chapters = this.bp.bookData.chapters;
        const currentIndex = chapters.findIndex(ch => ch.realNumber === this.bp.currentChapter.realNumber);
        
        if (currentIndex === -1 || currentIndex >= chapters.length - 1) {
            this.showToast('Это последняя глава', true);
            return;
        }
        
        const nextChapter = chapters[currentIndex + 1];
        this.loadChapterContent(nextChapter);
        this.bp.currentChapter = nextChapter;
        
        // Обновляем URL
        const params = new URLSearchParams(window.location.search);
        params.set('chapter', nextChapter.realNumber);
        window.history.pushState({}, '', '?' + params.toString());
    }

    async requestTagsForCurrentChapter() {
        const btn = document.getElementById('requestTagsBtn');
        
        if (!this.bp.currentChapter) {
            this.showToast('Нет активной главы', true);
            return;
        }
        
        const chapter = this.bp.currentChapter;
        
        // Проверяем состояние подтверждения
        if (!this._confirmingRequest) {
            // Первое нажатие - просим подтвердить
            this._confirmingRequest = true;
            btn.textContent = 'Точно? Нажми еще раз';
            btn.style.background = '#ff9800';
            
            // Через 3 секунды возвращаем обратно
            this._confirmTimeout = setTimeout(() => {
                this._confirmingRequest = false;
                btn.textContent = 'Разметить';
                btn.style.background = '';
            }, 3000);
            
            return;
        }
        
        // Второе нажатие - запускаем
        clearTimeout(this._confirmTimeout);
        this._confirmingRequest = false;
        btn.style.background = '';
        
        try {
            if (btn) { btn.disabled = true; }
            
            if (btn) btn.textContent = 'Отправка запроса...';
            
            const response = await fetch('/api/tags/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bookName: this.bp.selectedBook,
                    chapterIndex: chapter.realNumber
                })
            });
            
            if (btn) btn.textContent = 'Получение ответа...';
            const text = await response.text();
            
            if (btn) btn.textContent = 'Парсинг результата...';
            
            let data = {};
            try { 
                data = JSON.parse(text); 
            } catch(parseErr) { 
                throw new Error('Невалидный JSON ответа сервера'); 
            }
            
            if (!response.ok) {
                throw new Error(data.error || 'Ошибка запроса');
            }
            
            if (btn) btn.textContent = 'Сохранение...';
            
            // Небольшая задержка для видимости статуса "Сохранение..."
            await new Promise(resolve => setTimeout(resolve, 500));
            
            this.showToast(`Готово! Сохранено в ${data.filePath}`);
            
            // Перезагружаем главу для отображения новых тегов
            this.loadChapterContent(chapter);
        } catch (error) {
            this.showToast(`Ошибка: ${error.message}`, true);
        } finally {
            if (btn) { btn.textContent = 'Разметить'; btn.disabled = false; }
        }
    }
}
