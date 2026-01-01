⚠️ **ARCHIVED DOCUMENT**

This document is deprecated and superseded by:
- [docs/EXPERT_PIPELINE_DECISION_TABLE.md](../EXPERT_PIPELINE_DECISION_TABLE.md)
- [docs/ARCHITECTURE_OVERVIEW.md](../ARCHITECTURE_OVERVIEW.md)

**Do not use this document to infer system behavior.**

---

# Component Hierarchy Documentation

This document outlines the high-level component hierarchy of the paperless-ai application, including a visual diagram and an onboarding checklist for new developers.

## Component Hierarchy Diagram

The following Mermaid diagram illustrates the main components and their relationships in the paperless-ai system:

```mermaid
graph TD
    A[paperless-ai Application] --> B[Frontend]
    A --> C[Backend]
    
    B --> B1[Views - EJS Templates]
    B --> B2[Public Assets - CSS/JS]
    
    C --> C1[API Server - server.js (Express)]
    C --> C2[Python Services - main.py]
    C --> C3[Routes]
    C --> C4[Services]
    C --> C5[Models]
    C --> C6[Configuration]
    C --> C7[Documentation]
    
    C1 --> C3
    C1 --> C4
    C1 --> C5
    C1 --> C6
    
    C3 --> C31[auth.js]
    C3 --> C32[rag.js]
    C3 --> C33[setup.js]
    
    C4 --> C41[AI Services - aiServiceFactory.js, chatService.js, etc.]
    C4 --> C42[Document Services - documentsService.js, paperlessService.js]
    C4 --> C43[Expert Pipeline - ExpertRegistry.js, vision.js]
    C4 --> C44[RAG Service - rag_service/ (Python)]
    C4 --> C45[Other Services - logger.js, setupService.js, etc.]
    
    C5 --> C51[document.js]
    
    C6 --> C61[config.js]
    C6 --> C62[routing.js]
    C6 --> C63[schemas/]
    
    C7 --> C71[docs/ - Guides, API docs]
```

### Diagram Explanation

- **Frontend**: Handles user interface rendering using EJS templates and static assets.
- **Backend**: Core application logic split between Node.js (Express server) and Python components.
- **API Server**: Main Express.js server handling HTTP requests via defined routes.
- **Routes**: Define API endpoints for authentication, RAG operations, and setup.
- **Services**: Modular components for AI processing, document handling, expert pipelines, and RAG functionality.
- **Models**: Data models for documents and other entities.
- **Configuration**: Environment and application settings management.
- **Documentation**: Guides, API specs, and project documentation.

## Onboarding Checklist

Follow these steps to get started with the paperless-ai project:

- [ ] **Clone the Repository**: `git clone <repo-url>` and navigate to the project directory.
- [ ] **Install Dependencies**:
  - Node.js: Run `npm install` in the root directory.
  - Python: Install requirements with `pip install -r requirements.txt`.
- [ ] **Set Up Environment Variables**: Copy `.env.example` to `.env` and configure necessary variables (e.g., API keys, model endpoints).
- [ ] **Configure Docker (if using)**: Ensure Docker and Docker Compose are installed. Use `docker-compose.yml` for containerized setup.
- [ ] **Run Database/External Services**: Start any required databases or external APIs (e.g., Ollama for AI models).
- [ ] **Start the Application**:
  - Node.js server: `npm start` or `node server.js`.
  - Python services: Run `python main.py` or use provided scripts.
- [ ] **Verify Setup**: Access the application at `http://localhost:<port>` and check logs for errors.
- [ ] **Run Tests**: Execute `npm test` or relevant test scripts to ensure everything works.
- [ ] **Review Documentation**: Read `README.md`, `docs/EXPERT_PIPELINE_GUIDE.md`, and other guides for detailed usage.

For more detailed setup instructions, refer to the main `README.md` file.