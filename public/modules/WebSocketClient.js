// WebSocket клиент для получения прогресса обработки
export class WebSocketClient {
    constructor(sessionId, onMessageCallback) {
        this.sessionId = sessionId;
        this.onMessageCallback = onMessageCallback;
        this.ws = null;
    }

    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}?session=${this.sessionId}`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('WebSocket подключен');
        };
        
        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.onMessageCallback(data);
            } catch (error) {
                console.error('Ошибка парсинга WebSocket сообщения:', error);
            }
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket ошибка:', error);
        };
        
        this.ws.onclose = () => {
            console.log('WebSocket отключен');
        };
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    isConnected() {
        return this.ws && this.ws.readyState === WebSocket.OPEN;
    }
}
