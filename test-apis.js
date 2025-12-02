/**
 * Test script to verify all free API endpoints
 */

async function testAPI(name, url, options = {}) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${name}`);
  console.log(`URL: ${url}`);
  console.log('='.repeat(60));

  try {
    const startTime = Date.now();
    const response = await fetch(url, options);
    const duration = Date.now() - startTime;

    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Duration: ${duration}ms`);
    console.log(`Headers:`, Object.fromEntries(response.headers.entries()));

    if (response.ok) {
      const contentType = response.headers.get('content-type');
      let data;

      if (contentType?.includes('application/json')) {
        data = await response.json();
        console.log(`✅ SUCCESS - Got JSON data`);
        console.log(`Sample:`, JSON.stringify(data).slice(0, 500));
        if (Array.isArray(data)) {
          console.log(`Array length: ${data.length}`);
        } else if (data.data && Array.isArray(data.data)) {
          console.log(`Data array length: ${data.data.length}`);
        }
      } else if (contentType?.includes('text') || contentType?.includes('xml')) {
        data = await response.text();
        console.log(`✅ SUCCESS - Got text data`);
        console.log(`Length: ${data.length} characters`);
        console.log(`Sample:`, data.slice(0, 500));
      } else {
        console.log(`✅ SUCCESS - Got data with content-type: ${contentType}`);
      }

      return { success: true, status: response.status, duration, data };
    } else {
      const text = await response.text();
      console.log(`❌ FAILED - ${response.status} ${response.statusText}`);
      console.log(`Response body:`, text.slice(0, 500));
      return { success: false, status: response.status, error: text, duration };
    }
  } catch (error) {
    console.log(`❌ ERROR:`, error.message);
    return { success: false, error: error.message };
  }
}

async function runAllTests() {
  console.log('\n🔍 TESTING ALL FREE CRYPTO APIs\n');
  console.log('Testing started at:', new Date().toISOString());

  const results = {};

  // Test 1: CoinGecko - Simple Price (truly free, no key)
  results.coingecko_simple = await testAPI(
    'CoinGecko - Simple Price',
    'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true'
  );

  // Test 2: CoinGecko - Coins List (free)
  results.coingecko_list = await testAPI(
    'CoinGecko - Coins List',
    'https://api.coingecko.com/api/v3/coins/list'
  );

  // Test 3: CoinGecko - Trending
  results.coingecko_trending = await testAPI(
    'CoinGecko - Trending',
    'https://api.coingecko.com/api/v3/search/trending'
  );

  // Test 4: Binance Public
  results.binance = await testAPI(
    'Binance - 24hr Ticker',
    'https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT'
  );

  // Test 5: Binance Exchange Info
  results.binance_info = await testAPI(
    'Binance - Exchange Info',
    'https://api.binance.com/api/v3/exchangeInfo'
  );

  // Test 6: CoinCap
  results.coincap = await testAPI(
    'CoinCap - Assets',
    'https://api.coincap.io/v2/assets?limit=10'
  );

  // Test 7: DeFi Llama
  results.defillama = await testAPI(
    'DeFi Llama - Protocols',
    'https://api.llama.fi/protocols'
  );

  // Test 8: CryptoPanic RSS
  results.cryptopanic_rss = await testAPI(
    'CryptoPanic - RSS Feed',
    'https://cryptopanic.com/news/rss/'
  );

  // Test 9: Alternative.me Fear & Greed
  results.fear_greed = await testAPI(
    'Alternative.me - Fear & Greed Index',
    'https://api.alternative.me/fng/?limit=10'
  );

  // Test 10: CryptoCompare (free tier)
  results.cryptocompare = await testAPI(
    'CryptoCompare - Price',
    'https://min-api.cryptocompare.com/data/pricemultifull?fsyms=BTC,ETH&tsyms=USD'
  );

  // Test 11: Messari (free endpoints)
  results.messari = await testAPI(
    'Messari - Assets',
    'https://data.messari.io/api/v1/assets?limit=10'
  );

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));

  const total = Object.keys(results).length;
  const successful = Object.values(results).filter(r => r.success).length;
  const failed = total - successful;

  console.log(`\nTotal APIs tested: ${total}`);
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success rate: ${((successful/total) * 100).toFixed(1)}%`);

  console.log('\n📊 DETAILED RESULTS:\n');
  for (const [name, result] of Object.entries(results)) {
    const status = result.success ? '✅' : '❌';
    const duration = result.duration ? `${result.duration}ms` : 'N/A';
    console.log(`${status} ${name.padEnd(30)} - ${duration}`);
    if (!result.success) {
      console.log(`   Error: ${result.error?.slice(0, 100) || 'Unknown'}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Testing completed at:', new Date().toISOString());

  // Export results
  return results;
}

// Run tests
runAllTests().catch(console.error);
