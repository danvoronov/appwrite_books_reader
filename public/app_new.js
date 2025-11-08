// Главный файл приложения - точка входа
import { BookProcessor } from './modules/BookProcessor.js';

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    new BookProcessor();
});
