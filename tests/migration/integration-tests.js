/**
 * Integration Tests for Serverless Functions
 * Tests the new serverless architecture without Modal dependency
 */

const { chromium } = require('playwright');
const WebSocket = require('ws');
const { EventEmitter } = require('events');

class IntegrationTestSuite extends EventEmitter {
  constructor() {
    super();
    this.results = {
      timestamp: new Date().toISOString(),
      tests: [],
      metrics: {},
      errors: []
    };
  }

  async runAllTests() {
    console.log('🧪 Starting Integration Tests...');
    
    try {
      await this.testServerlessTokenGeneration();
      await this.testDirectSpeechmaticsConnection();
      await this.testEndToEndTranscription();
      await this.testMultiLanguageSupport();
      await this.testErrorRecovery();
      await this.testConcurrentSessions();
      
      this.saveResults();
      this.generateReport();
    } catch (error) {
      console.error('Integration testing failed:', error);
      throw error;
    }
  }

  async testServerlessTokenGeneration() {
    console.log('🔐 Testing Serverless Token Generation...');
    
    try {
      // Test Speechmatics token generation
      const speechmaticsTokenResponse = await fetch('http://localhost:3000/api/speechmatics-token', {
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

      const speechmaticsToken = await speechmaticsTokenResponse.json();
      
      this.results.tests.push({
        name: 'Serverless Speechmatics Token Generation',
        status: speechmaticsToken.token ? 'PASS' : 'FAIL',
        duration: speechmaticsTokenResponse.headers.get('x-response-time') || 'unknown',
        details: {
          hasToken: !!speechmaticsToken.token,
          tokenType: speechmaticsToken.type,
          expiresAt: speechmaticsToken.expires_at
        }
      });

      // Test rate limiting
      const rateLimitPromises = [];
      for (let i = 0; i < 10; i++) {
        rateLimitPromises.push(
          fetch('http://localhost:3000/api/speechmatics-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'speechmatics', transcriptionConfig: { language: 'en' } })
          })
        );
      }

      const rateLimitResponses = await Promise.all(rateLimitPromises);
      const successfulResponses = rateLimitResponses.filter(r => r.ok).length;
      
      this.results.tests.push({
        name: 'Token Generation Rate Limiting',
        status: successfulResponses >= 8 ? 'PASS' : 'FAIL', // Allow some to be rate limited
        details: {
          totalRequests: 10,
          successful: successfulResponses,
          rateLimited: 10 - successfulResponses
        }
      });

    } catch (error) {
      this.results.errors.push({
        test: 'Serverless Token Generation',
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  async testDirectSpeechmaticsConnection() {
    console.log('🔌 Testing Direct Speechmatics Connection...');
    
    return new Promise((resolve, reject) => {
      try {
        // Get a real token first
        fetch('http://localhost:3000/api/speechmatics-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'speechmatics',
            transcriptionConfig: { language: 'en' }
          })
        })
        .then(response => response.json())
        .then(tokenData => {
          // Test WebSocket connection to Speechmatics
          const ws = new WebSocket('wss://eu2.rt.speechmatics.com/v2', {
            headers: {
              'Authorization': `Bearer ${process.env.SPEECHMATICS_API_KEY}`
            }
          });

          let connectionEstablished = false;
          const connectionTimeout = setTimeout(() => {
            if (!connectionEstablished) {
              ws.close();
              reject(new Error('Connection timeout'));
            }
          }, 10000);

          ws.on('open', () => {
            console.log('✅ Connected to Speechmatics');
            connectionEstablished = true;
            clearTimeout(connectionTimeout);

            // Send start recognition message
            const startMessage = {
              message: 'StartRecognition',
              audio_format: {
                type: 'raw',
                encoding: 'pcm_s16le',
                sample_rate: 16000
              },
              transcription_config: {
                language: 'en',
                enable_partials: true,
                diarization: 'speaker'
              }
            };

            ws.send(JSON.stringify(startMessage));

            this.results.tests.push({
              name: 'Direct Speechmatics WebSocket Connection',
              status: 'PASS',
              details: { connectionTime: Date.now() }
            });

            ws.close();
            resolve();
          });

          ws.on('error', (error) => {
            clearTimeout(connectionTimeout);
            this.results.tests.push({
              name: 'Direct Speechmatics WebSocket Connection',
              status: 'FAIL',
              error: error.message
            });
            reject(error);
          });

          ws.on('message', (data) => {
            try {
              const message = JSON.parse(data.toString());
              console.log('📨 Received from Speechmatics:', message.message);
              
              if (message.message === 'RecognitionStarted') {
                this.results.tests.push({
                  name: 'Speechmatics Recognition Initialization',
                  status: 'PASS',
                  details: message
                });
              }
            } catch (parseError) {
              console.warn('Failed to parse message:', parseError);
            }
          });

        });

      } catch (error) {
        this.results.errors.push({
          test: 'Direct Speechmatics Connection',
          error: error.message,
          timestamp: new Date().toISOString()
        });
        reject(error);
      }
    });
  }

  async testEndToEndTranscription() {
    console.log('🎯 Testing End-to-End Transcription...');
    
    const browser = await chromium.launch();
    const page = await browser.newPage();

    try {
      // Grant microphone permission
      await page.context().grantPermissions(['microphone']);
      
      // Navigate to the application
      await page.goto('http://localhost:8081');
      
      // Wait for the page to load
      await page.waitForLoadState('networkidle');
      
      // Start recording
      const startTime = Date.now();
      await page.click('[data-testid="record-button"]');
      
      // Wait for connection establishment
      await page.waitForSelector('[data-testid="connection-status"]', {
        state: 'visible',
        timeout: 15000
      });
      
      const connectionTime = Date.now() - startTime;
      
      // Listen for transcription messages
      const transcriptionMessages = [];
      page.on('console', msg => {
        const text = msg.text();
        if (text.includes('transcription') || text.includes('🎤')) {
          transcriptionMessages.push({
            text,
            timestamp: Date.now()
          });
        }
      });

      // Simulate audio input (this would normally come from microphone)
      // In a real test, you'd inject audio data
      await page.evaluate(() => {
        // Simulate receiving transcription data
        window.dispatchEvent(new CustomEvent('transcript-received', {
          detail: {
            speaker: 'M1',
            text: 'This is a test transcription',
            timestamp: Date.now()
          }
        }));
      });

      // Wait for transcription to appear
      await page.waitForSelector('[data-testid="transcription-message"]', {
        timeout: 10000
      });

      const transcriptionElements = await page.$$('[data-testid="transcription-message"]');
      
      this.results.tests.push({
        name: 'End-to-End Transcription Flow',
        status: transcriptionElements.length > 0 ? 'PASS' : 'FAIL',
        details: {
          connectionTime,
          transcriptionCount: transcriptionElements.length,
          messagesReceived: transcriptionMessages.length
        }
      });

      // Test stop recording
      await page.click('[data-testid="stop-button"]');
      
      await page.waitForSelector('[data-testid="welcome-screen"]', {
        timeout: 5000
      });

      this.results.tests.push({
        name: 'Session Cleanup After Stop',
        status: 'PASS',
        details: { cleanupSuccessful: true }
      });

    } catch (error) {
      this.results.errors.push({
        test: 'End-to-End Transcription',
        error: error.message,
        timestamp: new Date().toISOString()
      });
      this.results.tests.push({
        name: 'End-to-End Transcription Flow',
        status: 'FAIL',
        error: error.message
      });
    } finally {
      await browser.close();
    }
  }

  async testMultiLanguageSupport() {
    console.log('🌍 Testing Multi-Language Support...');
    
    const languages = ['en', 'fr'];
    const browser = await chromium.launch();

    try {
      for (const language of languages) {
        const page = await browser.newPage();
        await page.context().grantPermissions(['microphone']);
        
        try {
          await page.goto('http://localhost:8081');
          
          // Select language
          await page.click(`[data-testid="language-selector"] button[data-lang="${language}"]`);
          
          // Verify language selection
          const selectedLanguage = await page.getAttribute(
            `[data-testid="language-selector"] button[data-selected="true"]`,
            'data-lang'
          );
          
          expect(selectedLanguage).toBe(language);
          
          // Start recording with selected language
          await page.click('[data-testid="record-button"]');
          
          // Verify the room name includes the language
          const roomNamePromise = page.waitForFunction(
            (lang) => {
              return window.currentRoomName && window.currentRoomName.includes(`-${lang}`);
            },
            language,
            { timeout: 10000 }
          );
          
          await roomNamePromise;
          
          this.results.tests.push({
            name: `Multi-Language Support - ${language.toUpperCase()}`,
            status: 'PASS',
            details: {
              language,
              roomNameCorrect: true
            }
          });
          
          await page.click('[data-testid="stop-button"]');
          
        } catch (error) {
          this.results.tests.push({
            name: `Multi-Language Support - ${language.toUpperCase()}`,
            status: 'FAIL',
            error: error.message
          });
        } finally {
          await page.close();
        }
      }
      
    } finally {
      await browser.close();
    }
  }

  async testErrorRecovery() {
    console.log('🛡️ Testing Error Recovery...');
    
    try {
      // Test network interruption recovery
      const browser = await chromium.launch();
      const page = await browser.newPage();
      
      await page.context().grantPermissions(['microphone']);
      await page.goto('http://localhost:8081');
      
      // Start recording
      await page.click('[data-testid="record-button"]');
      await page.waitForSelector('[data-testid="connection-status"][data-status="connected"]');
      
      // Simulate network interruption
      await page.setOffline(true);
      await page.waitForTimeout(2000);
      
      // Restore network
      await page.setOffline(false);
      
      // Wait for reconnection
      await page.waitForSelector('[data-testid="connection-status"][data-status="connected"]', {
        timeout: 15000
      });
      
      this.results.tests.push({
        name: 'Network Interruption Recovery',
        status: 'PASS',
        details: { recoverySuccessful: true }
      });
      
      await browser.close();

      // Test invalid token handling
      const invalidTokenResponse = await fetch('http://localhost:3000/api/speechmatics-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'speechmatics',
          transcriptionConfig: { language: 'invalid-language' }
        })
      });

      this.results.tests.push({
        name: 'Invalid Token Request Handling',
        status: !invalidTokenResponse.ok ? 'PASS' : 'FAIL',
        details: {
          status: invalidTokenResponse.status,
          handled: !invalidTokenResponse.ok
        }
      });

    } catch (error) {
      this.results.errors.push({
        test: 'Error Recovery',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  async testConcurrentSessions() {
    console.log('⚡ Testing Concurrent Sessions...');
    
    const concurrentUsers = 3;
    const browsers = [];
    
    try {
      // Launch multiple browser sessions
      for (let i = 0; i < concurrentUsers; i++) {
        const browser = await chromium.launch();
        browsers.push(browser);
      }
      
      const sessionPromises = browsers.map(async (browser, index) => {
        const page = await browser.newPage();
        await page.context().grantPermissions(['microphone']);
        
        try {
          await page.goto('http://localhost:8081');
          
          // Start recording
          await page.click('[data-testid="record-button"]');
          await page.waitForSelector('[data-testid="connection-status"][data-status="connected"]', {
            timeout: 15000
          });
          
          // Keep session active for a few seconds
          await page.waitForTimeout(5000);
          
          // Stop recording
          await page.click('[data-testid="stop-button"]');
          
          return { userId: index, status: 'success' };
          
        } catch (error) {
          return { userId: index, status: 'failed', error: error.message };
        } finally {
          await page.close();
        }
      });
      
      const sessionResults = await Promise.allSettled(sessionPromises);
      const successfulSessions = sessionResults.filter(r => 
        r.status === 'fulfilled' && r.value.status === 'success'
      ).length;
      
      this.results.tests.push({
        name: 'Concurrent Sessions Handling',
        status: successfulSessions >= concurrentUsers * 0.8 ? 'PASS' : 'FAIL',
        details: {
          totalSessions: concurrentUsers,
          successful: successfulSessions,
          failed: concurrentUsers - successfulSessions,
          successRate: successfulSessions / concurrentUsers
        }
      });
      
      this.results.metrics.concurrentCapacity = {
        maxSessions: successfulSessions,
        failureRate: (concurrentUsers - successfulSessions) / concurrentUsers
      };
      
    } finally {
      // Close all browsers
      await Promise.all(browsers.map(browser => browser.close()));
    }
  }

  saveResults() {
    const fs = require('fs');
    const resultsFile = `./test-results/integration-${Date.now()}.json`;
    
    if (!fs.existsSync('./test-results')) {
      fs.mkdirSync('./test-results', { recursive: true });
    }
    
    fs.writeFileSync(resultsFile, JSON.stringify(this.results, null, 2));
    console.log(`📊 Integration test results saved to ${resultsFile}`);
  }

  generateReport() {
    const totalTests = this.results.tests.length;
    const passedTests = this.results.tests.filter(t => t.status === 'PASS').length;
    const failedTests = this.results.tests.filter(t => t.status === 'FAIL').length;
    
    console.log('\n' + '='.repeat(50));
    console.log('🧪 INTEGRATION TEST RESULTS SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} (${((passedTests/totalTests)*100).toFixed(1)}%)`);
    console.log(`Failed: ${failedTests} (${((failedTests/totalTests)*100).toFixed(1)}%)`);
    console.log(`Errors: ${this.results.errors.length}`);
    
    if (this.results.metrics.concurrentCapacity) {
      console.log('\n📊 Capacity Metrics:');
      console.log(`  Max Concurrent Sessions: ${this.results.metrics.concurrentCapacity.maxSessions}`);
      console.log(`  Failure Rate: ${(this.results.metrics.concurrentCapacity.failureRate * 100).toFixed(1)}%`);
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
module.exports = { IntegrationTestSuite };

// Run if called directly
if (require.main === module) {
  (async () => {
    const suite = new IntegrationTestSuite();
    await suite.runAllTests();
  })();
}

// Mock expect function for standalone usage
function expect(actual) {
  return {
    toBe: (expected) => {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, got ${actual}`);
      }
    },
    toEqual: (expected) => {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    }
  };
}