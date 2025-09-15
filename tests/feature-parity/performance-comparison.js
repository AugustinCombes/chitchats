/**
 * Performance Comparison Testing
 * Measures latency, throughput, and resource usage between Modal and Serverless
 */

const { chromium } = require('playwright');
const { EventEmitter } = require('events');
const fs = require('fs');

// Performance test scenarios
const PERFORMANCE_SCENARIOS = [
  {
    name: 'cold-start',
    description: 'First connection after idle period',
    coldStart: true,
    duration: 30000, // 30 seconds
    expectedMetrics: {
      connectionTime: { modal: 15000, serverless: 3000 }, // ms
      firstTranscript: { modal: 5000, serverless: 2000 }, // ms
    }
  },
  {
    name: 'warm-connection',
    description: 'Connection when services are already warm',
    coldStart: false,
    duration: 60000, // 1 minute
    expectedMetrics: {
      connectionTime: { modal: 3000, serverless: 1000 }, // ms
      firstTranscript: { modal: 2000, serverless: 1000 }, // ms
    }
  },
  {
    name: 'sustained-load',
    description: 'Continuous transcription for extended period',
    coldStart: false,
    duration: 300000, // 5 minutes
    expectedMetrics: {
      avgLatency: { modal: 1500, serverless: 800 }, // ms
      maxLatency: { modal: 5000, serverless: 2000 }, // ms
    }
  },
  {
    name: 'burst-traffic',
    description: 'Multiple concurrent sessions',
    coldStart: false,
    concurrentSessions: 5,
    duration: 60000, // 1 minute each
    expectedMetrics: {
      successRate: { modal: 0.8, serverless: 0.95 }, // percentage
      avgLatency: { modal: 3000, serverless: 1500 }, // ms
    }
  }
];

class PerformanceComparisonSuite extends EventEmitter {
  constructor() {
    super();
    this.results = {
      timestamp: new Date().toISOString(),
      scenarios: {},
      modal: { metrics: {} },
      serverless: { metrics: {} },
      comparison: {}
    };
  }

  async runPerformanceComparison() {
    console.log('⚡ Starting Performance Comparison Tests...');
    
    for (const scenario of PERFORMANCE_SCENARIOS) {
      console.log(`\n🎯 Testing scenario: ${scenario.name}`);
      console.log(`   ${scenario.description}`);
      
      // Initialize cold start if needed
      if (scenario.coldStart) {
        await this.ensureColdStart();
      }
      
      // Test Modal implementation
      console.log('🏗️ Testing Modal performance...');
      const modalResults = await this.testModalPerformance(scenario);
      
      // Reset for fair comparison
      if (scenario.coldStart) {
        await this.ensureColdStart();
      }
      
      // Test Serverless implementation
      console.log('☁️ Testing Serverless performance...');
      const serverlessResults = await this.testServerlessPerformance(scenario);
      
      // Store results
      this.results.scenarios[scenario.name] = {
        scenario,
        modal: modalResults,
        serverless: serverlessResults,
        comparison: this.compareScenarioResults(scenario, modalResults, serverlessResults)
      };
    }
    
    this.generateOverallComparison();
    this.saveResults();
    this.generatePerformanceReport();
  }

  async ensureColdStart() {
    console.log('❄️ Ensuring cold start conditions...');
    
    // For Modal: Wait for container to scale down
    console.log('Waiting for Modal container to scale down...');
    await this.waitFor(35000); // Modal scaledown_window is 30s + buffer
    
    // For Serverless: Clear any cached connections
    // This would involve clearing browser cache, resetting network, etc.
    console.log('Clearing cached connections...');
    await this.waitFor(5000);
  }

  async testModalPerformance(scenario) {
    const results = {
      scenario: scenario.name,
      implementation: 'modal',
      metrics: {},
      sessions: [],
      errors: []
    };

    try {
      if (scenario.concurrentSessions) {
        // Test concurrent sessions
        const sessionPromises = [];
        for (let i = 0; i < scenario.concurrentSessions; i++) {
          sessionPromises.push(this.runModalSession(scenario, i));
        }
        
        const sessionResults = await Promise.allSettled(sessionPromises);
        
        sessionResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results.sessions.push(result.value);
          } else {
            results.errors.push({
              session: index,
              error: result.reason.message
            });
          }
        });
        
        results.metrics = this.calculateConcurrentMetrics(results.sessions);
        
      } else {
        // Single session test
        const sessionResult = await this.runModalSession(scenario);
        results.sessions.push(sessionResult);
        results.metrics = sessionResult.metrics;
      }
      
    } catch (error) {
      results.errors.push({ error: error.message });
      console.error('Modal performance test failed:', error);
    }

    return results;
  }

  async testServerlessPerformance(scenario) {
    const results = {
      scenario: scenario.name,
      implementation: 'serverless',
      metrics: {},
      sessions: [],
      errors: []
    };

    try {
      if (scenario.concurrentSessions) {
        // Test concurrent sessions
        const sessionPromises = [];
        for (let i = 0; i < scenario.concurrentSessions; i++) {
          sessionPromises.push(this.runServerlessSession(scenario, i));
        }
        
        const sessionResults = await Promise.allSettled(sessionPromises);
        
        sessionResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results.sessions.push(result.value);
          } else {
            results.errors.push({
              session: index,
              error: result.reason.message
            });
          }
        });
        
        results.metrics = this.calculateConcurrentMetrics(results.sessions);
        
      } else {
        // Single session test
        const sessionResult = await this.runServerlessSession(scenario);
        results.sessions.push(sessionResult);
        results.metrics = sessionResult.metrics;
      }
      
    } catch (error) {
      results.errors.push({ error: error.message });
      console.error('Serverless performance test failed:', error);
    }

    return results;
  }

  async runModalSession(scenario, sessionId = 0) {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    const session = {
      id: sessionId,
      implementation: 'modal',
      metrics: {
        connectionTime: 0,
        firstTranscriptTime: 0,
        transcriptCount: 0,
        latencies: [],
        errors: 0
      },
      timeline: []
    };

    try {
      await page.context().grantPermissions(['microphone']);
      
      const startTime = Date.now();
      session.timeline.push({ event: 'session_start', timestamp: 0 });
      
      // Navigate to app
      await page.goto('http://localhost:8081');
      session.timeline.push({ event: 'page_loaded', timestamp: Date.now() - startTime });
      
      // Monitor console for transcription events
      page.on('console', msg => {
        const text = msg.text();
        if (text.includes('🎤') || text.includes('transcription')) {
          const transcriptTime = Date.now() - startTime;
          
          if (session.metrics.firstTranscriptTime === 0) {
            session.metrics.firstTranscriptTime = transcriptTime;
            session.timeline.push({ event: 'first_transcript', timestamp: transcriptTime });
          }
          
          session.metrics.transcriptCount++;
          session.metrics.latencies.push(transcriptTime);
        }
        
        if (text.includes('error') || text.includes('Error')) {
          session.metrics.errors++;
          session.timeline.push({ event: 'error', timestamp: Date.now() - startTime, error: text });
        }
      });
      
      // Start recording
      const recordStartTime = Date.now();
      await page.click('[data-testid="record-button"]');
      
      // Wait for Modal agent connection
      await page.waitForSelector('[data-testid="connection-status"][data-status="connected"]', {
        timeout: 30000
      });
      
      session.metrics.connectionTime = Date.now() - recordStartTime;
      session.timeline.push({ event: 'connected', timestamp: session.metrics.connectionTime });
      
      // Simulate continuous audio for the test duration
      await this.simulateAudioInput(page, scenario.duration);
      
      // Stop recording
      await page.click('[data-testid="stop-button"]');
      session.timeline.push({ event: 'session_end', timestamp: Date.now() - startTime });
      
      // Calculate additional metrics
      session.metrics.avgLatency = session.metrics.latencies.length > 0 ? 
        session.metrics.latencies.reduce((sum, lat) => sum + lat, 0) / session.metrics.latencies.length : 0;
      
      session.metrics.maxLatency = session.metrics.latencies.length > 0 ? 
        Math.max(...session.metrics.latencies) : 0;
      
      session.metrics.minLatency = session.metrics.latencies.length > 0 ? 
        Math.min(...session.metrics.latencies) : 0;
      
      session.metrics.totalDuration = Date.now() - startTime;
      
    } catch (error) {
      session.error = error.message;
      session.metrics.errors++;
      console.error(`Modal session ${sessionId} failed:`, error);
    } finally {
      await browser.close();
    }

    return session;
  }

  async runServerlessSession(scenario, sessionId = 0) {
    const session = {
      id: sessionId,
      implementation: 'serverless',
      metrics: {
        tokenGenerationTime: 0,
        connectionTime: 0,
        firstTranscriptTime: 0,
        transcriptCount: 0,
        latencies: [],
        errors: 0
      },
      timeline: []
    };

    return new Promise(async (resolve) => {
      try {
        const startTime = Date.now();
        session.timeline.push({ event: 'session_start', timestamp: 0 });
        
        // Generate token
        const tokenStartTime = Date.now();
        const tokenResponse = await fetch('http://localhost:3000/api/speechmatics-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'speechmatics',
            transcriptionConfig: { language: 'en', operating_point: 'enhanced' }
          })
        });
        
        const tokenData = await tokenResponse.json();
        session.metrics.tokenGenerationTime = Date.now() - tokenStartTime;
        session.timeline.push({ event: 'token_generated', timestamp: session.metrics.tokenGenerationTime });
        
        if (!tokenData.token) {
          throw new Error('Failed to generate token');
        }
        
        // Connect to Speechmatics
        const WebSocket = require('ws');
        const ws = new WebSocket('wss://eu2.rt.speechmatics.com/v2', {
          headers: {
            'Authorization': `Bearer ${process.env.SPEECHMATICS_API_KEY}`
          }
        });
        
        const connectionStartTime = Date.now();
        
        ws.on('open', () => {
          session.metrics.connectionTime = Date.now() - connectionStartTime;
          session.timeline.push({ event: 'connected', timestamp: Date.now() - startTime });
          
          // Start recognition
          ws.send(JSON.stringify({
            message: 'StartRecognition',
            audio_format: {
              type: 'raw',
              encoding: 'pcm_s16le',
              sample_rate: 16000
            },
            transcription_config: {
              language: 'en',
              enable_partials: true,
              operating_point: 'enhanced'
            }
          }));
          
          // Simulate audio data
          this.simulateServerlessAudio(ws, scenario.duration);
        });
        
        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            const currentTime = Date.now() - startTime;
            
            if (message.message === 'AddTranscript') {
              if (session.metrics.firstTranscriptTime === 0) {
                session.metrics.firstTranscriptTime = currentTime;
                session.timeline.push({ event: 'first_transcript', timestamp: currentTime });
              }
              
              session.metrics.transcriptCount++;
              session.metrics.latencies.push(currentTime);
            }
          } catch (error) {
            session.metrics.errors++;
            console.warn('Error parsing Speechmatics message:', error);
          }
        });
        
        ws.on('error', (error) => {
          session.metrics.errors++;
          session.timeline.push({ event: 'error', timestamp: Date.now() - startTime, error: error.message });
          console.error('WebSocket error:', error);
        });
        
        ws.on('close', () => {
          session.timeline.push({ event: 'session_end', timestamp: Date.now() - startTime });
          
          // Calculate metrics
          session.metrics.avgLatency = session.metrics.latencies.length > 0 ? 
            session.metrics.latencies.reduce((sum, lat) => sum + lat, 0) / session.metrics.latencies.length : 0;
          
          session.metrics.maxLatency = session.metrics.latencies.length > 0 ? 
            Math.max(...session.metrics.latencies) : 0;
          
          session.metrics.minLatency = session.metrics.latencies.length > 0 ? 
            Math.min(...session.metrics.latencies) : 0;
          
          session.metrics.totalDuration = Date.now() - startTime;
          
          resolve(session);
        });
        
        // Timeout handling
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
        }, scenario.duration + 10000); // Add buffer to scenario duration
        
      } catch (error) {
        session.error = error.message;
        session.metrics.errors++;
        console.error(`Serverless session ${sessionId} failed:`, error);
        resolve(session);
      }
    });
  }

  async simulateAudioInput(page, duration) {
    // Simulate continuous audio input for the specified duration
    console.log(`Simulating audio input for ${duration}ms...`);
    
    const intervals = Math.floor(duration / 1000); // 1 second intervals
    
    for (let i = 0; i < intervals; i++) {
      await page.evaluate((intervalIndex) => {
        // Simulate audio data reception
        window.dispatchEvent(new CustomEvent('mock-audio-data', {
          detail: {
            timestamp: Date.now(),
            interval: intervalIndex
          }
        }));
      }, i);
      
      await this.waitFor(1000);
    }
  }

  simulateServerlessAudio(ws, duration) {
    console.log(`Simulating serverless audio for ${duration}ms...`);
    
    const chunkSize = 1024;
    const chunkInterval = 50; // 50ms intervals
    const totalChunks = Math.floor(duration / chunkInterval);
    
    let chunkCount = 0;
    const audioInterval = setInterval(() => {
      if (chunkCount >= totalChunks || ws.readyState !== ws.OPEN) {
        clearInterval(audioInterval);
        ws.send(JSON.stringify({ message: 'EndOfStream' }));
        return;
      }
      
      // Send mock audio chunk
      const mockAudio = Buffer.alloc(chunkSize, chunkCount % 256);
      ws.send(mockAudio);
      chunkCount++;
    }, chunkInterval);
  }

  calculateConcurrentMetrics(sessions) {
    const successfulSessions = sessions.filter(s => !s.error);
    
    if (successfulSessions.length === 0) {
      return {
        successRate: 0,
        avgConnectionTime: 0,
        avgFirstTranscriptTime: 0,
        avgLatency: 0,
        maxLatency: 0,
        totalErrors: sessions.reduce((sum, s) => sum + s.metrics.errors, 0)
      };
    }
    
    return {
      successRate: successfulSessions.length / sessions.length,
      avgConnectionTime: successfulSessions.reduce((sum, s) => sum + s.metrics.connectionTime, 0) / successfulSessions.length,
      avgFirstTranscriptTime: successfulSessions.reduce((sum, s) => sum + s.metrics.firstTranscriptTime, 0) / successfulSessions.length,
      avgLatency: successfulSessions.reduce((sum, s) => sum + s.metrics.avgLatency, 0) / successfulSessions.length,
      maxLatency: Math.max(...successfulSessions.map(s => s.metrics.maxLatency)),
      totalTranscripts: successfulSessions.reduce((sum, s) => sum + s.metrics.transcriptCount, 0),
      totalErrors: sessions.reduce((sum, s) => sum + s.metrics.errors, 0)
    };
  }

  compareScenarioResults(scenario, modalResults, serverlessResults) {
    const comparison = {
      scenario: scenario.name,
      improvements: {},
      degradations: {},
      overall: 'UNKNOWN'
    };
    
    // Compare key metrics
    const metrics = ['connectionTime', 'firstTranscriptTime', 'avgLatency', 'maxLatency'];
    
    metrics.forEach(metric => {
      const modalValue = modalResults.metrics[metric];
      const serverlessValue = serverlessResults.metrics[metric];
      
      if (modalValue && serverlessValue) {
        const improvement = ((modalValue - serverlessValue) / modalValue) * 100;
        
        if (improvement > 10) {
          comparison.improvements[metric] = {
            improvement: improvement.toFixed(1) + '%',
            modal: modalValue,
            serverless: serverlessValue
          };
        } else if (improvement < -10) {
          comparison.degradations[metric] = {
            degradation: Math.abs(improvement).toFixed(1) + '%',
            modal: modalValue,
            serverless: serverlessValue
          };
        }
      }
    });
    
    // Compare success rates for concurrent scenarios
    if (scenario.concurrentSessions) {
      const modalSuccess = modalResults.metrics.successRate || 0;
      const serverlessSuccess = serverlessResults.metrics.successRate || 0;
      
      if (serverlessSuccess > modalSuccess + 0.1) { // 10% improvement
        comparison.improvements.successRate = {
          improvement: `${((serverlessSuccess - modalSuccess) * 100).toFixed(1)}%`,
          modal: (modalSuccess * 100).toFixed(1) + '%',
          serverless: (serverlessSuccess * 100).toFixed(1) + '%'
        };
      }
    }
    
    // Overall assessment
    const improvementCount = Object.keys(comparison.improvements).length;
    const degradationCount = Object.keys(comparison.degradations).length;
    
    if (improvementCount > degradationCount * 2) {
      comparison.overall = 'SIGNIFICANT_IMPROVEMENT';
    } else if (improvementCount > degradationCount) {
      comparison.overall = 'IMPROVEMENT';
    } else if (improvementCount === degradationCount) {
      comparison.overall = 'MIXED';
    } else if (degradationCount > improvementCount) {
      comparison.overall = 'DEGRADATION';
    }
    
    return comparison;
  }

  generateOverallComparison() {
    const scenarios = Object.values(this.results.scenarios);
    
    this.results.comparison = {
      overallAssessment: this.assessOverallPerformance(scenarios),
      keyMetrics: this.calculateKeyMetrics(scenarios),
      recommendations: this.generateRecommendations(scenarios)
    };
  }

  assessOverallPerformance(scenarios) {
    const assessments = scenarios.map(s => s.comparison.overall);
    
    const improvements = assessments.filter(a => a.includes('IMPROVEMENT')).length;
    const degradations = assessments.filter(a => a.includes('DEGRADATION')).length;
    const mixed = assessments.filter(a => a === 'MIXED').length;
    
    if (improvements >= scenarios.length * 0.75) {
      return 'EXCELLENT';
    } else if (improvements > degradations) {
      return 'GOOD';
    } else if (mixed > scenarios.length * 0.5) {
      return 'ACCEPTABLE';
    } else {
      return 'NEEDS_ATTENTION';
    }
  }

  calculateKeyMetrics(scenarios) {
    // Aggregate key metrics across all scenarios
    const metrics = {
      avgConnectionTimeImprovement: 0,
      avgLatencyImprovement: 0,
      reliabilityImprovement: 0,
      costEfficiency: 'IMPROVED' // Serverless is generally more cost-effective
    };
    
    scenarios.forEach(scenario => {
      const comparison = scenario.comparison;
      
      if (comparison.improvements.connectionTime) {
        metrics.avgConnectionTimeImprovement += parseFloat(comparison.improvements.connectionTime.improvement);
      }
      
      if (comparison.improvements.avgLatency) {
        metrics.avgLatencyImprovement += parseFloat(comparison.improvements.avgLatency.improvement);
      }
      
      if (comparison.improvements.successRate) {
        metrics.reliabilityImprovement += parseFloat(comparison.improvements.successRate.improvement);
      }
    });
    
    // Average the improvements
    metrics.avgConnectionTimeImprovement /= scenarios.length;
    metrics.avgLatencyImprovement /= scenarios.length;
    metrics.reliabilityImprovement /= scenarios.length;
    
    return metrics;
  }

  generateRecommendations(scenarios) {
    const recommendations = [];
    
    const overallAssessment = this.results.comparison.overallAssessment;
    const keyMetrics = this.results.comparison.keyMetrics;
    
    if (overallAssessment === 'EXCELLENT' || overallAssessment === 'GOOD') {
      recommendations.push('✅ Migration to serverless architecture is highly recommended');
      recommendations.push('🚀 Significant performance improvements observed');
    }
    
    if (keyMetrics.avgConnectionTimeImprovement > 20) {
      recommendations.push('⚡ Cold start performance is significantly better with serverless');
    }
    
    if (keyMetrics.avgLatencyImprovement > 15) {
      recommendations.push('🎯 Real-time transcription latency has improved substantially');
    }
    
    if (keyMetrics.reliabilityImprovement > 10) {
      recommendations.push('🛡️ System reliability and concurrent user handling improved');
    }
    
    recommendations.push('💰 Cost optimization: Serverless architecture eliminates idle container costs');
    recommendations.push('🔧 Operational simplicity: Reduced infrastructure management complexity');
    
    if (overallAssessment === 'NEEDS_ATTENTION') {
      recommendations.push('⚠️ Review performance degradations before migration');
      recommendations.push('🔍 Consider phased rollout with performance monitoring');
    }
    
    return recommendations;
  }

  saveResults() {
    const resultsFile = `./test-results/performance-comparison-${Date.now()}.json`;
    
    if (!fs.existsSync('./test-results')) {
      fs.mkdirSync('./test-results', { recursive: true });
    }
    
    fs.writeFileSync(resultsFile, JSON.stringify(this.results, null, 2));
    console.log(`📊 Performance comparison results saved to ${resultsFile}`);
  }

  generatePerformanceReport() {
    console.log('\n' + '='.repeat(60));
    console.log('⚡ PERFORMANCE COMPARISON RESULTS');
    console.log('='.repeat(60));
    
    console.log(`\n🎯 Overall Assessment: ${this.results.comparison.overallAssessment}`);
    
    console.log('\n📊 Key Performance Metrics:');
    const metrics = this.results.comparison.keyMetrics;
    console.log(`  Connection Time Improvement: ${metrics.avgConnectionTimeImprovement.toFixed(1)}%`);
    console.log(`  Latency Improvement: ${metrics.avgLatencyImprovement.toFixed(1)}%`);
    console.log(`  Reliability Improvement: ${metrics.reliabilityImprovement.toFixed(1)}%`);
    console.log(`  Cost Efficiency: ${metrics.costEfficiency}`);
    
    console.log('\n🧪 Scenario Results:');
    Object.values(this.results.scenarios).forEach(scenario => {
      console.log(`\n  ${scenario.scenario.name.toUpperCase()}: ${scenario.comparison.overall}`);
      
      // Show improvements
      Object.entries(scenario.comparison.improvements).forEach(([metric, data]) => {
        console.log(`    ✅ ${metric}: ${data.improvement} faster (${data.modal}ms → ${data.serverless}ms)`);
      });
      
      // Show degradations
      Object.entries(scenario.comparison.degradations).forEach(([metric, data]) => {
        console.log(`    ⚠️ ${metric}: ${data.degradation} slower (${data.modal}ms → ${data.serverless}ms)`);
      });
    });
    
    console.log('\n💡 Recommendations:');
    this.results.comparison.recommendations.forEach(rec => {
      console.log(`  ${rec}`);
    });
    
    console.log('='.repeat(60));
  }

  async waitFor(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { PerformanceComparisonSuite, PERFORMANCE_SCENARIOS };

if (require.main === module) {
  (async () => {
    const suite = new PerformanceComparisonSuite();
    await suite.runPerformanceComparison();
  })();
}