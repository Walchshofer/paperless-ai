# 📄 Paperless-AI

[![GitHub commit activity](https://img.shields.io/github/commit-activity/t/clusterzx/paperless-ai)](https://github.com/clusterzx/paperless-ai/commits/main)
[![Docker Pulls](https://img.shields.io/docker/pulls/clusterzx/paperless-ai)](https://hub.docker.com/r/clusterzx/paperless-ai)
[![GitHub Stars](https://img.shields.io/github/stars/clusterzx)](https://github.com/clusterzx)
[![License](https://img.shields.io/github/license/clusterzx/paperless-ai?cacheSeconds=1)](LICENSE)

---

**Paperless-AI** is an AI-powered extension for [Paperless-ngx](https://github.com/paperless-ngx/paperless-ngx) that brings automatic document classification, smart tagging, and semantic search using OpenAI-compatible APIs and Ollama.

It enables **fully automated document workflows**, **contextual chat**, and **powerful customization** — all via an intuitive web interface.

> 💡 Just ask:  
> “When did I sign my rental agreement?”  
> “What was the amount of the last electricity bill?”  
> “Which documents mention my health insurance?”  

Powered by **Retrieval-Augmented Generation (RAG)**, you can now search semantically across your full archive and get precise, natural language answers.

---

## ✨ Features

### 🔄 Automated Document Processing
- Detects new documents in Paperless-ngx automatically
- Analyzes content using OpenAI API, Ollama, and other compatible backends
- Assigns title, tags, document type, and correspondent
- **Visual RAG Pipeline** (Ollama only):
  - Multi-model routing: Text analysis, Vision analysis, or Sequential (hybrid)
  - Automatic quality assessment for scanned documents
  - Vision model fallback for poor OCR or complex layouts (tables, forms, multi-column)
  - Domain-specific field extraction (financial, medical, legal, technical)
- Built-in support for:
  - Ollama (Mistral, Llama, Phi-3, Gemma-2, **Qwen3-VL for vision**)
  - OpenAI
  - DeepSeek.ai
  - OpenRouter.ai
  - Perplexity.ai
  - Together.ai
  - LiteLLM
  - VLLM
  - Fastchat
  - Gemini (Google)
  - ...and more!

### 🧠 RAG-Based AI Chat
- Natural language document search and Q&A
- Understands full document context (not just keywords)
- Semantic memory powered by your own data
- Fast, intelligent, privacy-friendly document queries  
![RAG_CHAT_DEMO](https://raw.githubusercontent.com/clusterzx/paperless-ai/refs/heads/main/ppairag.png)

### ⚙️ Manual Processing
- Web interface for manual AI tagging
- Useful when reviewing sensitive documents
- Accessible via `/manual`

### 🧩 Smart Tagging & Rules
- Define rules to limit which documents are processed
- Disable prompts and apply tags automatically
- Set custom output tags for tracked classification  
![PPAI_SHOWCASE3](https://github.com/user-attachments/assets/1fc9f470-6e45-43e0-a212-b8fa6225e8dd)

---

## 👁️ Visual RAG (Ollama Vision Models)

**NEW:** Paperless-AI now supports vision models for enhanced document analysis!

### What is Visual RAG?

Visual RAG combines traditional text-based analysis with vision model capabilities to improve extraction accuracy for:
- Scanned documents with poor OCR quality
- Complex layouts (tables, forms, multi-column documents)
- Documents with visual elements that don't translate well to text

### How It Works

The system automatically routes documents through a **3-stage pipeline**:

1. **TEXT_ONLY** - High quality OCR, simple layouts → Fast text-only analysis
2. **VISION_ONLY** - Very poor OCR quality → Direct vision model analysis
3. **SEQUENTIAL** - Medium quality or complex layouts → Text analysis first, vision enhancement if needed

### Configuration

Add these environment variables to enable Visual RAG:

```bash
# Vision model configuration
OLLAMA_VISION_MODEL=qwen3-vl:8b
VISION_KEEP_ALIVE=5m
TEXT_KEEP_ALIVE=2m

# Enable Visual RAG pipeline (yes/no)
ENABLE_VISUAL_RAG=yes

# Text quality threshold (0-100)
# Below this score triggers vision analysis in sequential mode
TEXT_QUALITY_THRESHOLD=60

# Force all documents through vision model (useful for testing)
FORCE_VISUAL_RAG=no

# Render settings for vision extraction
VISION_RENDER_DPI=150
MAX_VISION_PAGES=4

# Retry policy for vision planner/extractor
VISUAL_RAG_MAX_RETRIES_PLANNER=1
VISUAL_RAG_MAX_RETRIES_EXTRACTOR=1
```

### Domain-Specific Extraction

Visual RAG includes specialized profiles for different document types:

- **Financial** - Invoices, receipts, bank statements (extracts amounts, IBAN, VAT, payment dates)
- **Medical** - Lab reports, prescriptions, doctor letters (extracts diagnoses, medications, lab values)
- **Legal** - Contracts, agreements (extracts parties, dates, termination clauses)
- **Technical** - Manuals, datasheets (extracts model numbers, specifications)
- **Personal** - Letters, notices (extracts addresses, reference numbers)

The system automatically selects the appropriate profile based on document classification.

### Requirements

- Ollama installation with vision model support
- Recommended: `qwen3-vl:8b` (6.1GB) - install with `ollama pull qwen3-vl:8b`
- Text model: Any Ollama model (sauerkraut-llama3.1:8b, mistral, etc.)

### Performance Notes

- Vision analysis takes longer than text-only (due to model size)
- Keep-alive settings prevent frequent model reloads
- Sequential mode provides best balance of speed and accuracy
- Disable with `ENABLE_VISUAL_RAG=no` to revert to text-only mode

---

## 🚀 Installation

> ⚠️ **First-time install:** Restart the container **after completing setup** (API keys, preferences) to build RAG index.  
> 🔁 Not required for updates.

📘 [Installation Wiki](https://github.com/clusterzx/paperless-ai/wiki/2.-Installation)

---

## 🐳 Docker Support

- Health monitoring and auto-restart
- Persistent volumes and graceful shutdown
- Works out of the box with minimal setup

---

## 🔧 Local Development

```bash
# Install dependencies
npm install

# Start development/test mode
npm run test
```

---

## 🧭 Roadmap Highlights

- ✅ Multi-AI model support
- ✅ Multilingual document analysis
- ✅ Tag rules and filters
- ✅ Integrated document chat with RAG
- ✅ Responsive web interface

---

## 🤝 Contributing

We welcome PRs and contributions!

```bash
# Fork, clone, then:
git checkout -b feature/YourFeature
# After changes:
git commit -m "Add YourFeature"
git push origin feature/YourFeature
```

Then open a Pull Request via GitHub.

---

## 🆘 Support & Community

- [Issues](https://github.com/clusterzx/paperless-ai/issues)
- [Discord](https://discord.gg/AvNekAfK38)

---

## 📄 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

## 🙏 Support Development

[![Patreon](https://img.shields.io/badge/Patreon-F96854?style=for-the-badge&logo=patreon&logoColor=white)](https://www.patreon.com/c/clusterzx)
[![PayPal](https://img.shields.io/badge/PayPal-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://www.paypal.com/paypalme/bech0r)
[![BuyMeACoffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://www.buymeacoffee.com/clusterzx)
[![Ko-Fi](https://img.shields.io/badge/Ko--fi-F16061?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/clusterzx)
