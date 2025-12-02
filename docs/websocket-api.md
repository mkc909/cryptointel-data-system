# WebSocket API Documentation

## Overview

The CryptoIntel Data System provides real-time WebSocket connections for live price updates, instant signal notifications, and market data streaming. WebSocket connections are managed using Cloudflare Durable Objects for scalable stateful connections.

## Connection Details

### WebSocket Endpoint
```
wss://cryptointel-data-production.magicmike.workers.dev/ws
```

### Authentication
WebSocket connections require authentication via JWT token in the initial message:

```json
{
  "type": "auth",
  "token": "your-jwt-token"
}
```

## Message Types

### Client → Server Messages

#### Subscribe to Channels
```json
{
  "type": "subscribe",
  "channels": ["price:bitcoin", "signals:all", "market:summary"]
}
```

#### Unsubscribe from Channels
```json
{
  "type": "unsubscribe", 
  "channels": ["price:bitcoin"]
}
```

#### Ping (Keep-alive)
```json
{
  "type": "ping"
}
```

### Server → Client Messages

#### Price Update
```json
{
  "type": "price_update",
  "channel": "price:bitcoin",
  "data": {
    "symbol": "BTC",
    "price": 43250.75,
    "change_24h": 2.34,
    "volume_24h": 1250000000,
    "timestamp": "2025-12-02T12:30:00Z"
  }
}
```

#### Signal Alert
```json
{
  "type": "signal_alert",
  "channel": "signals:high",
  "data": {
    "id": "signal_12345",
    "type": "price_anomaly",
    "symbol": "ETH",
    "confidence": 0.85,
    "description": "Unusual price movement detected",
    "timestamp": "2025-12-02T12:25:00Z",
    "metadata": {
      "price_change": 5.2,
      "volume_spike": 1.8,
      "sources": ["coingecko", "coinmarketcap"]
    }
  }
}
```

#### Market Data
```json
{
  "type": "market_data",
  "channel": "market:summary",
  "data": {
    "total_market_cap": 2450000000000,
    "total_volume_24h": 89000000000,
    "bitcoin_dominance": 52.3,
    "active_cryptocurrencies": 9875,
    "timestamp": "2025-12-02T12:30:00Z"
  }
}
```

#### System Status
```json
{
  "type": "system_status",
  "data": {
    "status": "healthy",
    "active_connections": 1247,
    "messages_per_second": 45.2,
    "uptime": 99.98,
    "timestamp": "2025-12-02T12:30:00Z"
  }
}
```

#### Pong Response
```json
{
  "type": "pong"
}
```

#### Error Message
```json
{
  "type": "error",
  "error": {
    "code": "INVALID_CHANNEL",
    "message": "Channel 'price:invalid' does not exist",
    "timestamp": "2025-12-02T12:30:00Z"
  }
}
```

## Available Channels

### Price Channels
- `price:bitcoin` - Bitcoin price updates
- `price:ethereum` - Ethereum price updates  
- `price:symbol` - Dynamic symbol channels (e.g., `price:ADA`, `price:SOL`)

### Signal Channels
- `signals:all` - All signal notifications
- `signals:high` - High confidence signals only
- `signals:type:{type}` - Signals by type (e.g., `signals:type:price_anomaly`)

### Market Channels
- `market:summary` - Overall market statistics
- `market:volume` - Volume analysis and trends
- `market:sentiment` - Market sentiment indicators

## Client Library

### JavaScript Client

```javascript
import { CryptoIntelWebSocket } from './websocket-client.js';

const ws = new CryptoIntelWebSocket('wss://cryptointel-data-production.magicmike.workers.dev/ws', {
  autoReconnect: true,
  reconnectDelay: 1000,
  maxReconnectAttempts: 10
});

// Subscribe to price updates
ws.subscribe(['price:bitcoin', 'price:ethereum'], (data) => {
  console.log('Price update:', data);
});

// Subscribe to high-confidence signals
ws.subscribe(['signals:high'], (signal) => {
  console.log('Signal alert:', signal);
  // Show notification to user
});

// Connect to WebSocket
ws.connect();
```

### React Integration Example

```jsx
import React, { useState, useEffect } from 'react';
import { CryptoIntelWebSocket } from './websocket-client';

function CryptoDashboard() {
  const [prices, setPrices] = useState({});
  const [signals, setSignals] = useState([]);

  useEffect(() => {
    const ws = new CryptoIntelWebSocket('wss://cryptointel-data-production.magicmike.workers.dev/ws');
    
    // Subscribe to price updates
    ws.subscribe(['price:bitcoin', 'price:ethereum'], (data) => {
      setPrices(prev => ({
        ...prev,
        [data.symbol.toLowerCase()]: data
      }));
    });
    
    // Subscribe to signals
    ws.subscribe(['signals:high'], (signal) => {
      setSignals(prev => [signal, ...prev.slice(0, 9)]);
    });
    
    ws.connect();
    
    return () => ws.disconnect();
  }, []);

  return (
    <div>
      <h2>Live Prices</h2>
      {Object.entries(prices).map(([symbol, data]) => (
        <div key={symbol}>
          {symbol.toUpperCase()}: ${data.price} USD
        </div>
      ))}
      
      <h2>Recent Signals</h2>
      {signals.map(signal => (
        <div key={signal.id}>
          <strong>{signal.type}</strong>: {signal.description}
          <br />
          Confidence: {(signal.confidence * 100).toFixed(1)}%
        </div>
      ))}
    </div>
  );
}
```

## Rate Limits

- **Connection Rate**: 10 connections per minute per IP
- **Message Rate**: 100 messages per minute per connection
- **Subscription Limit**: 50 channels per connection
- **Reconnection**: Exponential backoff with 30-second maximum delay

## Error Codes

| Code | Description | Action |
|------|-------------|--------|
| `INVALID_TOKEN` | Authentication token invalid | Refresh token and reconnect |
| `EXPIRED_TOKEN` | Token has expired | Obtain new token and reconnect |
| `INVALID_CHANNEL` | Channel does not exist | Check channel name and resubscribe |
| `RATE_LIMITED` | Connection/message rate exceeded | Wait and retry later |
| `CONNECTION_FULL` | Server at maximum capacity | Retry with exponential backoff |
| `INVALID_MESSAGE` | Malformed message | Fix message format |
| `UNAUTHORIZED` | Missing or invalid auth | Provide valid authentication |

## Performance Metrics

- **Connection Establishment**: < 100ms average
- **Message Latency**: < 50ms average
- **Throughput**: 1000+ messages/second
- **Concurrent Connections**: 10,000+ supported
- **Uptime**: 99.9%+ target

## Security Features

- **WSS Only**: Encrypted WebSocket connections required
- **JWT Authentication**: Token-based access control
- **IP Rate Limiting**: Connection limits per IP address
- **Message Validation**: All messages validated and sanitized
- **Connection Timeout**: Idle connections closed after 5 minutes
- **Size Limits**: Maximum 64KB per message

## Monitoring

WebSocket connections are monitored for:
- Active connection count
- Message delivery latency
- Error rates by type
- Bandwidth usage
- Connection churn rate

Real-time statistics available at `/ws/stats` endpoint.

## Fallback Options

If WebSocket connection fails:
1. **Automatic Reconnection**: Built-in exponential backoff
2. **Server-Sent Events**: Fallback to SSE at `/sse`
3. **HTTP Polling**: Traditional REST API polling

## Browser Compatibility

- Chrome 16+
- Firefox 11+
- Safari 10+
- Edge 12+
- Node.js 14+ (server-side)

## Testing

Use the provided test suite to validate WebSocket functionality:

```bash
npm test websocket.test.js
```

Tests cover:
- Connection establishment
- Message handling
- Subscription management
- Authentication
- Error scenarios
- Reconnection logic
- Performance benchmarks