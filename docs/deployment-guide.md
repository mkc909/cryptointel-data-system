# Deployment Guide

## Overview

This guide covers the deployment process for the CryptoIntel Data System, including local development, staging, and production environments using Cloudflare Workers and D1 database.

## Prerequisites

### Required Tools
- **Node.js** (v18 or higher)
- **npm** (v9 or higher)
- **Wrangler CLI** (v3 or higher)
- **Git** for version control
- **Cloudflare Account** with Workers and D1 enabled

### Environment Setup

```bash
# Install Wrangler CLI
npm install -g wrangler

# Authenticate with Cloudflare
wrangler auth login

# Verify installation
wrangler whoami
```

---

## Project Structure

```
cryptointel-data-system/
├── src/
│   ├── index.js                 # Main application entry
│   ├── dashboard.js             # Dashboard functionality
│   ├── enhanced-dashboard.js    # Enhanced dashboard with analytics
│   └── intelligence-dashboard.js # Intelligence dashboard
├── docs/                        # Documentation
├── test/                        # Test files
├── scripts/                     # Deployment scripts
├── migrations/                  # Database migrations
├── data/                        # Local database files
├── package.json                 # Dependencies
├── wrangler.toml               # Cloudflare configuration
└── .env.example                # Environment variables template
```

---

## Environment Configuration

### Environment Variables

Create a `.env` file in the project root:

```bash
# API Keys (set via wrangler secrets for production)
COINGECKO_API_KEY=your_coingecko_api_key
COINMARKETCAP_API_KEY=your_coinmarketcap_api_key
DEFILLAMA_API_KEY=your_defillama_api_key
CRYPTOPANIC_API_KEY=your_cryptopanic_api_key

# Database Configuration
DATABASE_ID=your_d1_database_id
DATABASE_NAME=CRYPTOINTEL_DB

# KV Namespace IDs
KV_NAMESPACE_ID=your_kv_namespace_id
KV_PREVIEW_NAMESPACE_ID=your_kv_preview_namespace_id

# Application Settings
NODE_ENV=development
LOG_LEVEL=info
RATE_LIMIT_REQUESTS_PER_MINUTE=100

# x402 Payment Configuration
X402_PAYMENT_ENABLED=true
X402_DEFAULT_AMOUNT=0.01
X402_CURRENCY=USD
```

### Wrangler Configuration

The `wrangler.toml` file contains the Cloudflare Workers configuration:

```toml
name = "cryptointel-data-system"
main = "src/index.js"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

# Environment variables
[vars]
ENVIRONMENT = "development"
LOG_LEVEL = "info"

# KV Namespaces
[[kv_namespaces]]
binding = "CACHE"
id = "your_kv_namespace_id"
preview_id = "your_kv_preview_namespace_id"

# D1 Database
[[d1_databases]]
binding = "DB"
database_name = "CRYPTOINTEL_DB"
database_id = "your_database_id"

# Cron triggers for automated data collection
[[triggers]]
crons = ["*/15 * * * *"]  # Every 15 minutes

# Environment-specific configurations
[env.staging]
name = "cryptointel-staging"
vars = { ENVIRONMENT = "staging" }

[env.production]
name = "cryptointel-production"
vars = { ENVIRONMENT = "production" }
```

---

## Local Development

### Setup

```bash
# Clone the repository
git clone https://github.com/your-org/cryptointel-data-system.git
cd cryptointel-data-system

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
```

### Database Setup

```bash
# Create D1 database
wrangler d1 create CRYPTOINTEL_DB

# Update wrangler.toml with the database ID
# Run database migrations
wrangler d1 execute CRYPTOINTEL_DB --file=migrations/001_initial_schema.sql
wrangler d1 execute CRYPTOINTEL_DB --file=migrations/002_performance_indexes.sql
wrangler d1 execute CRYPTOINTEL_DB --file=migrations/003_user_analytics.sql
wrangler d1 execute CRYPTOINTEL_DB --file=migrations/004_archival_strategy.sql

# Seed database with initial data
wrangler d1 execute CRYPTOINTEL_DB --file=seed.sql
```

### Running Locally

```bash
# Start development server
npm run dev

# Or with Wrangler directly
wrangler dev

# With specific environment
wrangler dev --env staging
```

The development server will be available at `http://localhost:8787`

### Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- test/dex-api.test.js

# Run tests with coverage
npm run test:coverage

# Run integration tests
npm run test:integration
```

---

## Staging Deployment

### Preparation

```bash
# Ensure all tests pass
npm test

# Build the application
npm run build

# Run linting
npm run lint

# Check for security vulnerabilities
npm audit
```

### Deploy to Staging

```bash
# Deploy to staging environment
npm run deploy:staging

# Or with Wrangler
wrangler deploy --env staging

# Set production secrets for staging
wrangler secret put COINGECKO_API_KEY --env staging
wrangler secret put COINMARKETCAP_API_KEY --env staging
wrangler secret put DEFILLAMA_API_KEY --env staging
wrangler secret put CRYPTOPANIC_API_KEY --env staging
```

### Staging Validation

```bash
# Run staging tests
npm run test:staging

# Validate deployment
npm run validate:staging

# Check health endpoint
curl https://cryptointel-staging.workers.dev/api/v1/health
```

---

## Production Deployment

### Pre-deployment Checklist

- [ ] All tests passing in staging
- [ ] Security audit completed
- [ ] Performance benchmarks met
- [ ] Database migrations tested
- [ ] Backup strategy verified
- [ ] Monitoring configured
- [ ] Rollback plan prepared

### Deployment Process

```bash
# Create production branch
git checkout -b production-deploy
git merge main

# Run final tests
npm test

# Deploy to production
npm run deploy:production

# Or with Wrangler
wrangler deploy --env production
```

### Production Secrets

```bash
# Set production secrets
wrangler secret put COINGECKO_API_KEY --env production
wrangler secret put COINMARKETCAP_API_KEY --env production
wrangler secret put DEFILLAMA_API_KEY --env production
wrangler secret put CRYPTOPANIC_API_KEY --env production

# Set payment configuration
wrangler secret put X402_PAYMENT_ENABLED --env production
wrangler secret put X402_DEFAULT_AMOUNT --env production
wrangler secret put X402_CURRENCY --env production
```

### Post-deployment Validation

```bash
# Validate production deployment
npm run validate:production

# Check health endpoint
curl https://cryptointel-data-system.workers.dev/api/v1/health

# Run smoke tests
npm run test:smoke

# Monitor logs
wrangler tail --env production
```

---

## Database Migrations

### Creating New Migrations

```bash
# Create new migration file
touch migrations/005_new_feature.sql

# Add migration SQL
# Example:
-- Add new table
CREATE TABLE new_feature (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes
CREATE INDEX idx_new_feature_name ON new_feature(name);
```

### Running Migrations

```bash
# Run specific migration
wrangler d1 execute CRYPTOINTEL_DB --file=migrations/005_new_feature.sql

# Run all pending migrations
npm run migrate

# Run migrations for specific environment
npm run migrate:production
```

### Migration Rollback

```bash
# Create rollback migration
touch migrations/005_rollback_new_feature.sql

# Add rollback SQL
DROP TABLE IF EXISTS new_feature;

# Run rollback
wrangler d1 execute CRYPTOINTEL_DB --file=migrations/005_rollback_new_feature.sql
```

---

## Monitoring and Logging

### Log Management

```bash
# View real-time logs
wrangler tail

# View logs for specific environment
wrangler tail --env production

# Filter logs by level
wrangler tail --level error

# Export logs
wrangler tail --format json > logs.json
```

### Performance Monitoring

```bash
# Check worker performance
wrangler tail --format pretty | grep "response_time"

# Monitor database queries
wrangler d1 execute CRYPTOINTEL_DB --command="EXPLAIN QUERY PLAN SELECT * FROM market_data WHERE symbol = 'BTC'"

# Check KV cache performance
wrangler kv:key list --namespace-id=your_kv_namespace_id
```

### Health Checks

```bash
# Automated health check script
npm run health-check

# Custom health check
curl -f https://cryptointel-data-system.workers.dev/api/v1/health || exit 1
```

---

## Scaling and Performance

### Auto-scaling Configuration

The system automatically scales with Cloudflare Workers, but you can optimize:

```toml# wrangler.toml
# Configure limits
[limits]
cpu_ms = 50000  # 50 seconds
memory_mb = 128  # 128MB

# Configure placement
[placement]
mode = "smart"
```

### Performance Optimization

```bash
# Enable caching headers
# In your code:
response.headers.set('Cache-Control', 'public, max-age=300');

# Optimize database queries
# Use prepared statements and indexes

# Configure KV caching
# Set appropriate TTL values
```

### Load Testing

```bash
# Install load testing tool
npm install -g artillery

# Run load test
artillery run load-test-config.yml

# Monitor during load test
wrangler tail --format json | jq '.timestamp, .level, .message'
```

---

## Security Configuration

### API Security

```bash
# Set secure headers
# In your code:
response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
response.headers.set('X-Content-Type-Options', 'nosniff');
response.headers.set('X-Frame-Options', 'DENY');
```

### Secret Management

```bash
# List all secrets
wrangler secret list

# Update secret
wrangler secret put API_KEY

# Delete secret
wrangler secret delete API_KEY

# Rotate secrets regularly
npm run rotate-secrets
```

### Access Control

```bash
# Configure IP allowlists (if needed)
# In wrangler.toml:
[env.production]
routes = [
  { pattern = "your-domain.com/*", zone_name = "your-domain.com" }
]
```

---

## Backup and Recovery

### Database Backups

```bash
# Export database
wrangler d1 export CRYPTOINTEL_DB --output=backup.sql

# Schedule regular backups
# Add to cron:
0 2 * * * wrangler d1 export CRYPTOINTEL_DB --output=backup-$(date +\%Y\%m\%d).sql

# Import database
wrangler d1 import CRYPTOINTEL_DB backup.sql
```

### Disaster Recovery

```bash
# Recovery script
npm run disaster-recovery

# Manual recovery steps:
# 1. Restore database from backup
# 2. Redeploy application
# 3. Verify all services
# 4. Monitor for issues
```

---

## Troubleshooting

### Common Issues

#### 1. Deployment Failures
```bash
# Check wrangler version
wrangler --version

# Clear cache
wrangler clean

# Check configuration
wrangler validate
```

#### 2. Database Connection Issues
```bash
# Check database status
wrangler d1 info CRYPTOINTEL_DB

# Test database connection
wrangler d1 execute CRYPTOINTEL_DB --command="SELECT 1"

# Check database permissions
wrangler d1 execute CRYPTOINTEL_DB --command="PRAGMA table_list"
```

#### 3. Performance Issues
```bash
# Check worker logs
wrangler tail --level error

# Monitor response times
curl -w "@curl-format.txt" https://cryptointel-data-system.workers.dev/api/v1/health

# Analyze database queries
wrangler d1 execute CRYPTOINTEL_DB --command="EXPLAIN QUERY PLAN SELECT * FROM market_data LIMIT 10"
```

### Debug Mode

```bash
# Enable debug logging
wrangler dev --log-level debug

# Set debug environment variable
wrangler secret put DEBUG_MODE --env production

# Debug specific requests
curl -H "Debug: true" https://cryptointel-data-system.workers.dev/api/v1/market-data/BTC
```

---

## CI/CD Pipeline

### GitHub Actions Configuration

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloudflare Workers

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npm run lint

  deploy-staging:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/staging'
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - name: Deploy to Staging
        run: npm run deploy:staging
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}

  deploy-production:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - name: Deploy to Production
        run: npm run deploy:production
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

### Environment Secrets

Set up GitHub repository secrets:

- `CLOUDFLARE_API_TOKEN`: Cloudflare API token
- `COINGECKO_API_KEY`: CoinGecko API key
- `COINMARKETCAP_API_KEY`: CoinMarketCap API key
- `DEFILLAMA_API_KEY`: DeFi Llama API key
- `CRYPTOPANIC_API_KEY`: CryptoPanic API key

---

## Maintenance

### Regular Tasks

```bash
# Weekly maintenance
npm run maintenance:weekly

# Monthly maintenance
npm run maintenance:monthly

# Update dependencies
npm update
npm audit fix

# Clean up old logs
wrangler tail --since 7d --format json > old-logs.json
```

### Performance Tuning

```bash
# Analyze performance
npm run analyze:performance

# Optimize database
wrangler d1 execute CRYPTOINTEL_DB --command="VACUUM"
wrangler d1 execute CRYPTOINTEL_DB --command="ANALYZE"

# Update indexes
npm run update:indexes
```

---

**Last Updated:** 2025-11-30  
**Deployment Guide Version:** v2.0.0  
**Next Review:** Post-Priority 3 completion