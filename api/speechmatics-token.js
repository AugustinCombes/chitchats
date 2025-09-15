export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed' 
    });
  }

  try {
    const { type, ttl = 3600, language = 'en' } = req.body;
    
    const apiKey = process.env.SPEECHMATICS_API_KEY;
    if (!apiKey) {
      throw new Error('SPEECHMATICS_API_KEY not configured');
    }

    // Generate temporary key from Speechmatics API
    const response = await fetch(`https://mp.speechmatics.com/v1/api_keys?type=${type}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ ttl })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Speechmatics API error: ${error}`);
    }

    const data = await response.json();
    
    return res.status(200).json({
      jwt: data.key_value,
      expires_in: ttl,
      language
    });
    
  } catch (error) {
    console.error('Token generation error:', error);
    return res.status(500).json({ 
      error: 'Failed to generate token',
      message: error.message 
    });
  }
}