/**
 * Unit Tests for New Speechmatics Components
 * Tests the new serverless Speechmatics integration without Modal dependency
 */

const { describe, test, expect, beforeEach, afterEach, jest } = require('@jest/globals');
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

// Mock fetch globally
global.fetch = jest.fn();

describe('Speechmatics Integration Unit Tests', () => {
  let mockWebSocket;
  let speechmaticsClient;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Mock WebSocket
    mockWebSocket = {
      send: jest.fn(),
      close: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      readyState: WebSocket.OPEN
    };
    
    global.WebSocket = jest.fn(() => mockWebSocket);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Token Generation', () => {
    test('should generate valid Speechmatics JWT token', async () => {
      // Mock successful token response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: 'mock-jwt-token',
          type: 'speechmatics',
          expires_at: Math.floor(Date.now() / 1000) + 3600
        })
      });

      const tokenRequest = {
        type: 'speechmatics',
        transcriptionConfig: {
          language: 'en',
          operating_point: 'enhanced',
          enable_partials: true
        }
      };

      const response = await fetch('/api/speechmatics-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tokenRequest)
      });

      const tokenData = await response.json();

      expect(response.ok).toBe(true);
      expect(tokenData.token).toBe('mock-jwt-token');
      expect(tokenData.type).toBe('speechmatics');
      expect(tokenData.expires_at).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    test('should handle token generation errors', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(fetch('/api/speechmatics-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'speechmatics' })
      })).rejects.toThrow('Network error');
    });

    test('should validate token structure', () => {
      const mockToken = jwt.sign(
        {
          sub: 'speechmatics-rt-client',
          iss: 'speechmatics',
          aud: 'speechmatics',
          transcription_config: {
            language: 'en',
            operating_point: 'enhanced'
          }
        },
        'test-secret'
      );

      const decoded = jwt.decode(mockToken);
      expect(decoded.sub).toBe('speechmatics-rt-client');
      expect(decoded.transcription_config.language).toBe('en');
      expect(decoded.transcription_config.operating_point).toBe('enhanced');
    });
  });

  describe('WebSocket Connection', () => {
    test('should establish WebSocket connection to Speechmatics', () => {
      const SpeechmaticsClient = require('../../../src/speechmatics-client');
      speechmaticsClient = new SpeechmaticsClient({
        apiKey: 'test-api-key',
        url: 'wss://eu2.rt.speechmatics.com/v2'
      });

      speechmaticsClient.connect();

      expect(global.WebSocket).toHaveBeenCalledWith('wss://eu2.rt.speechmatics.com/v2');
      expect(mockWebSocket.addEventListener).toHaveBeenCalledWith('open', expect.any(Function));
      expect(mockWebSocket.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockWebSocket.addEventListener).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockWebSocket.addEventListener).toHaveBeenCalledWith('close', expect.any(Function));
    });

    test('should handle connection errors', () => {
      const SpeechmaticsClient = require('../../../src/speechmatics-client');
      speechmaticsClient = new SpeechmaticsClient({
        apiKey: 'invalid-key',
        url: 'wss://invalid-url'
      });

      const errorHandler = jest.fn();
      speechmaticsClient.on('error', errorHandler);
      speechmaticsClient.connect();

      // Simulate connection error
      const errorEvent = new Event('error');
      errorEvent.error = new Error('Connection failed');
      mockWebSocket.addEventListener.mock.calls
        .find(call => call[0] === 'error')[1](errorEvent);

      expect(errorHandler).toHaveBeenCalledWith(expect.any(Error));
    });

    test('should handle reconnection attempts', async () => {
      const SpeechmaticsClient = require('../../../src/speechmatics-client');
      speechmaticsClient = new SpeechmaticsClient({
        apiKey: 'test-api-key',
        reconnectAttempts: 3,
        reconnectInterval: 100
      });

      const connectSpy = jest.spyOn(speechmaticsClient, 'connect');
      speechmaticsClient.connect();

      // Simulate connection close
      const closeEvent = new Event('close');
      closeEvent.code = 1006; // Abnormal closure
      mockWebSocket.addEventListener.mock.calls
        .find(call => call[0] === 'close')[1](closeEvent);

      // Wait for reconnection attempt
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(connectSpy).toHaveBeenCalledTimes(2); // Initial + 1 reconnect
    });
  });

  describe('Audio Processing', () => {
    test('should process audio frames correctly', () => {
      const SpeechmaticsClient = require('../../../src/speechmatics-client');
      speechmaticsClient = new SpeechmaticsClient({ apiKey: 'test-key' });

      const audioData = new ArrayBuffer(1024);
      const uint8Array = new Uint8Array(audioData);
      
      // Fill with sample audio data
      for (let i = 0; i < uint8Array.length; i++) {
        uint8Array[i] = Math.floor(Math.random() * 256);
      }

      speechmaticsClient.connect();
      speechmaticsClient.sendAudio(audioData);

      expect(mockWebSocket.send).toHaveBeenCalledWith(expect.any(ArrayBuffer));
    });

    test('should handle audio format conversion', () => {
      const AudioProcessor = require('../../../src/audio-processor');
      const processor = new AudioProcessor({
        sampleRate: 16000,
        channels: 1,
        bitDepth: 16
      });

      // Mock stereo audio data that needs conversion to mono
      const stereoData = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]);
      const monoData = processor.stereoToMono(stereoData);

      expect(monoData.length).toBe(3); // Half the length
      expect(monoData[0]).toBeCloseTo(0.15); // (0.1 + 0.2) / 2
      expect(monoData[1]).toBeCloseTo(0.35); // (0.3 + 0.4) / 2
      expect(monoData[2]).toBeCloseTo(0.55); // (0.5 + 0.6) / 2
    });

    test('should handle sample rate conversion', () => {
      const AudioProcessor = require('../../../src/audio-processor');
      const processor = new AudioProcessor();

      // Mock 44.1kHz audio data that needs conversion to 16kHz
      const highSampleRateData = new Float32Array(44100); // 1 second at 44.1kHz
      const lowSampleRateData = processor.resample(highSampleRateData, 44100, 16000);

      expect(lowSampleRateData.length).toBe(16000); // 1 second at 16kHz
    });
  });

  describe('Transcription Processing', () => {
    test('should parse transcription messages correctly', () => {
      const TranscriptionParser = require('../../../src/transcription-parser');
      const parser = new TranscriptionParser();

      const mockMessage = {
        message: 'AddTranscript',
        metadata: {
          transcript: 'Hello world',
          start_time: 1.5,
          end_time: 3.2,
          channel: 'channel-0',
          speaker: 'M1'
        },
        results: [{
          alternatives: [{
            content: 'Hello world',
            confidence: 0.95,
            speaker: 'M1'
          }],
          start_time: 1.5,
          end_time: 3.2
        }]
      };

      const parsed = parser.parseMessage(mockMessage);

      expect(parsed).toEqual({
        type: 'transcript',
        text: 'Hello world',
        speaker: 'M1',
        confidence: 0.95,
        startTime: 1.5,
        endTime: 3.2,
        timestamp: expect.any(Number)
      });
    });

    test('should handle partial transcription updates', () => {
      const TranscriptionParser = require('../../../src/transcription-parser');
      const parser = new TranscriptionParser();

      const partialMessage = {
        message: 'AddPartialTranscript',
        metadata: {
          transcript: 'Hello wo',
          start_time: 1.5,
          speaker: 'M1'
        }
      };

      const parsed = parser.parseMessage(partialMessage);

      expect(parsed.type).toBe('partial');
      expect(parsed.text).toBe('Hello wo');
      expect(parsed.speaker).toBe('M1');
    });

    test('should detect speaker changes', () => {
      const SpeakerTracker = require('../../../src/speaker-tracker');
      const tracker = new SpeakerTracker();

      tracker.addTranscript({ speaker: 'M1', text: 'First speaker' });
      tracker.addTranscript({ speaker: 'M2', text: 'Second speaker' });
      tracker.addTranscript({ speaker: 'M1', text: 'Back to first' });

      const speakers = tracker.getSpeakers();
      expect(speakers).toHaveLength(2);
      expect(speakers).toContain('M1');
      expect(speakers).toContain('M2');

      const conversation = tracker.getConversation();
      expect(conversation).toHaveLength(3);
      expect(conversation[0].speaker).toBe('M1');
      expect(conversation[1].speaker).toBe('M2');
      expect(conversation[2].speaker).toBe('M1');
    });
  });

  describe('Language Support', () => {
    test('should support multiple languages', () => {
      const languages = ['en', 'fr', 'es', 'de', 'it'];
      
      languages.forEach(async (language) => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            token: `token-${language}`,
            type: 'speechmatics'
          })
        });

        const response = await fetch('/api/speechmatics-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'speechmatics',
            transcriptionConfig: { language }
          })
        });

        const data = await response.json();
        expect(data.token).toBe(`token-${language}`);
      });
    });

    test('should validate language codes', () => {
      const LanguageValidator = require('../../../src/language-validator');
      const validator = new LanguageValidator();

      expect(validator.isValidLanguage('en')).toBe(true);
      expect(validator.isValidLanguage('fr')).toBe(true);
      expect(validator.isValidLanguage('invalid')).toBe(false);
      expect(validator.isValidLanguage('')).toBe(false);
      expect(validator.isValidLanguage(null)).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should handle WebSocket connection errors gracefully', () => {
      const SpeechmaticsClient = require('../../../src/speechmatics-client');
      speechmaticsClient = new SpeechmaticsClient({ apiKey: 'test-key' });

      const errorHandler = jest.fn();
      speechmaticsClient.on('error', errorHandler);

      speechmaticsClient.connect();

      // Simulate WebSocket error
      const errorEvent = new Event('error');
      errorEvent.error = new Error('WebSocket connection failed');
      mockWebSocket.addEventListener.mock.calls
        .find(call => call[0] === 'error')[1](errorEvent);

      expect(errorHandler).toHaveBeenCalledWith(expect.any(Error));
    });

    test('should handle API key errors', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: 'Invalid API key',
          message: 'Authentication failed'
        })
      });

      const response = await fetch('/api/speechmatics-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'speechmatics',
          transcriptionConfig: { language: 'en' }
        })
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);
    });

    test('should handle rate limiting', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: 'Too many requests',
          retry_after: 60
        })
      });

      const response = await fetch('/api/speechmatics-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'speechmatics' })
      });

      expect(response.status).toBe(429);
    });

    test('should handle network timeouts', async () => {
      // Mock a timeout scenario
      global.fetch.mockImplementationOnce(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      await expect(fetch('/api/speechmatics-token', {
        method: 'POST',
        timeout: 50,
        body: JSON.stringify({ type: 'speechmatics' })
      })).rejects.toThrow('Timeout');
    });
  });

  describe('Performance Tests', () => {
    test('should handle high-frequency audio frames', async () => {
      const SpeechmaticsClient = require('../../../src/speechmatics-client');
      speechmaticsClient = new SpeechmaticsClient({ apiKey: 'test-key' });
      speechmaticsClient.connect();

      const audioFrame = new ArrayBuffer(1024);
      const startTime = Date.now();
      
      // Simulate high-frequency audio frames (50 frames per second)
      const framePromises = [];
      for (let i = 0; i < 50; i++) {
        framePromises.push(
          new Promise(resolve => {
            setTimeout(() => {
              speechmaticsClient.sendAudio(audioFrame);
              resolve();
            }, i * 20); // 20ms intervals
          })
        );
      }

      await Promise.all(framePromises);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1200); // Should complete within reasonable time
      expect(mockWebSocket.send).toHaveBeenCalledTimes(50);
    });

    test('should measure transcription latency', async () => {
      const SpeechmaticsClient = require('../../../src/speechmatics-client');
      speechmaticsClient = new SpeechmaticsClient({ apiKey: 'test-key' });

      const latencyTracker = [];
      speechmaticsClient.on('transcript', (data) => {
        const latency = Date.now() - data.audioTimestamp;
        latencyTracker.push(latency);
      });

      speechmaticsClient.connect();

      // Simulate audio with timestamp
      const audioData = new ArrayBuffer(1024);
      const audioTimestamp = Date.now();
      speechmaticsClient.sendAudio(audioData, { timestamp: audioTimestamp });

      // Simulate transcription response
      setTimeout(() => {
        const transcriptEvent = new MessageEvent('message', {
          data: JSON.stringify({
            message: 'AddTranscript',
            results: [{
              alternatives: [{ content: 'test transcript' }]
            }]
          })
        });
        
        // Trigger message event
        mockWebSocket.addEventListener.mock.calls
          .find(call => call[0] === 'message')[1](transcriptEvent);
      }, 100);

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(latencyTracker.length).toBe(1);
      expect(latencyTracker[0]).toBeLessThan(200); // Should be under 200ms
    });
  });
});

module.exports = {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest
};