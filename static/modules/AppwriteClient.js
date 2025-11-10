// Клиент для работы с Appwrite Functions и Storage
export class AppwriteClient {
    constructor() {
        this.client = new Appwrite.Client();
        this.functions = new Appwrite.Functions(this.client);
        this.storage = new Appwrite.Storage(this.client);
        
        // Настройка клиента из конфига
        this.client
            .setEndpoint('https://fra.cloud.appwrite.io/v1')
            .setProject('690f8b5b0012faa10454');
            
        this.functionId = 'rem-backend';
        this.booksBucketId = 'books';
    }

    // Универсальный метод для вызова функции
    async callFunction(path, method = 'GET', data = null) {
        try {
            const payload = {
                path: path,
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                }
            };

            if (data) {
                payload.body = JSON.stringify(data);
            }

            const response = await this.functions.createExecution(
                this.functionId,
                JSON.stringify(payload),
                false // async = false для синхронного выполнения
            );

            const result = JSON.parse(response.response);
            return result;
        } catch (error) {
            console.error('Appwrite Function call failed:', error);
            throw error;
        }
    }

    // API методы
    async getBooks() {
        try {
            // Получаем список книг напрямую из Storage
            const files = await this.storage.listFiles(this.booksBucketId);
            
            const books = files.files.map(file => ({
                name: file.name,
                title: file.name.replace('.epub', ''),
                lastModified: file.$updatedAt,
                size: file.sizeOriginal,
                id: file.$id
            }));

            return { success: true, books, lastBook: null };
        } catch (error) {
            console.error('Error getting books from storage:', error);
            // Fallback to function call
            return await this.callFunction('/api/books', 'GET');
        }
    }

    async getBookInfo(bookName, forceEpub = false) {
        try {
            // Получаем файл книги из storage для получения информации
            const files = await this.storage.listFiles(this.booksBucketId);
            const bookFile = files.files.find(file => file.name === bookName);
            
            if (!bookFile) {
                throw new Error('Книга не найдена в storage');
            }

            // Вызываем функцию для обработки epub и получения глав
            return await this.callFunction('/api/book/info', 'POST', {
                bookName,
                forceEpub,
                fileId: bookFile.$id
            });
        } catch (error) {
            console.error('Error getting book info:', error);
            // Fallback к обычному вызову функции
            return await this.callFunction('/api/book/info', 'POST', {
                bookName,
                forceEpub
            });
        }
    }

    async processChapters(bookName, chapters, sessionId) {
        return await this.callFunction('/api/process', 'POST', {
            bookName,
            chapters,
            sessionId
        });
    }
}

// Создаем глобальный экземпляр
window.appwriteClient = new AppwriteClient();