# CoinMarketCap API Usage Documentation

## Overview

Comprehensive documentation for CoinMarketCap Professional API usage in the CryptoIntel Data System for DEX integration.

## API Configuration

### Authentication
- **Header**: `X-CMC_PRO_API_KEY`
- **Key Format**: 32-character alphanumeric string
- **Example**: `b54bcf4d-1bca-4e8e-9a24-22ff2c3d462c`

### Base URL
- **Production**: `https://pro-api.coinmarketcap.com`
- **Version**: `v1` for standard endpoints, `v4` for DEX endpoints

## DEX API v4 Endpoints

### 1. DEX Spot Pairs Latest
- **Endpoint**: `/v4/dex/spot/pairs/latest`
- **Method**: GET
- **Purpose**: Get latest DEX trading pairs
- **Rate Limit**: 10 credits per call
- **Parameters**:
  - `network_id` (optional): Filter by network
  - `limit` (optional): Number of results (max 200)
- **Usage**: 144 calls/day (every 10 minutes)

### 2. DEX Networks
- **Endpoint**: `/v4/dex/networks`
- **Method**: GET
- **Purpose**: Get supported blockchain networks
- **Rate Limit**: 1 credit per call
- **Usage**: 6 calls/day (every 4 hours)

### 3. DEX Listings Quotes
- **Endpoint**: `/v4/dex/listings/quotes/latest`
- **Method**: GET
- **Purpose**: Get latest quotes for DEX listings
- **Rate Limit**: 10 credits per call
- **Parameters**:
  - `convert` (optional): Convert to fiat currencies
  - `limit` (optional): Number of results
- **Usage**: 144 calls/day (every 10 minutes)

### 4. DEX Pairs OHLCV Historical
- **Endpoint**: `/v4/dex/pairs/ohlcv/historical`
- **Method**: GET
- **Purpose**: Get historical OHLCV data for DEX pairs
- **Rate Limit**: 10 credits per call
- **Parameters**:
  - `pair_id` (required): DEX pair identifier
  - `time_start` (optional): Start timestamp
  - `time_end` (optional): End timestamp
  - `interval` (optional): Time interval (1m, 5m, 1h, 1d)
- **Usage**: 144 calls/day (every 10 minutes)

### 5. DEX Latest Quotes
- **Endpoint**: `/v4/dex/quotes/latest`
- **Method**: GET
- **Purpose**: Get latest quotes for specific DEX pairs
- **Rate Limit**: 10 credits per call
- **Parameters**:
  - `pair_id` (required): DEX pair identifier
  - `convert` (optional): Convert to fiat currencies
- **Usage**: 144 calls/day (every 10 minutes)

### 6. DEX Market Pairs Latest
- **Endpoint**: `/v4/dex/market/pairs/latest`
- **Method**: GET
- **Purpose**: Get latest market pair data
- **Rate Limit**: 10 credits per call
- **Parameters**:
  - `network_id` (optional): Filter by network
  - `limit` (optional): Number of results
- **Usage**: 144 calls/day (every 10 minutes)

### 7. DEX Order Book
- **Endpoint**: `/v4/dex/orderbook/latest`
- **Method**: GET
- **Purpose**: Get order book data for DEX pairs
- **Rate Limit**: 10 credits per call
- **Parameters**:
  - `pair_id` (required): DEX pair identifier
  - `limit` (optional): Number of results
- **Usage**: 144 calls/day (every 10 minutes)

### 8. DEX Trades Historical
- **Endpoint**: `/v4/dex/trades/historical`
- **Method**: GET
- **Purpose**: Get historical trade data for DEX pairs
- **Rate Limit**: 10 credits per call
- **Parameters**:
  - `pair_id` (required): DEX pair identifier
  - `time_start` (optional): Start timestamp
  - `time_end` (optional): End timestamp
  - `limit` (optional): Number of results
- **Usage**: 144 calls/day (every 10 minutes)

## Rate Limiting

### Professional Plan Limits
- **Credits**: 300,000 credits/month
- **Daily Limit**: ~10,000 credits/day
- **Per Minute**: ~416 credits/minute
- **Reset**: Monthly on subscription anniversary

### Credit Consumption Analysis
- **DEX Endpoints**: 10 credits/call (7 endpoints)
- **Network Endpoint**: 1 credit/call (1 endpoint)
- **Daily Usage**: 1,430 credits/day
- **Monthly Usage**: ~43,000 credits/month
- **Buffer**: 257,000 credits for other features

### Rate Limiting Strategy
```javascript
// Implement client-side rate limiting
const rateLimiter = {
  creditsUsed: 0,
  lastReset: Date.now(),
  dailyLimit: 10000,
  
  checkLimit(credits) {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    
    if (now - this.lastReset > dayMs) {
      this.creditsUsed = 0;
      this.lastReset = now;
    }
    
    return this.creditsUsed + credits <= this.dailyLimit;
  },
  
  useCredits(credits) {
    this.creditsUsed += credits;
  }
};
```

## Error Handling

### HTTP Status Codes
- **200**: Success
- **400**: Bad Request (invalid parameters)
- **401**: Unauthorized (invalid API key)
- **403**: Forbidden (insufficient permissions)
- **429**: Rate Limit Exceeded
- **500**: Internal Server Error

### Error Response Format
```json
{
  "status": {
    "error_code": 1001,
    "error_message": "Invalid API key.",
    "timestamp": "2025-12-02T00:00:00.000Z"
  }
}
```

### Error Handling Strategy
```javascript
async function makeAPIRequest(endpoint, params = {}) {
  const maxRetries = 3;
  const baseDelay = 1000;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(endpoint, {
        headers: {
          'X-CMC_PRO_API_KEY': API_KEY,
          'Accept': 'application/json'
        }
      });
      
      if (response.status === 429) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

## Caching Strategy

### Cache Configuration
- **TTL**: 5 minutes for real-time data
- **TTL**: 1 hour for reference data (networks)
- **Storage**: Cloudflare KV
- **Key Format**: `cmc:dex:{endpoint}:{params_hash}`

### Cache Implementation
```javascript
async function getCachedData(key, fetcher, ttl = 300) {
  const cached = await CRYPTOINTEL_KV.get(key);
  
  if (cached) {
    const data = JSON.parse(cached);
    if (Date.now() - data.timestamp < ttl * 1000) {
      return data.payload;
    }
  }
  
  const freshData = await fetcher();
  await CRYPTOINTEL_KV.put(key, JSON.stringify({
    payload: freshData,
    timestamp: Date.now()
  }), { expirationTtl: ttl });
  
  return freshData;
}
```

## Monitoring and Analytics

### Usage Metrics
- **API Calls**: Track total calls per endpoint
- **Credit Usage**: Monitor credit consumption
- **Error Rates**: Track 4xx and 5xx errors
- **Response Times**: Monitor API latency
- **Cache Hit Rates**: Track caching effectiveness

### Monitoring Implementation
```javascript
const metrics = {
  apiCalls: {},
  creditsUsed: 0,
  errors: {},
  
  recordCall(endpoint, credits, success = true) {
    this.apiCalls[endpoint] = (this.apiCalls[endpoint] || 0) + 1;
    this.creditsUsed += credits;
    
    if (!success) {
      this.errors[endpoint] = (this.errors[endpoint] || 0) + 1;
    }
  },
  
  getUsageReport() {
    return {
      totalCalls: Object.values(this.apiCalls).reduce((a, b) => a + b, 0),
      creditsUsed: this.creditsUsed,
      errorRate: Object.values(this.errors).reduce((a, b) => a + b, 0) / 
                 Object.values(this.apiCalls).reduce((a, b) => a + b, 0),
      endpointBreakdown: this.apiCalls
    };
  }
};
```

## Security Best Practices

### API Key Management
1. **Storage**: Use Cloudflare Workers secrets
2. **Rotation**: Rotate keys every 90 days
3. **Access**: Limit to production environments
4. **Monitoring**: Track unusual usage patterns

### Implementation Security
```javascript
// Secure API key usage
const API_KEY = COINMARKETCAP_API_KEY; // From Workers secrets

// Validate API key format
function validateAPIKey(key) {
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(key);
}

// Rate limiting by IP
const ipRateLimiter = new Map();

function checkIPRateLimit(ip, limit = 100) {
  const now = Date.now();
  const window = 60 * 1000; // 1 minute
  
  if (!ipRateLimiter.has(ip)) {
    ipRateLimiter.set(ip, { count: 0, resetTime: now + window });
  }
  
  const ipData = ipRateLimiter.get(ip);
  
  if (now > ipData.resetTime) {
    ipData.count = 0;
    ipData.resetTime = now + window;
  }
  
  if (ipData.count >= limit) {
    return false;
  }
  
  ipData.count++;
  return true;
}
```

## Cost Optimization

### Usage Optimization
1. **Caching**: Implement aggressive caching for static data
2. **Batching**: Combine multiple requests when possible
3. **Filtering**: Use specific parameters to reduce data transfer
4. **Scheduling**: Optimize call frequency based on data volatility

### Cost Analysis
- **Current Usage**: ~43,000 credits/month
- **Plan Limit**: 300,000 credits/month
- **Utilization**: 14.3% of plan capacity
- **Cost per Credit**: $0.001 (Professional plan)
- **Monthly Cost**: $299 for 300,000 credits

## Testing and Validation

### Test Scenarios
1. **API Key Validation**: Test with valid/invalid keys
2. **Rate Limiting**: Test rate limit handling
3. **Error Handling**: Test various error conditions
4. **Data Quality**: Validate response data integrity
5. **Performance**: Test response times and caching

### Test Implementation
```javascript
// Test API connectivity
async function testAPIConnectivity() {
  const testEndpoint = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/info';
  const params = new URLSearchParams({ id: '1' });
  
  try {
    const response = await fetch(`${testEndpoint}?${params}`, {
      headers: {
        'X-CMC_PRO_API_KEY': API_KEY,
        'Accept': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API connectivity test passed');
      return true;
    } else {
      console.log('❌ API connectivity test failed:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ API connectivity test error:', error.message);
    return false;
  }
}
```

## Troubleshooting

### Common Issues
1. **429 Errors**: Rate limit exceeded
2. **401 Errors**: Invalid API key
3. **Timeouts**: Network connectivity issues
4. **Data Gaps**: API maintenance or downtime

### Troubleshooting Steps
1. **Check API Key**: Validate key format and permissions
2. **Monitor Usage**: Check credit consumption
3. **Review Logs**: Analyze error patterns
4. **Test Connectivity**: Verify network access
5. **Contact Support**: Escalate persistent issues

---

**Document Version**: 1.0  
**Last Updated**: 2025-12-02  
**Next Review**: 2025-12-09