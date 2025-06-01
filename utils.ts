import Constants from 'expo-constants';

export const generateAPIUrl = (relativePath: string) => {
  const origin = Constants.experienceUrl.replace('exp://', 'http://');

  const path = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;

  if (process.env.NODE_ENV === 'development') {
    return origin.concat(path);
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

// Generate JWT token for LiveKit connection via API
export const generateToken = async (roomName: string, participantIdentity: string) => {
  try {
    const response = await fetch(generateAPIUrl('/api/livekit-token'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        roomName,
        participantIdentity,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate token');
    }

    const { token } = await response.json();
    return token;
  } catch (error) {
    console.error('Error generating LiveKit token:', error);
    throw error;
  }
};