// services/openaiService.js
const OpenAI = require('openai');
const config = require('../config/config');

class OpenAIService {
  constructor() {
    this.client = null;
  }

  initialize() {
    if (!this.client && config.openai.apiKey) {
      this.client = new OpenAI({
        apiKey: config.openai.apiKey
      });
    }
  }

  async analyzeDocument(content) {
    try {
      // Ensure client is initialized
      this.initialize();

      if (!this.client) {
        console.error('OpenAI client not initialized - missing API key');
        return { tags: [], correspondent: null };
      }

      const response = await this.client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: 'Analysieren Sie den Inhalt des Dokuments und extrahieren Sie nur die wichtigsten Informationen. Generieren Sie ein JSON-Objekt mit den vorgeschlagenen Tags und dem entsprechenden Korrespondenten. Erfassen Sie dabei ausschließlich relevante Kategorien wie Rechnung, Steuer, Vertrag, Mitteilung, Kfz, Versicherung usw. sowie die zugehörige Firma oder Institution. Vermeiden Sie generische Tags oder irrelevante Korrespondenten. Ausgabeformat: {tags: ["Tag1", "Tag2"], correspondent: "Firma/Institution"} – keine Markdown-Syntax, nur das JSON-Objekt."'
          },
          {
            role: "user",
            content: content
          }
        ],
        temperature: 0.3,
      });

      let jsonContent = response.choices[0].message.content;
      
      // Remove any markdown code block syntax if present
      jsonContent = jsonContent.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      
      // Remove any leading/trailing whitespace
      jsonContent = jsonContent.trim();
      
      // Try to parse the cleaned JSON
      const parsedResponse = JSON.parse(jsonContent);
      
      // Validate the structure
      if (!Array.isArray(parsedResponse.tags) || typeof parsedResponse.correspondent !== 'string') {
        throw new Error('Invalid response structure');
      }
      
      return parsedResponse;
    } catch (error) {
      if (error.message.includes('OpenAI')) {
        console.error('OpenAI API Error:', error);
      } else {
        console.error('Failed to parse OpenAI response:', error);
        if (response?.choices[0]?.message?.content) {
          console.log('Raw API response:', response.choices[0].message.content);
        }
      }
      return { tags: [], correspondent: null };
    }
  }
}

module.exports = new OpenAIService();