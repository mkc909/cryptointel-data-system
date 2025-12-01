# Query Performance Quick Reference Card

**For:** CryptoIntel Data System Developers
**Updated:** 2025-11-29

## Quick Optimization Checklist

Before writing any database query, check these boxes:

- [ ] Added time window filter (WHERE timestamp > ...)
- [ ] Used exact match instead of LIKE where possible
- [ ] Added LIMIT clause to restrict result set
- [ ] Selected only needed columns (not SELECT *)
- [ ] Verified query uses appropriate index (EXPLAIN QUERY PLAN)
- [ ] Considered if data might be in archive tables

## Indexed Query Patterns (Fast)

### ✅ Signals Table

```sql
-- Entity-based retrieval (uses idx_signals_entity_timestamp)
SELECT id, entity, confidence_score, timestamp
FROM signals
WHERE entity = 'bitcoin'
  AND timestamp > strftime('%s', 'now', '-7 days')
ORDER BY timestamp DESC
LIMIT 50;

-- High-confidence signals (uses idx_signals_confidence_timestamp)
SELECT id, type, entity, confidence_score
FROM signals
WHERE confidence_score >= 0.8
  AND processed = FALSE
ORDER BY confidence_score DESC, timestamp DESC
LIMIT 20;

-- Type filtering (uses idx_signals_type_processed_timestamp)
SELECT id, entity, data, timestamp
FROM signals
WHERE type = 'volume_anomaly'
  AND processed = FALSE
  AND timestamp > strftime('%s', 'now', '-24 hours')
ORDER BY timestamp DESC
LIMIT 30;
```

### ✅ Market Data Table

```sql
-- Symbol time-series (uses idx_market_data_symbol_timestamp_desc)
SELECT symbol, price, volume_24h, price_change_24h, timestamp
FROM market_data
WHERE symbol = 'BTC'
  AND timestamp > strftime('%s', 'now', '-7 days')
ORDER BY timestamp DESC;

-- Multi-symbol query (uses idx_market_data_symbol_timestamp_desc)
SELECT symbol, price, volume_24h, market_cap
FROM market_data
WHERE symbol IN ('BTC', 'ETH', 'SOL')
  AND timestamp > strftime('%s', 'now', '-24 hours')
ORDER BY symbol, timestamp DESC;
```

### ✅ Entity Mentions Table

```sql
-- Top entities (uses idx_entity_mentions_timestamp_entity)
SELECT entity_name, entity_type, COUNT(*) as mentions, AVG(sentiment_score) as sentiment
FROM entity_mentions
WHERE timestamp > strftime('%s', 'now', '-7 days')
GROUP BY entity_name, entity_type
ORDER BY mentions DESC
LIMIT 10;

-- Signal-based entities (uses idx_entity_mentions_signal_id)
SELECT entity_name, entity_type, sentiment_score
FROM entity_mentions
WHERE signal_id = ?;
```

### ✅ Transactions Table

```sql
-- Revenue by tool (uses idx_transactions_status_tool_currency)
SELECT tool_id, currency, SUM(amount) as revenue, COUNT(*) as count
FROM transactions
WHERE status = 'confirmed'
  AND timestamp > strftime('%s', 'now', '-30 days')
GROUP BY tool_id, currency
ORDER BY revenue DESC;

-- User transactions (uses idx_transactions_wallet_timestamp)
SELECT id, tool_id, amount, currency, timestamp
FROM transactions
WHERE user_wallet = ?
  AND timestamp > strftime('%s', 'now', '-90 days')
ORDER BY timestamp DESC
LIMIT 50;
```

### ✅ DEX Tables

```sql
-- Volume leaders (uses idx_dex_pairs_network_volume)
SELECT dp.name, dp.volume_24h, dp.price, dn.name as network
FROM dex_pairs dp
LEFT JOIN dex_networks dn ON dp.network_id = dn.id
WHERE dp.volume_24h > 10000
  AND dp.last_updated > datetime('now', '-1 day')
ORDER BY dp.volume_24h DESC
LIMIT 20;

-- DEX signals (uses idx_dex_signals_type_pair_created)
SELECT signal_type, pair_id, details, confidence_score, created_at
FROM dex_signals
WHERE signal_type = 'dex_volume_anomaly'
  AND created_at > datetime('now', '-24 hours')
ORDER BY confidence_score DESC
LIMIT 25;
```

## Common Mistakes to Avoid

### ❌ No Time Filter
```sql
-- BAD: Scans entire table (slow)
SELECT * FROM signals WHERE entity = 'bitcoin';

-- GOOD: Time filter enables efficient range scan
SELECT * FROM signals
WHERE entity = 'bitcoin'
  AND timestamp > strftime('%s', 'now', '-7 days');
```

### ❌ Leading Wildcard in LIKE
```sql
-- BAD: Can't use index
SELECT * FROM signals WHERE entity LIKE '%bitcoin%';

-- GOOD: Exact match uses index
SELECT * FROM signals WHERE entity = 'bitcoin';

-- ACCEPTABLE: Trailing wildcard can use index
SELECT * FROM signals WHERE entity LIKE 'bitcoin%';
```

### ❌ OR Conditions
```sql
-- BAD: Prevents index usage
SELECT * FROM signals WHERE entity = 'bitcoin' OR entity = 'ethereum';

-- GOOD: Use IN clause or UNION
SELECT * FROM signals WHERE entity IN ('bitcoin', 'ethereum');
```

### ❌ Functions on Indexed Columns
```sql
-- BAD: Function prevents index usage
SELECT * FROM signals WHERE LOWER(entity) = 'bitcoin';

-- GOOD: Store normalized and query directly
SELECT * FROM signals WHERE entity = 'bitcoin';
```

### ❌ SELECT * Without LIMIT
```sql
-- BAD: Returns all rows (memory intensive)
SELECT * FROM signals WHERE processed = FALSE;

-- GOOD: Limit result set
SELECT id, entity, confidence_score
FROM signals
WHERE processed = FALSE
ORDER BY confidence_score DESC
LIMIT 50;
```

## Quick Performance Checks

### Check if Query Uses Index
```sql
EXPLAIN QUERY PLAN
SELECT * FROM signals
WHERE entity = 'bitcoin'
  AND timestamp > strftime('%s', 'now', '-7 days');

-- Look for: "USING INDEX idx_signals_entity_timestamp"
-- Avoid: "SCAN TABLE signals"
```

### List Available Indexes for Table
```sql
SELECT name FROM sqlite_master
WHERE type = 'index'
  AND tbl_name = 'signals'
ORDER BY name;
```

### Check Table Size
```sql
SELECT COUNT(*) as row_count FROM signals;
```

## Index Reference

| Table | Common Filters | Best Index |
|-------|---------------|------------|
| signals | entity + time | `idx_signals_entity_timestamp` |
| signals | confidence + time | `idx_signals_confidence_timestamp` |
| signals | type + processed + time | `idx_signals_type_processed_timestamp` |
| market_data | symbol + time | `idx_market_data_symbol_timestamp_desc` |
| entity_mentions | time + entity | `idx_entity_mentions_timestamp_entity` |
| entity_mentions | signal_id | `idx_entity_mentions_signal_id` |
| transactions | status + tool + currency | `idx_transactions_status_tool_currency` |
| transactions | wallet + time | `idx_transactions_wallet_timestamp` |
| dex_pairs | network + volume | `idx_dex_pairs_network_volume` |
| dex_signals | type + pair + time | `idx_dex_signals_type_pair_created` |

## Time Window Templates

```sql
-- Last hour
WHERE timestamp > strftime('%s', 'now', '-1 hour')

-- Last 24 hours
WHERE timestamp > strftime('%s', 'now', '-24 hours')
-- OR
WHERE timestamp > strftime('%s', 'now', '-1 day')

-- Last 7 days
WHERE timestamp > strftime('%s', 'now', '-7 days')

-- Last 30 days
WHERE timestamp > strftime('%s', 'now', '-30 days')

-- Last 90 days
WHERE timestamp > strftime('%s', 'now', '-90 days')

-- Specific date range
WHERE timestamp BETWEEN
  strftime('%s', '2025-01-01') AND
  strftime('%s', '2025-01-31')
```

## Archival Queries

### Query Active + Archived Data
```sql
-- Use unified view for seamless access
SELECT * FROM all_signals
WHERE entity = 'bitcoin'
  AND timestamp > strftime('%s', 'now', '-90 days')
ORDER BY timestamp DESC;
```

### Query Only Archived Data
```sql
-- Direct query to archive table
SELECT * FROM archived_signals
WHERE entity = 'bitcoin'
  AND timestamp BETWEEN
    strftime('%s', 'now', '-90 days') AND
    strftime('%s', 'now', '-30 days')
ORDER BY timestamp DESC;
```

## Performance Targets

| Query Type | Target | Alert If |
|------------|--------|----------|
| Simple lookup | <10ms | >25ms |
| Filtered query | <30ms | >75ms |
| Aggregation | <50ms | >150ms |
| Complex join | <100ms | >300ms |
| Dashboard stats | <200ms | >500ms |

## When to Use What

### Use Active Tables When:
- ✅ Querying data from last 7-30 days
- ✅ Need fastest performance
- ✅ Real-time analytics

### Use Archive Tables When:
- ✅ Historical analysis (>30 days old)
- ✅ Compliance/audit queries
- ✅ Long-term trend analysis

### Use Unified Views When:
- ✅ Need data across active + archive
- ✅ Don't know age of data
- ✅ Ad-hoc analysis queries

## Emergency Troubleshooting

### Query Taking Too Long?

1. **Add EXPLAIN QUERY PLAN:**
   ```sql
   EXPLAIN QUERY PLAN [your query here]
   ```

2. **Check for table scan:**
   - If you see "SCAN TABLE", query needs optimization
   - Add appropriate WHERE filters or verify index exists

3. **Add time window:**
   - Most queries should have timestamp filter
   - Reduces data scanned by 80-95%

4. **Check LIMIT clause:**
   - Always limit result sets in production
   - Use pagination for large datasets

5. **Run ANALYZE:**
   ```bash
   wrangler d1 execute CRYPTOINTEL_DB --command="ANALYZE"
   ```

### Index Not Being Used?

1. **Verify index exists:**
   ```sql
   SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='signals';
   ```

2. **Check column data types match**
   - Integer vs. Text mismatch prevents index usage

3. **Remove function calls from WHERE clause**
   - LOWER(), UPPER(), etc. prevent index usage

4. **Use exact match instead of LIKE**
   - Or use trailing wildcard only (e.g., 'bitcoin%')

## Getting Help

- **Full Documentation:** `docs/query-optimization.md`
- **Performance Summary:** `docs/PERFORMANCE_OPTIMIZATION_SUMMARY.md`
- **Migrations:** `migrations/001_performance_indexes.sql`, `migrations/002_archival_strategy.sql`
- **Project Guide:** `CLAUDE.md`

---

**Pro Tip:** Always test queries with EXPLAIN QUERY PLAN before deploying to production!
