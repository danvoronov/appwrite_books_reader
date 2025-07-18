const { log } = console;
const EPub = require("epub2").EPub;
const exclude_chapters = input => !['Cover', 'Title Page', 'Copyright', 'Epigraph', 'Contents', 'Acknowledgments', 'Notes', 'Appendix', 'What Should You Read Next?', 'Index', 'About the Author'].includes(input.name);
var TurndownService = require('turndown');
var toMarkdown = new TurndownService();

async function getEpubMetadata(epubfile) {
    const epub = await EPub.createAsync('../epub/' + epubfile + '.epub');
    const { title, creator, date } = epub.metadata;
    
    // Логируем информацию о главах и их MIME-типах
    console.log('Доступные главы:');
    epub.toc.forEach(t => console.log(`${t.title}: ${t.mime || 'MIME не указан'} (ID: ${t.id})`));
    
    // Фильтруем только текстовые главы и исключаем служебные разделы
    let chapters = epub.toc
        .filter(t => !t.mime || t.mime.includes('html') || t.mime.includes('text'))
        .map(t => ({ name: t.title, id: t.id }))
        .filter(exclude_chapters);

    console.log(`\nНайдено ${chapters.length} глав для обработки`);

    log(`Достаем главы в объект`);
    const processedChapters = [];
    for (let i = 0; i < chapters.length; i++) {
        const chapter = chapters[i];
        console.log(`\nОбрабатываем главу ${i + 1}/${chapters.length}: "${chapter.name}" (ID: ${chapter.id})`);
        try {
            const data = await epub.getChapterAsync(chapter.id);
            if (data) {
                const markdown = toMarkdown.turndown(data);
                processedChapters.push({
                    ...chapter,
                    content: markdown
                });
                console.log(`✅ Глава "${chapter.name}" успешно обработана (${data.length} символов)`);
            } else {
                console.log(`⚠️ Глава "${chapter.name}" вернула пустые данные`);
            }
        } catch (err) {
            console.log(`❌ Основной метод не сработал для главы "${chapter.name}":`, err.message);
            
            // Пробуем альтернативный способ через getChapter (синхронный)
            try {
                console.log(`🔄 Пробуем альтернативный метод для главы "${chapter.name}"`);
                const data = epub.getChapter(chapter.id);
                if (data) {
                    const markdown = toMarkdown.turndown(data);
                    processedChapters.push({
                        ...chapter,
                        content: markdown
                    });
                    console.log(`✅ Глава "${chapter.name}" обработана альтернативным методом (${data.length} символов)`);
                } else {
                    console.log(`⚠️ Альтернативный метод тоже вернул пустые данные для "${chapter.name}"`);
                }
            } catch (err2) {
                console.log(`❌ Альтернативный метод тоже не сработал для "${chapter.name}":`, err2.message);
            }
        }
    };

    if (processedChapters.length === 0) {
        throw new Error('Не удалось обработать ни одной главы');
    }

    return {
        title: `${title} — ${creator} (${date.substring(0, 4)})`,
        chapters: processedChapters
    };
}

module.exports = { getEpubMetadata };
