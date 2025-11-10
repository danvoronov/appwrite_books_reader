// Отслеживание прогресса обработки
export class ProgressTracker {
    constructor() {
        this.totalChapters = 0;
        this.processedChapters = 0;
        this.currentChapterProgress = 0;
    }

    reset(totalChapters) {
        this.totalChapters = totalChapters;
        this.processedChapters = 0;
        this.currentChapterProgress = 0;
    }

    incrementProcessedChapters() {
        this.processedChapters++;
    }

    calculateProgress() {
        if (this.totalChapters === 0) return 0;
        
        const chapterWeight = 100 / this.totalChapters;
        const completedProgress = this.processedChapters * chapterWeight;
        const currentProgress = this.currentChapterProgress * chapterWeight;
        
        return Math.min(completedProgress + currentProgress, 100);
    }

    setChapterProgress(phase, characters = '') {
        switch (phase) {
            case 'start':
                this.currentChapterProgress = 0.0;
                break;
            case 'request':
                this.currentChapterProgress = 0.2;
                break;
            case 'receiving':
                const charCount = parseInt(characters.replace(/[^0-9.]/g, '')) || 0;
                const estimatedTotal = 8000;
                const receiveProgress = Math.min(charCount / estimatedTotal, 1.0);
                this.currentChapterProgress = 0.3 + (receiveProgress * 0.6);
                break;
            case 'complete':
                this.currentChapterProgress = 1.0;
                break;
        }
    }

    updateProgressBar(progress, text, chapterInfo = '', chapterProgress = '') {
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        const progressPercentage = document.getElementById('progressPercentage');
        const currentChapter = document.getElementById('currentChapter');
        const chapterProgressElement = document.getElementById('chapterProgress');
        
        if (!progressBar || !progressText || !progressPercentage || 
            !currentChapter || !chapterProgressElement) {
            return;
        }
        
        progressBar.style.width = `${Math.round(progress)}%`;
        progressText.textContent = text;
        progressPercentage.textContent = `${Math.round(progress)}%`;
        currentChapter.textContent = chapterInfo;
        chapterProgressElement.textContent = chapterProgress;
    }

    clearProgressLog() {
        const logContainer = document.getElementById('progressLog');
        if (logContainer) {
            logContainer.innerHTML = '';
        }
    }

    addToProgressLog(message) {
        const logContainer = document.getElementById('progressLog');
        if (logContainer) {
            const logEntry = document.createElement('div');
            logEntry.textContent = message;
            logContainer.appendChild(logEntry);
            logContainer.scrollTop = logContainer.scrollHeight;
        }
    }

    updateCharacterProgress(message) {
        const match = message.match(/Получено: ([\d.]+k?) символов/);
        if (match) {
            this.setChapterProgress('receiving', match[1]);
            const progress = this.calculateProgress();
            this.updateProgressBar(progress, 'Получаем ответ...', '', match[0]);
        }
    }
}
