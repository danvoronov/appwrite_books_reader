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

        this.progressTracker.updateProgressBar(0, 'Начинаем обработку...', '', '');
        this.progressTracker.addToProgressLog('🚀 Запускаем обработку...');
        
        this.connectWebSocket();

        try {
            const chaptersArray = Array.from(this.bp.selectedChapters);
            
            const data = await window.appwriteClient.processChapters(
                this.bp.selectedBook,
                chaptersArray,
                this.bp.sessionId
            );
            
            if (!data.success) {
                throw new Error(data.error || 'Ошибка обработки');
            }

            this.showResults(data.results);
            
        } catch (error) {
            console.error('Processing error:', error);
            this.progressTracker.addToProgressLog(`❌ Ошибка: ${error.message}`);
            this.progressTracker.updateProgressBar(0, 'Ошибка обработки', '', '');
        } finally {
            this.processingActive = false;
            document.getElementById('stopProcessingBtn').disabled = true;
            this.disconnectWebSocket();
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
        if (data.type === 'progress') {
            this.progressTracker.addToProgressLog(data.message);
            
            if (data.message.includes('Начинаем обработку главы')) {
                this.progressTracker.setChapterProgress('start');
                const progress = this.progressTracker.calculateProgress();
                this.progressTracker.updateProgressBar(progress, 'Обработка главы...', data.message, '');
            } else if (data.message.includes('Отправляем запрос')) {
                this.progressTracker.setChapterProgress('request');
                const progress = this.progressTracker.calculateProgress();
                this.progressTracker.updateProgressBar(progress, 'Отправка запроса...', '', '');
            } else if (data.message.includes('Получено:')) {
                this.progressTracker.updateCharacterProgress(data.message);
            } else if (data.message.includes('Глава успешно обработана')) {
                this.progressTracker.setChapterProgress('complete');
                this.progressTracker.incrementProcessedChapters();
                const progress = this.progressTracker.calculateProgress();
                this.progressTracker.updateProgressBar(progress, 'Глава завершена', '', '');
            }
        } else if (data.type === 'error') {
            this.progressTracker.addToProgressLog(`❌ ${data.message}`);
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
