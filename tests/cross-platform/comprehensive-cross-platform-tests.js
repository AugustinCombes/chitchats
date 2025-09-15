/**
 * Comprehensive Cross-Platform Validation Tests
 * Tests for Web browsers, React Native iOS/Android, audio permissions, and network conditions
 */

const { chromium, firefox, webkit } = require('playwright');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// Cross-platform test configuration
const CROSS_PLATFORM_CONFIG = {
  timeout: 90000,
  
  // Browser matrix for web testing
  browsers: {
    desktop: [
      { name: 'chromium', engine: 'Blink', platform: 'desktop' },
      { name: 'firefox', engine: 'Gecko', platform: 'desktop' },
      { name: 'webkit', engine: 'WebKit', platform: 'desktop' }
    ],
    mobile: [
      { name: 'chromium-mobile', engine: 'Blink', platform: 'mobile' },
      { name: 'webkit-mobile', engine: 'WebKit', platform: 'mobile' }
    ]
  },
  
  // Device viewports for mobile testing
  devices: {
    'iPhone SE': { width: 375, height: 667, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15' },
    'iPhone 12 Pro': { width: 390, height: 844, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15' },
    'iPhone 12 Pro Max': { width: 428, height: 926, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15' },
    'iPad': { width: 768, height: 1024, userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15' },
    'Samsung Galaxy S21': { width: 384, height: 854, userAgent: 'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36' },
    'Samsung Galaxy S21 Ultra': { width: 412, height: 915, userAgent: 'Mozilla/5.0 (Linux; Android 11; SM-G998B) AppleWebKit/537.36' },
    'Google Pixel 5': { width: 393, height: 851, userAgent: 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36' },
    'Desktop 1920x1080': { width: 1920, height: 1080, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    'Desktop 1366x768': { width: 1366, height: 768, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    'MacBook Pro 13': { width: 1280, height: 800, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15' }
  },
  
  // Network conditions for testing
  networkConditions: [
    {
      name: 'Fast 3G',
      downloadThroughput: 1.6 * 1024 * 1024 / 8, // 1.6 Mbps
      uploadThroughput: 750 * 1024 / 8, // 750 Kbps
      latency: 150 // 150ms
    },
    {
      name: 'Slow 3G',
      downloadThroughput: 500 * 1024 / 8, // 500 Kbps
      uploadThroughput: 500 * 1024 / 8, // 500 Kbps
      latency: 300 // 300ms
    },
    {
      name: 'WiFi',
      downloadThroughput: 30 * 1024 * 1024 / 8, // 30 Mbps
      uploadThroughput: 15 * 1024 * 1024 / 8, // 15 Mbps
      latency: 20 // 20ms
    },
    {
      name: 'Offline',
      downloadThroughput: 0,
      uploadThroughput: 0,
      latency: 0
    }
  ],
  
  // Audio permission scenarios
  audioPermissions: [
    { scenario: 'granted', permission: 'granted' },
    { scenario: 'denied', permission: 'denied' },
    { scenario: 'prompt', permission: 'prompt' }
  ],
  
  // Feature detection tests
  featureTests: [
    'mediaDevices',
    'getUserMedia',
    'webkitGetUserMedia',
    'mozGetUserMedia',
    'WebRTC',
    'fetch',
    'Promise',
    'localStorage',
    'sessionStorage',
    'WebSocket',
    'EventSource'
  ],
  
  // React Native simulation tests (these would be run on actual devices)
  reactNativeTests: [
    'audio-session-setup',
    'livekit-integration',
    'speechmatics-token-generation',
    'language-switching',
    'permission-handling',
    'background-mode-handling'
  ]
};

class ComprehensiveCrossPlatformTestSuite {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      testType: 'cross-platform-validation',
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        warnings: 0
      },
      browserCompatibility: {},
      deviceCompatibility: {},
      networkCompatibility: {},
      audioPermissions: {},
      featureSupport: {},
      reactNativeCompat: {},
      performanceMetrics: {},
      errors: [],
      warnings: []
    };
  }

  async runAllCrossPlatformTests() {
    console.log('🌐 Starting Comprehensive Cross-Platform Testing...');
    console.log('📱 Testing Web browsers, mobile devices, network conditions, and React Native compatibility');
    
    try {
      // Phase 1: Desktop Browser Testing
      await this.testDesktopBrowsers();
      
      // Phase 2: Mobile Browser Testing
      await this.testMobileBrowsers();
      
      // Phase 3: Device-Specific Testing
      await this.testSpecificDevices();
      
      // Phase 4: Network Condition Testing
      await this.testNetworkConditions();
      
      // Phase 5: Audio Permission Testing
      await this.testAudioPermissions();
      
      // Phase 6: Feature Detection Testing
      await this.testFeatureSupport();
      
      // Phase 7: React Native Compatibility Testing
      await this.testReactNativeCompatibility();
      
      // Phase 8: Performance Across Platforms
      await this.testCrossPlatformPerformance();
      
      this.generateCompatibilityMatrix();
      this.saveCrossPlatformResults();
      this.generateCrossPlatformReport();
      
    } catch (error) {
      console.error('❌ Cross-platform testing failed:', error);
      this.results.errors.push({
        test: 'Cross-Platform Test Suite',
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  async testDesktopBrowsers() {
    console.log('🖥️  Testing Desktop Browsers...');
    
    for (const browser of CROSS_PLATFORM_CONFIG.browsers.desktop) {
      console.log(`  Testing ${browser.name} (${browser.engine})...`);
      
      try {
        const browserInstance = await this.launchBrowser(browser.name);
        const context = await browserInstance.newContext({
          viewport: { width: 1920, height: 1080 },
          permissions: ['microphone']
        });
        const page = await context.newPage();
        
        const browserResults = await this.runBrowserTestSuite(page, browser);
        this.results.browserCompatibility[browser.name] = browserResults;
        
        await browserInstance.close();
        
      } catch (error) {
        this.results.errors.push({
          test: `Desktop Browser - ${browser.name}`,
          error: error.message,
          timestamp: new Date().toISOString()
        });
        
        this.results.browserCompatibility[browser.name] = {
          status: 'FAILED',
          error: error.message,
          tests: []
        };
      }
    }
  }

  async testMobileBrowsers() {
    console.log('📱 Testing Mobile Browsers...');
    
    const mobileBrowsers = [
      { name: 'chromium', platform: 'android' },
      { name: 'webkit', platform: 'ios' }
    ];
    
    for (const browser of mobileBrowsers) {
      console.log(`  Testing ${browser.name} on ${browser.platform}...`);
      
      try {
        const browserInstance = await this.launchBrowser(browser.name);
        const context = await browserInstance.newContext({
          viewport: { width: 375, height: 667 },
          isMobile: true,
          hasTouch: true,
          permissions: ['microphone'],
          userAgent: browser.platform === 'ios' ? 
            CROSS_PLATFORM_CONFIG.devices['iPhone SE'].userAgent :
            CROSS_PLATFORM_CONFIG.devices['Samsung Galaxy S21'].userAgent
        });
        const page = await context.newPage();
        
        const mobileResults = await this.runMobileBrowserTestSuite(page, browser);
        this.results.browserCompatibility[`${browser.name}-mobile`] = mobileResults;
        
        await browserInstance.close();
        
      } catch (error) {
        this.results.errors.push({
          test: `Mobile Browser - ${browser.name}`,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  async runBrowserTestSuite(page, browser) {
    const results = {
      browser: browser.name,
      engine: browser.engine,
      platform: browser.platform,
      status: 'UNKNOWN',
      tests: [],
      features: {},
      performance: {}
    };
    
    try {
      // Test 1: Page Load
      const loadStart = Date.now();
      await page.goto('http://localhost:8081', { waitUntil: 'networkidle' });
      const loadTime = Date.now() - loadStart;
      
      results.tests.push({
        name: 'Page Load',
        status: loadTime < 10000 ? 'PASS' : 'FAIL',
        duration: loadTime,
        details: { loadTime }
      });
      
      // Test 2: JavaScript Features
      const jsFeatures = await page.evaluate(() => {
        return {
          es6Support: typeof Promise !== 'undefined',
          fetchSupport: typeof fetch !== 'undefined',
          asyncAwaitSupport: (async () => true)().constructor === Promise,
          arrowFunctions: (() => true)() === true,
          destructuring: (() => { try { const [a] = [1]; return true; } catch { return false; } })(),
          classes: (() => { try { class Test {} return true; } catch { return false; } })()
        };
      });
      
      const jsSupport = Object.values(jsFeatures).every(v => v);
      results.tests.push({
        name: 'JavaScript ES6+ Features',
        status: jsSupport ? 'PASS' : 'FAIL',
        details: jsFeatures
      });
      
      // Test 3: WebRTC Support
      const webrtcSupport = await page.evaluate(() => {
        return {
          rtcPeerConnection: typeof RTCPeerConnection !== 'undefined',
          getUserMedia: typeof navigator.mediaDevices?.getUserMedia !== 'undefined',
          webkitGetUserMedia: typeof navigator.webkitGetUserMedia !== 'undefined',
          mozGetUserMedia: typeof navigator.mozGetUserMedia !== 'undefined'
        };
      });
      
      const hasWebRTC = webrtcSupport.rtcPeerConnection && 
                       (webrtcSupport.getUserMedia || webrtcSupport.webkitGetUserMedia || webrtcSupport.mozGetUserMedia);
      
      results.tests.push({
        name: 'WebRTC Support',
        status: hasWebRTC ? 'PASS' : 'FAIL',
        details: webrtcSupport
      });
      
      // Test 4: Audio Context Support
      const audioSupport = await page.evaluate(() => {
        return {
          audioContext: typeof AudioContext !== 'undefined',
          webkitAudioContext: typeof webkitAudioContext !== 'undefined',
          audioWorklet: typeof AudioWorkletNode !== 'undefined'
        };
      });
      
      const hasAudio = audioSupport.audioContext || audioSupport.webkitAudioContext;
      results.tests.push({
        name: 'Audio Context Support',
        status: hasAudio ? 'PASS' : 'FAIL',
        details: audioSupport
      });
      
      // Test 5: Token Generation API
      const tokenTest = await page.evaluate(async () => {
        try {
          const response = await fetch('/api/speechmatics-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'speechmatics',
              transcriptionConfig: { language: 'en' }
            })
          });
          
          const data = await response.json();
          return {
            success: response.ok,
            hasToken: !!data.token,
            status: response.status
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      });
      
      results.tests.push({
        name: 'API Integration',
        status: tokenTest.success ? 'PASS' : 'FAIL',
        details: tokenTest
      });
      
      // Test 6: Local Storage
      const storageTest = await page.evaluate(() => {
        try {
          localStorage.setItem('test', 'value');
          const retrieved = localStorage.getItem('test');
          localStorage.removeItem('test');
          return {
            localStorage: retrieved === 'value',
            sessionStorage: typeof sessionStorage !== 'undefined'
          };
        } catch (error) {
          return {
            localStorage: false,
            sessionStorage: false,
            error: error.message
          };
        }
      });
      
      results.tests.push({
        name: 'Storage Support',
        status: storageTest.localStorage ? 'PASS' : 'FAIL',
        details: storageTest
      });
      
      // Calculate overall status
      const passedTests = results.tests.filter(t => t.status === 'PASS').length;
      const totalTests = results.tests.length;
      results.status = passedTests === totalTests ? 'FULL_SUPPORT' : 
                      passedTests > totalTests * 0.8 ? 'GOOD_SUPPORT' : 
                      passedTests > totalTests * 0.5 ? 'PARTIAL_SUPPORT' : 'POOR_SUPPORT';
      
      results.performance.loadTime = loadTime;
      
    } catch (error) {
      results.status = 'ERROR';
      results.error = error.message;
    }
    
    return results;
  }

  async runMobileBrowserTestSuite(page, browser) {
    const results = {
      browser: `${browser.name}-mobile`,
      platform: browser.platform,
      status: 'UNKNOWN',
      tests: [],
      mobileFeatures: {},
      performance: {}
    };
    
    try {
      await page.goto('http://localhost:8081');
      
      // Mobile-specific tests
      const mobileFeatures = await page.evaluate(() => {
        return {
          touchSupport: 'ontouchstart' in window,
          orientationSupport: typeof window.orientation !== 'undefined',
          deviceMotion: typeof DeviceMotionEvent !== 'undefined',
          deviceOrientation: typeof DeviceOrientationEvent !== 'undefined',
          vibration: typeof navigator.vibrate !== 'undefined',
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
            devicePixelRatio: window.devicePixelRatio
          }
        };
      });
      
      results.tests.push({
        name: 'Mobile Features',
        status: mobileFeatures.touchSupport ? 'PASS' : 'FAIL',
        details: mobileFeatures
      });
      
      // Test responsive design
      const responsiveTest = await page.evaluate(() => {
        const viewportMeta = document.querySelector('meta[name="viewport"]');
        const hasFlexbox = CSS.supports('display', 'flex');
        const hasGrid = CSS.supports('display', 'grid');
        
        return {
          viewportMeta: !!viewportMeta,
          viewportContent: viewportMeta?.content || '',
          cssFlexbox: hasFlexbox,
          cssGrid: hasGrid,
          responsiveImages: document.querySelectorAll('img[srcset]').length > 0
        };
      });
      
      results.tests.push({
        name: 'Responsive Design',
        status: responsiveTest.viewportMeta && responsiveTest.cssFlexbox ? 'PASS' : 'FAIL',
        details: responsiveTest
      });
      
      // Test touch interactions
      const touchTest = await page.evaluate(() => {
        const elements = document.querySelectorAll('button, [role="button"]');
        let touchFriendly = 0;
        
        elements.forEach(el => {
          const rect = el.getBoundingClientRect();
          const size = Math.min(rect.width, rect.height);
          if (size >= 44) touchFriendly++; // 44px is iOS recommended minimum
        });
        
        return {
          totalButtons: elements.length,
          touchFriendlyButtons: touchFriendly,
          ratio: elements.length > 0 ? touchFriendly / elements.length : 1
        };
      });
      
      results.tests.push({
        name: 'Touch Interaction',
        status: touchTest.ratio > 0.8 ? 'PASS' : 'WARN',
        details: touchTest
      });
      
      results.mobileFeatures = mobileFeatures;
      
      const passedTests = results.tests.filter(t => t.status === 'PASS').length;
      const totalTests = results.tests.length;
      results.status = passedTests === totalTests ? 'FULL_SUPPORT' : 
                      passedTests > totalTests * 0.8 ? 'GOOD_SUPPORT' : 
                      'NEEDS_WORK';
      
    } catch (error) {
      results.status = 'ERROR';
      results.error = error.message;
    }
    
    return results;
  }

  async testSpecificDevices() {
    console.log('📱 Testing Specific Device Configurations...');
    
    for (const [deviceName, deviceConfig] of Object.entries(CROSS_PLATFORM_CONFIG.devices)) {
      console.log(`  Testing ${deviceName}...`);
      
      try {
        const browser = await chromium.launch();
        const context = await browser.newContext({
          viewport: { width: deviceConfig.width, height: deviceConfig.height },
          userAgent: deviceConfig.userAgent,
          isMobile: deviceName.includes('iPhone') || deviceName.includes('Samsung') || deviceName.includes('Pixel'),
          hasTouch: deviceName.includes('iPhone') || deviceName.includes('Samsung') || deviceName.includes('Pixel') || deviceName.includes('iPad'),
          permissions: ['microphone']
        });
        const page = await context.newPage();
        
        const deviceResults = await this.runDeviceTestSuite(page, deviceName, deviceConfig);
        this.results.deviceCompatibility[deviceName] = deviceResults;
        
        await browser.close();
        
      } catch (error) {
        this.results.errors.push({
          test: `Device - ${deviceName}`,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  async runDeviceTestSuite(page, deviceName, deviceConfig) {
    const results = {
      device: deviceName,
      viewport: { width: deviceConfig.width, height: deviceConfig.height },
      tests: [],
      layoutMetrics: {},
      status: 'UNKNOWN'
    };
    
    try {
      await page.goto('http://localhost:8081');
      
      // Test layout adaptation
      const layoutTest = await page.evaluate(() => {
        const body = document.body;
        const container = document.querySelector('[data-testid="app-container"]') || body;
        
        return {
          bodyWidth: body.offsetWidth,
          bodyHeight: body.offsetHeight,
          containerWidth: container.offsetWidth,
          containerHeight: container.offsetHeight,
          hasHorizontalScrollbar: body.scrollWidth > window.innerWidth,
          hasVerticalScrollbar: body.scrollHeight > window.innerHeight,
          elementsOverflowing: document.querySelectorAll('*').length // Simplified check
        };
      });
      
      results.tests.push({
        name: 'Layout Adaptation',
        status: !layoutTest.hasHorizontalScrollbar ? 'PASS' : 'FAIL',
        details: layoutTest
      });
      
      // Test interactive elements sizing
      const interactionTest = await page.evaluate(() => {
        const interactiveElements = document.querySelectorAll('button, input, select, textarea, [role="button"]');
        const minTouchTarget = 44; // pixels
        let properSized = 0;
        
        const elementSizes = [];
        interactiveElements.forEach(el => {
          const rect = el.getBoundingClientRect();
          const size = Math.min(rect.width, rect.height);
          elementSizes.push({ tagName: el.tagName, width: rect.width, height: rect.height });
          if (size >= minTouchTarget) properSized++;
        });
        
        return {
          totalElements: interactiveElements.length,
          properlySizedElements: properSized,
          compliance: interactiveElements.length > 0 ? properSized / interactiveElements.length : 1,
          elementSizes: elementSizes.slice(0, 10) // First 10 for brevity
        };
      });
      
      results.tests.push({
        name: 'Touch Target Sizing',
        status: interactionTest.compliance > 0.9 ? 'PASS' : interactionTest.compliance > 0.7 ? 'WARN' : 'FAIL',
        details: interactionTest
      });
      
      // Test font scaling
      const fontTest = await page.evaluate(() => {
        const textElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, div');
        const fontSizes = [];
        const minReadableSize = 16; // pixels for mobile
        let readableCount = 0;
        
        for (let i = 0; i < Math.min(textElements.length, 20); i++) {
          const el = textElements[i];
          const style = window.getComputedStyle(el);
          const fontSize = parseFloat(style.fontSize);
          fontSizes.push(fontSize);
          if (fontSize >= minReadableSize) readableCount++;
        }
        
        return {
          sampledElements: fontSizes.length,
          readableElements: readableCount,
          averageFontSize: fontSizes.reduce((sum, size) => sum + size, 0) / fontSizes.length,
          compliance: fontSizes.length > 0 ? readableCount / fontSizes.length : 1
        };
      });
      
      results.tests.push({
        name: 'Font Readability',
        status: fontTest.compliance > 0.8 ? 'PASS' : 'WARN',
        details: fontTest
      });
      
      results.layoutMetrics = { layoutTest, interactionTest, fontTest };
      
      const passedTests = results.tests.filter(t => t.status === 'PASS').length;
      const totalTests = results.tests.length;
      results.status = passedTests === totalTests ? 'OPTIMIZED' : 
                      passedTests > totalTests * 0.8 ? 'GOOD' : 'NEEDS_OPTIMIZATION';
      
    } catch (error) {
      results.status = 'ERROR';
      results.error = error.message;
    }
    
    return results;
  }

  async testNetworkConditions() {
    console.log('🌐 Testing Network Conditions...');
    
    for (const condition of CROSS_PLATFORM_CONFIG.networkConditions) {
      console.log(`  Testing ${condition.name} network...`);
      
      try {
        const browser = await chromium.launch();
        const context = await browser.newContext();
        const page = await context.newPage();
        
        // Apply network throttling
        if (condition.name !== 'Offline') {
          await page.route('**/*', async route => {
            // Add artificial delay based on latency
            await new Promise(resolve => setTimeout(resolve, condition.latency));
            await route.continue();
          });
        } else {
          // Simulate offline by blocking all requests
          await page.route('**/*', route => route.abort());
        }
        
        const networkResults = await this.runNetworkTestSuite(page, condition);
        this.results.networkCompatibility[condition.name] = networkResults;
        
        await browser.close();
        
      } catch (error) {
        this.results.errors.push({
          test: `Network - ${condition.name}`,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  async runNetworkTestSuite(page, condition) {
    const results = {
      condition: condition.name,
      latency: condition.latency,
      downloadSpeed: condition.downloadThroughput,
      tests: [],
      performance: {},
      status: 'UNKNOWN'
    };
    
    try {
      if (condition.name === 'Offline') {
        // Test offline functionality
        const offlineTest = await page.evaluate(() => {
          return {
            offlineSupported: typeof navigator.onLine !== 'undefined',
            serviceWorkerSupported: 'serviceWorker' in navigator,
            cacheApiSupported: 'caches' in window
          };
        });
        
        results.tests.push({
          name: 'Offline Support',
          status: offlineTest.serviceWorkerSupported ? 'PASS' : 'SKIP',
          details: offlineTest
        });
        
        results.status = 'OFFLINE_TESTED';
        return results;
      }
      
      // Test page loading under network condition
      const loadStart = Date.now();
      try {
        await page.goto('http://localhost:8081', { 
          waitUntil: 'networkidle',
          timeout: condition.name === 'Slow 3G' ? 60000 : 30000
        });
        const loadTime = Date.now() - loadStart;
        
        results.tests.push({
          name: 'Page Load Performance',
          status: loadTime < (condition.name === 'Slow 3G' ? 30000 : 15000) ? 'PASS' : 'FAIL',
          duration: loadTime,
          details: { loadTime, condition: condition.name }
        });
        
        results.performance.pageLoadTime = loadTime;
      } catch (error) {
        results.tests.push({
          name: 'Page Load Performance',
          status: 'TIMEOUT',
          error: error.message
        });
      }
      
      // Test API response under network condition
      const apiStart = Date.now();
      const apiTest = await page.evaluate(async () => {
        try {
          const response = await fetch('/api/speechmatics-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'speechmatics',
              transcriptionConfig: { language: 'en' }
            })
          });
          
          return {
            success: response.ok,
            status: response.status,
            hasToken: response.ok ? !!(await response.json()).token : false
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      });
      const apiTime = Date.now() - apiStart;
      
      results.tests.push({
        name: 'API Response Performance',
        status: apiTest.success && apiTime < 10000 ? 'PASS' : 'FAIL',
        duration: apiTime,
        details: { ...apiTest, responseTime: apiTime }
      });
      
      results.performance.apiResponseTime = apiTime;
      
      // Test resource loading efficiency
      const resourceTest = await page.evaluate(() => {
        const resources = performance.getEntriesByType('resource');
        const totalSize = resources.reduce((sum, resource) => sum + (resource.transferSize || 0), 0);
        const totalTime = resources.reduce((sum, resource) => sum + resource.duration, 0);
        
        return {
          resourceCount: resources.length,
          totalSize,
          totalTime: totalTime / resources.length, // Average time per resource
          efficientResources: resources.filter(r => r.duration < 1000).length
        };
      });
      
      results.tests.push({
        name: 'Resource Loading Efficiency',
        status: resourceTest.efficientResources / resourceTest.resourceCount > 0.8 ? 'PASS' : 'WARN',
        details: resourceTest
      });
      
      const passedTests = results.tests.filter(t => t.status === 'PASS').length;
      const totalTests = results.tests.length;
      results.status = passedTests === totalTests ? 'EXCELLENT' : 
                      passedTests > totalTests * 0.8 ? 'GOOD' : 'POOR';
      
    } catch (error) {
      results.status = 'ERROR';
      results.error = error.message;
    }
    
    return results;
  }

  async testAudioPermissions() {
    console.log('🎤 Testing Audio Permission Scenarios...');
    
    for (const permissionScenario of CROSS_PLATFORM_CONFIG.audioPermissions) {
      console.log(`  Testing ${permissionScenario.scenario} permission...`);
      
      try {
        const browser = await chromium.launch();
        const context = await browser.newContext({
          permissions: permissionScenario.permission === 'granted' ? ['microphone'] : []
        });
        const page = await context.newPage();
        
        if (permissionScenario.permission === 'denied') {
          await context.setPermissions('http://localhost:8081', []);
        }
        
        const permissionResults = await this.runAudioPermissionTestSuite(page, permissionScenario);
        this.results.audioPermissions[permissionScenario.scenario] = permissionResults;
        
        await browser.close();
        
      } catch (error) {
        this.results.errors.push({
          test: `Audio Permission - ${permissionScenario.scenario}`,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  async runAudioPermissionTestSuite(page, scenario) {
    const results = {
      scenario: scenario.scenario,
      permission: scenario.permission,
      tests: [],
      status: 'UNKNOWN'
    };
    
    try {
      await page.goto('http://localhost:8081');
      
      // Test media device detection
      const mediaTest = await page.evaluate(() => {
        return {
          mediaDevicesSupported: typeof navigator.mediaDevices !== 'undefined',
          getUserMediaSupported: typeof navigator.mediaDevices?.getUserMedia !== 'undefined',
          webkitGetUserMediaSupported: typeof navigator.webkitGetUserMedia !== 'undefined'
        };
      });
      
      results.tests.push({
        name: 'Media API Detection',
        status: mediaTest.mediaDevicesSupported ? 'PASS' : 'FAIL',
        details: mediaTest
      });
      
      // Test permission request handling
      const permissionTest = await page.evaluate(async (expectedPermission) => {
        try {
          if (expectedPermission === 'denied') {
            // Try to request permission and expect failure
            try {
              await navigator.mediaDevices.getUserMedia({ audio: true });
              return { success: false, unexpectedSuccess: true };
            } catch (error) {
              return { 
                success: true, 
                properlyBlocked: true, 
                error: error.name 
              };
            }
          } else if (expectedPermission === 'granted') {
            // Try to get media stream
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const hasAudio = stream.getAudioTracks().length > 0;
            stream.getTracks().forEach(track => track.stop());
            
            return {
              success: true,
              hasAudioTrack: hasAudio,
              trackCount: stream.getAudioTracks().length
            };
          } else {
            // Permission prompt scenario - just check API availability
            return {
              success: true,
              apiAvailable: typeof navigator.mediaDevices?.getUserMedia !== 'undefined'
            };
          }
        } catch (error) {
          return {
            success: false,
            error: error.name,
            message: error.message
          };
        }
      }, scenario.permission);
      
      let permissionStatus = 'UNKNOWN';
      if (scenario.permission === 'granted') {
        permissionStatus = permissionTest.success && permissionTest.hasAudioTrack ? 'PASS' : 'FAIL';
      } else if (scenario.permission === 'denied') {
        permissionStatus = permissionTest.success && permissionTest.properlyBlocked ? 'PASS' : 'FAIL';
      } else {
        permissionStatus = permissionTest.success && permissionTest.apiAvailable ? 'PASS' : 'FAIL';
      }
      
      results.tests.push({
        name: 'Permission Handling',
        status: permissionStatus,
        details: permissionTest
      });
      
      // Test graceful error handling
      const errorHandlingTest = await page.evaluate(() => {
        // Check if app shows appropriate error messages
        const errorElements = document.querySelectorAll('[data-testid="error-message"], .error, .permission-error');
        const hasErrorUI = errorElements.length > 0;
        
        return {
          hasErrorUI,
          errorElementCount: errorElements.length,
          hasUserGuidance: Array.from(errorElements).some(el => 
            el.textContent.includes('permission') || 
            el.textContent.includes('microphone') ||
            el.textContent.includes('audio')
          )
        };
      });
      
      // Error UI should be present for denied permissions
      const shouldHaveErrorUI = scenario.permission === 'denied';
      const errorUIStatus = shouldHaveErrorUI ? 
        (errorHandlingTest.hasErrorUI ? 'PASS' : 'WARN') : 'SKIP';
      
      results.tests.push({
        name: 'Error Handling UI',
        status: errorUIStatus,
        details: errorHandlingTest
      });
      
      const passedTests = results.tests.filter(t => t.status === 'PASS').length;
      const totalTests = results.tests.filter(t => t.status !== 'SKIP').length;
      results.status = totalTests > 0 && passedTests === totalTests ? 'EXCELLENT' : 
                      passedTests > totalTests * 0.7 ? 'GOOD' : 'NEEDS_IMPROVEMENT';
      
    } catch (error) {
      results.status = 'ERROR';
      results.error = error.message;
    }
    
    return results;
  }

  async testFeatureSupport() {
    console.log('🔍 Testing Feature Support Across Platforms...');
    
    const browsers = ['chromium', 'firefox', 'webkit'];
    
    for (const browserName of browsers) {
      try {
        const browser = await this.launchBrowser(browserName);
        const page = await browser.newPage();
        
        await page.goto('http://localhost:8081');
        
        const featureResults = await this.runFeatureDetectionTests(page);
        this.results.featureSupport[browserName] = featureResults;
        
        await browser.close();
        
      } catch (error) {
        this.results.errors.push({
          test: `Feature Support - ${browserName}`,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  async runFeatureDetectionTests(page) {
    const results = {
      tests: [],
      features: {},
      status: 'UNKNOWN'
    };
    
    try {
      const featureDetection = await page.evaluate((featureList) => {
        const features = {};
        
        for (const feature of featureList) {
          switch (feature) {
            case 'mediaDevices':
              features[feature] = typeof navigator.mediaDevices !== 'undefined';
              break;
            case 'getUserMedia':
              features[feature] = typeof navigator.mediaDevices?.getUserMedia !== 'undefined';
              break;
            case 'webkitGetUserMedia':
              features[feature] = typeof navigator.webkitGetUserMedia !== 'undefined';
              break;
            case 'mozGetUserMedia':
              features[feature] = typeof navigator.mozGetUserMedia !== 'undefined';
              break;
            case 'WebRTC':
              features[feature] = typeof RTCPeerConnection !== 'undefined';
              break;
            case 'fetch':
              features[feature] = typeof fetch !== 'undefined';
              break;
            case 'Promise':
              features[feature] = typeof Promise !== 'undefined';
              break;
            case 'localStorage':
              try {
                localStorage.setItem('test', 'test');
                localStorage.removeItem('test');
                features[feature] = true;
              } catch {
                features[feature] = false;
              }
              break;
            case 'sessionStorage':
              features[feature] = typeof sessionStorage !== 'undefined';
              break;
            case 'WebSocket':
              features[feature] = typeof WebSocket !== 'undefined';
              break;
            case 'EventSource':
              features[feature] = typeof EventSource !== 'undefined';
              break;
            default:
              features[feature] = false;
          }
        }
        
        return features;
      }, CROSS_PLATFORM_CONFIG.featureTests);
      
      results.features = featureDetection;
      
      // Create individual test results for each feature
      for (const [feature, supported] of Object.entries(featureDetection)) {
        const isRequired = ['mediaDevices', 'getUserMedia', 'fetch', 'Promise', 'WebRTC'].includes(feature);
        const status = supported ? 'PASS' : isRequired ? 'FAIL' : 'WARN';
        
        results.tests.push({
          name: `Feature Support - ${feature}`,
          status,
          required: isRequired,
          details: { supported, feature }
        });
      }
      
      // Overall feature support status
      const requiredFeatures = results.tests.filter(t => t.required);
      const supportedRequiredFeatures = requiredFeatures.filter(t => t.status === 'PASS');
      
      results.status = supportedRequiredFeatures.length === requiredFeatures.length ? 'FULL_SUPPORT' :
                      supportedRequiredFeatures.length > requiredFeatures.length * 0.8 ? 'GOOD_SUPPORT' : 
                      'PARTIAL_SUPPORT';
      
    } catch (error) {
      results.status = 'ERROR';
      results.error = error.message;
    }
    
    return results;
  }

  async testReactNativeCompatibility() {
    console.log('📱 Testing React Native Compatibility...');
    
    // These tests simulate React Native functionality
    // In a real scenario, these would run on actual React Native builds
    
    const reactNativeTests = {
      'iOS Compatibility': await this.simulateReactNativeTest('ios'),
      'Android Compatibility': await this.simulateReactNativeTest('android'),
      'Audio Session Management': await this.simulateAudioSessionTest(),
      'LiveKit Integration': await this.simulateLiveKitIntegrationTest(),
      'Permission Handling': await this.simulatePermissionTest(),
      'Background Mode': await this.simulateBackgroundModeTest()
    };
    
    this.results.reactNativeCompat = reactNativeTests;
  }

  async simulateReactNativeTest(platform) {
    return {
      platform,
      status: 'SIMULATED',
      tests: [
        { name: 'Bundle Loading', status: 'PASS', simulated: true },
        { name: 'Native Module Integration', status: 'PASS', simulated: true },
        { name: 'Audio Permission Request', status: 'PASS', simulated: true },
        { name: 'WebSocket Connection', status: 'PASS', simulated: true },
        { name: 'Token Generation', status: 'PASS', simulated: true }
      ],
      note: `Simulated ${platform} test - requires actual device testing`
    };
  }

  async simulateAudioSessionTest() {
    return {
      status: 'SIMULATED',
      tests: [
        { name: 'Audio Session Configuration', status: 'PASS', simulated: true },
        { name: 'Interruption Handling', status: 'PASS', simulated: true },
        { name: 'Route Change Handling', status: 'PASS', simulated: true }
      ],
      note: 'Audio session management simulation - requires device testing'
    };
  }

  async simulateLiveKitIntegrationTest() {
    return {
      status: 'SIMULATED',
      tests: [
        { name: 'Room Connection', status: 'PASS', simulated: true },
        { name: 'Audio Track Publishing', status: 'PASS', simulated: true },
        { name: 'Data Message Handling', status: 'PASS', simulated: true }
      ],
      note: 'LiveKit integration simulation - requires device testing'
    };
  }

  async simulatePermissionTest() {
    return {
      status: 'SIMULATED',
      tests: [
        { name: 'iOS Permission Request', status: 'PASS', simulated: true },
        { name: 'Android Permission Request', status: 'PASS', simulated: true },
        { name: 'Permission Denial Handling', status: 'PASS', simulated: true }
      ],
      note: 'Permission handling simulation - requires device testing'
    };
  }

  async simulateBackgroundModeTest() {
    return {
      status: 'SIMULATED',
      tests: [
        { name: 'Background Audio Processing', status: 'PASS', simulated: true },
        { name: 'App State Change Handling', status: 'PASS', simulated: true },
        { name: 'Resource Cleanup', status: 'PASS', simulated: true }
      ],
      note: 'Background mode simulation - requires device testing'
    };
  }

  async testCrossPlatformPerformance() {
    console.log('⚡ Testing Cross-Platform Performance...');
    
    const performanceTests = {};
    
    for (const [deviceName, deviceConfig] of Object.entries(CROSS_PLATFORM_CONFIG.devices)) {
      if (deviceName.includes('Desktop')) continue; // Skip desktop for mobile performance test
      
      try {
        const browser = await chromium.launch();
        const context = await browser.newContext({
          viewport: { width: deviceConfig.width, height: deviceConfig.height },
          userAgent: deviceConfig.userAgent
        });
        const page = await context.newPage();
        
        const performanceMetrics = await this.measureCrossPlatformPerformance(page, deviceName);
        performanceTests[deviceName] = performanceMetrics;
        
        await browser.close();
        
      } catch (error) {
        performanceTests[deviceName] = {
          status: 'ERROR',
          error: error.message
        };
      }
    }
    
    this.results.performanceMetrics = performanceTests;
  }

  async measureCrossPlatformPerformance(page, deviceName) {
    const metrics = {
      device: deviceName,
      tests: [],
      measurements: {}
    };
    
    try {
      // Measure page load performance
      const loadStart = Date.now();
      await page.goto('http://localhost:8081', { waitUntil: 'networkidle' });
      const loadTime = Date.now() - loadStart;
      
      // Get web vitals
      const webVitals = await page.evaluate(() => {
        return new Promise((resolve) => {
          const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const vitals = {};
            
            entries.forEach(entry => {
              if (entry.entryType === 'paint') {
                if (entry.name === 'first-contentful-paint') {
                  vitals.fcp = entry.startTime;
                }
              } else if (entry.entryType === 'largest-contentful-paint') {
                vitals.lcp = entry.startTime;
              } else if (entry.entryType === 'first-input') {
                vitals.fid = entry.processingStart - entry.startTime;
              } else if (entry.entryType === 'layout-shift') {
                if (!entry.hadRecentInput) {
                  vitals.cls = (vitals.cls || 0) + entry.value;
                }
              }
            });
            
            resolve(vitals);
          });
          
          observer.observe({ 
            entryTypes: ['paint', 'largest-contentful-paint', 'first-input', 'layout-shift'] 
          });
          
          setTimeout(() => resolve({}), 5000);
        });
      });
      
      metrics.measurements = {
        pageLoadTime: loadTime,
        ...webVitals
      };
      
      // Performance thresholds based on device type
      const isMobile = deviceName.includes('iPhone') || deviceName.includes('Samsung') || deviceName.includes('Pixel');
      const thresholds = {
        pageLoad: isMobile ? 5000 : 3000,
        fcp: isMobile ? 3000 : 2000,
        lcp: isMobile ? 4000 : 3000
      };
      
      metrics.tests.push({
        name: 'Page Load Performance',
        status: loadTime < thresholds.pageLoad ? 'PASS' : 'FAIL',
        measurement: loadTime,
        threshold: thresholds.pageLoad
      });
      
      if (webVitals.fcp) {
        metrics.tests.push({
          name: 'First Contentful Paint',
          status: webVitals.fcp < thresholds.fcp ? 'PASS' : 'FAIL',
          measurement: webVitals.fcp,
          threshold: thresholds.fcp
        });
      }
      
      if (webVitals.lcp) {
        metrics.tests.push({
          name: 'Largest Contentful Paint',
          status: webVitals.lcp < thresholds.lcp ? 'PASS' : 'FAIL',
          measurement: webVitals.lcp,
          threshold: thresholds.lcp
        });
      }
      
    } catch (error) {
      metrics.error = error.message;
    }
    
    return metrics;
  }

  generateCompatibilityMatrix() {
    console.log('📊 Generating Compatibility Matrix...');
    
    const matrix = {
      browsers: {},
      devices: {},
      features: {},
      performance: {}
    };
    
    // Browser compatibility summary
    for (const [browser, results] of Object.entries(this.results.browserCompatibility)) {
      matrix.browsers[browser] = {
        status: results.status,
        supportLevel: this.calculateSupportLevel(results.tests),
        criticalIssues: results.tests.filter(t => t.status === 'FAIL').length
      };
    }
    
    // Device compatibility summary
    for (const [device, results] of Object.entries(this.results.deviceCompatibility)) {
      matrix.devices[device] = {
        status: results.status,
        layoutIssues: results.tests.filter(t => t.status === 'FAIL').length,
        warnings: results.tests.filter(t => t.status === 'WARN').length
      };
    }
    
    // Feature support summary
    for (const [browser, results] of Object.entries(this.results.featureSupport)) {
      matrix.features[browser] = {
        totalFeatures: results.tests.length,
        supportedFeatures: results.tests.filter(t => t.status === 'PASS').length,
        missingCritical: results.tests.filter(t => t.required && t.status !== 'PASS').length
      };
    }
    
    this.results.compatibilityMatrix = matrix;
  }

  calculateSupportLevel(tests) {
    if (!tests || tests.length === 0) return 'UNKNOWN';
    
    const passed = tests.filter(t => t.status === 'PASS').length;
    const total = tests.length;
    const percentage = (passed / total) * 100;
    
    if (percentage >= 95) return 'EXCELLENT';
    if (percentage >= 85) return 'GOOD';
    if (percentage >= 70) return 'FAIR';
    return 'POOR';
  }

  updateSummary() {
    const allTests = [
      ...Object.values(this.results.browserCompatibility).flatMap(b => b.tests || []),
      ...Object.values(this.results.deviceCompatibility).flatMap(d => d.tests || []),
      ...Object.values(this.results.networkCompatibility).flatMap(n => n.tests || []),
      ...Object.values(this.results.audioPermissions).flatMap(a => a.tests || []),
      ...Object.values(this.results.featureSupport).flatMap(f => f.tests || [])
    ];
    
    this.results.summary = {
      totalTests: allTests.length,
      passed: allTests.filter(t => t.status === 'PASS').length,
      failed: allTests.filter(t => t.status === 'FAIL').length,
      warnings: allTests.filter(t => t.status === 'WARN').length,
      skipped: allTests.filter(t => t.status === 'SKIP').length
    };
  }

  async launchBrowser(browserName) {
    switch (browserName) {
      case 'firefox': return await firefox.launch();
      case 'webkit': return await webkit.launch();
      default: return await chromium.launch();
    }
  }

  saveCrossPlatformResults() {
    this.updateSummary();
    
    const resultsDir = './test-results/cross-platform';
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsFile = path.join(resultsDir, `cross-platform-${timestamp}.json`);
    
    fs.writeFileSync(resultsFile, JSON.stringify(this.results, null, 2));
    console.log(`📊 Cross-platform results saved to ${resultsFile}`);
  }

  generateCrossPlatformReport() {
    const { summary } = this.results;
    const totalTests = summary.totalTests;
    const passedTests = summary.passed;
    const failedTests = summary.failed;
    const warnings = summary.warnings;
    
    console.log('\n' + '='.repeat(80));
    console.log('🌐 CROSS-PLATFORM COMPATIBILITY REPORT');
    console.log('='.repeat(80));
    console.log(`📊 Total Tests: ${totalTests}`);
    console.log(`✅ Passed: ${passedTests} (${((passedTests/totalTests)*100).toFixed(1)}%)`);
    console.log(`❌ Failed: ${failedTests} (${((failedTests/totalTests)*100).toFixed(1)}%)`);
    console.log(`⚠️  Warnings: ${warnings} (${((warnings/totalTests)*100).toFixed(1)}%)`);
    console.log(`⏭️  Skipped: ${summary.skipped} (${((summary.skipped/totalTests)*100).toFixed(1)}%)`);
    
    // Browser compatibility summary
    console.log('\n🌍 BROWSER COMPATIBILITY:');
    for (const [browser, results] of Object.entries(this.results.browserCompatibility)) {
      const status = results.status || 'UNKNOWN';
      const emoji = status === 'FULL_SUPPORT' ? '✅' : 
                   status === 'GOOD_SUPPORT' ? '🟡' : 
                   status === 'PARTIAL_SUPPORT' ? '🟠' : '❌';
      console.log(`  ${emoji} ${browser}: ${status}`);
    }
    
    // Device compatibility summary
    console.log('\n📱 DEVICE COMPATIBILITY:');
    const deviceTypes = {
      mobile: Object.keys(this.results.deviceCompatibility).filter(d => 
        d.includes('iPhone') || d.includes('Samsung') || d.includes('Pixel')),
      tablet: Object.keys(this.results.deviceCompatibility).filter(d => d.includes('iPad')),
      desktop: Object.keys(this.results.deviceCompatibility).filter(d => d.includes('Desktop'))
    };
    
    for (const [type, devices] of Object.entries(deviceTypes)) {
      if (devices.length > 0) {
        const compatible = devices.filter(d => 
          this.results.deviceCompatibility[d]?.status === 'OPTIMIZED' ||
          this.results.deviceCompatibility[d]?.status === 'GOOD'
        ).length;
        console.log(`  📱 ${type.toUpperCase()}: ${compatible}/${devices.length} compatible`);
      }
    }
    
    // Network performance summary
    console.log('\n🌐 NETWORK PERFORMANCE:');
    for (const [condition, results] of Object.entries(this.results.networkCompatibility)) {
      const status = results.status || 'UNKNOWN';
      const emoji = status === 'EXCELLENT' ? '✅' : 
                   status === 'GOOD' ? '🟡' : 
                   status === 'POOR' ? '❌' : '❓';
      console.log(`  ${emoji} ${condition}: ${status}`);
    }
    
    // Feature support summary
    console.log('\n🔧 FEATURE SUPPORT:');
    const criticalFeatures = ['mediaDevices', 'getUserMedia', 'WebRTC', 'fetch'];
    for (const feature of criticalFeatures) {
      const supportedBrowsers = Object.values(this.results.featureSupport).filter(result =>
        result.features?.[feature] === true
      ).length;
      const totalBrowsers = Object.keys(this.results.featureSupport).length;
      
      if (totalBrowsers > 0) {
        const emoji = supportedBrowsers === totalBrowsers ? '✅' : 
                     supportedBrowsers > totalBrowsers * 0.8 ? '🟡' : '❌';
        console.log(`  ${emoji} ${feature}: ${supportedBrowsers}/${totalBrowsers} browsers`);
      }
    }
    
    // Migration readiness assessment
    console.log('\n🎯 CROSS-PLATFORM MIGRATION READINESS:');
    const compatibilityScore = (passedTests / (totalTests - summary.skipped)) * 100;
    
    if (compatibilityScore >= 95) {
      console.log(`  ✅ EXCELLENT COMPATIBILITY (${compatibilityScore.toFixed(1)}%)`);
      console.log(`  📋 Ready for deployment across all platforms`);
    } else if (compatibilityScore >= 85) {
      console.log(`  🟡 GOOD COMPATIBILITY (${compatibilityScore.toFixed(1)}%)`);
      console.log(`  📋 Minor issues on some platforms - monitor closely`);
    } else if (compatibilityScore >= 70) {
      console.log(`  🟠 FAIR COMPATIBILITY (${compatibilityScore.toFixed(1)}%)`);
      console.log(`  📋 Some platforms need attention before deployment`);
    } else {
      console.log(`  ❌ POOR COMPATIBILITY (${compatibilityScore.toFixed(1)}%)`);
      console.log(`  📋 Major cross-platform issues need resolution`);
    }
    
    // Recommendations
    console.log('\n📝 RECOMMENDATIONS:');
    if (failedTests > 0) {
      console.log(`  • Address ${failedTests} failing tests before production deployment`);
    }
    if (warnings > 0) {
      console.log(`  • Review ${warnings} warnings for potential UX improvements`);
    }
    
    const problematicBrowsers = Object.entries(this.results.browserCompatibility)
      .filter(([, results]) => results.status === 'POOR_SUPPORT' || results.status === 'PARTIAL_SUPPORT')
      .map(([browser]) => browser);
    
    if (problematicBrowsers.length > 0) {
      console.log(`  • Focus testing on: ${problematicBrowsers.join(', ')}`);
    }
    
    console.log(`  • Test on actual React Native devices before production`);
    console.log(`  • Validate audio permissions on all target platforms`);
    console.log(`  • Performance test under various network conditions`);
    
    console.log('='.repeat(80));
  }
}

// Export for use in other test files
module.exports = { ComprehensiveCrossPlatformTestSuite, CROSS_PLATFORM_CONFIG };

// Run if called directly
if (require.main === module) {
  (async () => {
    const suite = new ComprehensiveCrossPlatformTestSuite();
    await suite.runAllCrossPlatformTests();
  })();
}