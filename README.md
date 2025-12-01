# CryptoIntel Data Gathering System

Multi-source crypto intelligence data collection and analysis system with x402 payment integration. Designed to provide real-time market signals, sentiment analysis, and transaction intelligence for the TradingMindset ecosystem.

**Current Status:** ✅ Priority 1 & 2 Complete | Production Ready | Performance Optimized

## 🚀 Features

### Data Sources
- **CoinGecko**: Real-time price and market data
- **CoinMarketCap**: Comprehensive market metrics
- **DeFi Llama**: DeFi protocol TVL and analytics
- **CryptoPanic**: News sentiment and market signals

### Core Capabilities
- **Signal Detection**: AI-powered pattern recognition and anomaly detection
- **Sentiment Analysis**: Real-time market sentiment from news sources
- **Entity Extraction**: Automatic identification of tokens, exchanges, and wallets
- **Rate Limiting**: Intelligent API rate limiting with caching
- **x402 Integration**: Monetized analysis endpoints with payment verification
- **Performance Optimization**: 29+ database indexes with 10-20x query improvement
- **Real-time Dashboards**: Enhanced analytics with interactive visualizations

### Intelligence Features
- **Transaction Tracking**: Monitor all x402 payments across tools
- **Market Analysis**: Comprehensive market trend analysis
- **Content Generation**: Automated content creation from signals
- **Pattern Recognition**: ML-based pattern detection and storage
- **Revenue Analytics**: Real-time x402 transaction intelligence
- **User Behavior Tracking**: Advanced analytics for optimization

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Data Sources  │───▶│  CryptoIntel     │───▶│   x402 API      │
│                 │    │  Data Worker     │    │   Endpoints     │
│ • CoinGecko    │    │                  │    │                 │
│ • CoinMarketCap│    │ • Signal Process │    │ • Paid Analysis │
│ • DeFi Llama   │    │ • Entity Extract │    │ • Free Previews │
│ • CryptoPanic  │    │ • Rate Limiting  │    │ • Transaction   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   D1 Database    │
                       │                  │
                       │ • Signals       │
                       │ • Market Data   │
                       │ • Transactions  │
                       │ • Entity Mentions│
                       └──────────────────┘
```

## 📦 Installation & Setup

### Prerequisites
- Node.js 18+
- Cloudflare account with Workers and D1
- API keys for data sources (optional for enhanced features)

### Local Development

1. **Clone and install dependencies**
```bash
cd cryptointel-data-system
npm install
```

2. **Set up environment variables**
```bash
# Copy wrangler.toml and update with your values
cp wrangler.toml.example wrangler.toml

# Set API keys in Cloudflare environment
wrangler secret put COINGECKO_API_KEY
wrangler secret put COINMARKETCAP_API_KEY
```

3. **Initialize database**
```bash
# Create and migrate D1 database
npm run db:migrate

# Optional: Add seed data
npm run db:seed
```

4. **Start development server**
```bash
npm run dev
```

### Deployment

1. **Deploy to production**
```bash
npm run deploy
```

2. **Deploy to staging**
```bash
npm run deploy:staging
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `COINGECKO_API_KEY` | CoinGecko Pro API key | Optional |
| `COINMARKETCAP_API_KEY` | CoinMarketCap API key | Optional |
| `CRYPTOINTEL_DB` | D1 database binding | Required |
| `CRYPTOINTEL_CACHE` | KV namespace for caching | Required |

### Database Schema

The system uses D1 with the following main tables:

- **`signals`**: All detected signals from various sources
- **`market_data`**: Current and historical market information
- **`entity_mentions`**: Entity frequency and sentiment tracking
- **`transactions`**: x402 payment tracking
- **`user_analytics`**: User behavior analytics
- **`signal_patterns`**: ML pattern storage

See [`schema.sql`](schema.sql) for complete schema definition.

## 📚 Documentation

For comprehensive documentation, guides, and API references, visit our [`docs/`](docs/) folder:

- **[Documentation Index](docs/README.md)** - Full documentation structure and guides
- **[Enhanced Dashboard Guide](docs/dashboard-guide.md)** - Complete dashboard features and API reference
- **[Performance Optimization](docs/PERFORMANCE_OPTIMIZATION_SUMMARY.md)** - Database performance improvements and benchmarks
- **[Query Optimization Guide](docs/query-optimization.md)** - Comprehensive query performance guide
- **[CoinMarketCap DEX APIs](docs/coinmarketcap-dex-apis.md)** - Complete guide to CoinMarketCap's DEX API suite
- **[Query Quick Reference](docs/QUERY_PERFORMANCE_QUICK_REFERENCE.md)** - Fast query patterns and examples

## 📚 API Documentation

### Health Check
```http
GET /health
```

### Data Collection
```http
POST /collect
```
Triggers data collection from all configured sources.

### Get Signals
```http
GET /signals?limit=50&type=sentiment_shift&entity=bitcoin
```
Retrieve signals with optional filtering.

### Market Analysis
```http
GET /market-analysis?symbols=bitcoin,ethereum
```
Get current market analysis for specified symbols.

### x402 Analysis (Paid)
```http
POST /x402/analysis
```
Generate comprehensive analysis report (requires x402 payment).

### x402 Transaction Intelligence
```http
GET /x402/transactions
GET /x402/analytics
```
Monitor revenue, user behavior, and transaction patterns.

### Enhanced Dashboard APIs
```http
GET /enhanced-dashboard/api/stats
GET /enhanced-dashboard/api/signals
GET /enhanced-dashboard/api/market
GET /enhanced-dashboard/api/transactions
GET /enhanced-dashboard/api/entities
```
Real-time analytics with filtering and caching.

### Market Data (Cached)
```http
GET /market-data/:symbol
```
Get cached market data for a specific symbol.

## 🔄 Cron Jobs

The system runs automated data collection every 15 minutes:

```bash
# Cron schedule in wrangler.toml
[triggers]
crons = ["*/15 * * * *"]
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test test/index.test.js
```

## 📊 Monitoring & Analytics

### View Logs
```bash
npm run logs
```

### View Metrics
```bash
npm run metrics
```

### Database Operations
```bash
# Backup database
npm run db:backup

# View recent data
wrangler d1 execute CRYPTOINTEL_DB --command "SELECT * FROM signals ORDER BY timestamp DESC LIMIT 10"
```

## 🔒 Security

- **Rate Limiting**: Built-in rate limiting for all external APIs
- **CORS**: Configured for x402 ecosystem integration
- **Input Validation**: Comprehensive input validation and sanitization
- **Error Handling**: Graceful error handling with detailed logging

## 💰 x402 Integration

### Payment Flow
1. User initiates analysis request
2. System verifies x402 payment
3. Transaction logged for intelligence
4. Analysis report generated and delivered
5. Revenue tracked in transaction system

### Intelligence Benefits
- Track which analysis types sell best
- Monitor pricing optimization
- Analyze user behavior patterns
- Identify market gaps and opportunities

## 🚀 Performance Optimization

- **Database Performance**: 29+ composite indexes with 10-20x query improvement
- **Intelligent Caching**: 5-minute cache for market data with KV storage
- **Batch Processing**: Efficient batch API calls
- **Connection Pooling**: Optimized D1 database connections
- **Archival Strategy**: Automated data archival to maintain query performance
- **Compression**: Automatic response compression
- **Query Optimization**: Comprehensive performance guides and benchmarks

**Performance Targets Achieved:**
- Signal retrieval: <50ms (was 500-800ms)
- Market data queries: <25ms (was 200-400ms)
- Dashboard stats: <250ms (was 1000-2000ms)
- Entity aggregation: <100ms (was 800-1200ms)

## 🛠️ Development Workflow

1. **Feature Development**
   ```bash
   git checkout -b feature/new-signal-type
   # Make changes
   npm test
   npm run lint
   git commit -m "Add new signal type detection"
   ```

2. **Database Changes**
   ```bash
   # Create migration
   # Update schema.sql
   npm run db:migrate
   ```

3. **Testing**
   ```bash
   npm run build
   npm run test:coverage
   ```

## 🚀 Recent Achievements & Roadmap

### ✅ Priority 2: x402 Live Endpoints & Transaction Intelligence (COMPLETED)

**Completed Features:**
- **Live x402 Analysis Endpoints** - Paid analysis with payment verification
- **Transaction Intelligence Dashboard** - Real-time revenue and user analytics
- **Enhanced Analytics** - Revenue by tool, user behavior tracking, daily trends
- **Professional UI** - Dark mode, responsive design, interactive charts
- **Complete Integration** - Seamless x402 ecosystem integration

**Business Intelligence Capabilities:**
- Revenue optimization analytics
- Customer segmentation insights
- Usage pattern analysis
- Growth trend tracking

### 🔄 Current Development: DEX API Integration

The system is being enhanced with CoinMarketCap's complete DEX API v4 suite, providing comprehensive decentralized exchange data:

#### Available Endpoints (8 Total)

**Phase 1 APIs (Available):**
1. `/v4/dex/spot-pairs/latest` - Latest DEX spot trading pairs
2. `/v4/dex/pairs/quotes/latest` - Real-time DEX quotes
3. `/v4/dex/pairs/ohlcv/latest` - Latest OHLCV data

**Phase 2 APIs (Available):**
4. `/v4/dex/listings/quotes` - Comprehensive DEX listings with quotes
5. `/v4/dex/networks` - All blockchain networks with CoinMarketCap IDs
6. `/v4/dex/pairs/ohlcv/historical` - Historical OHLCV data for trend analysis
7. `/v4/dex/pairs/trade/latest` - Latest 100 trades per pair
8. `/v4/dex/listings/info` - Detailed DEX information

#### Integration Status

- [x] **API Documentation Complete** - Full DEX API guide available
- [x] **Database Schema Ready** - DEX tables designed with performance indexes
- [ ] **Implementation Pending** - Data collection functions to be added
- [ ] **Signal Type Integration** - DEX-specific signal detection
- [ ] **Testing & Validation** - Real-time data verification

#### Expected Benefits
- **1M free credits/month** during soft launch period
- **300 queries/minute** enhanced rate limit
- Real-time DEX data (Uniswap, PancakeSwap, SushiSwap, etc.)
- Historical data for backtesting and trend analysis
- Network-specific insights across multiple chains
- Arbitrage opportunity detection

### 🎯 Next Priority: Holiday Affiliate Site Automation

**Planned Features:**
- Automated affiliate content generation
- Holiday-themed crypto recommendations
- Revenue tracking and optimization
- SEO-optimized landing pages
- Social media integration

---

## 📈 Scaling Considerations

- **Horizontal Scaling**: Deploy multiple Workers behind load balancer
- **Database Scaling**: Use D1 read replicas for read-heavy workloads
- **Cache Strategy**: Implement multi-tier caching with KV and edge caching
- **Rate Limiting**: Implement distributed rate limiting for high traffic

## 🔍 Troubleshooting

### Common Issues

1. **Rate Limit Exceeded**
   - Check API key quotas
   - Verify rate limiting configuration
   - Monitor cache hit rates

2. **Database Connection Issues**
   - Verify D1 binding configuration
   - Check database migration status
   - Review query performance

3. **x402 Payment Failures**
   - Verify payment signature validation
   - Check transaction logging
   - Review payment gateway status

### Debug Mode

Enable debug logging:
```bash
wrangler dev --log-level debug
```

## 📝 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes with tests
4. Submit pull request with description

## 📞 Support

For issues and questions:
- Create GitHub issue
- Check logs with `npm run logs`
- Review documentation

---

**Built with ❤️ for the TradingMindset ecosystem**

**Version:** 2.0.0
**Last Updated:** 2025-11-30
**Status:** Production Ready with Priority 1 & 2 Complete