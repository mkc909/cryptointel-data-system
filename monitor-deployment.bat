@echo off
REM CryptoIntel Data System - Real-time Deployment Monitoring
REM Run this to watch logs and metrics as deployment happens

echo ========================================
echo CryptoIntel - Deployment Monitoring
echo ========================================
echo.

echo Starting real-time log monitoring...
echo Press Ctrl+C to stop
echo.
echo Watching for:
echo - "Running scheduled data collection"
echo - Error messages
echo - API requests
echo - Database operations
echo.

wrangler tail --format pretty
