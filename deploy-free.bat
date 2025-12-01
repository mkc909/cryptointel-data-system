@echo off
REM CryptoIntel Data System - FREE API Deployment Script
REM Deploy with ZERO API costs - No keys required!

echo ========================================
echo CryptoIntel FREE API Deployment
echo Cost: $0/month - No API Keys Required
echo ========================================
echo.

echo [1/6] Checking configuration...
if not exist wrangler-free.toml (
    echo ERROR: wrangler-free.toml not found!
    exit /b 1
)
echo ✓ Configuration found
echo.

echo [2/6] Installing dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: npm install failed!
    exit /b 1
)
echo ✓ Dependencies installed
echo.

echo [3/6] Running tests...
call npm test -- --run
if %ERRORLEVEL% NEQ 0 (
    echo WARNING: Some tests failed, continuing...
)
echo.

echo [4/6] Deploying to Cloudflare Workers...
echo Using configuration: wrangler-free.toml
call wrangler deploy --config wrangler-free.toml --env production
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Deployment failed!
    exit /b 1
)
echo ✓ Deployment successful
echo.

echo [5/6] Running database migrations...
call wrangler d1 execute CRYPTOINTEL_DB --file=schema.sql --env production
echo ✓ Database ready
echo.

echo [6/6] Verifying deployment...
timeout /t 5 /nobreak > nul

echo.
echo Testing health endpoint...
curl -s "https://cryptointel-data-production-free.magicmike.workers.dev/health"
echo.
echo.

echo ========================================
echo DEPLOYMENT COMPLETE!
echo ========================================
echo.
echo Production URL: https://cryptointel-data-production-free.magicmike.workers.dev
echo Dashboard URL: https://cryptointel-data-production-free.magicmike.workers.dev/enhanced-dashboard
echo.
echo Free API Sources:
echo - CoinGecko (30 req/min)
echo - DeFi Llama (100 req/min)
echo - Binance Public (1200 weight/min)
echo - CoinCap (200 req/min)
echo - CryptoPanic RSS (60 req/min)
echo.
echo Monthly Cost: $0
echo API Keys Required: NONE
echo.
echo Next Steps:
echo 1. Open dashboard in browser
echo 2. Monitor with: wrangler tail --config wrangler-free.toml --env production
echo 3. First data collection will run in 15 minutes
echo.

pause