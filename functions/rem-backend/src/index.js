const sdk = require('node-appwrite');

// Создание клиента Appwrite для серверных операций
function getAppwriteClient() {
    const client = new sdk.Client();
    client
        .setEndpoint('https://fra.cloud.appwrite.io/v1')
        .setProject('690f8b5b0012faa10454')
        .setKey(process.env.APPWRITE_API_KEY); // Нужно будет установить в настройках функции
    
    return client;
}

// Основная функция Appwrite
module.exports = async ({ req, res, log, error }) => {
    try {
        // Настройка CORS для веб-интерфейса
        const headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Content-Type': 'application/json'
        };

        // Обработка preflight запросов
        if (req.method === 'OPTIONS') {
            return res.json({ message: 'OK' }, 200, headers);
        }

        const path = req.path || '/';
        const method = req.method;

        log(`Processing ${method} ${path}`);

        // Роутинг API
        if (path.startsWith('/api/books') && method === 'GET') {
            return handleGetBooks(req, res, log, headers);
        } 
        else if (path.startsWith('/api/book/info') && method === 'POST') {
            return handleBookInfo(req, res, log, headers);
        }
        else if (path.startsWith('/api/process') && method === 'POST') {
            return handleProcessChapters(req, res, log, headers);
        }
        else {
            return res.json({ error: 'Route not found' }, 404, headers);
        }

    } catch (err) {
        error('Function error: ' + err.message);
        return res.json({ error: err.message }, 500, {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
        });
    }
};

// API endpoints с подключением к Storage
async function handleGetBooks(req, res, log, headers) {
    log('Getting available books list from storage');
    
    try {
        const storage = new sdk.Storage(getAppwriteClient());
        const files = await storage.listFiles('books');
        
        const books = files.files.map(file => ({
            name: file.name,
            title: file.name.replace('.epub', ''),
            lastModified: file.$updatedAt,
            size: file.sizeOriginal,
            id: file.$id
        }));
        
        return res.json({ success: true, books, lastBook: null }, 200, headers);
    } catch (error) {
        log('Error accessing storage: ' + error.message);
        
        // Возвращаем fallback данные
        const books = [
            {
                name: "LeanStartup.epub",
                title: "The Lean Startup",
                lastModified: new Date().toISOString()
            }
        ];
        
        return res.json({ success: true, books }, 200, headers);
    }
}

async function handleBookInfo(req, res, log, headers) {
    log('Getting book info');
    
    const { bookName, forceEpub, fileId } = req.body || {};
    
    try {
        const storage = new sdk.Storage(getAppwriteClient());
        
        // Получаем epub файл из storage
        if (fileId) {
            log(`Processing epub file: ${bookName} (ID: ${fileId})`);
            
            // Здесь можно добавить обработку epub файла
            // const fileBuffer = await storage.getFileDownload('books', fileId);
            // const epub = await parseEpub(fileBuffer);
            
            // Пока возвращаем демо-данные с реальным названием книги
            const bookInfo = {
                title: bookName.replace('.epub', ''),
                chapters: [
                    { number: 1, title: "Глава 1", size: "15KB", processed: false, exists: false },
                    { number: 2, title: "Глава 2", size: "22KB", processed: false, exists: false },
                    { number: 3, title: "Глава 3", size: "18KB", processed: false, exists: false }
                ],
                chaptersCount: 3
            };
            
            return res.json({ 
                success: true, 
                book: { title: bookInfo.title, chaptersCount: bookInfo.chaptersCount },
                chapters: bookInfo.chapters 
            }, 200, headers);
        }
        
        // Fallback к демо-данным
        const bookInfo = {
            title: bookName ? bookName.replace('.epub', '') : "Demo Book",
            chapters: [
                { number: 1, title: "Demo Chapter 1", size: "15KB", processed: false, exists: false }
            ],
            chaptersCount: 1
        };
        
        return res.json({ 
            success: true, 
            book: { title: bookInfo.title, chaptersCount: bookInfo.chaptersCount },
            chapters: bookInfo.chapters 
        }, 200, headers);
        
    } catch (error) {
        log('Error processing book info: ' + error.message);
        return res.json({ 
            success: false, 
            error: 'Ошибка обработки книги: ' + error.message 
        }, 500, headers);
    }
}

async function handleProcessChapters(req, res, log, headers) {
    log('Processing chapters');
    
    const { bookName, chapters, sessionId } = req.body || {};
    
    // Демо-ответ для обработки
    return res.json({ 
        success: true, 
        message: 'Processing started',
        sessionId: sessionId || 'demo-session'
    }, 200, headers);
}