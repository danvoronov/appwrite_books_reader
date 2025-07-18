const { log } = console;
const EPub = require("epub2").EPub;
const exclude_chapters = input => !['Cover', 'Title Page', 'Copyright', 'Epigraph', 'Contents', 'Acknowledgments', 'Notes', 'Appendix', 'What Should You Read Next?', 'Index', 'About the Author'].includes(input.name);
var TurndownService = require('turndown');
var toMarkdown = new TurndownService();

async function getEpubMetadata(epubfile) {
    const epub = await EPub.createAsync('../epub/' + epubfile + '.epub');
    const { title, creator, date } = epub.metadata;
    
    // Фильтруем только текстовые главы и исключаем служебные разделы
    let chapters = epub.toc
        .filter(t => !t.mime || t.mime.includes('html') || t.mime.includes('text'))
        .map(t => ({ name: t.title, id: t.id }))
        .filter(exclude_chapters);

    console.log(`Обрабатываем ${chapters.length} глав из epub файла...`);
    
    const processedChapters = [];
    for (let i = 0; i < chapters.length; i++) {
        const chapter = chapters[i];
        try {
            const data = await epub.getChapterAsync(chapter.id);
            if (data) {
                const markdown = toMarkdown.turndown(data);
                // Фильтруем главы меньше 5кб
                if (markdown.length >= 5000) {
                    processedChapters.push({
                        ...chapter,
                        content: markdown
                    });
                }
            }
        } catch (err) {
            // Пробуем альтернативный способ
            try {
                const data = epub.getChapter(chapter.id);
                if (data) {
                    const markdown = toMarkdown.turndown(data);
                    // Фильтруем главы меньше 5кб
                    if (markdown.length >= 5000) {
                        processedChapters.push({
                            ...chapter,
                            content: markdown
                        });
                    }
                }
            } catch (err2) {
                // Тихо пропускаем проблемные главы
            }
        }
    }

    if (processedChapters.length === 0) {
        throw new Error('Не удалось обработать ни одной главы');
    }

    console.log(`Загружено ${processedChapters.length} глав (размер >= 5кб)`);

    return {
        title: `${title} — ${creator} (${date.substring(0, 4)})`,
        chapters: processedChapters
    };
}

module.exports = { getEpubMetadata };