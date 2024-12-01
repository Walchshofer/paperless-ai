const axios = require('axios');
const config = require('../config/config');

class PaperlessService {
  constructor() {
    this.client = null;
  }

  initialize() {
    if (!this.client && config.paperless.apiUrl && config.paperless.apiToken) {
      this.client = axios.create({
        baseURL: config.paperless.apiUrl,
        headers: {
          'Authorization': `Token ${config.paperless.apiToken}`,
          'Content-Type': 'application/json'
        }
      });
    }
  }

  async getDocuments() {
    this.initialize();
    if (!this.client) {
      console.error('Paperless client not initialized - missing configuration');
      return [];
    }
    const response = await this.client.get('/documents/');
    return response.data.results;
  }

  async getDocumentContent(documentId) {
    this.initialize();
    if (!this.client) return null;
    const response = await this.client.get(`/documents/${documentId}/`);
    return response.data.content;
  }

  async updateDocument(documentId, updates) {
    this.initialize();
    if (!this.client) return;
    await this.client.patch(`/documents/${documentId}/`, updates);
  }

  async getTags() {
    this.initialize();
    if (!this.client) return [];
    const response = await this.client.get('/tags/');
    return response.data.results;
  }

  async getCorrespondents() {
    this.initialize();
    if (!this.client) return [];
    const response = await this.client.get('/correspondents/');
    return response.data.results;
  }

  async createTag(name) {
    this.initialize();
    if (!this.client) return null;
    const response = await this.client.post('/tags/', { name });
    return response.data;
  }

  async createCorrespondent(name) {
    this.initialize();
    if (!this.client) return null;
    const response = await this.client.post('/correspondents/', { name });
    return response.data;
  }
}

module.exports = new PaperlessService();