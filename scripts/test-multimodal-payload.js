const axios = require('axios');
const token = process.env.TEST_TOKEN || process.env.JWT_TOKEN;
const documentId = 97;

async function testMultimodal() {
  if (!token) {
    console.error('Missing TEST_TOKEN or JWT_TOKEN environment variable.');
    console.error('Example: $env:TEST_TOKEN = (node scripts/gen-test-token.js)');
    process.exit(1);
  }
  try {
    const response = await axios.post('http://localhost:3000/api/chat/document', {
      documentId,
      message: 'Analyze this image.',
      model: 'qwen3-vl:8b',
      documentContext: {
        title: '2025-04-28 - Labor Hamwi - Laborbefund',
        content: 'Sample content',
        page: 1
      },
      context: [
        {
          type: 'visual',
          page: 1,
          imageBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' // Minimal valid PNG
        }
      ]
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('Response status:', response.status);
    console.log('Response data:', response.data);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testMultimodal();
