import jwt from 'jsonwebtoken';

const LIVEKIT_API_KEY = process.env.EXPO_PUBLIC_LIVEKIT_API_KEY || '';
const LIVEKIT_API_SECRET = process.env.EXPO_PUBLIC_LIVEKIT_API_SECRET || '';

export async function POST(req: Request) {
  try {
    const { roomName, participantIdentity } = await req.json();

    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return new Response(
        JSON.stringify({ error: 'LiveKit API key and secret are required' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!roomName || !participantIdentity) {
      return new Response(
        JSON.stringify({ error: 'roomName and participantIdentity are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const payload = {
      exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour from now
      iss: LIVEKIT_API_KEY,
      sub: participantIdentity,
      name: participantIdentity,
      video: {
        roomJoin: true,
        room: roomName,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      },
      kind: 'standard',
    };

    const token = jwt.sign(payload, LIVEKIT_API_SECRET, { algorithm: 'HS256' });

    return new Response(
      JSON.stringify({ token }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating LiveKit token:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate token' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}