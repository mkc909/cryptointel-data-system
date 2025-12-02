/**
 * CryptoIntel WebSocket Connection Manager
 * Durable Object for managing WebSocket connections and real-time data streaming
 */

export class WebSocketConnection {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
    this.subscriptions = new Map(); // channel -> Set of sessions
    this.priceData = new Map(); // symbol -> price data
    this.signalData = new Map(); // signal_id -> signal data
    
    // WebSocket message types
    this.WS_MESSAGES = {
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
    
    // Channel definitions
    this.CHANNELS = {
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
    
    // Initialize cleanup interval
    this.initCleanupInterval();
  }

  async fetch(request) {
    try {
      const upgradeHeader = request.headers.get('Upgrade');
      if (upgradeHeader !== 'websocket') {
        return new Response('Expected WebSocket', { status: 400 });
      }

      const [client, server] = Object.values(new WebSocketPair());
      
      // Handle the WebSocket session
      await this.handleSession(server, request);

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    } catch (error) {
      console.error('WebSocket connection error:', error);
      return new Response('WebSocket connection failed', { status: 500 });
    }
  }

  async handleSession(websocket, request) {
    websocket.accept();

    const sessionId = this.generateSessionId();
    const session = {
      id: sessionId,
      websocket,
      subscriptions: new Set(),
      authenticated: false,
      userId: null,
      lastActivity: Date.now(),
      connectedAt: Date.now(),
      ipAddress: request.headers.get('CF-Connecting-IP') || 'unknown',
      userAgent: request.headers.get('User-Agent') || 'unknown'
    };

    this.sessions.set(websocket, session);

    // Send welcome message
    this.sendMessage(session, {
      type: this.WS_MESSAGES.SYSTEM_STATUS,
      data: {
        status: 'connected',
        sessionId: sessionId,
        timestamp: Date.now(),
        message: 'Connected to CryptoIntel WebSocket'
      }
    });

    // Set up event listeners
    websocket.addEventListener('message', async (event) => {
      try {
        await this.handleMessage(session, event.data);
      } catch (error) {
        console.error('Message handling error:', error);
        this.sendError(session, 'Message processing failed');
      }
    });

    websocket.addEventListener('close', () => {
      this.handleSessionClose(session);
    });

    websocket.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
      this.handleSessionClose(session);
    });

    // Start heartbeat for this session
    this.startHeartbeat(session);
  }

  async handleMessage(session, data) {
    try {
      const message = JSON.parse(data);
      session.lastActivity = Date.now();

      switch (message.type) {
        case this.WS_MESSAGES.SUBSCRIBE:
          await this.handleSubscribe(session, message.channels || []);
          break;
          
        case this.WS_MESSAGES.UNSUBSCRIBE:
          await this.handleUnsubscribe(session, message.channels || []);
          break;
          
        case this.WS_MESSAGES.PING:
          this.sendMessage(session, { type: this.WS_MESSAGES.PONG });
          break;
          
        case this.WS_MESSAGES.AUTH:
          await this.handleAuthentication(session, message.token);
          break;
          
        default:
          this.sendError(session, `Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('Message parsing error:', error);
      this.sendError(session, 'Invalid message format');
    }
  }

  async handleSubscribe(session, channels) {
    if (!Array.isArray(channels)) {
      channels = [channels];
    }

    for (const channel of channels) {
      // Validate channel format
      if (!this.isValidChannel(channel)) {
        this.sendError(session, `Invalid channel: ${channel}`);
        continue;
      }

      // Add to session subscriptions
      session.subscriptions.add(channel);

      // Add to global subscriptions
      if (!this.subscriptions.has(channel)) {
        this.subscriptions.set(channel, new Set());
      }
      this.subscriptions.get(channel).add(session);

      // Send current data for price channels
      if (channel.startsWith('price:')) {
        const symbol = channel.replace('price:', '');
        const currentPrice = this.priceData.get(symbol);
        if (currentPrice) {
          this.sendMessage(session, {
            type: this.WS_MESSAGES.PRICE_UPDATE,
            channel: channel,
            data: currentPrice
          });
        }
      }
    }

    this.sendMessage(session, {
      type: 'subscription_success',
      channels: channels,
      timestamp: Date.now()
    });
  }

  async handleUnsubscribe(session, channels) {
    if (!Array.isArray(channels)) {
      channels = [channels];
    }

    for (const channel of channels) {
      session.subscriptions.delete(channel);
      
      const channelSubscribers = this.subscriptions.get(channel);
      if (channelSubscribers) {
        channelSubscribers.delete(session);
        if (channelSubscribers.size === 0) {
          this.subscriptions.delete(channel);
        }
      }
    }

    this.sendMessage(session, {
      type: 'unsubscription_success',
      channels: channels,
      timestamp: Date.now()
    });
  }

  async handleAuthentication(session, token) {
    try {
      // For now, accept any non-empty token (implement proper JWT validation later)
      if (token && token.length > 0) {
        session.authenticated = true;
        session.userId = this.extractUserIdFromToken(token);
        
        this.sendMessage(session, {
          type: this.WS_MESSAGES.AUTH_SUCCESS,
          data: {
            userId: session.userId,
            timestamp: Date.now()
          }
        });
      } else {
        this.sendMessage(session, {
          type: this.WS_MESSAGES.AUTH_ERROR,
          data: {
            error: 'Invalid authentication token',
            timestamp: Date.now()
          }
        });
      }
    } catch (error) {
      console.error('Authentication error:', error);
      this.sendMessage(session, {
        type: this.WS_MESSAGES.AUTH_ERROR,
        data: {
          error: 'Authentication failed',
          timestamp: Date.now()
        }
      });
    }
  }

  handleSessionClose(session) {
    // Remove from all subscriptions
    for (const channel of session.subscriptions) {
      const channelSubscribers = this.subscriptions.get(channel);
      if (channelSubscribers) {
        channelSubscribers.delete(session);
        if (channelSubscribers.size === 0) {
          this.subscriptions.delete(channel);
        }
      }
    }

    // Remove session
    this.sessions.delete(session.websocket);
    
    console.log(`Session ${session.id} disconnected. Active sessions: ${this.sessions.size}`);
  }

  // Broadcasting methods
  async broadcastPriceUpdate(symbol, priceData) {
    const channel = `price:${symbol}`;
    this.priceData.set(symbol, priceData);
    
    await this.broadcast(channel, {
      type: this.WS_MESSAGES.PRICE_UPDATE,
      channel: channel,
      data: priceData,
      timestamp: Date.now()
    });
  }

  async broadcastSignalAlert(signalData) {
    const channels = ['signals:all'];
    
    if (signalData.confidence >= 0.8) {
      channels.push('signals:high');
    }
    
    channels.push(`signals:type:${signalData.type}`);
    
    this.signalData.set(signalData.id, signalData);
    
    for (const channel of channels) {
      await this.broadcast(channel, {
        type: this.WS_MESSAGES.SIGNAL_ALERT,
        channel: channel,
        data: signalData,
        timestamp: Date.now()
      });
    }
  }

  async broadcastMarketData(marketData) {
    const channels = ['market:summary'];
    
    if (marketData.volume) {
      channels.push('market:volume');
    }
    
    if (marketData.sentiment) {
      channels.push('market:sentiment');
    }
    
    for (const channel of channels) {
      await this.broadcast(channel, {
        type: this.WS_MESSAGES.MARKET_DATA,
        channel: channel,
        data: marketData,
        timestamp: Date.now()
      });
    }
  }

  async broadcast(channel, message) {
    const subscribers = this.subscriptions.get(channel);
    if (!subscribers) return;

    const messageStr = JSON.stringify(message);
    const errors = [];

    for (const session of subscribers) {
      try {
        session.websocket.send(messageStr);
      } catch (error) {
        console.error(`Failed to send message to session ${session.id}:`, error);
        errors.push(session.id);
      }
    }

    // Clean up failed sessions
    for (const sessionId of errors) {
      const sessionToRemove = Array.from(this.sessions.values())
        .find(s => s.id === sessionId);
      if (sessionToRemove) {
        this.handleSessionClose(sessionToRemove);
      }
    }
  }

  // Utility methods
  sendMessage(session, message) {
    try {
      session.websocket.send(JSON.stringify(message));
    } catch (error) {
      console.error(`Failed to send message to session ${session.id}:`, error);
    }
  }

  sendError(session, error) {
    this.sendMessage(session, {
      type: this.WS_MESSAGES.ERROR,
      data: {
        error: error,
        timestamp: Date.now()
      }
    });
  }

  isValidChannel(channel) {
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

  generateSessionId() {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  extractUserIdFromToken(token) {
    // Simple extraction for now - implement proper JWT parsing later
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        return payload.sub || payload.userId || 'unknown';
      }
    } catch (error) {
      console.error('Token parsing error:', error);
    }
    return `user_${Math.random().toString(36).substr(2, 9)}`;
  }

  startHeartbeat(session) {
    const heartbeatInterval = setInterval(() => {
      if (this.sessions.has(session.websocket)) {
        try {
          session.websocket.send(JSON.stringify({ 
            type: this.WS_MESSAGES.PONG,
            timestamp: Date.now()
          }));
        } catch (error) {
          clearInterval(heartbeatInterval);
          this.handleSessionClose(session);
        }
      } else {
        clearInterval(heartbeatInterval);
      }
    }, 30000); // Send pong every 30 seconds
  }

  initCleanupInterval() {
    // Clean up inactive sessions every 5 minutes
    setInterval(() => {
      const now = Date.now();
      const inactiveThreshold = 5 * 60 * 1000; // 5 minutes
      
      for (const [websocket, session] of this.sessions) {
        if (now - session.lastActivity > inactiveThreshold) {
          console.log(`Cleaning up inactive session ${session.id}`);
          try {
            websocket.close();
          } catch (error) {
            // WebSocket might already be closed
          }
          this.handleSessionClose(session);
        }
      }
    }, 5 * 60 * 1000);
  }

  // Statistics methods
  getStats() {
    return {
      activeSessions: this.sessions.size,
      totalSubscriptions: Array.from(this.sessions.values())
        .reduce((total, session) => total + session.subscriptions.size, 0),
      channelCount: this.subscriptions.size,
      trackedSymbols: this.priceData.size,
      trackedSignals: this.signalData.size,
      timestamp: Date.now()
    };
  }

  async getSessions() {
    return Array.from(this.sessions.values()).map(session => ({
      id: session.id,
      authenticated: session.authenticated,
      userId: session.userId,
      connectedAt: session.connectedAt,
      lastActivity: session.lastActivity,
      subscriptionCount: session.subscriptions.size,
      ipAddress: session.ipAddress
    }));
  }
}