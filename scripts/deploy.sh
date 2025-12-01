#!/bin/bash

# CryptoIntel Data System Deployment Script
# Automates deployment to Cloudflare Workers with database setup

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
WORKER_NAME="cryptointel-data-system"
DB_NAME="CRYPTOINTEL_DB"
KV_NAME="CRYPTOINTEL_CACHE"

echo -e "${BLUE}🚀 CryptoIntel Data System Deployment${NC}"
echo "=================================="

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"

if ! command_exists wrangler; then
    echo -e "${RED}❌ Wrangler CLI not found. Please install it with: npm install -g wrangler${NC}"
    exit 1
fi

if ! command_exists node; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js 18+${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"

# Check if user is logged in to Cloudflare
echo -e "${YELLOW}🔐 Checking Cloudflare authentication...${NC}"
if ! wrangler whoami &>/dev/null; then
    echo -e "${RED}❌ Not logged in to Cloudflare. Please run: wrangler login${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Cloudflare authentication confirmed${NC}"

# Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm install

echo -e "${GREEN}✅ Dependencies installed${NC}"

# Run tests
echo -e "${YELLOW}🧪 Running tests...${NC}"
npm test

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Tests failed. Please fix issues before deploying.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Tests passed${NC}"

# Create D1 database if it doesn't exist
echo -e "${YELLOW}🗄️ Setting up D1 database...${NC}"

if ! wrangler d1 list | grep -q "$DB_NAME"; then
    echo "Creating D1 database: $DB_NAME"
    wrangler d1 create "$DB_NAME"
    echo -e "${GREEN}✅ D1 database created${NC}"
else
    echo -e "${GREEN}✅ D1 database already exists${NC}"
fi

# Create KV namespace if it doesn't exist
echo -e "${YELLOW}💾 Setting up KV namespace...${NC}"

if ! wrangler kv:namespace list | grep -q "$KV_NAME"; then
    echo "Creating KV namespace: $KV_NAME"
    wrangler kv:namespace create "$KV_NAME"
    echo -e "${GREEN}✅ KV namespace created${NC}"
else
    echo -e "${GREEN}✅ KV namespace already exists${NC}"
fi

# Run database migrations
echo -e "${YELLOW}🔄 Running database migrations...${NC}"
wrangler d1 execute "$DB_NAME" --file=schema.sql

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Database migration failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Database migrations completed${NC}"

# Set up secrets (prompt for API keys)
echo -e "${YELLOW}🔑 Setting up secrets...${NC}"

read -p "Enter CoinGecko API Key (optional, press Enter to skip): " COINGECKO_KEY
if [ ! -z "$COINGECKO_KEY" ]; then
    echo "$COINGECKO_KEY" | wrangler secret put COINGECKO_API_KEY
    echo -e "${GREEN}✅ CoinGecko API key set${NC}"
fi

read -p "Enter CoinMarketCap API Key (optional, press Enter to skip): " CMC_KEY
if [ ! -z "$CMC_KEY" ]; then
    echo "$CMC_KEY" | wrangler secret put COINMARKETCAP_API_KEY
    echo -e "${GREEN}✅ CoinMarketCap API key set${NC}"
fi

# Deploy to staging first
echo -e "${YELLOW}🚀 Deploying to staging...${NC}"
wrangler deploy --env staging

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Staging deployment failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Staging deployment successful${NC}"

# Test staging deployment
echo -e "${YELLOW}🧪 Testing staging deployment...${NC}"
STAGING_URL=$(wrangler whoami --env staging | grep "Worker URL" | awk '{print $3}')

if [ ! -z "$STAGING_URL" ]; then
    # Test health endpoint
    if curl -f "$STAGING_URL/health" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Staging health check passed${NC}"
    else
        echo -e "${RED}❌ Staging health check failed${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️ Could not determine staging URL, skipping health check${NC}"
fi

# Deploy to production
echo -e "${YELLOW}🚀 Deploying to production...${NC}"
read -p "Continue with production deployment? (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    wrangler deploy

    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Production deployment failed${NC}"
        exit 1
    fi

    echo -e "${GREEN}✅ Production deployment successful${NC}"

    # Test production deployment
    echo -e "${YELLOW}🧪 Testing production deployment...${NC}"
    PROD_URL=$(wrangler whoami | grep "Worker URL" | awk '{print $3}')

    if [ ! -z "$PROD_URL" ]; then
        # Test health endpoint
        if curl -f "$PROD_URL/health" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Production health check passed${NC}"
        else
            echo -e "${RED}❌ Production health check failed${NC}"
            exit 1
        fi

        # Test data collection
        echo -e "${YELLOW}🔄 Testing data collection...${NC}"
        COLLECT_RESPONSE=$(curl -s -X POST "$PROD_URL/collect" | jq '.success' 2>/dev/null)

        if [ "$COLLECT_RESPONSE" = "true" ]; then
            echo -e "${GREEN}✅ Data collection test passed${NC}"
        else
            echo -e "${YELLOW}⚠️ Data collection test failed (may need API keys)${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️ Could not determine production URL, skipping health check${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ Production deployment skipped${NC}"
fi

# Set up cron triggers
echo -e "${YELLOW}⏰ Setting up cron triggers...${NC}"
echo "Cron triggers are configured in wrangler.toml and will be activated automatically."

# Display deployment summary
echo -e "${BLUE}📊 Deployment Summary${NC}"
echo "===================="
echo "Worker: $WORKER_NAME"
echo "Database: $DB_NAME"
echo "Cache: $KV_NAME"
echo "Environment: Production"

if [ ! -z "$PROD_URL" ]; then
    echo "URL: $PROD_URL"
    echo ""
    echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Test the API endpoints"
    echo "2. Monitor logs with: npm run logs"
    echo "3. Set up monitoring and alerts"
    echo "4. Configure additional data sources if needed"
else
    echo -e "${YELLOW}⚠️ Deployment completed but URL verification failed${NC}"
fi

echo ""
echo "Useful commands:"
echo "- View logs: npm run logs"
echo "- View metrics: npm run metrics"
echo "- Database backup: npm run db:backup"
echo "- Test locally: npm run dev"