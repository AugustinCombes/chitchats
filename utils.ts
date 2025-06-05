import Constants from 'expo-constants';

export const generateAPIUrl = (relativePath: string) => {
  const path = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;

  if (process.env.NODE_ENV === 'development') {
    // For development builds on device, use the Metro bundler URL
    const experienceUrl = Constants.experienceUrl || Constants.linkingUrl;
    if (experienceUrl) {
      const origin = experienceUrl.replace('exp://', 'http://');
      return origin.concat(path);
    }
    
    // For physical devices, we need to use the computer's IP address
    // The Metro bundler should be running on your computer's IP
    const debuggerHost = Constants.expoConfig?.hostUri || 'localhost:8081';
    const host = debuggerHost.split(':')[0];
    return `http://${host}:8081${path}`;
  }

  if (!process.env.EXPO_PUBLIC_API_BASE_URL) {
    throw new Error(
      'EXPO_PUBLIC_API_BASE_URL environment variable is not defined',
    );
  }

  return process.env.EXPO_PUBLIC_API_BASE_URL.concat(path);
};

// LiveKit Cloud configuration
export const LIVEKIT_URL = process.env.EXPO_PUBLIC_LIVEKIT_URL || 'wss://your-app.livekit.cloud';

// Generate JWT token for LiveKit connection directly (for development)
export const generateToken = async (roomName: string, participantIdentity: string, language: string = 'en') => {
  try {
    // For development, generate token directly on client
    // In production, this should be done on a secure backend
    const { Base64 } = await import('js-base64');
    const { HmacSHA256, enc } = await import('crypto-js');
    
    const LIVEKIT_API_KEY = process.env.EXPO_PUBLIC_LIVEKIT_API_KEY;
    const LIVEKIT_API_SECRET = process.env.EXPO_PUBLIC_LIVEKIT_API_SECRET;

    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      throw new Error('LiveKit API key and secret are required');
    }

    const now = Math.floor(Date.now() / 1000);
    
    const header = {
      alg: 'HS256',
      typ: 'JWT'
    };
    
    const payload = {
      iss: LIVEKIT_API_KEY,
      sub: participantIdentity,
      name: participantIdentity,
      exp: now + (60 * 60), // 1 hour from now
      iat: now, // issued at
      nbf: now, // not before
      video: {
        roomJoin: true,
        room: roomName,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      },
      language: language, // Add language parameter
    };

    const encodedHeader = Base64.encode(JSON.stringify(header)).replace(/[=]/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const encodedPayload = Base64.encode(JSON.stringify(payload)).replace(/[=]/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const data = `${encodedHeader}.${encodedPayload}`;
    
    const signature = HmacSHA256(data, LIVEKIT_API_SECRET);
    const encodedSignature = signature.toString(enc.Base64).replace(/[=]/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    
    const token = `${data}.${encodedSignature}`;
    return token;
  } catch (error) {
    console.error('Error generating LiveKit token:', error);
    throw error;
  }
};