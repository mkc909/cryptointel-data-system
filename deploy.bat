@echo off
REM CryptoIntel Data System - Production Deployment Script
REM Run this from Windows Command Prompt or PowerShell

echo ========================================
echo CryptoIntel Data System - DEPLOYMENT
echo ========================================
echo.

echo [1/4] Checking environment...
call npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: npm not found. Please install Node.js
    exit /b 1
)

call wrangler --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: wrangler not found. Please install: npm install -g wrangler
    exit /b 1
)

echo ✓ npm and wrangler found
echo.

echo [2/4] Applying database migrations...
call npm run db:migrate
if %errorlevel% neq 0 (
    echo ERROR: Database migration failed
    exit /b 1
)
echo ✓ Database migrated
echo.

echo [3/4] Deploying to Cloudflare Workers...
call npm run deploy
if %errorlevel% neq 0 (
    echo ERROR: Deployment failed
    exit /b 1
)
echo ✓ Deployed successfully
echo.

echo [4/4] Checking deployment status...
call wrangler deployments list
echo.

echo ========================================
echo DEPLOYMENT COMPLETE! 🚀
echo ========================================
echo.
echo Your application is live at:
echo https://cryptointel-data-production.workers.dev/
echo.
echo Dashboard:
echo https://cryptointel-data-production.workers.dev/enhanced-dashboard
echo.
echo Next steps:
echo 1. Test health endpoint: curl https://cryptointel-data-production.workers.dev/health
echo 2. Trigger data collection: curl -X POST https://cryptointel-data-production.workers.dev/collect
echo 3. Open dashboard in browser
echo.

pause
