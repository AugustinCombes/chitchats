// Example server endpoint for secure token generation
// Deploy this to a secure backend (Vercel, Netlify Functions, etc.)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { roomName, participantIdentity, language } = req.body;

  try {
    const jwt = require('jsonwebtoken');
    
    const payload = {
      iss: process.env.LIVEKIT_API_KEY, // Server-side only
      sub: participantIdentity,
      name: participantIdentity,
      exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour
      iat: Math.floor(Date.now() / 1000),
      nbf: Math.floor(Date.now() / 1000),
      video: {
        roomJoin: true,
        room: roomName,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      },
      language: language,
    };

    const token = jwt.sign(payload, process.env.LIVEKIT_API_SECRET, {
      algorithm: 'HS256',
    });

    res.status(200).json({ token });
  } catch (error) {
    console.error('Error generating token:', error);
    res.status(500).json({ error: 'Failed to generate token' });
  }
}