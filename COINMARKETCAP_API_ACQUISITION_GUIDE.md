# CoinMarketCap API Acquisition Guide

## Overview

Step-by-step guide for acquiring CoinMarketCap Professional API key to enable DEX API v4 integration for TICKET-003.

## Prerequisites

1. **Budget Approval**: $299/month for Professional plan
2. **Payment Method**: Credit card or PayPal
3. **Account Information**: Valid email address
4. **Technical Requirements**: Cloudflare Workers access

## Acquisition Steps

### Step 1: Account Setup
1. Visit [CoinMarketCap API Portal](https://coinmarketcap.com/api/)
2. Click "Get Started" or "Sign Up"
3. Create account with:
   - Email address
   - Password
   - Company/Project name: "CryptoIntel Data System"
4. Verify email address

### Step 2: Plan Selection
1. Navigate to [Pricing Page](https://coinmarketcap.com/api/pricing/)
2. Select **Professional Plan** ($299/month)
3. Review features:
   - ✅ DEX API v4 access
   - ✅ 300,000 calls/month
   - ✅ Historical data (5 years)
   - ✅ Priority support

### Step 3: Payment Setup
1. Enter payment information
2. Select billing cycle (monthly recommended initially)
3. Review terms and conditions
4. Complete payment

### Step 4: API Key Generation
1. Navigate to Dashboard → API Keys
2. Click "Create New Key"
3. Configure key settings:
   - **Key Name**: "CryptoIntel-Production"
   - **Permissions**: Read access
   - **Rate Limits**: Default (Professional plan limits)
4. Copy generated API key
5. Store securely (password manager recommended)

### Step 5: Key Configuration
1. **API Key Format**: Typically 32-character alphanumeric string
2. **Example**: `b54bcf4d-1bca-4e8e-9a24-22ff2c3d462c`
3. **Security**: Never commit to version control
4. **Storage**: Use Cloudflare Workers secrets

## Cloudflare Workers Configuration

### Method 1: Using Wrangler CLI (Recommended)
```bash
# Set the API key as a secret
wrangler secret put COINMARKETCAP_API_KEY

# Enter the API key when prompted
# Verify the secret was set
wrangler secret list
```

### Method 2: Using Cloudflare Dashboard
1. Login to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to Workers & Pages
3. Select "CryptoIntel Data System" worker
4. Go to Settings → Variables
5. Add secret:
   - **Variable**: COINMARKETCAP_API_KEY
   - **Type**: Secret
   - **Value**: [Paste API key]

## Testing and Validation

### Step 1: Basic API Test
```bash
# Test the API key with a simple endpoint
curl -H "X-CMC_PRO_API_KEY: YOUR_API_KEY" \
     -H "Accept: application/json" \
     -d "id=1" \
     -G "https://pro-api.coinmarketcap.com/v1/cryptocurrency/info"
```

### Step 2: DEX API Test
```bash
# Test DEX endpoint access
curl -H "X-CMC_PRO_API_KEY: YOUR_API_KEY" \
     -H "Accept: application/json" \
     -G "https://pro-api.coinmarketcap.com/v4/dex/spot/pairs/latest"
```

### Step 3: Application Integration Test
1. Deploy updated code with API key
2. Test DEX endpoints in application
3. Verify rate limiting is working
4. Monitor API usage in CoinMarketCap dashboard

## Security Best Practices

### API Key Management
1. **Never commit** API keys to version control
2. **Use environment variables** or secrets management
3. **Rotate keys** regularly (every 90 days)
4. **Monitor usage** for unusual patterns
5. **Implement rate limiting** on application side

### Access Control
1. **IP Whitelisting**: Restrict to production servers
2. **Rate Limiting**: Implement client-side limits
3. **Error Handling**: Graceful degradation on API failures
4. **Logging**: Monitor API calls and responses

## Cost Management

### Usage Monitoring
1. **Daily Usage Check**: Monitor API call consumption
2. **Rate Limit Alerts**: Set up alerts for 80% usage
3. **Optimization**: Cache responses to reduce calls
4. **Plan Review**: Evaluate plan suitability monthly

### Budget Considerations
- **Monthly Cost**: $299
- **Annual Cost**: $3,588
- **Call Allocation**: 300,000 calls/month (~10,000/day)
- **DEX Usage**: ~43,200 calls/month (estimated)
- **Buffer**: 256,800 calls for other features

## Troubleshooting

### Common Issues
1. **Invalid API Key**: Verify key is correct and active
2. **Rate Limit Exceeded**: Implement better caching
3. **Plan Limitations**: Upgrade to higher tier if needed
4. **Network Issues**: Check firewall and DNS settings

### Error Codes
- **401**: Invalid API key
- **429**: Rate limit exceeded
- **403**: Insufficient permissions
- **500**: CoinMarketCap server error

## Rollback Plan

### If API Key Issues Occur
1. **Fallback to Free Sources**: Use existing free APIs
2. **Graceful Degradation**: Disable DEX features temporarily
3. **User Notification**: Inform users of limited functionality
4. **Quick Resolution**: Contact CoinMarketCap support

### Alternative Solutions
1. **Multiple Free APIs**: Combine CoinGecko, DeFi Llama, etc.
2. **Custom DEX APIs**: Build direct DEX integrations
3. **Third-party Providers**: Use alternative data providers

## Success Criteria

### Technical Validation
- [ ] API key successfully configured in Cloudflare Workers
- [ ] DEX API v4 endpoints accessible
- [ ] Rate limiting implemented and working
- [ ] Error handling for API failures
- [ ] Usage monitoring in place

### Business Validation
- [ ] Budget approved and payment processed
- [ ] API usage within plan limits
- [ ] DEX data quality meets requirements
- [ ] System performance maintained
- [ ] User experience not degraded

## Next Steps

1. **Immediate**: Acquire API key and configure in Cloudflare Workers
2. **Short-term**: Test DEX integration and monitor usage
3. **Medium-term**: Optimize API usage and caching
4. **Long-term**: Evaluate plan suitability and ROI

## Contact Information

### CoinMarketCap Support
- **Email**: api-support@coinmarketcap.com
- **Documentation**: https://coinmarketcap.com/api/documentation/
- **Status Page**: https://status.coinmarketcap.com/

### Internal Contacts
- **Technical Lead**: [Contact information]
- **Budget Approval**: [Contact information]
- **Emergency Contact**: [Contact information]

---

**Document Version**: 1.0  
**Last Updated**: 2025-12-02  
**Next Review**: 2025-12-09