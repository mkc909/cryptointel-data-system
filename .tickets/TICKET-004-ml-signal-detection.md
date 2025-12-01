# TICKET-004: Begin ML-Based Signal Detection (Issue #2)

**Status:** Not Started
**Priority:** HIGH
**Estimated Time:** 2-3 weeks
**Assigned To:** [Unassigned]
**Created:** 2025-12-01
**Due Date:** 2025-12-22
**GitHub Issue:** #2

---

## Objectives

Implement machine learning algorithms for enhanced signal detection using Cloudflare Workers AI to improve accuracy, reduce false positives, and provide better confidence scoring.

---

## Success Criteria

- [ ] ML models integrated with signal detection pipeline
- [ ] Confidence scores improved by 20%+ compared to baseline
- [ ] False positive rate reduced by 30%+
- [ ] Performance remains under 50ms p95 for ML inference
- [ ] Historical data used for pattern training
- [ ] A/B testing shows improvement over rule-based system
- [ ] Documentation updated with ML methodology

---

## Dependencies

**Requires:**
- Cloudflare Workers AI binding configured
- Historical signal data (at least 1 week of production data)
- Baseline metrics from current rule-based system (TICKET-008)

**Blocks:**
- Advanced pattern recognition features
- Automated content generation improvements
- Predictive analytics capabilities

---

## Implementation Steps

### Phase 1: Research and Planning (Week 1 - 8 hours)

1. **Review Cloudflare Workers AI Models**
   - Text generation: `@cf/meta/llama-2-7b-chat-int8`
   - Embeddings: `@cf/baai/bge-base-en-v1.5`
   - Classification: `@cf/huggingface/distilbert-sst-2-int8`
   - Sentiment: `@cf/huggingface/distilbert-sst-2-int8`

2. **Define ML Use Cases**
   - **News Sentiment Enhancement:** Better sentiment scoring from CryptoPanic
   - **Pattern Recognition:** Identify recurring market patterns
   - **Entity Classification:** Improve entity extraction accuracy
   - **Anomaly Detection:** ML-based volume/TVL anomaly scoring
   - **Signal Validation:** Predict signal reliability

3. **Collect Baseline Metrics**
   ```sql
   -- Current signal statistics
   SELECT
     signal_type,
     COUNT(*) as total_signals,
     AVG(confidence_score) as avg_confidence,
     COUNT(DISTINCT source) as sources
   FROM signals
   WHERE timestamp > strftime('%s', 'now', '-7 days')
   GROUP BY signal_type
   ```

4. **Design ML Architecture**
   ```
   Data Collection → Feature Extraction → ML Model → Signal Enhancement → Storage
                                              ↓
                                      Workers AI Binding
                                              ↓
                                    (Llama 2, DistilBERT, BGE)
   ```

### Phase 2: Setup Workers AI (Week 1 - 4 hours)

5. **Configure Workers AI Binding**

   Update `wrangler.toml`:
   ```toml
   [ai]
   binding = "AI"
   ```

6. **Test Workers AI Connection**
   ```javascript
   // Test file: test-workers-ai.js
   export default {
     async fetch(request, env) {
       const response = await env.AI.run('@cf/meta/llama-2-7b-chat-int8', {
         messages: [{ role: 'user', content: 'Hello!' }]
       });
       return Response.json(response);
     }
   }
   ```

7. **Implement AI Service Layer**

   Create `src/ml/ai-service.js`:
   ```javascript
   export class AIService {
     constructor(aiBinding) {
       this.ai = aiBinding;
     }

     async analyzeSentiment(text) {
       // Use DistilBERT for sentiment
     }

     async generateEmbedding(text) {
       // Use BGE for embeddings
     }

     async classifyEntity(text) {
       // Use Llama 2 for entity classification
     }
   }
   ```

### Phase 3: Implement ML Features (Week 2 - 20 hours)

8. **Enhanced Sentiment Analysis**
   ```javascript
   async function enhancedSentimentAnalysis(newsItems, env) {
     const aiService = new AIService(env.AI);

     for (const item of newsItems) {
       // Get ML sentiment score
       const mlSentiment = await aiService.analyzeSentiment(item.title);

       // Combine with keyword-based approach
       const combinedScore = (mlSentiment.score * 0.7) + (keywordScore * 0.3);

       // Higher confidence from ML
       item.confidence_score = mlSentiment.confidence;
     }
   }
   ```

9. **Pattern Recognition for Signals**
   ```javascript
   async function detectPatterns(signals, env) {
     const aiService = new AIService(env.AI);

     // Generate embeddings for recent signals
     const embeddings = await Promise.all(
       signals.map(s => aiService.generateEmbedding(s.description))
     );

     // Cluster similar patterns
     const patterns = await clusterSignals(embeddings);

     // Store patterns for future matching
     await storePatterns(patterns, env.CRYPTOINTEL_DB);
   }
   ```

10. **Entity Classification Enhancement**
    ```javascript
    async function enhanceEntityExtraction(text, env) {
      const aiService = new AIService(env.AI);

      // Use Llama 2 for entity extraction
      const prompt = `Extract crypto entities from: "${text}"
      Return as JSON: {"tokens":[], "exchanges":[], "protocols":[]}`;

      const result = await env.AI.run('@cf/meta/llama-2-7b-chat-int8', {
        messages: [{ role: 'user', content: prompt }]
      });

      return parseMLEntities(result);
    }
    ```

11. **ML-Based Confidence Scoring**
    ```javascript
    async function calculateMLConfidence(signal, env) {
      const aiService = new AIService(env.AI);

      // Features for ML model
      const features = {
        sourceReliability: getSourceReliability(signal.source),
        historicalAccuracy: getHistoricalAccuracy(signal.signal_type),
        dataFreshness: calculateFreshness(signal.timestamp),
        crossSourceValidation: checkOtherSources(signal)
      };

      // Use ML to predict confidence
      const mlConfidence = await aiService.predictConfidence(features);

      return mlConfidence;
    }
    ```

### Phase 4: Training and Validation (Week 3 - 12 hours)

12. **Collect Training Data**
    ```sql
    -- Export historical signals for training
    SELECT
      signal_type,
      description,
      confidence_score,
      source,
      entity_mentions,
      market_impact
    FROM signals
    WHERE timestamp > strftime('%s', 'now', '-30 days')
    ORDER BY timestamp DESC
    ```

13. **Implement Pattern Learning**
    ```javascript
    async function learnPatterns(historicalSignals, env) {
      const patterns = [];

      for (const signal of historicalSignals) {
        // Generate embedding
        const embedding = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
          text: signal.description
        });

        // Store pattern with outcome
        patterns.push({
          embedding: embedding,
          signal_type: signal.signal_type,
          confidence: signal.confidence_score,
          verified: signal.verified || false
        });
      }

      // Store in signal_patterns table
      await storePatterns(patterns, env.CRYPTOINTEL_DB);
    }
    ```

14. **Validate ML Performance**
    ```javascript
    async function validateMLPerformance(testSignals, env) {
      const results = {
        accuracy: 0,
        precision: 0,
        recall: 0,
        f1Score: 0
      };

      for (const signal of testSignals) {
        const mlScore = await calculateMLConfidence(signal, env);
        const actualOutcome = signal.verified;

        // Calculate metrics
        updateMetrics(results, mlScore, actualOutcome);
      }

      return results;
    }
    ```

### Phase 5: A/B Testing and Deployment (Week 3 - 8 hours)

15. **Implement Feature Flag**
    ```javascript
    const ML_ENABLED = env.ML_FEATURES_ENABLED === 'true';

    if (ML_ENABLED) {
      confidence = await calculateMLConfidence(signal, env);
    } else {
      confidence = calculateRuleBasedConfidence(signal);
    }
    ```

16. **Deploy ML Features Gradually**
    - Week 1: Enable ML for 10% of signals
    - Week 2: Increase to 50% if metrics improve
    - Week 3: Full rollout if validation successful

17. **Monitor ML Performance**
    ```sql
    -- Track ML vs rule-based performance
    SELECT
      ml_enabled,
      COUNT(*) as signal_count,
      AVG(confidence_score) as avg_confidence,
      AVG(verified_accuracy) as avg_accuracy
    FROM signals
    WHERE timestamp > strftime('%s', 'now', '-7 days')
    GROUP BY ml_enabled
    ```

### Phase 6: Optimization (Ongoing)

18. **Performance Optimization**
    - Cache ML model results for 5 minutes
    - Batch ML requests where possible
    - Monitor Workers AI usage and costs
    - Optimize prompt engineering for better results

19. **Continuous Improvement**
    - Retrain patterns weekly with new data
    - Adjust confidence thresholds based on accuracy
    - Add new ML models as they become available
    - Collect user feedback on signal quality

---

## Testing Requirements

### Unit Tests
- [ ] AI service initialization
- [ ] Sentiment analysis accuracy
- [ ] Entity extraction validation
- [ ] Pattern matching logic
- [ ] Confidence score calculation

### Integration Tests
- [ ] Workers AI binding functional
- [ ] ML pipeline end-to-end test
- [ ] Performance under load (50ms p95)
- [ ] Fallback to rule-based on ML failure

### Validation Tests
- [ ] ML confidence scores > rule-based by 20%
- [ ] False positive rate reduced by 30%
- [ ] Accuracy on test dataset >80%
- [ ] No significant latency increase

---

## Documentation Needs

- [ ] ML architecture documentation
- [ ] Model selection rationale
- [ ] Training data preparation guide
- [ ] Performance benchmarks
- [ ] Troubleshooting guide for ML features
- [ ] API documentation updates

---

## Related Issues/Tickets

**GitHub Issue:** #2 - Implement ML-Based Signal Detection
**Related Tickets:**
- TICKET-008: Performance Baselines (provides metrics)
- TICKET-010: Advanced Analytics Dashboard (displays ML insights)
- TICKET-011: API Optimization (ML performance impact)

---

## Performance Targets

### Latency
- ML inference: <30ms p95
- Total signal processing: <50ms p95
- Batch processing: <200ms for 10 signals

### Accuracy
- Sentiment accuracy: >85%
- Entity extraction precision: >90%
- Pattern matching recall: >80%
- Overall confidence improvement: >20%

### Cost
- Workers AI calls: <10,000 per day
- Total ML cost: <$10/month (free tier if possible)

---

## Rollback Plan

1. **Disable ML features** via feature flag
2. **Fallback to rule-based** system automatically
3. **Preserve ML data** for analysis
4. **Review failure logs**
5. **Fix issues and re-enable** when ready

---

## Notes

- Start with sentiment analysis (easiest to validate)
- Use embeddings for pattern matching (most powerful)
- Keep rule-based system as fallback
- Monitor Workers AI usage carefully (costs)
- Document all ML decisions for reproducibility

---

**Last Updated:** 2025-12-01
**Next Review:** End of Week 1 (planning phase)
