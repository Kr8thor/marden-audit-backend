// EMERGENCY CORS FIX - Simple backend with immediate CORS
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

// IMMEDIATE CORS FIX for ALL requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Emergency CORS fix deployed',
    timestamp: new Date().toISOString(),
    version: 'emergency-cors-fix'
  });
});

// SEO Analysis endpoint
app.post('/seo-analyze', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({
        status: 'error',
        message: 'URL is required'
      });
    }
    
    // Simple SEO analysis
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'MardenSEOAuditBot/1.0'
      }
    });
    
    const $ = cheerio.load(response.data);
    
    const title = $('title').text() || '';
    const metaDescription = $('meta[name="description"]').attr('content') || '';
    const h1Count = $('h1').length;
    const h1Texts = $('h1').map((i, el) => $(el).text()).get().slice(0, 5);
    
    // Calculate simple score
    let score = 0;
    if (title.length >= 30 && title.length <= 60) score += 20;
    if (metaDescription.length >= 120 && metaDescription.length <= 160) score += 20;
    if (h1Count === 1) score += 20;
    if ($('img[alt]').length > $('img').length * 0.8) score += 20;
    if ($('a[href^="http"]').length > 0) score += 20;
    
    const result = {
      status: 'ok',
      message: 'SEO analysis completed',
      url,
      cached: false,
      timestamp: new Date().toISOString(),
      data: {
        url,
        score,
        status: score >= 80 ? 'good' : score >= 50 ? 'needs_improvement' : 'poor',
        pageData: {
          title: { text: title, length: title.length },
          metaDescription: { text: metaDescription, length: metaDescription.length },
          headings: { h1Count, h1Texts }
        }
      }
    };
    
    res.json(result);
    
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Analysis failed',
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Emergency CORS fix server running on port ${PORT}`);
  console.log('✅ CORS enabled for all origins');
});
