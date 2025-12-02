/**
 * CryptoIntel WebSocket Client Library
 * Provides client-side WebSocket functionality for real-time data streaming
 */

class CryptoIntelWebSocket {
  constructor(options = {}) {
    // Handle both browser and Node.js environments
    const defaultHost = typeof window !== 'undefined' 
      ? window.location.host 
      : 'localhost:8787';
    this.url = options.url || `wss://${defaultHost}/ws`;
    this.token = options.token || null;
    this.autoReconnect = options.autoReconnect !== false;
    this.reconnectInterval = options.reconnectInterval || 5000;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 10;
    this.heartbeatInterval = options.heartbeatInterval || 30000;
    
    this.ws = null;
    this.reconnectAttempts = 0;
    this.heartbeatTimer = null;
    this.subscriptions = new Set();
    this.eventHandlers = new Map();
    this.connectionPromise = null;
    this.isConnecting = false;
    this.isDestroyed = false;
    
    // Connection state
    this.connectionState = {
      connected: false,
      connecting: false,
      reconnecting: false,
      lastError: null,
      connectTime: null,
      lastPingTime: null,
      lastPongTime: null
    };
  }

  /**
   * Connect to WebSocket server
   */
  async connect() {
    if (this.isDestroyed) {
      throw new Error('WebSocket client has been destroyed');
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.isConnecting = true;
    this.connectionState.connecting = true;
    this.connectionState.lastError = null;

    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        const wsUrl = new URL(this.url);
        if (this.token) {
          wsUrl.searchParams.set('token', this.token);
        }

        this.ws = new WebSocket(wsUrl.toString());

        this.ws.onopen = () => {
          console.log('CryptoIntel WebSocket connected');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.connectionState.connected = true;
          this.connectionState.connecting = false;
          this.connectionState.connectTime = new Date().toISOString();
          
          this.startHeartbeat();
          this.emit('connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
            this.emit('error', { type: 'parse_error', error: error.message });
          }
        };

        this.ws.onclose = (event) => {
          console.log('CryptoIntel WebSocket disconnected:', event.code, event.reason);
          this.isConnecting = false;
          this.connectionState.connected = false;
          this.connectionState.connecting = false;
          
          this.stopHeartbeat();
          this.emit('disconnected', { code: event.code, reason: event.reason });

          if (this.autoReconnect && !this.isDestroyed && event.code !== 1000) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('CryptoIntel WebSocket error:', error);
          this.connectionState.lastError = error;
          this.emit('error', { type: 'connection_error', error });
          
          if (this.isConnecting) {
            this.isConnecting = false;
            reject(error);
          }
        };

      } catch (error) {
        this.isConnecting = false;
        this.connectionState.connecting = false;
        this.connectionState.lastError = error;
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    this.autoReconnect = false;
    this.isDestroyed = true;
    
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close(1000, 'Client disconnect');
    }
    
    this.connectionState.connected = false;
    this.connectionState.connecting = false;
  }

  /**
   * Send message to WebSocket server
   */
  send(message) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
    this.ws.send(messageStr);
  }

  /**
   * Subscribe to a channel
   */
  subscribe(channel, params = {}) {
    if (!this.connectionState.connected) {
      throw new Error('WebSocket is not connected');
    }

    const message = {
      type: 'subscribe',
      channel,
      params
    };

    this.send(message);
    this.subscriptions.add(channel);
    this.emit('subscribed', { channel, params });
  }

  /**
   * Unsubscribe from a channel
   */
  unsubscribe(channel) {
    if (!this.connectionState.connected) {
      throw new Error('WebSocket is not connected');
    }

    const message = {
      type: 'unsubscribe',
      channel
    };

    this.send(message);
    this.subscriptions.delete(channel);
    this.emit('unsubscribed', { channel });
  }

  /**
   * Get list of active subscriptions
   */
  getSubscriptions() {
    return Array.from(this.subscriptions);
  }

  /**
   * Get connection state
   */
  getConnectionState() {
    return { ...this.connectionState };
  }

  /**
   * Add event listener
   */
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }

  /**
   * Remove event listener
   */
  off(event, handler) {
    if (this.eventHandlers.has(event)) {
      const handlers = this.eventHandlers.get(event);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to all listeners
   */
  emit(event, data) {
    if (this.eventHandlers.has(event)) {
      this.eventHandlers.get(event).forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in ${event} event handler:`, error);
        }
      });
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  handleMessage(message) {
    switch (message.type) {
      case 'price_update':
        this.emit('price_update', message.data);
        break;
      case 'signal_notification':
        this.emit('signal_notification', message.data);
        break;
      case 'market_data':
        this.emit('market_data', message.data);
        break;
      case 'subscription_success':
        this.emit('subscription_success', message.data);
        break;
      case 'subscription_error':
        this.emit('subscription_error', message.data);
        break;
      case 'pong':
        this.connectionState.lastPongTime = new Date().toISOString();
        this.emit('pong', message.data);
        break;
      case 'error':
        this.emit('server_error', message.data);
        break;
      default:
        console.warn('Unknown WebSocket message type:', message.type);
        this.emit('unknown_message', message);
    }
  }

  /**
   * Start heartbeat/ping-pong mechanism
   */
  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.connectionState.lastPingTime = new Date().toISOString();
        this.send({ type: 'ping' });
      }
    }, this.heartbeatInterval);
  }

  /**
   * Stop heartbeat mechanism
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.emit('reconnect_failed');
      return;
    }

    this.reconnectAttempts++;
    this.connectionState.reconnecting = true;
    
    const delay = this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Scheduling reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    this.emit('reconnect_scheduled', { attempt: this.reconnectAttempts, delay });

    setTimeout(async () => {
      if (!this.isDestroyed && this.autoReconnect) {
        try {
          await this.connect();
          
          // Resubscribe to previous channels
          const subscriptions = Array.from(this.subscriptions);
          this.subscriptions.clear();
          
          for (const channel of subscriptions) {
            this.subscribe(channel);
          }
          
          this.connectionState.reconnecting = false;
          this.emit('reconnected');
        } catch (error) {
          console.error('Reconnection failed:', error);
          this.connectionState.lastError = error;
          this.scheduleReconnect();
        }
      }
    }, delay);
  }

  /**
   * Subscribe to price updates for specific symbols
   */
  subscribePrices(symbols, exchanges = []) {
    this.subscribe('prices', { symbols, exchanges });
  }

  /**
   * Subscribe to signal notifications
   */
  subscribeSignals(types = [], severities = []) {
    this.subscribe('signals', { types, severities });
  }

  /**
   * Subscribe to market data
   */
  subscribeMarketData(markets = []) {
    this.subscribe('market_data', { markets });
  }

  /**
   * Get WebSocket statistics
   */
  getStats() {
    return {
      connectionState: this.getConnectionState(),
      subscriptions: this.getSubscriptions(),
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      reconnectInterval: this.reconnectInterval,
      heartbeatInterval: this.heartbeatInterval
    };
  }
}

// Export for use in browser or Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CryptoIntelWebSocket;
} else if (typeof window !== 'undefined') {
  window.CryptoIntelWebSocket = CryptoIntelWebSocket;
}

// Example usage:
/*
const wsClient = new CryptoIntelWebSocket({
  token: 'your-jwt-token',
  autoReconnect: true,
  reconnectInterval: 5000,
  maxReconnectAttempts: 10
});

// Event listeners
wsClient.on('connected', () => {
  console.log('Connected to WebSocket');
  
  // Subscribe to price updates
  wsClient.subscribePrices(['BTC', 'ETH'], ['binance', 'coinbase']);
  
  // Subscribe to signal notifications
  wsClient.subscribeSignals(['price_spike', 'volume_anomaly'], ['high', 'medium']);
});

wsClient.on('price_update', (data) => {
  console.log('Price update:', data);
});

wsClient.on('signal_notification', (data) => {
  console.log('Signal notification:', data);
});

wsClient.on('error', (error) => {
  console.error('WebSocket error:', error);
});

// Connect to WebSocket
wsClient.connect().catch(console.error);
*/

export default CryptoIntelWebSocket;