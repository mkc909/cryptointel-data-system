# TICKET-001: Complete DEX API Integration

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
- [x] High (P1)
- [ ] Medium (P2)
- [ ] Low (P3)

## Description
Implement all 8 CoinMarketCap DEX API v4 endpoints to enhance market intelligence capabilities with decentralized exchange data.

## Acceptance Criteria
- [ ] All 8 DEX API endpoints integrated
- [ ] Rate limiting properly implemented (300 queries/minute)
- [ ] Data caching with 5-minute TTL
- [ ] Error handling and retry logic
- [ ] Unit tests with >80% coverage
- [ ] Integration tests for each endpoint
- [ ] Documentation updated
- [ ] Signal detection for DEX-specific patterns

## Technical Details

### Implementation Plan
1. **Phase 1: Core Infrastructure**
   - Add DEX API configuration to `src/index.js`
   - Create `fetchDEXData()` function with rate limiting
   - Implement caching strategy in KV namespace

2. **Phase 2: Endpoint Implementation**
   - `/v4/dex/spot-pairs/latest` - Real-time spot pairs
   - `/v4/dex/networks/list` - Network identification
   - `/v4/dex/listings/quotes` - DEX exchange listings
   - `/v4/dex/pairs/ohlcv/historical` - Historical OHLCV data
   - 4 additional endpoints from Phase 1 & 2

3. **Phase 3: Signal Detection**
   - DEX volume anomalies
   - New pair listings detection
   - Liquidity shifts monitoring
   - Cross-chain activity patterns

4. **Phase 4: Testing & Documentation**
   - Unit tests for each endpoint
   - Integration tests with mock data
   - Update API documentation
   - Performance benchmarking

### Files to Modify
- [ ] `src/index.js` - Add DEX data collection functions
- [ ] `schema.sql` - Add DEX-specific tables (dex_pairs, dex_networks, dex_signals)
- [ ] `test/index.test.js` - Add DEX API test suite
- [ ] `scripts/test.sh` - Add DEX API integration tests
- [ ] `docs/coinmarketcap-dex-apis.md` - Update implementation status
- [ ] `README.md` - Document new DEX capabilities
- [ ] `wrangler.toml` - Verify rate limits configuration

### Dependencies
- CoinMarketCap API key (already configured)
- KV namespace for caching (existing)
- D1 database for storage (existing)

### Database Schema Changes
```sql
-- New tables for DEX data
CREATE TABLE dex_pairs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    base_currency_id INTEGER,
    quote_currency_id INTEGER,
    network_id TEXT,
    dex_id TEXT,
    price REAL,
    volume_24h REAL,
    liquidity REAL,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE dex_networks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    chain_id INTEGER,
    native_currency_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE dex_signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    signal_type TEXT NOT NULL,
    dex_id TEXT,
    pair_id TEXT,
    network_id TEXT,
    details TEXT,
    confidence_score REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Testing Plan
- [ ] Unit tests for each DEX endpoint function
- [ ] Integration tests with real API (limited calls)
- [ ] Mock data tests for rate limit scenarios
- [ ] Performance tests (response time <1000ms)
- [ ] Error handling tests (network failures, rate limits)
- [ ] Cache hit/miss ratio testing
- [ ] Signal detection accuracy testing

## Worktree Setup
```bash
git worktree add .tickets/worktrees/TICKET-001 -b feature/TICKET-001-dex-api-integration
cd .tickets/worktrees/TICKET-001
npm install
npm run dev
```

## Related Issues/PRs
- GitHub Issue: #TBD
- Relates to: coinmarketcap-dex-apis.md documentation
- Blocks: Advanced signal detection features

## Notes
- Use 1 million free credits wisely during soft launch
- Monitor credit usage closely
- Consider implementing request batching
- Cache historical data aggressively
- Prepare for hard launch pricing changes

## Completion Checklist
- [ ] All 8 endpoints implemented
- [ ] Tests written and passing
- [ ] Documentation updated
- [ ] Performance benchmarks met
- [ ] Code reviewed
- [ ] Branch merged
- [ ] Worktree removed
- [ ] Ticket archived

## Time Tracking
- Estimated: 16 hours
- Actual: TBD
- Started: 2025-11-27
- Completed: YYYY-MM-DD

## Implementation Progress
### Endpoints Status
- [ ] `/v4/dex/spot-pairs/latest`
- [ ] `/v4/dex/networks/list`
- [ ] `/v4/dex/listings/quotes`
- [ ] `/v4/dex/pairs/ohlcv/historical`
- [ ] Phase 1 Endpoint 3
- [ ] Phase 2 Endpoint 5
- [ ] Phase 2 Endpoint 6
- [ ] Phase 2 Endpoint 7

### Signal Types Added
- [ ] `dex_volume_anomaly`
- [ ] `dex_new_pair`
- [ ] `dex_liquidity_shift`
- [ ] `dex_arbitrage_opportunity`