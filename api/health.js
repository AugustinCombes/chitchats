export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check environment variables
    const requiredEnvVars = [
      'JWT_SECRET_KEY',
      'SPEECHMATICS_API_KEY',
      'EXPO_PUBLIC_LIVEKIT_API_KEY',
      'EXPO_PUBLIC_LIVEKIT_API_SECRET'
    ];

    const envStatus = {};
    const missingVars = [];

    requiredEnvVars.forEach(varName => {
      const isSet = !!process.env[varName];
      envStatus[varName] = isSet ? 'configured' : 'missing';
      if (!isSet) missingVars.push(varName);
    });

    const isHealthy = missingVars.length === 0;

    return res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 7) || 'unknown',
      environment: process.env.VERCEL_ENV || 'development',
      configuration: {
        environment_variables: envStatus,
        missing_variables: missingVars
      },
      endpoints: {
        '/api/speechmatics-token': 'JWT token generation for Speechmatics',
        '/api/health': 'Health check endpoint'
      }
    });

  } catch (error) {
    console.error('Health check error:', error);
    
    return res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
}