# TICKET-003: Add WebSocket Support

## Status
- [ ] In Progress
- [ ] Code Complete
- [ ] Tested
- [ ] Reviewed
- [ ] Merged

## Type
Feature

## Priority
- [ ] Critical (P0)
- [ ] High (P1)
- [x] Medium (P2)
- [ ] Low (P3)

## Description
Implement WebSocket support for real-time data streaming, enabling live price updates, instant signal notifications, and reduced API polling overhead.

## Acceptance Criteria
- [ ] WebSocket server implemented on Cloudflare Workers
- [ ] Real-time price streaming for tracked symbols
- [ ] Instant signal push notifications
- [ ] Connection management with auto-reconnect
- [ ] Client libraries for web and mobile
- [ ] Rate limiting and authentication
- [ ] Fallback to polling if WebSocket fails
- [ ] Dashboard integration with live updates

## Technical Details

### Implementation Plan

1. **Phase 1: WebSocket Infrastructure**
   - Set up Durable Objects for connection management
   - Implement WebSocket handler in Workers
   - Create connection pool management
   - Add heartbeat/ping-pong mechanism

2. **Phase 2: Real-time Data Streams**
   - Price update channels
   - Signal notification channels
   - Market data aggregation stream
   - Entity mention alerts

3. **Phase 3: Client Implementation**
   - JavaScript client library
   - Auto-reconnection logic
   - Message queue for offline handling
   - Subscription management

4. **Phase 4: Integration & Testing**
   - Dashboard live updates
   - Mobile push notifications prep
   - Load testing with multiple clients
   - Failover mechanisms

### Architecture Design

```javascript
// WebSocket Message Types
const WS_MESSAGES = {
  // Client -> Server
  SUBSCRIBE: 'subscribe',
  UNSUBSCRIBE: 'unsubscribe',
  PING: 'ping',

  // Server -> Client
  PRICE_UPDATE: 'price_update',
  SIGNAL_ALERT: 'signal_alert',
  MARKET_DATA: 'market_data',
  SYSTEM_STATUS: 'system_status',
  PONG: 'pong',
  ERROR: 'error'
};

// Subscription Channels
const CHANNELS = {
  prices: {
    bitcoin: 'price:bitcoin',
    ethereum: 'price:ethereum',
    // Dynamic symbol channels
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
```

### Files to Create/Modify

- [ ] `src/websocket.js` - WebSocket handler implementation
- [ ] `src/durable-objects.js` - Connection state management
- [ ] `src/ws-client.js` - Client library
- [ ] `src/index.js` - Add WebSocket routes
- [ ] `src/dashboard.js` - Integrate live updates
- [ ] `test/websocket.test.js` - WebSocket tests
- [ ] `docs/websocket-api.md` - API documentation
- [ ] `wrangler.toml` - Add Durable Objects config

### Durable Objects Configuration

```toml
# wrangler.toml additions
[[durable_objects.bindings]]
name = "WEBSOCKET_CONNECTIONS"
class_name = "WebSocketConnection"

[[migrations]]
tag = "v1"
new_classes = ["WebSocketConnection"]
```

### WebSocket Handler Structure

```javascript
export class WebSocketConnection {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
  }

  async fetch(request) {
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 400 });
    }

    const [client, server] = Object.values(new WebSocketPair());

    this.handleSession(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  handleSession(websocket) {
    websocket.accept();

    const session = {
      websocket,
      subscriptions: new Set(),
      authenticated: false,
      lastActivity: Date.now()
    };

    this.sessions.set(websocket, session);

    websocket.addEventListener('message', async (event) => {
      await this.handleMessage(session, event.data);
    });

    websocket.addEventListener('close', () => {
      this.sessions.delete(websocket);
    });
  }

  async handleMessage(session, data) {
    const message = JSON.parse(data);

    switch (message.type) {
      case WS_MESSAGES.SUBSCRIBE:
        await this.handleSubscribe(session, message.channels);
        break;
      case WS_MESSAGES.UNSUBSCRIBE:
        await this.handleUnsubscribe(session, message.channels);
        break;
      case WS_MESSAGES.PING:
        session.websocket.send(JSON.stringify({ type: WS_MESSAGES.PONG }));
        break;
    }

    session.lastActivity = Date.now();
  }

  async broadcast(channel, data) {
    for (const [ws, session] of this.sessions) {
      if (session.subscriptions.has(channel)) {
        ws.send(JSON.stringify(data));
      }
    }
  }
}
```

### Client Library Example

```javascript
class CryptoIntelWebSocket {
  constructor(url, options = {}) {
    this.url = url;
    this.options = options;
    this.ws = null;
    this.subscriptions = new Set();
    this.messageQueue = [];
    this.reconnectAttempts = 0;
    this.listeners = new Map();
  }

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.flushMessageQueue();
      this.resubscribe();
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(JSON.parse(event.data));
    };

    this.ws.onclose = () => {
      this.reconnect();
    };
  }

  subscribe(channels, callback) {
    if (!Array.isArray(channels)) channels = [channels];

    channels.forEach(channel => {
      this.subscriptions.add(channel);
      if (!this.listeners.has(channel)) {
        this.listeners.set(channel, new Set());
      }
      this.listeners.get(channel).add(callback);
    });

    this.send({
      type: 'subscribe',
      channels
    });
  }

  reconnect() {
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    setTimeout(() => {
      this.connect();
    }, delay);
  }
}
```

## Testing Plan

- [ ] Unit tests for WebSocket handler
- [ ] Integration tests with real connections
- [ ] Load testing with 1000+ concurrent connections
- [ ] Latency testing (target < 50ms)
- [ ] Reconnection logic testing
- [ ] Message ordering tests
- [ ] Authentication and authorization tests
- [ ] Rate limiting tests

## Performance Requirements

- Connection establishment: < 100ms
- Message delivery latency: < 50ms
- Support 10,000+ concurrent connections
- Memory per connection: < 1KB
- CPU usage: < 50% at peak load
- Auto-scaling based on connection count

## Worktree Setup

```bash
git worktree add .tickets/worktrees/TICKET-003 -b feature/TICKET-003-websocket-support
cd .tickets/worktrees/TICKET-003
npm install
npm run dev
```

## Related Issues/PRs

- GitHub Issue: #TBD
- Depends on: TICKET-002 (signals to broadcast)
- Enhances: Dashboard real-time capabilities
- Enables: Mobile app integration

## Security Considerations

- [ ] WebSocket authentication via JWT
- [ ] Rate limiting per connection
- [ ] Message size limits (max 64KB)
- [ ] Connection timeout (idle > 5 minutes)
- [ ] IP-based connection limits
- [ ] Encrypted connections only (wss://)
- [ ] Input validation for all messages

## Monitoring & Metrics

- Active connection count
- Messages per second
- Average latency
- Connection churn rate
- Error rates by type
- Bandwidth usage
- CPU/Memory utilization

## Notes

- Consider using Cloudflare Durable Objects for state
- Implement gradual rollout with feature flag
- Plan for horizontal scaling
- Consider WebSocket compression
- Prepare fallback to SSE or long-polling
- Document client reconnection strategies

## Completion Checklist

- [ ] WebSocket server implemented
- [ ] Durable Objects configured
- [ ] Client library created
- [ ] Dashboard integrated
- [ ] Tests written and passing
- [ ] Load testing completed
- [ ] Documentation updated
- [ ] Security review passed
- [ ] Code reviewed
- [ ] Branch merged
- [ ] Worktree removed
- [ ] Ticket archived

## Time Tracking

- Estimated: 20 hours
- Actual: TBD
- Started: 2025-11-27
- Completed: YYYY-MM-DD

## Implementation Progress

### Core Components
- [ ] WebSocket handler
- [ ] Durable Object class
- [ ] Connection manager
- [ ] Message router
- [ ] Client library
- [ ] Subscription system
- [ ] Broadcasting system

### Features Completed
- [ ] Basic WebSocket connection
- [ ] Authentication
- [ ] Channel subscriptions
- [ ] Price updates streaming
- [ ] Signal notifications
- [ ] Auto-reconnection
- [ ] Dashboard integration
- [ ] Load balancing