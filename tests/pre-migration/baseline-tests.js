/**
 * Baseline Testing Suite for Pre-Migration Validation
 * Run this before starting the Modal removal migration to establish baseline metrics
 */

const { chromium, firefox, webkit } = require('playwright');
const assert = require('assert');
const crypto = require('crypto');

// Test configuration
const TEST_CONFIG = {
  timeout: 30000,
  browsers: ['chromium', 'firefox', 'webkit'],
  languages: ['en', 'fr'],
  audioFiles: [
    './test-assets/sample-mono-english.wav',
    './test-assets/sample-mono-french.wav',
    './test-assets/sample-stereo-conversation.wav'
  ],
  modalEndpoint: 'https://augustincombes--livekit-dialogue-agent-ensure-agent-running.modal.run'
};

// Baseline performance metrics
const BASELINE_METRICS = {
  connectionTime: 5000, // max ms to connect
  firstTranscriptionTime: 3000, // max ms to get first transcription
  averageLatency: 2000, // max ms average transcription latency
  accuracyThreshold: 0.85 // minimum transcription accuracy
};

class BaselineTestSuite {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      tests: [],
      metrics: {},
      errors: []
    };
  }

  async runAllTests() {
    console.log('🔍 Starting Pre-Migration Baseline Testing...');
    
    try {
      await this.testModalAgentHealth();
      await this.testLiveKitConnection();
      await this.testSpeechmaticsIntegration();
      await this.testCrossPlatformFunctionality();
      await this.testPerformanceMetrics();
      await this.testLoadCapacity();
      
      this.saveResults();
      this.generateReport();
    } catch (error) {
      console.error('Baseline testing failed:', error);
      throw error;
    }
  }

  async testModalAgentHealth() {
    console.log('🏥 Testing Modal Agent Health...');
    
    const startTime = Date.now();
    try {
      const response = await fetch(TEST_CONFIG.modalEndpoint);
      const data = await response.json();
      const responseTime = Date.now() - startTime;
      
      this.results.tests.push({
        name: 'Modal Agent Health Check',
        status: data.agent_info?.ready ? 'PASS' : 'FAIL',
        duration: responseTime,
        details: data
      });
      
      // Test agent wake-up time
      let agentReady = false;
      let attempts = 0;
      const wakeupStart = Date.now();
      
      while (!agentReady && attempts < 30) {
        const wakeupResponse = await fetch(TEST_CONFIG.modalEndpoint);
        const wakeupData = await wakeupResponse.json();
        
        if (wakeupData.agent_info?.ready) {
          agentReady = true;
          const wakeupTime = Date.now() - wakeupStart;
          
          this.results.metrics.modalWakeupTime = wakeupTime;
          this.results.tests.push({
            name: 'Modal Agent Wakeup Time',
            status: wakeupTime < BASELINE_METRICS.connectionTime ? 'PASS' : 'FAIL',
            duration: wakeupTime,
            threshold: BASELINE_METRICS.connectionTime
          });
        } else {
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        }
      }
      
      if (!agentReady) {
        throw new Error('Modal agent failed to wake up within 30 seconds');
      }
      
    } catch (error) {
      this.results.errors.push({
        test: 'Modal Agent Health',
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  async testLiveKitConnection() {
    console.log('🔗 Testing LiveKit Connection...');
    
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    try {
      // Navigate to the conversation page
      await page.goto('http://localhost:8081');
      
      // Test connection establishment
      const connectionStart = Date.now();
      
      // Click the record button to start connection
      await page.click('[data-testid="record-button"]', { timeout: 10000 });
      
      // Wait for connection success indicator
      await page.waitForSelector('[data-testid="connection-status"][data-status="connected"]', {
        timeout: BASELINE_METRICS.connectionTime
      });
      
      const connectionTime = Date.now() - connectionStart;
      
      this.results.metrics.livekitConnectionTime = connectionTime;
      this.results.tests.push({
        name: 'LiveKit Connection Time',
        status: connectionTime < BASELINE_METRICS.connectionTime ? 'PASS' : 'FAIL',
        duration: connectionTime,
        threshold: BASELINE_METRICS.connectionTime
      });
      
    } catch (error) {
      this.results.errors.push({
        test: 'LiveKit Connection',
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    } finally {
      await browser.close();
    }
  }

  async testSpeechmaticsIntegration() {
    console.log('🎤 Testing Speechmatics Integration...');
    
    // Test direct Speechmatics token generation
    try {
      const tokenResponse = await fetch('/api/speechmatics-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'speechmatics',
          transcriptionConfig: {
            language: 'en',
            operating_point: 'enhanced',
            enable_partials: true
          }
        })
      });
      
      const tokenData = await tokenResponse.json();
      
      this.results.tests.push({
        name: 'Speechmatics Token Generation',
        status: tokenData.token ? 'PASS' : 'FAIL',
        details: { hasToken: !!tokenData.token, type: tokenData.type }
      });
      
      // Test different language configurations
      for (const language of TEST_CONFIG.languages) {
        const langTokenResponse = await fetch('/api/speechmatics-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'speechmatics',
            transcriptionConfig: { language }
          })
        });
        
        const langTokenData = await langTokenResponse.json();
        
        this.results.tests.push({
          name: `Speechmatics Token - ${language.toUpperCase()}`,
          status: langTokenData.token ? 'PASS' : 'FAIL',
          language,
          details: langTokenData
        });
      }
      
    } catch (error) {
      this.results.errors.push({
        test: 'Speechmatics Integration',
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  async testCrossPlatformFunctionality() {
    console.log('📱 Testing Cross-Platform Functionality...');
    
    for (const browserName of TEST_CONFIG.browsers) {
      try {
        const browser = await this.launchBrowser(browserName);
        const context = await browser.newContext({
          permissions: ['microphone']
        });
        const page = await context.newPage();
        
        // Test microphone permission request
        await page.goto('http://localhost:8081');
        
        const permissionResult = await page.evaluate(async () => {
          try {
            await navigator.mediaDevices.getUserMedia({ audio: true });
            return { success: true, error: null };
          } catch (error) {
            return { success: false, error: error.message };
          }
        });
        
        this.results.tests.push({
          name: `Cross-Platform Audio Permission - ${browserName}`,
          browser: browserName,
          status: permissionResult.success ? 'PASS' : 'FAIL',
          details: permissionResult
        });
        
        // Test language selector
        const languageSelectors = await page.$$('[data-testid="language-selector"] button');
        
        this.results.tests.push({
          name: `Language Selector - ${browserName}`,
          browser: browserName,
          status: languageSelectors.length === TEST_CONFIG.languages.length ? 'PASS' : 'FAIL',
          details: { foundSelectors: languageSelectors.length, expected: TEST_CONFIG.languages.length }
        });
        
        await browser.close();
      } catch (error) {
        this.results.errors.push({
          test: `Cross-Platform - ${browserName}`,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  async testPerformanceMetrics() {
    console.log('⚡ Testing Performance Metrics...');
    
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    try {
      // Enable performance monitoring
      await page.goto('http://localhost:8081');
      
      const performanceMetrics = await page.evaluate(() => {
        return new Promise((resolve) => {
          const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const metrics = {
              navigationStart: performance.timeOrigin,
              domContentLoaded: 0,
              loadComplete: 0,
              firstPaint: 0,
              firstContentfulPaint: 0
            };
            
            entries.forEach(entry => {
              if (entry.entryType === 'navigation') {
                metrics.domContentLoaded = entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart;
                metrics.loadComplete = entry.loadEventEnd - entry.loadEventStart;
              } else if (entry.entryType === 'paint') {
                if (entry.name === 'first-paint') {
                  metrics.firstPaint = entry.startTime;
                } else if (entry.name === 'first-contentful-paint') {
                  metrics.firstContentfulPaint = entry.startTime;
                }
              }
            });
            
            resolve(metrics);
          });
          
          observer.observe({ entryTypes: ['navigation', 'paint'] });
          
          // Fallback timeout
          setTimeout(() => resolve({}), 5000);
        });
      });
      
      this.results.metrics.performance = performanceMetrics;
      this.results.tests.push({
        name: 'Page Load Performance',
        status: performanceMetrics.domContentLoaded < 2000 ? 'PASS' : 'FAIL',
        metrics: performanceMetrics
      });
      
    } catch (error) {
      this.results.errors.push({
        test: 'Performance Metrics',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    } finally {
      await browser.close();
    }
  }

  async testLoadCapacity() {
    console.log('🔥 Testing Load Capacity...');
    
    // Test concurrent connections
    const concurrentTests = [];
    const concurrentUsers = 5;
    
    for (let i = 0; i < concurrentUsers; i++) {
      concurrentTests.push(this.simulateUserSession(i));
    }
    
    try {
      const results = await Promise.allSettled(concurrentTests);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      this.results.tests.push({
        name: 'Concurrent User Load Test',
        status: successful >= concurrentUsers * 0.8 ? 'PASS' : 'FAIL', // 80% success rate
        details: {
          totalUsers: concurrentUsers,
          successful,
          failed,
          successRate: successful / concurrentUsers
        }
      });
      
      this.results.metrics.loadCapacity = {
        maxConcurrentUsers: successful,
        failureRate: failed / concurrentUsers
      };
      
    } catch (error) {
      this.results.errors.push({
        test: 'Load Capacity',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  async simulateUserSession(userId) {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    try {
      await page.goto('http://localhost:8081');
      
      // Grant microphone permission
      await page.context().grantPermissions(['microphone']);
      
      // Start recording
      await page.click('[data-testid="record-button"]');
      
      // Wait for connection
      await page.waitForSelector('[data-testid="connection-status"][data-status="connected"]', {
        timeout: 10000
      });
      
      // Simulate activity for 30 seconds
      await page.waitForTimeout(30000);
      
      // Stop recording
      await page.click('[data-testid="stop-button"]');
      
      return { userId, status: 'success' };
      
    } catch (error) {
      return { userId, status: 'failed', error: error.message };
    } finally {
      await browser.close();
    }
  }

  async launchBrowser(browserName) {
    switch (browserName) {
      case 'firefox': return await firefox.launch();
      case 'webkit': return await webkit.launch();
      default: return await chromium.launch();
    }
  }

  saveResults() {
    const fs = require('fs');
    const resultsFile = `./test-results/baseline-${Date.now()}.json`;
    
    // Ensure directory exists
    if (!fs.existsSync('./test-results')) {
      fs.mkdirSync('./test-results', { recursive: true });
    }
    
    fs.writeFileSync(resultsFile, JSON.stringify(this.results, null, 2));
    console.log(`📊 Baseline results saved to ${resultsFile}`);
  }

  generateReport() {
    const totalTests = this.results.tests.length;
    const passedTests = this.results.tests.filter(t => t.status === 'PASS').length;
    const failedTests = this.results.tests.filter(t => t.status === 'FAIL').length;
    
    console.log('\n' + '='.repeat(50));
    console.log('📈 BASELINE TEST RESULTS SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} (${((passedTests/totalTests)*100).toFixed(1)}%)`);
    console.log(`Failed: ${failedTests} (${((failedTests/totalTests)*100).toFixed(1)}%)`);
    console.log(`Errors: ${this.results.errors.length}`);
    console.log('\n📊 Key Metrics:');
    
    if (this.results.metrics.modalWakeupTime) {
      console.log(`  Modal Wakeup Time: ${this.results.metrics.modalWakeupTime}ms`);
    }
    if (this.results.metrics.livekitConnectionTime) {
      console.log(`  LiveKit Connection Time: ${this.results.metrics.livekitConnectionTime}ms`);
    }
    if (this.results.metrics.loadCapacity) {
      console.log(`  Max Concurrent Users: ${this.results.metrics.loadCapacity.maxConcurrentUsers}`);
    }
    
    if (this.results.errors.length > 0) {
      console.log('\n❌ Errors:');
      this.results.errors.forEach(error => {
        console.log(`  ${error.test}: ${error.error}`);
      });
    }
    
    console.log('='.repeat(50));
  }
}

// Export for use in other test files
module.exports = { BaselineTestSuite, TEST_CONFIG, BASELINE_METRICS };

// Run if called directly
if (require.main === module) {
  (async () => {
    const suite = new BaselineTestSuite();
    await suite.runAllTests();
  })();
}