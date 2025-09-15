/**
 * Cross-Platform Browser Testing Matrix
 * Tests across multiple browsers, devices, and network conditions
 */

const { chromium, firefox, webkit } = require('playwright');
const { EventEmitter } = require('events');

// Browser testing matrix configuration
const BROWSER_MATRIX = {
  browsers: [
    { name: 'chromium', engine: chromium, versions: ['latest', 'stable'] },
    { name: 'firefox', engine: firefox, versions: ['latest'] },
    { name: 'webkit', engine: webkit, versions: ['latest'] }
  ],
  
  devices: [
    { name: 'Desktop-1920x1080', viewport: { width: 1920, height: 1080 } },
    { name: 'Desktop-1366x768', viewport: { width: 1366, height: 768 } },
    { name: 'Tablet-768x1024', viewport: { width: 768, height: 1024 } },
    { name: 'Mobile-375x667', viewport: { width: 375, height: 667 } },
    { name: 'Mobile-414x896', viewport: { width: 414, height: 896 } }
  ],
  
  networkConditions: [
    { name: 'Fast-3G', downloadSpeed: 1.6 * 1024, uploadSpeed: 0.768 * 1024, latency: 150 },
    { name: 'Slow-3G', downloadSpeed: 0.5 * 1024, uploadSpeed: 0.5 * 1024, latency: 300 },
    { name: 'WiFi', downloadSpeed: 30 * 1024, uploadSpeed: 15 * 1024, latency: 20 },
    { name: 'Offline', offline: true }
  ],
  
  languages: ['en', 'fr'],
  
  audioFormats: [
    { name: 'PCM-16kHz-Mono', sampleRate: 16000, channels: 1, bitDepth: 16 },
    { name: 'PCM-44kHz-Stereo', sampleRate: 44100, channels: 2, bitDepth: 16 }
  ]
};

class CrossPlatformTestSuite extends EventEmitter {
  constructor() {
    super();
    this.results = {
      timestamp: new Date().toISOString(),
      matrix: {},
      summary: {},
      errors: []
    };
  }

  async runFullMatrix() {
    console.log('🌐 Starting Cross-Platform Browser Matrix Testing...');
    console.log(`Testing ${BROWSER_MATRIX.browsers.length} browsers × ${BROWSER_MATRIX.devices.length} devices × ${BROWSER_MATRIX.networkConditions.length} network conditions`);
    
    for (const browserConfig of BROWSER_MATRIX.browsers) {
      for (const device of BROWSER_MATRIX.devices) {
        for (const network of BROWSER_MATRIX.networkConditions) {
          await this.testBrowserDeviceNetwork(browserConfig, device, network);
        }
      }
    }
    
    this.generateSummary();
    this.saveResults();
    this.generateReport();
  }

  async testBrowserDeviceNetwork(browserConfig, device, network) {
    const testKey = `${browserConfig.name}-${device.name}-${network.name}`;
    console.log(`🔍 Testing: ${testKey}`);
    
    this.results.matrix[testKey] = {
      browser: browserConfig.name,
      device: device.name,
      network: network.name,
      tests: [],
      startTime: new Date().toISOString()
    };

    let browser;
    try {
      browser = await browserConfig.engine.launch({
        headless: true,
        args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
      });
      
      const context = await browser.newContext({
        viewport: device.viewport,
        permissions: ['microphone'],
        ...(network.offline && { offline: true })
      });

      if (!network.offline) {
        await context.route('**/*', route => {
          // Simulate network throttling
          setTimeout(() => route.continue(), network.latency || 0);
        });
      }

      const page = await context.newPage();

      // Core functionality tests
      await this.testPageLoad(page, testKey);
      await this.testMicrophonePermissions(page, testKey);
      await this.testLanguageSelection(page, testKey);
      await this.testConnectionEstablishment(page, testKey, network);
      await this.testAudioProcessing(page, testKey);
      await this.testUIResponsiveness(page, testKey, device);
      
      if (!network.offline) {
        await this.testTranscriptionFlow(page, testKey);
        await this.testSpeakerDiarization(page, testKey);
      }
      
      await this.testSessionCleanup(page, testKey);
      
      this.results.matrix[testKey].endTime = new Date().toISOString();
      this.results.matrix[testKey].status = 'COMPLETED';

    } catch (error) {
      console.error(`❌ Error in ${testKey}:`, error.message);
      this.results.errors.push({
        testKey,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      this.results.matrix[testKey].status = 'FAILED';
      this.results.matrix[testKey].error = error.message;
      
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  async testPageLoad(page, testKey) {
    try {
      const startTime = Date.now();
      await page.goto('http://localhost:8081', { waitUntil: 'networkidle' });
      const loadTime = Date.now() - startTime;
      
      // Check if essential elements are present
      const recordButton = await page.$('[data-testid="record-button"]');
      const languageSelector = await page.$('[data-testid="language-selector"]');
      
      this.results.matrix[testKey].tests.push({
        name: 'Page Load',
        status: recordButton && languageSelector ? 'PASS' : 'FAIL',
        duration: loadTime,
        details: {
          recordButtonPresent: !!recordButton,
          languageSelectorPresent: !!languageSelector,
          loadTime
        }
      });

    } catch (error) {
      this.results.matrix[testKey].tests.push({
        name: 'Page Load',
        status: 'FAIL',
        error: error.message
      });
    }
  }

  async testMicrophonePermissions(page, testKey) {
    try {
      const permissionResult = await page.evaluate(async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(track => track.stop());
          return { success: true, error: null };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

      this.results.matrix[testKey].tests.push({
        name: 'Microphone Permissions',
        status: permissionResult.success ? 'PASS' : 'FAIL',
        details: permissionResult
      });

    } catch (error) {
      this.results.matrix[testKey].tests.push({
        name: 'Microphone Permissions',
        status: 'FAIL',
        error: error.message
      });
    }
  }

  async testLanguageSelection(page, testKey) {
    try {
      for (const language of BROWSER_MATRIX.languages) {
        const languageButton = await page.$(`[data-testid="language-selector"] button[data-lang="${language}"]`);
        
        if (languageButton) {
          await languageButton.click();
          
          // Verify selection
          const isSelected = await page.$eval(
            `[data-testid="language-selector"] button[data-lang="${language}"]`,
            el => el.getAttribute('data-selected') === 'true'
          );
          
          this.results.matrix[testKey].tests.push({
            name: `Language Selection - ${language.toUpperCase()}`,
            status: isSelected ? 'PASS' : 'FAIL',
            details: { language, selected: isSelected }
          });
        }
      }

    } catch (error) {
      this.results.matrix[testKey].tests.push({
        name: 'Language Selection',
        status: 'FAIL',
        error: error.message
      });
    }
  }

  async testConnectionEstablishment(page, testKey, network) {
    if (network.offline) {
      // Test offline behavior
      try {
        await page.click('[data-testid="record-button"]');
        
        // Should show offline message or handle gracefully
        await page.waitForSelector('[data-testid="offline-message"]', { timeout: 5000 });
        
        this.results.matrix[testKey].tests.push({
          name: 'Offline Connection Handling',
          status: 'PASS',
          details: { offlineHandled: true }
        });

      } catch (error) {
        this.results.matrix[testKey].tests.push({
          name: 'Offline Connection Handling',
          status: 'FAIL',
          error: error.message
        });
      }
      return;
    }

    try {
      const startTime = Date.now();
      await page.click('[data-testid="record-button"]');
      
      // Wait for connection with timeout based on network conditions
      const timeout = network.name === 'Slow-3G' ? 30000 : 15000;
      await page.waitForSelector('[data-testid="connection-status"][data-status="connected"]', {
        timeout
      });
      
      const connectionTime = Date.now() - startTime;
      
      this.results.matrix[testKey].tests.push({
        name: 'Connection Establishment',
        status: 'PASS',
        duration: connectionTime,
        details: {
          networkCondition: network.name,
          connectionTime,
          withinExpectedRange: connectionTime < timeout
        }
      });

    } catch (error) {
      this.results.matrix[testKey].tests.push({
        name: 'Connection Establishment',
        status: 'FAIL',
        error: error.message
      });
    }
  }

  async testAudioProcessing(page, testKey) {
    try {
      // Test audio constraints and processing
      const audioInfo = await page.evaluate(async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              sampleRate: 16000,
              channelCount: 1
            }
          });
          
          const track = stream.getAudioTracks()[0];
          const settings = track.getSettings();
          const constraints = track.getConstraints();
          
          stream.getTracks().forEach(t => t.stop());
          
          return {
            success: true,
            settings,
            constraints,
            supportedConstraints: navigator.mediaDevices.getSupportedConstraints()
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

      this.results.matrix[testKey].tests.push({
        name: 'Audio Processing Setup',
        status: audioInfo.success ? 'PASS' : 'FAIL',
        details: audioInfo
      });

    } catch (error) {
      this.results.matrix[testKey].tests.push({
        name: 'Audio Processing Setup',
        status: 'FAIL',
        error: error.message
      });
    }
  }

  async testUIResponsiveness(page, testKey, device) {
    try {
      // Test touch interactions on mobile devices
      if (device.name.includes('Mobile') || device.name.includes('Tablet')) {
        // Simulate touch events
        await page.touchscreen.tap(100, 100);
        
        // Test pinch zoom
        await page.touchscreen.tap(200, 200);
        await page.touchscreen.tap(300, 300);
      }

      // Test keyboard navigation
      await page.keyboard.press('Tab');
      const focusedElement = await page.evaluate(() => document.activeElement.tagName);
      
      // Test window resize handling
      await page.setViewportSize({ 
        width: device.viewport.width * 0.8, 
        height: device.viewport.height * 0.8 
      });
      
      await page.waitForTimeout(500); // Let layout stabilize
      
      // Verify UI adapts correctly
      const isResponsive = await page.evaluate(() => {
        const container = document.querySelector('[data-testid="main-container"]');
        return container && container.offsetWidth > 0;
      });

      this.results.matrix[testKey].tests.push({
        name: 'UI Responsiveness',
        status: isResponsive ? 'PASS' : 'FAIL',
        details: {
          device: device.name,
          focusedElement,
          responsive: isResponsive
        }
      });

    } catch (error) {
      this.results.matrix[testKey].tests.push({
        name: 'UI Responsiveness',
        status: 'FAIL',
        error: error.message
      });
    }
  }

  async testTranscriptionFlow(page, testKey) {
    try {
      // Simulate transcription data reception
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('mock-transcription', {
          detail: {
            type: 'transcription',
            speaker: 'M1',
            text: 'This is a test transcription for cross-platform validation',
            timestamp: Date.now()
          }
        }));
      });

      // Wait for transcription message to appear
      await page.waitForSelector('[data-testid="transcription-message"]', {
        timeout: 5000
      });

      const transcriptionCount = await page.$$eval(
        '[data-testid="transcription-message"]',
        elements => elements.length
      );

      this.results.matrix[testKey].tests.push({
        name: 'Transcription Flow',
        status: transcriptionCount > 0 ? 'PASS' : 'FAIL',
        details: { transcriptionCount }
      });

    } catch (error) {
      this.results.matrix[testKey].tests.push({
        name: 'Transcription Flow',
        status: 'FAIL',
        error: error.message
      });
    }
  }

  async testSpeakerDiarization(page, testKey) {
    try {
      // Simulate multiple speakers
      const speakers = ['M1', 'F1', 'M2'];
      
      for (let i = 0; i < speakers.length; i++) {
        await page.evaluate((speaker, index) => {
          window.dispatchEvent(new CustomEvent('mock-transcription', {
            detail: {
              type: 'transcription',
              speaker,
              text: `Message from speaker ${speaker}`,
              timestamp: Date.now() + index * 1000
            }
          }));
        }, speakers[i], i);
      }

      await page.waitForTimeout(2000); // Let all messages appear

      const speakerColors = await page.evaluate(() => {
        const messages = document.querySelectorAll('[data-testid="transcription-message"]');
        const colors = new Set();
        messages.forEach(msg => {
          const style = window.getComputedStyle(msg);
          colors.add(style.backgroundColor);
        });
        return Array.from(colors);
      });

      this.results.matrix[testKey].tests.push({
        name: 'Speaker Diarization',
        status: speakerColors.length >= 2 ? 'PASS' : 'FAIL',
        details: {
          uniqueColors: speakerColors.length,
          speakerCount: speakers.length
        }
      });

    } catch (error) {
      this.results.matrix[testKey].tests.push({
        name: 'Speaker Diarization',
        status: 'FAIL',
        error: error.message
      });
    }
  }

  async testSessionCleanup(page, testKey) {
    try {
      // Test stop functionality
      await page.click('[data-testid="stop-button"]');
      
      // Verify cleanup
      await page.waitForSelector('[data-testid="welcome-screen"]', {
        timeout: 5000
      });

      const messagesAfterStop = await page.$$('[data-testid="transcription-message"]');
      
      this.results.matrix[testKey].tests.push({
        name: 'Session Cleanup',
        status: messagesAfterStop.length === 0 ? 'PASS' : 'FAIL',
        details: {
          messagesCleared: messagesAfterStop.length === 0,
          remainingMessages: messagesAfterStop.length
        }
      });

    } catch (error) {
      this.results.matrix[testKey].tests.push({
        name: 'Session Cleanup',
        status: 'FAIL',
        error: error.message
      });
    }
  }

  generateSummary() {
    const allTests = [];
    const matrixKeys = Object.keys(this.results.matrix);
    
    matrixKeys.forEach(key => {
      if (this.results.matrix[key].tests) {
        allTests.push(...this.results.matrix[key].tests);
      }
    });

    const totalTests = allTests.length;
    const passedTests = allTests.filter(t => t.status === 'PASS').length;
    const failedTests = allTests.filter(t => t.status === 'FAIL').length;

    this.results.summary = {
      totalCombinations: matrixKeys.length,
      completedCombinations: matrixKeys.filter(k => this.results.matrix[k].status === 'COMPLETED').length,
      failedCombinations: matrixKeys.filter(k => this.results.matrix[k].status === 'FAILED').length,
      totalTests,
      passedTests,
      failedTests,
      passRate: totalTests > 0 ? (passedTests / totalTests) * 100 : 0,
      
      // Browser-specific summary
      browsers: {},
      devices: {},
      networks: {}
    };

    // Generate per-browser summary
    BROWSER_MATRIX.browsers.forEach(browser => {
      const browserTests = allTests.filter(t => 
        matrixKeys.some(k => k.includes(browser.name) && this.results.matrix[k].tests.includes(t))
      );
      
      this.results.summary.browsers[browser.name] = {
        total: browserTests.length,
        passed: browserTests.filter(t => t.status === 'PASS').length,
        failed: browserTests.filter(t => t.status === 'FAIL').length
      };
    });

    // Generate per-device summary
    BROWSER_MATRIX.devices.forEach(device => {
      const deviceTests = allTests.filter(t => 
        matrixKeys.some(k => k.includes(device.name) && this.results.matrix[k].tests.includes(t))
      );
      
      this.results.summary.devices[device.name] = {
        total: deviceTests.length,
        passed: deviceTests.filter(t => t.status === 'PASS').length,
        failed: deviceTests.filter(t => t.status === 'FAIL').length
      };
    });

    // Generate per-network summary
    BROWSER_MATRIX.networkConditions.forEach(network => {
      const networkTests = allTests.filter(t => 
        matrixKeys.some(k => k.includes(network.name) && this.results.matrix[k].tests.includes(t))
      );
      
      this.results.summary.networks[network.name] = {
        total: networkTests.length,
        passed: networkTests.filter(t => t.status === 'PASS').length,
        failed: networkTests.filter(t => t.status === 'FAIL').length
      };
    });
  }

  saveResults() {
    const fs = require('fs');
    const resultsFile = `./test-results/cross-platform-${Date.now()}.json`;
    
    if (!fs.existsSync('./test-results')) {
      fs.mkdirSync('./test-results', { recursive: true });
    }
    
    fs.writeFileSync(resultsFile, JSON.stringify(this.results, null, 2));
    console.log(`📊 Cross-platform test results saved to ${resultsFile}`);
  }

  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('🌐 CROSS-PLATFORM TEST RESULTS SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Combinations: ${this.results.summary.totalCombinations}`);
    console.log(`Completed: ${this.results.summary.completedCombinations}`);
    console.log(`Failed: ${this.results.summary.failedCombinations}`);
    console.log(`Total Tests: ${this.results.summary.totalTests}`);
    console.log(`Pass Rate: ${this.results.summary.passRate.toFixed(1)}%`);

    console.log('\n📊 Browser Performance:');
    Object.entries(this.results.summary.browsers).forEach(([browser, stats]) => {
      const rate = stats.total > 0 ? ((stats.passed / stats.total) * 100).toFixed(1) : 0;
      console.log(`  ${browser}: ${rate}% (${stats.passed}/${stats.total})`);
    });

    console.log('\n📱 Device Performance:');
    Object.entries(this.results.summary.devices).forEach(([device, stats]) => {
      const rate = stats.total > 0 ? ((stats.passed / stats.total) * 100).toFixed(1) : 0;
      console.log(`  ${device}: ${rate}% (${stats.passed}/${stats.total})`);
    });

    console.log('\n🌐 Network Performance:');
    Object.entries(this.results.summary.networks).forEach(([network, stats]) => {
      const rate = stats.total > 0 ? ((stats.passed / stats.total) * 100).toFixed(1) : 0;
      console.log(`  ${network}: ${rate}% (${stats.passed}/${stats.total})`);
    });

    if (this.results.errors.length > 0) {
      console.log('\n❌ Critical Errors:');
      this.results.errors.forEach(error => {
        console.log(`  ${error.testKey}: ${error.error}`);
      });
    }

    console.log('='.repeat(60));
  }
}

module.exports = { CrossPlatformTestSuite, BROWSER_MATRIX };

if (require.main === module) {
  (async () => {
    const suite = new CrossPlatformTestSuite();
    await suite.runFullMatrix();
  })();
}