// WebSocket клиент для получения прогресса обработки
export class WebSocketClient {
    constructor(sessionId, onMessageCallback) {
        this.sessionId = sessionId;
        this.onMessageCallback = onMessageCallback;
        this.ws = null;
    }

    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws?sessionId=${this.sessionId}`;
        
        console.log('🔌 Подключаемся к WebSocket:', wsUrl);
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('✅ WebSocket подключен успешно');
        };
        
        this.ws.onmessage = (event) => {
            try {
                console.log('📩 WebSocket получено сообщение:', event.data);
                const data = JSON.parse(event.data);
                this.onMessageCallback(data);
            } catch (error) {
                console.error('❌ Ошибка парсинга WebSocket сообщения:', error, 'Raw data:', event.data);
            }
        };
        
        this.ws.onerror = (error) => {
            console.error('❌ WebSocket ошибка:', error);
        };
        
        this.ws.onclose = (event) => {
            console.log('🔌 WebSocket отключен. Code:', event.code, 'Reason:', event.reason);
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
