const { log } = console;
const EPub = require("epub2").EPub;
const exclude_chapters = input => !['Cover', 'Title Page', 'Copyright', 'Epigraph', 'Contents', 'Acknowledgments', 'Notes', 'Appendix', 'What Should You Read Next?', 'Index', 'About the Author'].includes(input.name);
var TurndownService = require('turndown');
var toMarkdown = new TurndownService();

// Функция для получения всех связанных частей главы
function getChapterParts(epub, chapterId) {
    const parts = [chapterId];
    const suffixes = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
    
    for (const suffix of suffixes) {
        const partId = chapterId + suffix;
        if (epub.manifest[partId]) {
            parts.push(partId);
        } else {
            break; // Прерываем если нет следующей части
        }
    }
    
    return parts;
}

async function getEpubMetadata(epubfile) {
    const epub = await EPub.createAsync('../epub/' + epubfile + '.epub');
    const { title, creator, date } = epub.metadata;
    
    console.log('=== READING FROM EPUB FILE ===');
    console.log(`File: ${epubfile}.epub`);
    
    // Фильтруем только текстовые главы и исключаем служебные разделы
    // Сохраняем информацию о level для группировки
    let chapters = epub.toc
        .filter(t => !t.mime || t.mime.includes('html') || t.mime.includes('text'))
        .map(t => ({ name: t.title, id: t.id, level: t.level || 0 }))
        .filter(exclude_chapters);

    console.log(`Обрабатываем ${chapters.length} глав из epub файла...`);
    
    const processedChapters = [];
    let currentGroup = null;
    
    // Список заголовков разделов (не являются главами)
    const sectionHeaders = ['Set the Stage', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    
    for (let i = 0; i < chapters.length; i++) {
        const chapter = chapters[i];
        
        // Проверяем, является ли это заголовком раздела или отдельной главой
        if (chapter.level === 0 && sectionHeaders.includes(chapter.name)) {
            // Это заголовок раздела
            currentGroup = chapter.name;
            console.log(`\n📂 Раздел: ${currentGroup}`);
            continue;
        }
        
        // Если level 0, но не в списке заголовков - это отдельная глава без группы
        if (chapter.level === 0) {
            currentGroup = null;
        }
        try {
            // Получаем все части главы (основная + продолжения)
            const chapterParts = getChapterParts(epub, chapter.id);
            console.log(`  Глава "${chapter.name}": найдено частей: ${chapterParts.length}`);
            
            let combinedMarkdown = '';
            
            for (const partId of chapterParts) {
                try {
                    const data = await epub.getChapterAsync(partId);
                    if (data) {
                        const markdown = toMarkdown.turndown(data);
                        combinedMarkdown += markdown + '\n\n';
                    }
                } catch (err) {
                    console.log(`    Ошибка при чтении части ${partId}: ${err.message}`);
                    
                    // Пробуем найти правильный ID в manifest по href
                    const tocItem = epub.toc.find(t => t.id === partId);
                    if (tocItem && tocItem.href) {
                        const hrefWithoutAnchor = tocItem.href.split('#')[0];
                        const manifestEntry = Object.entries(epub.manifest).find(([id, item]) => {
                            return item.href === hrefWithoutAnchor;
                        });
                        
                        if (manifestEntry) {
                            const correctId = manifestEntry[0];
                            console.log(`    Нашли правильный ID в manifest: ${correctId}`);
                            try {
                                const data = await epub.getChapterAsync(correctId);
                                if (data) {
                                    const markdown = toMarkdown.turndown(data);
                                    combinedMarkdown += markdown + '\n\n';
                                    console.log(`    ✓ Прочитано через manifest ID`);
                                }
                            } catch (err3) {
                                console.log(`    ✗ И это не сработало: ${err3.message}`);
                            }
                        }
                    }
                }
            }
            
            // Фильтруем главы меньше 5кб
            if (combinedMarkdown.length >= 5000) {
                processedChapters.push({
                    ...chapter,
                    content: combinedMarkdown.trim(),
                    group: currentGroup // Добавляем информацию о группе
                });
                console.log(`    ✓ Загружено ${combinedMarkdown.length} символов`);
            } else {
                console.log(`    ✗ Пропущено (${combinedMarkdown.length} < 5000 символов)`);
            }
        } catch (err) {
            console.log(`    ✗ Ошибка при обработке главы: ${err.message}`);
        }
    }

    if (processedChapters.length === 0) {
        throw new Error('Не удалось обработать ни одной главы');
    }

    console.log(`Загружено ${processedChapters.length} глав (размер >= 5кб)`);

    return {
        title: `${title || 'Без названия'} — ${creator || 'Неизвестный автор'} (${date ? date.substring(0, 4) : 'н/д'})`,
        chapters: processedChapters
    };
}

module.exports = { getEpubMetadata };