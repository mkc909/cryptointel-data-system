# API Endpoints Documentation

## Overview

The CryptoIntel Data System provides a comprehensive RESTful API for accessing cryptocurrency intelligence data, signals, and analytics. The API is built on Cloudflare Workers with global edge distribution for optimal performance.

## Base URL

```
Production: https://cryptointel-data-system.workers.dev/api/v1
Development: https://cryptointel-dev.workers.dev/api/v1
```

## Authentication

### API Key Authentication
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     https://cryptointel-data-system.workers.dev/api/v1/market-data/BTC
```

### x402 Payment Integration
For premium endpoints, use x402 payment headers:
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     -H "x402-payment: true" \
     -H "x402-amount: 0.01" \
     -H "x402-currency: USD" \
     https://cryptointel-data-system.workers.dev/api/v1/premium/analytics
```

## Rate Limiting

- **Free Tier:** 100 requests per hour
- **Premium Tier:** 1,000 requests per hour
- **Enterprise Tier:** 10,000 requests per hour

Rate limit headers are included in all responses:
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1701388800
```

---

## Market Data Endpoints

### Get Market Data

Retrieve current market data for a specific cryptocurrency.

```http
GET /api/v1/market-data/{symbol}
```

**Parameters:**
- `symbol` (path, required): Cryptocurrency symbol (e.g., BTC, ETH)

**Query Parameters:**
- `source` (optional): Data source (coingecko, coinmarketcap, all)
- `include_history` (optional): Include 24h history (true/false)

**Response:**
```json
{
  "symbol": "BTC",
  "price": 43250.67,
  "volume_24h": 12500000000,
  "market_cap": 845000000000,
  "price_change_24h": 1250.34,
  "price_change_percentage_24h": 2.98,
  "circulating_supply": 19500000,
  "total_supply": 21000000,
  "timestamp": "2025-11-30T01:45:00Z",
  "source": "coingecko",
  "history": [
    {
      "timestamp": "2025-11-30T00:45:00Z",
      "price": 42000.33,
      "volume_24h": 12000000000
    }
  ]
}
```

**Example Request:**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     "https://cryptointel-data-system.workers.dev/api/v1/market-data/BTC?source=all&include_history=true"
```

---

### Get Multiple Market Data

Retrieve market data for multiple cryptocurrencies.

```http
GET /api/v1/market-data
```

**Query Parameters:**
- `symbols` (required): Comma-separated list of symbols
- `source` (optional): Data source preference
- `sort_by` (optional): Sort field (price, volume, market_cap)
- `sort_order` (optional): Sort order (asc, desc)

**Response:**
```json
{
  "data": [
    {
      "symbol": "BTC",
      "price": 43250.67,
      "volume_24h": 12500000000,
      "market_cap": 845000000000,
      "timestamp": "2025-11-30T01:45:00Z"
    },
    {
      "symbol": "ETH",
      "price": 2280.45,
      "volume_24h": 8500000000,
      "market_cap": 274000000000,
      "timestamp": "2025-11-30T01:45:00Z"
    }
  ],
  "total": 2,
  "page": 1,
  "per_page": 100
}
```

**Example Request:**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     "https://cryptointel-data-system.workers.dev/api/v1/market-data?symbols=BTC,ETH,ADA&sort_by=market_cap&sort_order=desc"
```

---

### Historical Market Data

Retrieve historical market data for analysis.

```http
GET /api/v1/market-data/{symbol}/history
```

**Query Parameters:**
- `period` (optional): Time period (1h, 24h, 7d, 30d, 90d)
- `interval` (optional): Data interval (1m, 5m, 15m, 1h, 1d)
- `start_date` (optional): Start date (ISO 8601)
- `end_date` (optional): End date (ISO 8601)

**Response:**
```json
{
  "symbol": "BTC",
  "period": "7d",
  "interval": "1h",
  "data": [
    {
      "timestamp": "2025-11-23T01:00:00Z",
      "price": 41000.00,
      "volume_24h": 11000000000,
      "market_cap": 800000000000
    }
  ],
  "total_points": 168
}
```

**Example Request:**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     "https://cryptointel-data-system.workers.dev/api/v1/market-data/BTC/history?period=7d&interval=1h"
```

---

## Signal Endpoints

### Get Active Signals

Retrieve currently active intelligence signals.

```http
GET /api/v1/signals
```

**Query Parameters:**
- `type` (optional): Signal type filter
- `symbol` (optional): Symbol filter
- `confidence_min` (optional): Minimum confidence score (0-1)
- `limit` (optional): Maximum number of results (default: 50)

**Response:**
```json
{
  "signals": [
    {
      "id": 12345,
      "type": "price_alert",
      "symbol": "BTC",
      "confidence_score": 0.85,
      "description": "BTC price increased by 8.5% in the last hour",
      "trigger_value": 43250.67,
      "threshold_value": 40000.00,
      "metadata": {
        "price_change_percentage": 8.5,
        "volume_increase": 15.2
      },
      "created_at": "2025-11-30T01:45:00Z",
      "expires_at": "2025-11-30T02:45:00Z"
    }
  ],
  "total": 1,
  "page": 1
}
```

**Example Request:**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     "https://cryptointel-data-system.workers.dev/api/v1/signals?type=price_alert&confidence_min=0.7&limit=10"
```

---

### Get Signal by ID

Retrieve detailed information about a specific signal.

```http
GET /api/v1/signals/{signal_id}
```

**Response:**
```json
{
  "id": 12345,
  "type": "volume_spike",
  "symbol": "ETH",
  "confidence_score": 0.92,
  "description": "Unusual volume spike detected for ETH",
  "trigger_value": 15000000000,
  "threshold_value": 8500000000,
  "metadata": {
    "volume_increase_percentage": 76.5,
    "average_volume_24h": 8500000000,
    "current_volume_24h": 15000000000,
    "exchanges": ["binance", "coinbase", "kraken"]
  },
  "is_active": true,
  "created_at": "2025-11-30T01:30:00Z",
  "expires_at": "2025-11-30T02:30:00Z",
  "related_signals": [12346, 12347]
}
```

**Example Request:**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     "https://cryptointel-data-system.workers.dev/api/v1/signals/12345"
```

---

### Signal History

Retrieve historical signals for analysis.

```http
GET /api/v1/signals/history
```

**Query Parameters:**
- `symbol` (optional): Symbol filter
- `type` (optional): Signal type filter
- `start_date` (optional): Start date (ISO 8601)
- `end_date` (optional): End date (ISO 8601)
- `resolution` (optional): Resolution outcome filter

**Response:**
```json
{
  "signals": [
    {
      "id": 12340,
      "type": "sentiment_shift",
      "symbol": "BTC",
      "confidence_score": 0.78,
      "created_at": "2025-11-29T15:30:00Z",
      "resolved_at": "2025-11-29T18:45:00Z",
      "resolution_outcome": "price_increase_5pct",
      "metadata": {
        "sentiment_change": "negative_to_positive",
        "news_sources": ["coindesk", "cointelegraph"]
      }
    }
  ],
  "total": 1,
  "success_rate": 0.65
}
```

**Example Request:**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     "https://cryptointel-data-system.workers.dev/api/v1/signals/history?symbol=BTC&start_date=2025-11-29T00:00:00Z"
```

---

## Analytics Endpoints

### Market Overview

Get comprehensive market overview and statistics.

```http
GET /api/v1/analytics/market-overview
```

**Response:**
```json
{
  "market_cap_total": 2500000000000,
  "market_cap_change_24h": 2.5,
  "volume_24h_total": 125000000000,
  "volume_change_24h": 5.2,
  "dominance": {
    "btc": 45.2,
    "eth": 18.5,
    "others": 36.3
  },
  "fear_greed_index": 72,
  "trending_symbols": ["BTC", "ETH", "SOL", "AVAX"],
  "top_gainers": [
    {
      "symbol": "SOL",
      "change_percentage": 15.2,
      "price": 98.45
    }
  ],
  "top_losers": [
    {
      "symbol": "LUNA",
      "change_percentage": -8.7,
      "price": 0.82
    }
  ],
  "timestamp": "2025-11-30T01:45:00Z"
}
```

**Example Request:**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     "https://cryptointel-data-system.workers.dev/api/v1/analytics/market-overview"
```

---

### Trending Analysis

Get trending cryptocurrencies and analysis.

```http
GET /api/v1/analytics/trending
```

**Query Parameters:**
- `timeframe` (optional): Analysis timeframe (1h, 6h, 24h, 7d)
- `limit` (optional): Number of results (default: 20)

**Response:**
```json
{
  "trending": [
    {
      "symbol": "SOL",
      "rank": 1,
      "score": 95.2,
      "price_change_24h": 15.2,
      "volume_change_24h": 45.8,
      "social_mentions": 1250,
      "sentiment_score": 0.78,
      "signals_count": 3
    }
  ],
  "timeframe": "24h",
  "updated_at": "2025-11-30T01:45:00Z"
}
```

**Example Request:**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     "https://cryptointel-data-system.workers.dev/api/v1/analytics/trending?timeframe=24h&limit=10"
```

---

## Entity Endpoints

### Entity Mentions

Get entity mentions across news and social media.

```http
GET /api/v1/entities/mentions
```

**Query Parameters:**
- `entity_type` (optional): Entity type filter
- `entity_name` (optional): Entity name filter
- `source` (optional): Source filter
- `timeframe` (optional): Timeframe (1h, 24h, 7d)

**Response:**
```json
{
  "mentions": [
    {
      "entity_type": "cryptocurrency",
      "entity_name": "BTC",
      "mention_count": 1250,
      "sentiment_score": 0.72,
      "sources": ["twitter", "reddit", "news"],
      "last_seen": "2025-11-30T01:40:00Z",
      "trend": "increasing"
    }
  ],
  "total_entities": 1,
  "timeframe": "24h"
}
```

**Example Request:**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     "https://cryptointel-data-system.workers.dev/api/v1/entities/mentions?entity_type=cryptocurrency&timeframe=24h"
```

---

### Entity Relationships

Get relationships between entities.

```http
GET /api/v1/entities/relationships
```

**Query Parameters:**
- `source_entity` (optional): Source entity name
- `target_entity` (optional): Target entity name
- `relationship_type` (optional): Relationship type filter

**Response:**
```json
{
  "relationships": [
    {
      "source_entity_type": "cryptocurrency",
      "source_entity_name": "BTC",
      "target_entity_type": "exchange",
      "target_entity_name": "binance",
      "relationship_type": "listed_on",
      "confidence_score": 0.95,
      "created_at": "2025-11-30T01:45:00Z"
    }
  ],
  "total": 1
}
```

**Example Request:**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     "https://cryptointel-data-system.workers.dev/api/v1/entities/relationships?source_entity=BTC"
```

---

## Premium Endpoints (x402 Payment Required)

### Advanced Analytics

Advanced analytics with machine learning insights.

```http
POST /api/v1/premium/analytics
```

**Headers:**
```http
Authorization: Bearer YOUR_API_KEY
x402-payment: true
x402-amount: 0.01
x402-currency: USD
```

**Request Body:**
```json
{
  "analysis_type": "price_prediction",
  "symbol": "BTC",
  "timeframe": "7d",
  "features": ["technical_indicators", "sentiment", "volume"]
}
```

**Response:**
```json
{
  "analysis_id": "analysis_12345",
  "symbol": "BTC",
  "analysis_type": "price_prediction",
  "predictions": [
    {
      "timestamp": "2025-12-01T01:45:00Z",
      "predicted_price": 44500.00,
      "confidence": 0.78,
      "factors": ["technical_bullish", "sentiment_positive"]
    }
  ],
  "model_accuracy": 0.82,
  "processing_time_ms": 1250,
  "cost_usd": 0.01
}
```

---

### Custom Signal Generation

Generate custom signals based on user criteria.

```http
POST /api/v1/premium/custom-signals
```

**Headers:**
```http
Authorization: Bearer YOUR_API_KEY
x402-payment: true
x402-amount: 0.02
x402-currency: USD
```

**Request Body:**
```json
{
  "signal_criteria": {
    "price_change_threshold": 5.0,
    "volume_multiplier": 2.0,
    "sentiment_threshold": 0.7,
    "symbols": ["BTC", "ETH", "SOL"]
  },
  "notification_settings": {
    "webhook_url": "https://your-webhook.com/signal",
    "email": "user@example.com"
  }
}
```

**Response:**
```json
{
  "signal_subscription_id": "sub_12345",
  "status": "active",
  "criteria": {
    "price_change_threshold": 5.0,
    "volume_multiplier": 2.0,
    "sentiment_threshold": 0.7
  },
  "estimated_daily_signals": 3,
  "cost_per_signal_usd": 0.02,
  "created_at": "2025-11-30T01:45:00Z"
}
```

---

## User Analytics Endpoints

### Usage Statistics

Get user-specific usage statistics and revenue data.

```http
GET /api/v1/user/analytics
```

**Response:**
```json
{
  "user_id": "user_12345",
  "period": "30d",
  "requests_total": 1250,
  "requests_breakdown": {
    "market_data": 800,
    "signals": 300,
    "analytics": 150
  },
  "revenue_generated": 12.50,
  "average_response_time_ms": 145,
  "error_rate": 0.02,
  "top_endpoints": [
    {
      "endpoint": "/api/v1/market-data/BTC",
      "requests": 250
    }
  ],
  "subscription_tier": "premium"
}
```

**Example Request:**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     "https://cryptointel-data-system.workers.dev/api/v1/user/analytics"
```

---

## DEX API Endpoints

### DEX Pair Monitoring

Get real-time DEX trading pair data and monitoring.

```http
GET /api/v1/dex/pairs/latest
```

**Query Parameters:**
- `network` (optional): Filter by network ID
- `min_volume` (optional): Minimum 24h volume filter
- `limit` (optional): Maximum pairs to return (default: 50)

**Response:**
```json
{
  "pairs": [
    {
      "pair_id": "0x1234...5678",
      "base_token": {
        "symbol": "BTC",
        "name": "Bitcoin",
        "address": "0x..."
      },
      "quote_token": {
        "symbol": "ETH",
        "name": "Ethereum",
        "address": "0x..."
      },
      "network_id": 1,
      "network_name": "Ethereum",
      "dex_id": "uniswap_v2",
      "dex_name": "Uniswap V2",
      "price_usd": 43250.67,
      "volume_24h": 125000000,
      "liquidity_usd": 89000000,
      "price_change_24h": 2.5,
      "last_updated": "2025-11-30T01:45:00Z"
    }
  ],
  "total_pairs": 1250,
  "timestamp": "2025-11-30T01:45:00Z"
}
```

**Example Request:**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     "https://cryptointel-data-system.workers.dev/api/v1/dex/pairs/latest?network=1&min_volume=10000&limit=20"
```

---

### DEX Network Status

Get status and information for DEX networks.

```http
GET /api/v1/dex/networks/status
```

**Response:**
```json
{
  "networks": [
    {
      "network_id": 1,
      "name": "Ethereum",
      "symbol": "ETH",
      "active_pairs": 450,
      "total_volume_24h": 2500000000,
      "status": "healthy",
      "last_updated": "2025-11-30T01:45:00Z"
    },
    {
      "network_id": 56,
      "name": "Binance Smart Chain",
      "symbol": "BSC",
      "active_pairs": 320,
      "total_volume_24h": 1800000000,
      "status": "healthy",
      "last_updated": "2025-11-30T01:45:00Z"
    }
  ],
  "total_networks": 8,
  "timestamp": "2025-11-30T01:45:00Z"
}
```

---

### DEX Signal History

Get historical DEX-specific signals and alerts.

```http
GET /api/v1/dex/signals/history
```

**Query Parameters:**
- `signal_type` (optional): Filter by signal type (dex_volume_spike, dex_new_pair, dex_liquidity_anomaly)
- `network_id` (optional): Filter by network ID
- `timeframe` (optional): Time period (1h, 24h, 7d, 30d)
- `min_confidence` (optional): Minimum confidence score (0-1)
- `limit` (optional): Maximum signals to return (default: 50)

**Response:**
```json
{
  "signals": [
    {
      "id": 12345,
      "signal_type": "dex_volume_spike",
      "pair_id": "0x1234...5678",
      "pair_symbol": "BTC/ETH",
      "network_id": 1,
      "network_name": "Ethereum",
      "dex_name": "Uniswap V2",
      "confidence_score": 0.85,
      "trigger_value": 250000000,
      "threshold_value": 50000000,
      "volume_multiplier": 5.0,
      "metadata": {
        "previous_volume": 50000000,
        "current_volume": 250000000,
        "timeframe": "1h"
      },
      "created_at": "2025-11-30T01:30:00Z",
      "expires_at": "2025-11-30T02:30:00Z"
    }
  ],
  "total_signals": 25,
  "filters": {
    "signal_type": "dex_volume_spike",
    "timeframe": "24h",
    "min_confidence": 0.8
  },
  "timestamp": "2025-11-30T01:45:00Z"
}
```

---

### DEX Volume Leaders

Get top DEX pairs by trading volume.

```http
GET /api/v1/dex/volume-leaders
```

**Query Parameters:**
- `timeframe` (optional): Time period (1h, 24h, 7d, default: 24h)
- `network_id` (optional): Filter by network ID
- `min_volume` (optional): Minimum volume filter
- `limit` (optional): Maximum pairs to return (default: 20)

**Response:**
```json
{
  "volume_leaders": [
    {
      "rank": 1,
      "pair_id": "0x1234...5678",
      "pair_symbol": "ETH/USDT",
      "network_name": "Ethereum",
      "dex_name": "Uniswap V3",
      "volume_24h": 1250000000,
      "volume_change_24h": 15.5,
      "price_usd": 2280.45,
      "liquidity_usd": 890000000,
      "trades_24h": 15420
    },
    {
      "rank": 2,
      "pair_id": "0x5678...9abc",
      "pair_symbol": "BTC/USDT",
      "network_name": "Ethereum",
      "dex_name": "Curve",
      "volume_24h": 980000000,
      "volume_change_24h": 8.2,
      "price_usd": 43250.67,
      "liquidity_usd": 650000000,
      "trades_24h": 8750
    }
  ],
  "timeframe": "24h",
  "total_pairs_analyzed": 1250,
  "timestamp": "2025-11-30T01:45:00Z"
}
```

---

## System Endpoints

### Health Check

System health and status information.

```http
GET /api/v1/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-30T01:45:00Z",
  "version": "2.0.0",
  "services": {
    "database": "healthy",
    "cache": "healthy",
    "external_apis": "degraded",
    "workers": "healthy"
  },
  "metrics": {
    "uptime": "99.95%",
    "response_time_ms": 145,
    "error_rate": "0.02%",
    "active_signals": 15
  },
  "data_sources": {
    "coingecko": "healthy",
    "coinmarketcap": "healthy",
    "defillama": "healthy",
    "cryptopanic": "degraded"
  }
}
```

---

### Rate Limit Status

Check current rate limit status.

```http
GET /api/v1/rate-limit
```

**Response:**
```json
{
  "limit": 1000,
  "remaining": 999,
  "reset_timestamp": "2025-11-30T02:00:00Z",
  "reset_in_seconds": 900,
  "tier": "premium"
}
```

---

## Error Handling

### Error Response Format

All errors follow a consistent format:

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please try again later.",
    "details": {
      "limit": 1000,
      "reset_timestamp": "2025-11-30T02:00:00Z"
    },
    "timestamp": "2025-11-30T01:45:00Z",
    "request_id": "req_12345"
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_API_KEY` | 401 | Invalid or expired API key |
| `RATE_LIMIT_EXCEEDED` | 429 | Rate limit exceeded |
| `INSUFFICIENT_FUNDS` | 402 | Insufficient funds for premium endpoint |
| `INVALID_SYMBOL` | 400 | Invalid cryptocurrency symbol |
| `DATA_NOT_FOUND` | 404 | Requested data not found |
| `SERVICE_UNAVAILABLE` | 503 | Temporary service outage |
| `VALIDATION_ERROR` | 400 | Request validation failed |

---

## SDK and Libraries

### JavaScript/TypeScript SDK

```javascript
import { CryptoIntelAPI } from '@cryptointel/sdk';

const client = new CryptoIntelAPI({
  apiKey: 'YOUR_API_KEY',
  baseURL: 'https://cryptointel-data-system.workers.dev/api/v1'
});

// Get market data
const btcData = await client.marketData.get('BTC');

// Get signals
const signals = await client.signals.getActive({
  type: 'price_alert',
  confidence_min: 0.7
});

// Premium analytics
const analysis = await client.premium.analytics({
  analysis_type: 'price_prediction',
  symbol: 'BTC',
  payment: { amount: 0.01, currency: 'USD' }
});
```

### Python SDK

```python
from cryptointel import CryptoIntelAPI

client = CryptoIntelAPI(
    api_key='YOUR_API_KEY',
    base_url='https://cryptointel-data-system.workers.dev/api/v1'
)

# Get market data
btc_data = client.market_data.get('BTC')

# Get signals
signals = client.signals.get_active(
    type='price_alert',
    confidence_min=0.7
)

# Premium analytics
analysis = client.premium.analytics(
    analysis_type='price_prediction',
    symbol='BTC',
    payment={'amount': 0.01, 'currency': 'USD'}
)
```

---

## Webhooks

### Signal Webhooks

Receive real-time signal notifications via webhooks.

**Webhook Payload:**
```json
{
  "event_type": "signal.created",
  "signal": {
    "id": 12345,
    "type": "price_alert",
    "symbol": "BTC",
    "confidence_score": 0.85,
    "description": "BTC price increased by 8.5% in the last hour",
    "created_at": "2025-11-30T01:45:00Z"
  },
  "timestamp": "2025-11-30T01:45:00Z"
}
```

**Webhook Configuration:**
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "webhook_url": "https://your-webhook.com/signals",
    "event_types": ["signal.created", "signal.expired"],
    "secret": "your_webhook_secret"
  }' \
  https://cryptointel-data-system.workers.dev/api/v1/webhooks
```

---

**Last Updated:** 2025-11-30  
**API Version:** v2.0.0  
**Next Review:** Post-Priority 3 completion