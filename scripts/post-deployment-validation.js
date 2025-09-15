#!/usr/bin/env node

/**
 * Post-Deployment Validation Script
 * Comprehensive validation suite for Modal to Speechmatics migration
 */

const { chromium } = require('playwright');

class PostDeploymentValidator {
  constructor() {
    this.baseUrl = process.env.EXPO_PUBLIC_BASE_URL || 
                   `https://augustincombes.github.io/blablabla`;
    
    this.results = {
      timestamp: new Date().toISOString(),
      validationType: 'post-deployment',
      baseUrl: this.baseUrl,
      validations: {},
      issues: [],
      warnings: [],
      recommendations: [],
      overallStatus: 'UNKNOWN',
      summary: {
        totalChecks: 0,
        passedChecks: 0,
        failedChecks: 0,
        warningChecks: 0,
        successRate: 0
      }
    };

    this.thresholds = {
      maxResponseTime: 3000, // 3 seconds
      minSuccessRate: 95, // 95%
      maxErrorRate: 5, // 5%
      maxPageLoadTime: 5000 // 5 seconds
    };
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = level === 'error' ? '❌' : 
                   level === 'warning' ? '⚠️' : 
                   level === 'success' ? '✅' : 'ℹ️';
    console.log(`${timestamp} ${prefix} ${message}`);
  }

  async runValidation() {
    this.log('🔍 Starting post-deployment validation...', 'info');

    try {
      // System health validation
      await this.validateSystemHealth();
      
      // API functionality validation
      await this.validateAPIFunctionality();
      
      // Feature validation
      await this.validateFeatures();
      
      // Performance validation
      await this.validatePerformance();
      
      // User experience validation
      await this.validateUserExperience();
      
      // Security validation
      await this.validateSecurity();
      
      // Integration validation
      await this.validateIntegrations();
      
      // Browser compatibility validation
      await this.validateBrowserCompatibility();
      
      this.calculateOverallStatus();
      this.generateRecommendations();
      this.saveResults();
      this.generateReport();
      
    } catch (error) {
      this.log(`Validation failed: ${error.message}`, 'error');
      this.results.overallStatus = 'FAILED';
      this.results.issues.push({
        severity: 'CRITICAL',
        category: 'validation-failure',
        issue: error.message,
        recommendation: 'Investigate validation failure and consider rollback'
      });
      throw error;
    }

    return this.results;
  }

  async validateSystemHealth() {
    this.log('🏥 Validating system health...', 'info');
    
    const healthValidation = {
      apiHealth: { status: 'unknown', responseTime: null },
      deploymentInfo: { status: 'unknown', data: null },
      uptime: { status: 'unknown', value: null },
      errorRate: { status: 'unknown', value: null }
    };

    try {
      // API Health Check
      const startTime = Date.now();
      const healthResponse = await this.makeRequest(`${this.baseUrl}/api/health`);
      const healthResponseTime = Date.now() - startTime;
      
      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        healthValidation.apiHealth = {
          status: 'pass',
          responseTime: healthResponseTime,
          data: healthData
        };
        this.log(`API health check passed (${healthResponseTime}ms)`, 'success');
      } else {
        healthValidation.apiHealth = {
          status: 'fail',
          responseTime: healthResponseTime,
          error: `HTTP ${healthResponse.status}`
        };
        this.addIssue('CRITICAL', 'system-health', 
          `API health check failed with status ${healthResponse.status}`,
          'Investigate API health endpoint and consider immediate rollback');
      }

      // Check deployment info
      try {
        const deployInfoResponse = await this.makeRequest(`${this.baseUrl}/deployment-info.json`);
        if (deployInfoResponse.ok) {
          const deployInfo = await deployInfoResponse.json();
          healthValidation.deploymentInfo = {
            status: 'pass',
            data: deployInfo
          };
          this.log(`Deployment info retrieved: ${deployInfo.deploymentId}`, 'success');
        }
      } catch (error) {
        this.log(`Could not retrieve deployment info: ${error.message}`, 'warning');
        healthValidation.deploymentInfo = {
          status: 'warning',
          error: error.message
        };
      }

    } catch (error) {
      healthValidation.apiHealth = {
        status: 'fail',
        error: error.message
      };
      this.addIssue('CRITICAL', 'system-health', 
        `System health validation failed: ${error.message}`,
        'Check system availability and network connectivity');
    }

    this.results.validations.systemHealth = healthValidation;
    this.incrementCheckCount(healthValidation);
  }

  async validateAPIFunctionality() {
    this.log('🔧 Validating API functionality...', 'info');
    
    const apiValidation = {
      healthEndpoint: { status: 'unknown' },
      speechmaticsToken: { status: 'unknown' },
      livekitToken: { status: 'unknown' },
      corsConfiguration: { status: 'unknown' }
    };

    // Health endpoint
    try {
      const healthResponse = await this.makeRequest(`${this.baseUrl}/api/health`);
      apiValidation.healthEndpoint = {
        status: healthResponse.ok ? 'pass' : 'fail',
        statusCode: healthResponse.status
      };
    } catch (error) {
      apiValidation.healthEndpoint = {
        status: 'fail',
        error: error.message
      };
    }

    // Speechmatics token generation
    try {
      const tokenResponse = await this.makeRequest(`${this.baseUrl}/api/speechmatics-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'speechmatics',
          transcriptionConfig: {
            language: 'en',
            enable_partials: true
          }
        })
      });

      if (tokenResponse.ok) {
        const tokenData = await tokenResponse.json();
        if (tokenData.token) {
          apiValidation.speechmaticsToken = {
            status: 'pass',
            hasToken: true,
            tokenValid: this.validateJWTStructure(tokenData.token)
          };
          this.log('Speechmatics token generation successful', 'success');
        } else {
          apiValidation.speechmaticsToken = {
            status: 'fail',
            hasToken: false
          };
          this.addIssue('HIGH', 'api-functionality',
            'Speechmatics token generation returned no token',
            'Check Speechmatics API configuration and credentials');
        }
      } else {
        apiValidation.speechmaticsToken = {
          status: 'fail',
          statusCode: tokenResponse.status
        };
        this.addIssue('HIGH', 'api-functionality',
          `Speechmatics token generation failed: HTTP ${tokenResponse.status}`,
          'Check Speechmatics API endpoint and authentication');
      }
    } catch (error) {
      apiValidation.speechmaticsToken = {
        status: 'fail',
        error: error.message
      };
      this.addIssue('HIGH', 'api-functionality',
        `Speechmatics token generation error: ${error.message}`,
        'Check API connectivity and configuration');
    }

    // LiveKit token generation
    try {
      const livekitResponse = await this.makeRequest(`${this.baseUrl}/api/livekit-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: 'test-room',
          participantName: 'test-participant'
        })
      });

      apiValidation.livekitToken = {
        status: livekitResponse.ok ? 'pass' : 'fail',
        statusCode: livekitResponse.status
      };
    } catch (error) {
      apiValidation.livekitToken = {
        status: 'fail',
        error: error.message
      };
    }

    // CORS configuration
    try {
      const corsResponse = await this.makeRequest(`${this.baseUrl}/api/health`, {
        method: 'OPTIONS',
        headers: { 'Origin': 'https://example.com' }
      });

      apiValidation.corsConfiguration = {
        status: corsResponse.headers.get('access-control-allow-origin') ? 'pass' : 'warning',
        headers: Object.fromEntries(corsResponse.headers.entries())
      };
    } catch (error) {
      apiValidation.corsConfiguration = {
        status: 'fail',
        error: error.message
      };
    }

    this.results.validations.apiFunctionality = apiValidation;
    this.incrementCheckCount(apiValidation);
  }

  async validateFeatures() {
    this.log('🎯 Validating feature functionality...', 'info');
    
    const featureValidation = {
      speechmaticsIntegration: { status: 'unknown' },
      languageSupport: { status: 'unknown', languages: {} },
      modalFallback: { status: 'unknown' },
      userInterface: { status: 'unknown' }
    };

    // Test language support
    const testLanguages = ['en', 'fr'];
    for (const lang of testLanguages) {
      try {
        const response = await this.makeRequest(`${this.baseUrl}/api/speechmatics-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'speechmatics',
            transcriptionConfig: { language: lang }
          })
        });
        
        featureValidation.languageSupport.languages[lang] = response.ok;
        this.log(`Language ${lang} support: ${response.ok ? 'working' : 'failed'}`, 
          response.ok ? 'success' : 'warning');
      } catch (error) {
        featureValidation.languageSupport.languages[lang] = false;
        this.addIssue('MEDIUM', 'feature-functionality',
          `Language ${lang} support test failed: ${error.message}`,
          `Verify ${lang} language configuration in Speechmatics`);
      }
    }

    const supportedLanguages = Object.values(featureValidation.languageSupport.languages)
      .filter(supported => supported).length;
    
    featureValidation.languageSupport.status = supportedLanguages > 0 ? 'pass' : 'fail';

    // Test Modal fallback availability (even if not actively used)
    try {
      const modalEndpoint = 'https://augustincombes--livekit-dialogue-agent-ensure-agent-running.modal.run';
      const modalResponse = await this.makeRequest(modalEndpoint, null, 10000); // 10 second timeout
      
      featureValidation.modalFallback = {
        status: modalResponse.ok ? 'pass' : 'warning',
        available: modalResponse.ok,
        responseTime: Date.now()
      };
      
      this.log(`Modal fallback availability: ${modalResponse.ok ? 'available' : 'unavailable'}`,
        modalResponse.ok ? 'success' : 'warning');
    } catch (error) {
      featureValidation.modalFallback = {
        status: 'warning',
        available: false,
        error: error.message
      };
      this.addWarning('fallback-availability',
        'Modal fallback system is not available',
        'Consider fixing Modal integration for emergency fallback');
    }

    this.results.validations.features = featureValidation;
    this.incrementCheckCount(featureValidation);
  }

  async validatePerformance() {
    this.log('⚡ Validating performance...', 'info');
    
    const performanceValidation = {
      responseTime: { status: 'unknown', metrics: {} },
      throughput: { status: 'unknown', metrics: {} },
      errorRate: { status: 'unknown', value: null },
      resourceUsage: { status: 'unknown', metrics: {} }
    };

    // Response time test
    const responseTimes = [];
    const errors = [];
    const testRequests = 10;

    this.log(`Running ${testRequests} performance test requests...`, 'info');

    for (let i = 0; i < testRequests; i++) {
      try {
        const startTime = Date.now();
        const response = await this.makeRequest(`${this.baseUrl}/api/health`);
        const responseTime = Date.now() - startTime;
        
        if (response.ok) {
          responseTimes.push(responseTime);
        } else {
          errors.push(`Request ${i + 1}: HTTP ${response.status}`);
        }
      } catch (error) {
        errors.push(`Request ${i + 1}: ${error.message}`);
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (responseTimes.length > 0) {
      const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
      const minResponseTime = Math.min(...responseTimes);
      const maxResponseTime = Math.max(...responseTimes);
      const p95ResponseTime = this.calculatePercentile(responseTimes, 95);

      performanceValidation.responseTime = {
        status: avgResponseTime <= this.thresholds.maxResponseTime ? 'pass' : 'fail',
        metrics: {
          average: avgResponseTime,
          min: minResponseTime,
          max: maxResponseTime,
          p95: p95ResponseTime,
          samples: responseTimes.length
        }
      };

      this.log(`Performance metrics: avg=${avgResponseTime.toFixed(0)}ms, p95=${p95ResponseTime.toFixed(0)}ms`, 
        avgResponseTime <= this.thresholds.maxResponseTime ? 'success' : 'warning');

      if (avgResponseTime > this.thresholds.maxResponseTime) {
        this.addIssue('MEDIUM', 'performance',
          `Average response time (${avgResponseTime.toFixed(0)}ms) exceeds threshold (${this.thresholds.maxResponseTime}ms)`,
          'Investigate performance bottlenecks and optimize response times');
      }
    }

    // Error rate calculation
    const errorRate = (errors.length / testRequests) * 100;
    performanceValidation.errorRate = {
      status: errorRate <= this.thresholds.maxErrorRate ? 'pass' : 'fail',
      value: errorRate,
      errors: errors
    };

    if (errorRate > this.thresholds.maxErrorRate) {
      this.addIssue('HIGH', 'performance',
        `Error rate (${errorRate.toFixed(1)}%) exceeds threshold (${this.thresholds.maxErrorRate}%)`,
        'Investigate error causes and improve system reliability');
    }

    this.results.validations.performance = performanceValidation;
    this.incrementCheckCount(performanceValidation);
  }

  async validateUserExperience() {
    this.log('👤 Validating user experience...', 'info');
    
    const uxValidation = {
      pageLoad: { status: 'unknown' },
      interactivity: { status: 'unknown' },
      visualElements: { status: 'unknown' },
      accessibility: { status: 'unknown' },
      mobileResponsiveness: { status: 'unknown' }
    };

    let browser;
    try {
      browser = await chromium.launch();
      const context = await browser.newContext();
      const page = await context.newPage();

      // Page load test
      const pageLoadStart = Date.now();
      await page.goto(this.baseUrl, { waitUntil: 'networkidle', timeout: 30000 });
      const pageLoadTime = Date.now() - pageLoadStart;

      uxValidation.pageLoad = {
        status: pageLoadTime <= this.thresholds.maxPageLoadTime ? 'pass' : 'fail',
        loadTime: pageLoadTime
      };

      this.log(`Page load time: ${pageLoadTime}ms`, 
        pageLoadTime <= this.thresholds.maxPageLoadTime ? 'success' : 'warning');

      if (pageLoadTime > this.thresholds.maxPageLoadTime) {
        this.addIssue('MEDIUM', 'user-experience',
          `Page load time (${pageLoadTime}ms) exceeds threshold (${this.thresholds.maxPageLoadTime}ms)`,
          'Optimize bundle size and loading performance');
      }

      // Interactive elements test
      try {
        await page.waitForSelector('button', { timeout: 10000 });
        const buttonCount = await page.$$eval('button', buttons => buttons.length);
        
        uxValidation.interactivity = {
          status: buttonCount > 0 ? 'pass' : 'fail',
          buttonCount,
          interactive: true
        };
        
        this.log(`Found ${buttonCount} interactive elements`, 'success');
      } catch (error) {
        uxValidation.interactivity = {
          status: 'fail',
          error: error.message
        };
        this.addIssue('MEDIUM', 'user-experience',
          'Interactive elements not found or not loading',
          'Check JavaScript bundle and component rendering');
      }

      // Visual elements test
      try {
        const hasTitle = await page.locator('h1, h2, .blaText1, .blaText2').count() > 0;
        const hasContent = await page.locator('body').textContent();
        
        uxValidation.visualElements = {
          status: hasTitle && hasContent.length > 100 ? 'pass' : 'fail',
          hasTitle,
          contentLength: hasContent.length
        };
        
        this.log(`Visual elements check: title=${hasTitle}, content=${hasContent.length} chars`, 
          hasTitle ? 'success' : 'warning');
      } catch (error) {
        uxValidation.visualElements = {
          status: 'fail',
          error: error.message
        };
      }

      // Mobile responsiveness test
      await page.setViewportSize({ width: 375, height: 667 }); // iPhone 8 size
      await page.reload({ waitUntil: 'networkidle' });
      
      const mobileLoadTime = Date.now();
      const mobileElements = await page.$$eval('*', elements => {
        return elements.some(el => {
          const style = window.getComputedStyle(el);
          return parseInt(style.width) > 375; // Check for elements wider than viewport
        });
      });

      uxValidation.mobileResponsiveness = {
        status: !mobileElements ? 'pass' : 'warning',
        hasOverflow: mobileElements,
        mobileLoadTime: Date.now() - mobileLoadTime
      };

    } catch (error) {
      this.log(`User experience validation error: ${error.message}`, 'warning');
      this.addWarning('user-experience', 
        `UX validation failed: ${error.message}`,
        'Check frontend functionality manually');
    } finally {
      if (browser) {
        await browser.close();
      }
    }

    this.results.validations.userExperience = uxValidation;
    this.incrementCheckCount(uxValidation);
  }

  async validateSecurity() {
    this.log('🔐 Validating security configuration...', 'info');
    
    const securityValidation = {
      headers: { status: 'unknown', present: {} },
      cors: { status: 'unknown', configured: false },
      httpsRedirect: { status: 'unknown', working: false },
      inputValidation: { status: 'unknown', validated: false }
    };

    try {
      // Security headers check
      const response = await this.makeRequest(`${this.baseUrl}/api/health`);
      const headers = Object.fromEntries(response.headers.entries());
      
      const securityHeaders = {
        'x-content-type-options': headers['x-content-type-options'],
        'x-frame-options': headers['x-frame-options'],
        'x-xss-protection': headers['x-xss-protection'],
        'strict-transport-security': headers['strict-transport-security'],
        'content-security-policy': headers['content-security-policy']
      };

      const presentHeaders = Object.values(securityHeaders).filter(h => h).length;
      
      securityValidation.headers = {
        status: presentHeaders > 0 ? 'pass' : 'warning',
        present: securityHeaders,
        count: presentHeaders
      };

      this.log(`Security headers present: ${presentHeaders}/5`, 
        presentHeaders > 2 ? 'success' : 'warning');

      // CORS configuration
      const corsResponse = await this.makeRequest(`${this.baseUrl}/api/health`, {
        method: 'OPTIONS',
        headers: { 'Origin': 'https://example.com' }
      });

      const corsConfigured = corsResponse.headers.has('access-control-allow-origin');
      securityValidation.cors = {
        status: corsConfigured ? 'pass' : 'warning',
        configured: corsConfigured
      };

      // Input validation test
      try {
        const invalidResponse = await this.makeRequest(`${this.baseUrl}/api/speechmatics-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'invalid-json-input'
        });

        const inputValidationWorking = invalidResponse.status >= 400;
        securityValidation.inputValidation = {
          status: inputValidationWorking ? 'pass' : 'warning',
          validated: inputValidationWorking,
          responseStatus: invalidResponse.status
        };

        this.log(`Input validation: ${inputValidationWorking ? 'working' : 'needs improvement'}`, 
          inputValidationWorking ? 'success' : 'warning');
      } catch (error) {
        securityValidation.inputValidation = {
          status: 'warning',
          error: error.message
        };
      }

    } catch (error) {
      this.addWarning('security',
        `Security validation error: ${error.message}`,
        'Review security configurations manually');
    }

    this.results.validations.security = securityValidation;
    this.incrementCheckCount(securityValidation);
  }

  async validateIntegrations() {
    this.log('🔗 Validating external integrations...', 'info');
    
    const integrationValidation = {
      speechmatics: { status: 'unknown', connected: false },
      livekit: { status: 'unknown', connected: false },
      github: { status: 'unknown', pages: false },
      modal: { status: 'unknown', fallback: false }
    };

    // Speechmatics integration
    try {
      const speechmaticsTest = await this.makeRequest(`${this.baseUrl}/api/speechmatics-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'speechmatics',
          transcriptionConfig: { language: 'en' }
        })
      });

      integrationValidation.speechmatics = {
        status: speechmaticsTest.ok ? 'pass' : 'fail',
        connected: speechmaticsTest.ok,
        responseStatus: speechmaticsTest.status
      };

      this.log(`Speechmatics integration: ${speechmaticsTest.ok ? 'connected' : 'failed'}`, 
        speechmaticsTest.ok ? 'success' : 'error');
    } catch (error) {
      integrationValidation.speechmatics = {
        status: 'fail',
        connected: false,
        error: error.message
      };
      this.addIssue('CRITICAL', 'integrations',
        `Speechmatics integration failed: ${error.message}`,
        'Check Speechmatics API credentials and connectivity');
    }

    // LiveKit integration (if available)
    try {
      const livekitTest = await this.makeRequest(`${this.baseUrl}/api/livekit-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: 'test-room',
          participantName: 'test-participant'
        })
      });

      integrationValidation.livekit = {
        status: livekitTest.ok ? 'pass' : 'warning',
        connected: livekitTest.ok
      };
    } catch (error) {
      integrationValidation.livekit = {
        status: 'warning',
        connected: false,
        error: error.message
      };
    }

    // GitHub Pages deployment check
    const isGitHubPages = this.baseUrl.includes('github.io');
    integrationValidation.github = {
      status: isGitHubPages ? 'pass' : 'info',
      pages: isGitHubPages
    };

    // Modal fallback check
    try {
      const modalEndpoint = 'https://augustincombes--livekit-dialogue-agent-ensure-agent-running.modal.run';
      const modalTest = await this.makeRequest(modalEndpoint, null, 15000);
      
      integrationValidation.modal = {
        status: modalTest.ok ? 'pass' : 'warning',
        fallback: modalTest.ok
      };
    } catch (error) {
      integrationValidation.modal = {
        status: 'warning',
        fallback: false,
        error: error.message
      };
    }

    this.results.validations.integrations = integrationValidation;
    this.incrementCheckCount(integrationValidation);
  }

  async validateBrowserCompatibility() {
    this.log('🌐 Validating browser compatibility...', 'info');
    
    const compatibilityValidation = {
      chromium: { status: 'unknown' },
      webkit: { status: 'unknown' },
      javascript: { status: 'unknown' },
      webrtc: { status: 'unknown' }
    };

    // Test with different browsers if available
    for (const browserType of ['chromium']) { // Can extend to 'firefox', 'webkit'
      try {
        const browser = await chromium.launch();
        const context = await browser.newContext();
        const page = await context.newPage();
        
        await page.goto(this.baseUrl, { timeout: 30000 });
        
        // Test JavaScript functionality
        const jsWorking = await page.evaluate(() => {
          return typeof window !== 'undefined' && 
                 typeof document !== 'undefined' &&
                 typeof fetch !== 'undefined';
        });
        
        // Test WebRTC support
        const webrtcSupported = await page.evaluate(() => {
          return typeof RTCPeerConnection !== 'undefined' ||
                 typeof webkitRTCPeerConnection !== 'undefined' ||
                 typeof mozRTCPeerConnection !== 'undefined';
        });
        
        compatibilityValidation[browserType] = {
          status: 'pass',
          jsWorking,
          webrtcSupported
        };
        
        compatibilityValidation.javascript = {
          status: jsWorking ? 'pass' : 'fail',
          working: jsWorking
        };
        
        compatibilityValidation.webrtc = {
          status: webrtcSupported ? 'pass' : 'warning',
          supported: webrtcSupported
        };
        
        await browser.close();
        
        this.log(`${browserType} compatibility: JS=${jsWorking}, WebRTC=${webrtcSupported}`, 'success');
        
      } catch (error) {
        compatibilityValidation[browserType] = {
          status: 'fail',
          error: error.message
        };
        this.log(`${browserType} compatibility test failed: ${error.message}`, 'warning');
      }
    }

    this.results.validations.browserCompatibility = compatibilityValidation;
    this.incrementCheckCount(compatibilityValidation);
  }

  // Helper methods

  async makeRequest(url, options = {}, timeout = 30000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  validateJWTStructure(token) {
    try {
      if (!token || typeof token !== 'string') return false;
      
      const parts = token.split('.');
      if (parts.length !== 3) return false;
      
      // Validate header and payload are valid base64
      const header = JSON.parse(atob(parts[0]));
      const payload = JSON.parse(atob(parts[1]));
      
      // Check for required JWT claims
      return !!(payload.sub && payload.iss && payload.aud);
    } catch {
      return false;
    }
  }

  calculatePercentile(array, percentile) {
    const sorted = [...array].sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    
    if (Math.floor(index) === index) {
      return sorted[index];
    } else {
      const lower = sorted[Math.floor(index)];
      const upper = sorted[Math.ceil(index)];
      return lower + (upper - lower) * (index - Math.floor(index));
    }
  }

  addIssue(severity, category, issue, recommendation) {
    this.results.issues.push({
      severity,
      category,
      issue,
      recommendation,
      timestamp: new Date().toISOString()
    });
  }

  addWarning(category, warning, recommendation) {
    this.results.warnings.push({
      category,
      warning,
      recommendation,
      timestamp: new Date().toISOString()
    });
  }

  incrementCheckCount(validationObject) {
    const checks = Object.values(validationObject);
    this.results.summary.totalChecks += checks.length;
    
    checks.forEach(check => {
      if (check.status === 'pass') {
        this.results.summary.passedChecks++;
      } else if (check.status === 'fail') {
        this.results.summary.failedChecks++;
      } else if (check.status === 'warning') {
        this.results.summary.warningChecks++;
      }
    });
  }

  calculateOverallStatus() {
    const { totalChecks, passedChecks, failedChecks } = this.results.summary;
    
    if (totalChecks === 0) {
      this.results.overallStatus = 'UNKNOWN';
      return;
    }
    
    this.results.summary.successRate = (passedChecks / totalChecks) * 100;
    
    const criticalIssues = this.results.issues.filter(i => i.severity === 'CRITICAL').length;
    const highIssues = this.results.issues.filter(i => i.severity === 'HIGH').length;
    
    if (criticalIssues > 0) {
      this.results.overallStatus = 'CRITICAL_ISSUES';
    } else if (highIssues > 0) {
      this.results.overallStatus = 'HIGH_ISSUES';
    } else if (this.results.summary.successRate < 80) {
      this.results.overallStatus = 'POOR_HEALTH';
    } else if (this.results.summary.successRate < 95) {
      this.results.overallStatus = 'DEGRADED_PERFORMANCE';
    } else {
      this.results.overallStatus = 'HEALTHY';
    }
  }

  generateRecommendations() {
    const recommendations = [];
    
    // Critical issues recommendations
    const criticalIssues = this.results.issues.filter(i => i.severity === 'CRITICAL');
    if (criticalIssues.length > 0) {
      recommendations.push({
        priority: 'IMMEDIATE',
        category: 'critical-issues',
        action: 'Address critical issues immediately - consider emergency rollback',
        details: criticalIssues.map(i => i.issue)
      });
    }
    
    // Performance recommendations
    const performanceIssues = this.results.issues.filter(i => i.category === 'performance');
    if (performanceIssues.length > 0) {
      recommendations.push({
        priority: 'HIGH',
        category: 'performance',
        action: 'Optimize system performance',
        details: performanceIssues.map(i => i.recommendation)
      });
    }
    
    // Security recommendations
    const securityIssues = this.results.issues.filter(i => i.category.includes('security'));
    if (securityIssues.length > 0) {
      recommendations.push({
        priority: 'HIGH',
        category: 'security',
        action: 'Review and improve security configuration',
        details: securityIssues.map(i => i.recommendation)
      });
    }
    
    // Success rate recommendations
    if (this.results.summary.successRate < 95) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'reliability',
        action: `Improve system reliability (current success rate: ${this.results.summary.successRate.toFixed(1)}%)`,
        target: 'Achieve >95% success rate across all checks'
      });
    }
    
    this.results.recommendations = recommendations;
  }

  saveResults() {
    const fs = require('fs');
    const path = require('path');
    
    const resultsDir = 'deployments';
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsFile = path.join(resultsDir, `post-deployment-validation-${timestamp}.json`);
    
    fs.writeFileSync(resultsFile, JSON.stringify(this.results, null, 2));
    this.log(`Validation results saved to: ${resultsFile}`, 'info');
  }

  generateReport() {
    this.log('\n' + '='.repeat(80), 'info');
    this.log('🔍 POST-DEPLOYMENT VALIDATION REPORT', 'info');
    this.log('='.repeat(80), 'info');
    
    const statusEmoji = this.results.overallStatus === 'HEALTHY' ? '🟢' : 
                       this.results.overallStatus === 'DEGRADED_PERFORMANCE' ? '🟡' : 
                       this.results.overallStatus === 'POOR_HEALTH' ? '🟠' : '🔴';
    
    this.log(`${statusEmoji} Overall Status: ${this.results.overallStatus}`, 'info');
    this.log(`📊 Success Rate: ${this.results.summary.successRate.toFixed(1)}%`, 'info');
    this.log(`✅ Passed: ${this.results.summary.passedChecks}`, 'info');
    this.log(`❌ Failed: ${this.results.summary.failedChecks}`, 'info');
    this.log(`⚠️ Warnings: ${this.results.summary.warningChecks}`, 'info');
    this.log(`📋 Total Checks: ${this.results.summary.totalChecks}`, 'info');
    
    // Validation categories
    this.log('\n📋 VALIDATION CATEGORIES:', 'info');
    for (const [category, results] of Object.entries(this.results.validations)) {
      const categoryStatus = Object.values(results).every(r => r.status === 'pass') ? '✅' : 
                            Object.values(results).some(r => r.status === 'fail') ? '❌' : '⚠️';
      this.log(`  ${categoryStatus} ${category.replace(/([A-Z])/g, ' $1').toUpperCase()}`, 'info');
    }
    
    // Critical issues
    const criticalIssues = this.results.issues.filter(i => i.severity === 'CRITICAL');
    if (criticalIssues.length > 0) {
      this.log('\n🚨 CRITICAL ISSUES:', 'info');
      criticalIssues.forEach((issue, index) => {
        this.log(`  ${index + 1}. ${issue.issue}`, 'error');
        this.log(`     💡 ${issue.recommendation}`, 'info');
      });
    }
    
    // High priority issues
    const highIssues = this.results.issues.filter(i => i.severity === 'HIGH');
    if (highIssues.length > 0 && highIssues.length <= 3) {
      this.log('\n⚠️ HIGH PRIORITY ISSUES:', 'info');
      highIssues.forEach((issue, index) => {
        this.log(`  ${index + 1}. ${issue.issue}`, 'warning');
        this.log(`     💡 ${issue.recommendation}`, 'info');
      });
    } else if (highIssues.length > 3) {
      this.log(`\n⚠️ HIGH PRIORITY ISSUES: ${highIssues.length} issues found (see full report)`, 'info');
    }
    
    // Recommendations
    if (this.results.recommendations.length > 0) {
      this.log('\n💡 TOP RECOMMENDATIONS:', 'info');
      this.results.recommendations.slice(0, 3).forEach((rec, index) => {
        this.log(`  ${index + 1}. [${rec.priority}] ${rec.action}`, 'info');
      });
    }
    
    // Deployment decision
    this.log('\n🎯 DEPLOYMENT VALIDATION RESULT:', 'info');
    if (this.results.overallStatus === 'HEALTHY') {
      this.log('  ✅ DEPLOYMENT VALIDATED - System is healthy and ready', 'success');
    } else if (this.results.overallStatus === 'DEGRADED_PERFORMANCE') {
      this.log('  🟡 DEPLOYMENT ACCEPTABLE - Monitor closely for performance issues', 'warning');
    } else if (criticalIssues.length > 0) {
      this.log('  ❌ DEPLOYMENT FAILED - Critical issues detected, consider immediate rollback', 'error');
    } else {
      this.log('  ⚠️ DEPLOYMENT MARGINAL - Address issues promptly', 'warning');
    }
    
    this.log('='.repeat(80), 'info');
    
    // Exit with appropriate code
    if (criticalIssues.length > 0) {
      process.exit(1);
    } else if (this.results.overallStatus === 'POOR_HEALTH') {
      process.exit(2);
    }
  }
}

// Run validation if called directly
if (require.main === module) {
  (async () => {
    const validator = new PostDeploymentValidator();
    try {
      await validator.runValidation();
    } catch (error) {
      console.error('❌ Validation failed:', error.message);
      process.exit(1);
    }
  })();
}

module.exports = { PostDeploymentValidator };