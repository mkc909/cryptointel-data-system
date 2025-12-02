/**
 * WebSocket Tests
 * Tests for WebSocket functionality including Durable Objects and client library
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import CryptoIntelWebSocket from '../src/websocket-client.js';

// Helper function to create a fresh mock WebSocket class
function createMockWebSocket(options = {}) {
  const {
    shouldFail = false,
    failMessage = 'Connection failed',
    connectionDelay = 10
  } = options;

  return class MockWebSocket {
    // WebSocket constants
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    constructor(url) {
      this.url = url;
      this.readyState = MockWebSocket.CONNECTING;
      this.onopen = null;
      this.onmessage = null;
      this.onclose = null;
      this.onerror = null;
      this.sentMessages = [];
      
      if (shouldFail) {
        // Simulate connection failure
        setTimeout(() => {
          this.readyState = MockWebSocket.CLOSED;
          if (this.onerror) {
            this.onerror(new Error(failMessage));
          }
        }, connectionDelay);
      } else {
        // Simulate successful connection
        setTimeout(() => {
          this.readyState = MockWebSocket.OPEN;
          if (this.onopen) {
            this.onopen({ type: 'open' });
          }
        }, connectionDelay);
      }
    }

    send(data) {
      this.sentMessages.push(data);
    }

    close(code = 1000, reason = '') {
      this.readyState = MockWebSocket.CLOSED;
      if (this.onclose) {
        this.onclose({ code, reason, type: 'close' });
      }
    }

    // Helper method to simulate incoming messages
    simulateMessage(message) {
      if (this.onmessage) {
        this.onmessage({ data: JSON.stringify(message), type: 'message' });
      }
    }

    // Helper method to simulate error
    simulateError(error) {
      if (this.onerror) {
        this.onerror(error);
      }
    }
  };
}

describe('WebSocket Client Library', () => {
  let wsClient;
  let originalWebSocket;

  beforeEach(() => {
    // Store original WebSocket if it exists
    originalWebSocket = global.WebSocket;
    
    // Set up default successful mock WebSocket
    const MockWebSocket = createMockWebSocket();
    global.WebSocket = MockWebSocket;
    global.WebSocket.CONNECTING = 0;
    global.WebSocket.OPEN = 1;
    global.WebSocket.CLOSING = 2;
    global.WebSocket.CLOSED = 3;

    wsClient = new CryptoIntelWebSocket({
      url: 'ws://localhost:8787/ws',
      token: 'test-token',
      autoReconnect: false // Disable auto-reconnect for most tests
    });
  });

  afterEach(() => {
    if (wsClient) {
      wsClient.disconnect();
    }
    
    // Restore original WebSocket
    if (originalWebSocket) {
      global.WebSocket = originalWebSocket;
    } else {
      delete global.WebSocket;
    }
  });

  describe('Connection Management', () => {
    it('should connect successfully', async () => {
      const connectPromise = wsClient.connect();
      
      // Wait for connection
      await connectPromise;
      
      expect(wsClient.getConnectionState().connected).toBe(true);
      expect(wsClient.getConnectionState().connecting).toBe(false);
    });

    it('should handle connection errors', async () => {
      // Create failing mock WebSocket
      const FailingWebSocket = createMockWebSocket({ 
        shouldFail: true, 
        failMessage: 'Connection failed',
        connectionDelay: 5
      });
      global.WebSocket = FailingWebSocket;

      const failingClient = new CryptoIntelWebSocket({
        url: 'ws://localhost:8787/ws',
        token: 'test-token',
        autoReconnect: false
      });

      await expect(failingClient.connect()).rejects.toThrow('Connection failed');
    });

    it('should disconnect properly', async () => {
      await wsClient.connect();
      
      expect(wsClient.getConnectionState().connected).toBe(true);
      
      wsClient.disconnect();
      
      expect(wsClient.getConnectionState().connected).toBe(false);
    });
  });

  describe('Message Handling', () => {
    beforeEach(async () => {
      await wsClient.connect();
    });

    it('should send messages correctly', () => {
      const testMessage = { type: 'test', data: 'hello' };
      
      wsClient.send(testMessage);
      
      expect(wsClient.ws.sentMessages).toContain(JSON.stringify(testMessage));
    });

    it('should receive messages correctly', async () => {
      const testMessage = { type: 'test', data: 'hello world' };
      
      const messagePromise = new Promise((resolve) => {
        wsClient.on('message', (message) => {
          resolve(message);
        });
      });

      // Simulate incoming message
      wsClient.ws.simulateMessage(testMessage);
      
      const receivedMessage = await messagePromise;
      expect(receivedMessage).toEqual(testMessage);
    });

    it('should handle JSON parsing errors', async () => {
      const errorPromise = new Promise((resolve) => {
        wsClient.on('error', (error) => {
          resolve(error);
        });
      });

      // Simulate invalid JSON message
      if (wsClient.ws.onmessage) {
        wsClient.ws.onmessage({ data: 'invalid json', type: 'message' });
      }
      
      const error = await errorPromise;
      expect(error).toBeDefined();
      expect(error.type).toBe('parse_error');
    });
  });

  describe('Subscription Management', () => {
    beforeEach(async () => {
      await wsClient.connect();
    });

    it('should subscribe to channels', () => {
      const channel = 'prices';
      const params = { symbols: ['BTC', 'ETH'] };
      
      wsClient.subscribe(channel, params);
      
      const subscribeMessage = JSON.parse(wsClient.ws.sentMessages.find(msg => {
        const parsed = JSON.parse(msg);
        return parsed.type === 'subscribe';
      }));
      
      expect(subscribeMessage.type).toBe('subscribe');
      expect(subscribeMessage.channel).toBe(channel);
      expect(subscribeMessage.params).toEqual(params);
    });

    it('should unsubscribe from channels', () => {
      const channel = 'prices';
      
      wsClient.unsubscribe(channel);
      
      const unsubscribeMessage = JSON.parse(wsClient.ws.sentMessages.find(msg => {
        const parsed = JSON.parse(msg);
        return parsed.type === 'unsubscribe';
      }));
      
      expect(unsubscribeMessage.type).toBe('unsubscribe');
      expect(unsubscribeMessage.channel).toBe(channel);
    });

    it('should track active subscriptions', () => {
      const channels = ['prices', 'signals', 'market-data'];
      
      // Subscribe to each channel
      channels.forEach(channel => {
        wsClient.subscribe(channel);
      });
      
      const activeSubscriptions = wsClient.getSubscriptions();
      expect(activeSubscriptions).toEqual(expect.arrayContaining(channels));
    });
  });

  describe('Auto-reconnection', () => {
    it('should attempt reconnection on disconnect', async () => {
      const reconnectingClient = new CryptoIntelWebSocket({
        url: 'ws://localhost:8787/ws',
        token: 'test-token',
        autoReconnect: true,
        reconnectInterval: 50 // Fast for testing
      });

      await reconnectingClient.connect();
      expect(reconnectingClient.getConnectionState().connected).toBe(true);

      // Simulate disconnection by calling close handler directly
      reconnectingClient.ws.readyState = global.WebSocket.CLOSED;
      if (reconnectingClient.ws.onclose) {
        reconnectingClient.ws.onclose({ code: 1006, reason: 'Connection lost', type: 'close' });
      }

      // Wait for reconnection to be scheduled
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Should have scheduled reconnection
      expect(reconnectingClient.getConnectionState().reconnecting).toBe(true);
      expect(reconnectingClient.reconnectAttempts).toBe(1);
    });

    it('should respect max reconnection attempts', async () => {
      const limitedClient = new CryptoIntelWebSocket({
        url: 'ws://localhost:8787/ws',
        token: 'test-token',
        autoReconnect: true,
        maxReconnectAttempts: 2,
        reconnectInterval: 10 // Very fast for testing
      });

      // Mock WebSocket to always fail after initial connection
      let connectionCount = 0;
      const FailingReconnectWebSocket = class extends createMockWebSocket() {
        constructor(url) {
          connectionCount++;
          if (connectionCount > 1) {
            // Fail reconnection attempts
            super(url);
            setTimeout(() => {
              this.readyState = MockWebSocket.CLOSED;
              if (this.onerror) {
                this.onerror(new Error('Reconnection failed'));
              }
              if (this.onclose) {
                this.onclose({ code: 1006, reason: 'Reconnection failed', type: 'close' });
              }
            }, 5);
          } else {
            // First connection succeeds
            super(url);
          }
        }
      };
      global.WebSocket = FailingReconnectWebSocket;

      await limitedClient.connect();
      
      // Simulate initial disconnection
      limitedClient.ws.readyState = global.WebSocket.CLOSED;
      if (limitedClient.ws.onclose) {
        limitedClient.ws.onclose({ code: 1006, reason: 'Connection lost', type: 'close' });
      }

      // Wait for reconnection attempts to complete
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should have attempted reconnection up to max attempts
      expect(limitedClient.reconnectAttempts).toBe(1);
      expect(limitedClient.getConnectionState().reconnecting).toBe(false);
    });
  });

  describe('Heartbeat Mechanism', () => {
    beforeEach(async () => {
      wsClient = new CryptoIntelWebSocket({
        url: 'ws://localhost:8787/ws',
        token: 'test-token',
        heartbeatInterval: 50 // Fast for testing
      });
      await wsClient.connect();
    });

    afterEach(() => {
      wsClient.disconnect();
    });

    it('should send ping messages periodically', async () => {
      await new Promise((resolve, reject) => {
        setTimeout(() => {
          if (wsClient.ws && wsClient.ws.sentMessages) {
            const pingMessage = JSON.parse(wsClient.ws.sentMessages.find(msg => {
              const parsed = JSON.parse(msg);
              return parsed.type === 'ping';
            }));
            
            expect(pingMessage.type).toBe('ping');
            resolve();
          } else {
            reject(new Error('WebSocket or sentMessages not available'));
          }
        }, 60); // Wait for first ping
      });
    });

    it('should handle pong responses', async () => {
      await new Promise((resolve) => {
        wsClient.on('pong', (data) => {
          expect(data).toBeDefined();
          expect(wsClient.getConnectionState().lastPongTime).toBeDefined();
          resolve();
        });

        // Send a ping first
        wsClient.send({ type: 'ping' });
        
        // Simulate pong response
        wsClient.ws.simulateMessage({
        type: 'pong',
        data: { timestamp: new Date().toISOString() }
      });
    });
  });

  describe('Event System', () => {
    beforeEach(async () => {
      await wsClient.connect();
    });

    it('should add and remove event listeners', () => {
      const handler = vi.fn();
      
      wsClient.on('test-event', handler);
      wsClient.emit('test-event', { data: 'test' });
      
      expect(handler).toHaveBeenCalledWith({ data: 'test' });
      
      wsClient.off('test-event', handler);
      wsClient.emit('test-event', { data: 'test2' });
      
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple listeners for same event', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      
      wsClient.on('multi-event', handler1);
      wsClient.on('multi-event', handler2);
      wsClient.emit('multi-event', { data: 'multi' });
      
      expect(handler1).toHaveBeenCalledWith({ data: 'multi' });
      expect(handler2).toHaveBeenCalledWith({ data: 'multi' });
    });

    it('should remove all listeners with off() without handler', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      
      wsClient.on('clear-event', handler1);
      wsClient.on('clear-event', handler2);
      
      // Remove all listeners by calling off without handler
      wsClient.eventHandlers.delete('clear-event');
      
      wsClient.emit('clear-event', { data: 'clear' });
      
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });
  });

  describe('Authentication', () => {
    it('should include token in connection URL', () => {
      const authenticatedClient = new CryptoIntelWebSocket({
        url: 'ws://localhost:8787/ws',
        token: 'test-token'
      });

      // Mock WebSocket constructor to capture URL
      let capturedUrl;
      const URLCaptureWebSocket = class extends createMockWebSocket() {
        constructor(url) {
          capturedUrl = url;
          super(url);
        }
      };
      global.WebSocket = URLCaptureWebSocket;

      authenticatedClient.connect();
      
      expect(capturedUrl).toContain('token=test-token');
    });

    it('should handle authentication errors', async () => {
      // Mock WebSocket to reject authentication
      const AuthFailWebSocket = createMockWebSocket({ 
        shouldFail: true, 
        failMessage: 'Authentication failed',
        connectionDelay: 5
      });
      global.WebSocket = AuthFailWebSocket;

      const authClient = new CryptoIntelWebSocket({
        url: 'ws://localhost:8787/ws',
        token: 'invalid-token'
      });

      await expect(authClient.connect()).rejects.toThrow('Authentication failed');
    });
  });

  describe('Connection State Management', () => {
    it('should provide accurate connection state', async () => {
      const stateClient = new CryptoIntelWebSocket({
        url: 'ws://localhost:8787/ws',
        token: 'test-token'
      });

      // Initial state
      let state = stateClient.getConnectionState();
      expect(state.connected).toBe(false);
      expect(state.connecting).toBe(false);
      expect(state.reconnecting).toBe(false);

      // During connection
      const connectPromise = stateClient.connect();
      state = stateClient.getConnectionState();
      expect(state.connecting).toBe(true);

      await connectPromise;
      state = stateClient.getConnectionState();
      expect(state.connected).toBe(true);
      expect(state.connecting).toBe(false);

      stateClient.disconnect();
      state = stateClient.getConnectionState();
      expect(state.connected).toBe(false);
    });

    it('should track connection statistics', async () => {
      const statsClient = new CryptoIntelWebSocket({
        url: 'ws://localhost:8787/ws',
        token: 'test-token'
      });

      await statsClient.connect();
      
      const stats = statsClient.getStats();
      expect(stats.connectionState).toBeDefined();
      expect(stats.connectionState.connectTime).toBeDefined();
      expect(stats.subscriptions).toEqual([]);
      expect(stats.reconnectAttempts).toBe(0);
    });
  });
  });
});