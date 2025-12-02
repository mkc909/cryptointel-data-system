/**
 * CryptoIntel WebSocket Handler
 * Routes WebSocket connections and manages real-time data streaming
 */

import { WebSocketConnection } from './websocket-connection.js';

export class WebSocketHandler {
  constructor(env) {
    this.env = env;
    this.connectionId = 'cryptointel-ws-connection';
  }

  async handleWebSocket(request) {
    try {
      // Get or create WebSocket connection Durable Object
      const connectionDurableObject = this.env.WEBSOCKET_CONNECTIONS.get(this.connectionId);
      
      // Forward the request to the Durable Object
      return await connectionDurableObject.fetch(request);
    } catch (error) {
      console.error('WebSocket handler error:', error);
      return new Response('WebSocket connection failed', { 
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
  }

  // Methods for broadcasting data to connected clients
  async broadcastPriceUpdate(symbol, priceData) {
    try {
      const connectionDurableObject = this.env.WEBSOCKET_CONNECTIONS.get(this.connectionId);
      await connectionDurableObject.broadcastPriceUpdate(symbol, priceData);
    } catch (error) {
      console.error('Failed to broadcast price update:', error);
    }
  }

  async broadcastSignalAlert(signalData) {
    try {
      const connectionDurableObject = this.env.WEBSOCKET_CONNECTIONS.get(this.connectionId);
      await connectionDurableObject.broadcastSignalAlert(signalData);
    } catch (error) {
      console.error('Failed to broadcast signal alert:', error);
    }
  }

  async broadcastMarketData(marketData) {
    try {
      const connectionDurableObject = this.env.WEBSOCKET_CONNECTIONS.get(this.connectionId);
      await connectionDurableObject.broadcastMarketData(marketData);
    } catch (error) {
      console.error('Failed to broadcast market data:', error);
    }
  }

  async getWebSocketStats() {
    try {
      const connectionDurableObject = this.env.WEBSOCKET_CONNECTIONS.get(this.connectionId);
      return await connectionDurableObject.getStats();
    } catch (error) {
      console.error('Failed to get WebSocket stats:', error);
      return {
        activeSessions: 0,
        totalSubscriptions: 0,
        channelCount: 0,
        trackedSymbols: 0,
        trackedSignals: 0,
        timestamp: Date.now(),
        error: error.message
      };
    }
  }

  async getWebSocketSessions() {
    try {
      const connectionDurableObject = this.env.WEBSOCKET_CONNECTIONS.get(this.connectionId);
      return await connectionDurableObject.getSessions();
    } catch (error) {
      console.error('Failed to get WebSocket sessions:', error);
      return [];
    }
  }
}

// WebSocket message constants for client use
export const WS_MESSAGES = {
  // Client -> Server
  SUBSCRIBE: 'subscribe',
  UNSUBSCRIBE: 'unsubscribe',
  PING: 'ping',
  AUTH: 'auth',
  
  // Server -> Client
  PRICE_UPDATE: 'price_update',
  SIGNAL_ALERT: 'signal_alert',
  MARKET_DATA: 'market_data',
  SYSTEM_STATUS: 'system_status',
  PONG: 'pong',
  ERROR: 'error',
  AUTH_SUCCESS: 'auth_success',
  AUTH_ERROR: 'auth_error'
};

// Channel definitions for client use
export const CHANNELS = {
  prices: {
    bitcoin: 'price:bitcoin',
    ethereum: 'price:ethereum',
    // Dynamic symbol channels: price:{symbol}
  },
  signals: {
    all: 'signals:all',
    high_confidence: 'signals:high',
    by_type: 'signals:type:{type}'
  },
  market: {
    summary: 'market:summary',
    volume: 'market:volume',
    sentiment: 'market:sentiment'
  }
};

// Helper function to validate channels
export function isValidChannel(channel) {
  // Price channels: price:{symbol}
  if (channel.startsWith('price:')) {
    return channel.length > 6; // Must have symbol after 'price:'
  }
  
  // Signal channels
  const validSignalChannels = ['signals:all', 'signals:high'];
  if (validSignalChannels.includes(channel)) {
    return true;
  }
  
  // Signal type channels: signals:type:{type}
  if (channel.startsWith('signals:type:')) {
    return channel.length > 13; // Must have type after 'signals:type:'
  }
  
  // Market channels
  const validMarketChannels = ['market:summary', 'market:volume', 'market:sentiment'];
  if (validMarketChannels.includes(channel)) {
    return true;
  }
  
  return false;
}

// Helper function to create subscription message
export function createSubscribeMessage(channels) {
  return {
    type: WS_MESSAGES.SUBSCRIBE,
    channels: Array.isArray(channels) ? channels : [channels],
    timestamp: Date.now()
  };
}

// Helper function to create unsubscribe message
export function createUnsubscribeMessage(channels) {
  return {
    type: WS_MESSAGES.UNSUBSCRIBE,
    channels: Array.isArray(channels) ? channels : [channels],
    timestamp: Date.now()
  };
}

// Helper function to create ping message
export function createPingMessage() {
  return {
    type: WS_MESSAGES.PING,
    timestamp: Date.now()
  };
}

// Helper function to create auth message
export function createAuthMessage(token) {
  return {
    type: WS_MESSAGES.AUTH,
    token: token,
    timestamp: Date.now()
  };
}