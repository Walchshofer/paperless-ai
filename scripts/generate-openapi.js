#!/usr/bin/env node
'use strict';

const swaggerJSDoc = require('swagger-jsdoc');
const fs = require('fs');
const path = require('path');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Paperless-AI API Documentation',
    version: '1.0.0',
    description: 'API documentation for the Paperless-AI application',
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
    contact: {
      name: 'Clusterzx',
      url: 'https://github.com/Clusterzx',
    },
  },
  servers: [
    {
      url: `http://localhost:${process.env.PAPERLESS_AI_PORT || 3000}`,
      description: 'Development server',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT authentication token obtained from the /login endpoint.',
      },
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
        description: 'API key for programmatic access.',
      },
    },
  },
  security: [
    { BearerAuth: [] },
    { ApiKeyAuth: [] },
  ],
};

const options = {
  definition: swaggerDefinition,
  apis: ['./server.js', './routes/*.js', './routes/api/*.js', './schemas.js'],
};

try {
  const spec = swaggerJSDoc(options);
  const outputPath = path.join(__dirname, '..', 'OPENAPI', 'openapi.json');
  fs.writeFileSync(outputPath, JSON.stringify(spec, null, 2));
  console.log(`✅ OpenAPI spec generated: ${outputPath}`);
} catch (err) {
  console.error('❌ Failed to generate OpenAPI spec:', err.message);
  process.exit(1);
}
