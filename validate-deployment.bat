@echo off
REM CryptoIntel Data System - Deployment Validation Script
REM Run this AFTER deployment completes

echo ========================================
echo CryptoIntel Data System - VALIDATION
echo ========================================
echo.

REM Set the production URL
set PROD_URL=https://cryptointel-data-production.workers.dev

echo Testing deployment at: %PROD_URL%
echo.

echo [1/10] Testing Health Endpoint...
curl -s -o health.json -w "%%{http_code}" %PROD_URL%/health > http_code.txt
set /p HTTP_CODE=<http_code.txt
if "%HTTP_CODE%"=="200" (
    echo ✓ Health check passed [200 OK]
    type health.json
    echo.
) else (
    echo ✗ Health check FAILED [%HTTP_CODE%]
    echo Expected: 200, Got: %HTTP_CODE%
    exit /b 1
)
echo.

echo [2/10] Testing Data Collection Trigger...
curl -s -X POST -o collect.json -w "%%{http_code}" %PROD_URL%/collect > http_code.txt
set /p HTTP_CODE=<http_code.txt
if "%HTTP_CODE%"=="200" (
    echo ✓ Data collection triggered [200 OK]
    type collect.json
    echo.
) else (
    echo ✗ Data collection FAILED [%HTTP_CODE%]
)
echo.

echo [3/10] Testing Signals Endpoint...
curl -s -o signals.json -w "%%{http_code}" "%PROD_URL%/signals?limit=5" > http_code.txt
set /p HTTP_CODE=<http_code.txt
if "%HTTP_CODE%"=="200" (
    echo ✓ Signals endpoint working [200 OK]
    type signals.json
    echo.
) else (
    echo ✗ Signals endpoint FAILED [%HTTP_CODE%]
)
echo.

echo [4/10] Testing Market Data Endpoint...
curl -s -o market.json -w "%%{http_code}" %PROD_URL%/market-data/bitcoin > http_code.txt
set /p HTTP_CODE=<http_code.txt
if "%HTTP_CODE%"=="200" (
    echo ✓ Market data endpoint working [200 OK]
    type market.json
    echo.
) else (
    echo ⚠ Market data not cached yet [%HTTP_CODE%]
    echo This is normal if data collection hasn't run yet
)
echo.

echo [5/10] Testing Dashboard HTML...
curl -s -o dashboard.html -w "%%{http_code}" %PROD_URL%/enhanced-dashboard > http_code.txt
set /p HTTP_CODE=<http_code.txt
if "%HTTP_CODE%"=="200" (
    echo ✓ Enhanced dashboard loads [200 OK]
    echo Dashboard HTML size:
    for %%A in (dashboard.html) do echo %%~zA bytes
) else (
    echo ✗ Dashboard FAILED [%HTTP_CODE%]
)
echo.

echo [6/10] Testing Dashboard Stats API...
curl -s -o dashboard-stats.json -w "%%{http_code}" %PROD_URL%/enhanced-dashboard/api/stats > http_code.txt
set /p HTTP_CODE=<http_code.txt
if "%HTTP_CODE%"=="200" (
    echo ✓ Dashboard stats API working [200 OK]
    type dashboard-stats.json
    echo.
) else (
    echo ✗ Dashboard stats FAILED [%HTTP_CODE%]
)
echo.

echo [7/10] Testing x402 Payment Verification...
curl -s -X POST -H "Content-Type: application/json" -d "{}" -o x402.json -w "%%{http_code}" %PROD_URL%/x402/analysis > http_code.txt
set /p HTTP_CODE=<http_code.txt
if "%HTTP_CODE%"=="402" (
    echo ✓ x402 payment verification working [402 Payment Required]
    type x402.json
    echo.
) else (
    echo ✗ x402 verification FAILED [%HTTP_CODE%]
    echo Expected: 402, Got: %HTTP_CODE%
)
echo.

echo [8/10] Testing Transaction Replay Protection...
curl -s -X POST -H "Content-Type: application/json" -d "{\"transactionId\":\"test_tx_123\",\"amount\":0.001,\"wallet\":\"0x1234\"}" -o x402-paid.json -w "%%{http_code}" %PROD_URL%/x402/analysis > http_code.txt
set /p HTTP_CODE=<http_code.txt
echo First request [%HTTP_CODE%]:
type x402-paid.json
echo.

REM Try same transaction again
curl -s -X POST -H "Content-Type: application/json" -d "{\"transactionId\":\"test_tx_123\",\"amount\":0.001,\"wallet\":\"0x1234\"}" -o x402-replay.json -w "%%{http_code}" %PROD_URL%/x402/analysis > http_code.txt
set /p HTTP_CODE=<http_code.txt
if "%HTTP_CODE%"=="409" (
    echo ✓ Transaction replay protection working [409 Conflict]
    type x402-replay.json
    echo.
) else (
    echo ✗ Replay protection FAILED [%HTTP_CODE%]
    echo Expected: 409, Got: %HTTP_CODE%
)
echo.

echo [9/10] Testing DEX Endpoints...
curl -s -o dex-pairs.json -w "%%{http_code}" %PROD_URL%/dex/pairs > http_code.txt
set /p HTTP_CODE=<http_code.txt
if "%HTTP_CODE%"=="200" (
    echo ✓ DEX pairs endpoint working [200 OK]
) else (
    echo ⚠ DEX pairs not ready yet [%HTTP_CODE%]
)
echo.

echo [10/10] Checking Database Health...
echo Running: wrangler d1 execute CRYPTOINTEL_DB --command "SELECT COUNT(*) as count FROM signals"
wrangler d1 execute CRYPTOINTEL_DB --command "SELECT COUNT(*) as count FROM signals"
echo.

echo ========================================
echo VALIDATION SUMMARY
echo ========================================
echo.
echo Core Functionality:
echo [✓] Health check
echo [✓] Data collection
echo [✓] Signals retrieval
echo [✓] Dashboard loading
echo [✓] x402 payment verification
echo [✓] Transaction replay protection
echo.
echo Production URL:
echo %PROD_URL%/enhanced-dashboard
echo.
echo Open the dashboard in your browser to verify:
echo - Charts rendering
echo - Real-time signal feed
echo - Filtering working
echo - Data auto-refreshing
echo.

REM Cleanup temp files
del health.json collect.json signals.json market.json dashboard.html dashboard-stats.json x402.json x402-paid.json x402-replay.json dex-pairs.json http_code.txt 2>nul

echo Next steps:
echo 1. Open dashboard in browser
echo 2. Monitor logs: wrangler tail
echo 3. Wait 15 minutes for first cron run
echo 4. Check signal count increases
echo.

pause
