// Управление процессом обработки глав
import { WebSocketClient } from './WebSocketClient.js';
import { ProgressTracker } from './ProgressTracker.js';

export class ProcessingManager {
    constructor(bookProcessor) {
        this.bp = bookProcessor;
        this.progressTracker = new ProgressTracker();
        this.wsClient = null;
        this.processingActive = false;
    }

    prepareForProcessing() {
        if (this.bp.selectedChapters.size === 0) {
            alert('Выберите хотя бы одну главу для обработки');
            return;
        }
        this.openProcessingModal();
    }

    openProcessingModal() {
        const modal = document.getElementById('processingModal');
        modal.style.display = 'block';
        
        this.progressTracker.clearProgressLog();
        this.progressTracker.reset(this.bp.selectedChapters.size);
        
        document.getElementById('stopProcessingBtn').disabled = false;
        
        this.progressTracker.addToProgressLog(`📋 Начинаем обработку ${this.bp.selectedChapters.size} глав`);
        
        const chaptersArray = Array.from(this.bp.selectedChapters);
        chaptersArray.forEach(chapterNum => {
            const chapter = this.bp.bookData.chapters.find(c => c.realNumber === chapterNum);
            if (chapter) {
                this.progressTracker.addToProgressLog(`   • Глава ${chapter.displayNumber}: ${chapter.name}`);
            }
        });
        
        setTimeout(() => this.startProcessing(), 500);
    }

    closeProcessingModal() {
        const modal = document.getElementById('processingModal');
        modal.style.display = 'none';
        
        if (this.processingActive) {
            this.stopProcessing();
        }
    }

    async startProcessing() {
        if (this.bp.selectedChapters.size === 0) return;

        this.processingActive = true;
        document.getElementById('stopProcessingBtn').disabled = false;

        this.progressTracker.updateProgressBar(0, 'Подготовка...', '', '');
        this.progressTracker.addToProgressLog('🚀 Запускаем обработку...');
        console.log('🚀 Начало обработки, sessionId:', this.bp.sessionId);
        
        this.progressTracker.addToProgressLog('🔌 Подключаем WebSocket...');
        this.connectWebSocket();
        
        // Даем время на подключение WebSocket
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (!this.wsClient || !this.wsClient.isConnected()) {
            console.warn('⚠️ WebSocket не подключен, но продолжаем обработку');
            this.progressTracker.addToProgressLog('⚠️ WebSocket не подключен, прогресс может не отображаться');
        } else {
            console.log('✅ WebSocket подключен успешно');
            this.progressTracker.addToProgressLog('✅ WebSocket подключен');
        }

        try {
            const chaptersArray = Array.from(this.bp.selectedChapters);
            console.log('📤 Отправляем запрос на обработку глав:', chaptersArray);
            
            this.progressTracker.updateProgressBar(5, 'Отправка запроса...', '', '');
            this.progressTracker.addToProgressLog('📤 Отправляем запрос на сервер...');
            
            const response = await fetch('/api/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bookName: this.bp.selectedBook,
                    chapters: chaptersArray,
                    sessionId: this.bp.sessionId
                })
            });

            console.log('📥 Получен ответ от сервера, status:', response.status);
            const data = await response.json();
            console.log('📥 Данные ответа:', data);
            
            if (!response.ok) {
                throw new Error(data.error || 'Ошибка обработки');
            }

            this.showResults(data.results);
            
        } catch (error) {
            console.error('❌ Ошибка обработки:', error);
            this.progressTracker.addToProgressLog(`❌ Ошибка: ${error.message}`);
            this.progressTracker.updateProgressBar(0, 'Ошибка обработки', '', '');
        } finally {
            this.processingActive = false;
            document.getElementById('stopProcessingBtn').disabled = true;
            this.disconnectWebSocket();
            console.log('🏁 Обработка завершена');
        }
    }

    showResults(results) {
        this.progressTracker.addToProgressLog('');
        this.progressTracker.addToProgressLog('📊 Итоговые результаты:');
        
        let successCount = 0;
        results.forEach(result => {
            const status = result.success ? '✅' : '❌';
            this.progressTracker.addToProgressLog(`${status} Глава ${result.chapterNumber}: ${result.chapterName}`);
            if (result.success) successCount++;
            if (result.error) {
                this.progressTracker.addToProgressLog(`   Ошибка: ${result.error}`);
            }
        });

        this.progressTracker.updateProgressBar(
            100, 
            'Обработка завершена!', 
            `Готово: ${successCount}/${this.progressTracker.totalChapters}`,
            ''
        );

        if (successCount > 0) {
            this.progressTracker.addToProgressLog('');
            this.progressTracker.addToProgressLog('✨ Обновляем информацию о книге...');
            setTimeout(() => this.bp.selectBook(), 2000);
        }
    }

    async stopProcessing() {
        if (!this.processingActive) return;
        
        try {
            await fetch('/api/stop-processing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: this.bp.sessionId })
            });
            
            this.progressTracker.addToProgressLog('');
            this.progressTracker.addToProgressLog('🛑 Остановка обработки...');
            this.processingActive = false;
            document.getElementById('stopProcessingBtn').disabled = true;
        } catch (error) {
            console.error('Error stopping processing:', error);
        }
    }

    connectWebSocket() {
        console.log('🔌 Создаем WebSocket клиент с sessionId:', this.bp.sessionId);
        this.wsClient = new WebSocketClient(this.bp.sessionId, (data) => this.handleWebSocketMessage(data));
        this.wsClient.connect();
    }

    disconnectWebSocket() {
        if (this.wsClient) {
            this.wsClient.disconnect();
            this.wsClient = null;
        }
    }

    handleWebSocketMessage(data) {
        console.log('📨 Обработка WebSocket сообщения:', data);
        
        if (data.type === 'progress') {
            this.progressTracker.addToProgressLog(data.message);
            
            if (data.message.includes('Начинаем обработку')) {
                this.progressTracker.setChapterProgress('start');
                const progress = this.progressTracker.calculateProgress();
                this.progressTracker.updateProgressBar(progress, 'Обработка главы...', data.message, '');
            } else if (data.message.includes('Отправка') || data.message.includes('Sending')) {
                this.progressTracker.setChapterProgress('request');
                const progress = this.progressTracker.calculateProgress();
                this.progressTracker.updateProgressBar(progress, 'Отправка запроса в LLM...', '', '');
            } else if (data.message.includes('Получено') || data.message.includes('Received')) {
                this.progressTracker.updateCharacterProgress(data.message);
                const progress = this.progressTracker.calculateProgress();
                this.progressTracker.updateProgressBar(progress, 'Получение ответа...', data.message, '');
            } else if (data.message.includes('успешно') || data.message.includes('Successfully')) {
                this.progressTracker.setChapterProgress('complete');
                this.progressTracker.incrementProcessedChapters();
                const progress = this.progressTracker.calculateProgress();
                this.progressTracker.updateProgressBar(progress, 'Глава завершена', '', '');
            }
        } else if (data.type === 'error') {
            console.error('❌ WebSocket error message:', data.message);
            this.progressTracker.addToProgressLog(`❌ ${data.message}`);
        } else if (data.type === 'chapter_result') {
            console.log('✅ Получен результат главы:', data.chapterNumber, data.chapterName);
        } else {
            console.log('ℹ️ Неизвестный тип сообщения:', data.type);
        }
    }

    async downloadSummary() {
        try {
            const response = await fetch('/api/download-summary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bookName: this.bp.selectedBook })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Ошибка загрузки');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${this.bp.selectedBook}_summary.md`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            alert(`Ошибка скачивания: ${error.message}`);
        }
    }
}
