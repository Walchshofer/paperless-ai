let currentDocumentId = null;
let currentModel = null;

// Component globals (attached in views via script tags)
const ExpertMessage = window.ExpertMessage;
const DocumentOverlay = window.DocumentOverlay;
const ThinkingAccordion = window.ThinkingAccordion;
const OrchestratorStatus = window.OrchestratorStatus; 

// Initialize marked with options for code highlighting
marked.setOptions({
    highlight: function(code, lang) {
        if (lang && hljs.getLanguage(lang)) {
            return hljs.highlight(code, { language: lang }).value;
        }
        return hljs.highlightAuto(code).value;
    },
    breaks: true,
    gfm: true
});

// Load saved theme on page load
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    setupTextareaAutoResize();
    setupChatTabs();
    setupModelSelector();
});

async function initializeChat(documentId) {
    try {
        currentModel = getSelectedModel();
        const modelParam = currentModel ? `?model=${encodeURIComponent(currentModel)}` : '';
        const response = await fetch(`/chat/init/${documentId}${modelParam}`);
        if (!response.ok) throw new Error('Failed to initialize chat');
        const data = await response.json();

        document.getElementById('initialState').classList.add('hidden');        
        document.getElementById('chatHistory').classList.remove('hidden');      
        document.getElementById('messageForm').classList.remove('hidden');
        document.getElementById('documentId').value = documentId;
        document.getElementById('chatHistory').innerHTML = '';
        
        currentDocumentId = documentId;
        loadDocumentPreview(documentId);

        addMessage('Chat initialized for document: ' + data.documentTitle, false);
    } catch (error) {
        console.error('Error initializing chat:', error);
        showError('Failed to initialize chat');
    }
}

async function sendMessage(message) {
    try {
        const response = await fetch('/chat/message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                documentId: currentDocumentId,
                message: message,
                model: currentModel
            })
        });
        
        if (!response.ok) throw new Error('Failed to send message');
        
        // Create message container for streaming response
        const containerDiv = document.createElement('div');
        containerDiv.className = 'message-container assistant';
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message assistant';
        containerDiv.appendChild(messageDiv);
        
        document.getElementById('chatHistory').appendChild(containerDiv);
        
        let markdown = '';
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = decoder.decode(value);
            const lines = text.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;

                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.content) {
                            markdown += parsed.content;
                            messageDiv.innerHTML = marked.parse(markdown);
                            
                            // Apply syntax highlighting to any code blocks
                            messageDiv.querySelectorAll('pre code').forEach((block) => {
                                hljs.highlightBlock(block);
                            });
                            
                            // Scroll to bottom
                            const chatHistory = document.getElementById('chatHistory');
                            chatHistory.scrollTop = chatHistory.scrollHeight;
                        }

                        // If the stream includes structured metadata/expert payloads, handle them
                        if (parsed.metadata || parsed.expert || parsed.expert_response) {
                            try { handleExpertResponse(parsed); } catch (err) { console.error('handleExpertResponse failed', err); }
                        }
                    } catch (e) {
                        console.error('Error parsing SSE data:', e);
                    }
                }
            }
        }

        return null; // No need to return response as it's handled in streaming
    } catch (error) {
        console.error('Error sending message:', error);
        throw error;
    }
}

function addMessage(message, isUser = true) {
    const containerDiv = document.createElement('div');
    containerDiv.className = `message-container ${isUser ? 'user' : 'assistant'}`;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user' : 'assistant'}`;
    
    if (isUser) {
        messageDiv.innerHTML = `<p>${escapeHtml(message)}</p>`;
    } else {
        let messageContent = message;
        try {
            if (typeof message === 'string' && message.trim().startsWith('{')) {
                const jsonResponse = JSON.parse(message);
                messageContent = jsonResponse.reply || jsonResponse.message || message;
            }
        } catch (e) {
            console.log('Message is not JSON, using as is');
        }
        
        messageDiv.innerHTML = marked.parse(messageContent);
        messageDiv.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightBlock(block);
        });
    }
    
    containerDiv.appendChild(messageDiv);
    const chatHistory = document.getElementById('chatHistory');
    chatHistory.appendChild(containerDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'message-container assistant';
    errorDiv.innerHTML = `
        <div class="message assistant error">
            <p>Error: ${escapeHtml(message)}</p>
        </div>
    `;
    document.getElementById('chatHistory').appendChild(errorDiv);
}

// Handle specialized expert responses and UI integrations
function handleExpertResponse(parsed) {
    try {
        const chatHistory = document.getElementById('chatHistory');

        // Render ExpertMessage if available
        if (typeof ExpertMessage !== 'undefined' && parsed) {
            const em = new ExpertMessage(parsed);
            const wrapper = document.createElement('div');
            wrapper.className = 'message-container assistant';
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message assistant';
            messageDiv.appendChild(em.render());
            wrapper.appendChild(messageDiv);
            chatHistory.appendChild(wrapper);
            chatHistory.scrollTop = chatHistory.scrollHeight;
        }

        // Render thinking blocks if present
        const text = parsed.reply || parsed.message || parsed.content || '';
        if (text && typeof ThinkingAccordion !== 'undefined') {
            const acc = ThinkingAccordion.renderFromText(text);
            if (acc) {
                const wrapper = document.createElement('div');
                wrapper.className = 'message-container assistant';
                const messageDiv = document.createElement('div');
                messageDiv.className = 'message assistant';
                messageDiv.appendChild(acc);
                wrapper.appendChild(messageDiv);
                chatHistory.appendChild(wrapper);
                chatHistory.scrollTop = chatHistory.scrollHeight;
            }
        }

        // Visual grounding
        if (parsed.metadata && parsed.metadata.visual_grounding && typeof DocumentOverlay !== 'undefined') {
            try {
                // attach to document preview if present
                const preview = document.getElementById('documentPreview');
                if (preview) {
                    const ov = new DocumentOverlay(preview);
                    ov.render(parsed.metadata.visual_grounding);
                }
            } catch (e) {
                console.error('DocumentOverlay error:', e);
            }
        }

        // Orchestrator status updates (e.g., model swap)
        if (parsed.metadata && (Array.isArray(parsed.metadata.stages_executed) && parsed.metadata.stages_executed.includes('model_swap'))
            || (parsed.metadata && parsed.metadata.model_swap)) {
            if (typeof OrchestratorStatus !== 'undefined') {
                const orch = new OrchestratorStatus();
                orch.show('Consulting Legal Expert...');
                // hide after a short timeout if nothing else
                setTimeout(() => orch.hide(), 8000);
            }
        }

    } catch (e) {
        console.error('handleExpertResponse error:', e);
    }
}

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
}

function setTheme(theme) {
    const body = document.body;
    const lightIcon = document.getElementById('lightIcon');
    const darkIcon = document.getElementById('darkIcon');
    
    body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    if (theme === 'dark') {
        lightIcon.classList.add('hidden');
        darkIcon.classList.remove('hidden');
    } else {
        lightIcon.classList.remove('hidden');
        darkIcon.classList.add('hidden');
    }
}

function setupTextareaAutoResize() {
    const textarea = document.getElementById('messageInput');
    
    function adjustHeight() {
        textarea.style.height = 'auto';
        textarea.style.height = (textarea.scrollHeight) + 'px';
    }
    
    textarea.addEventListener('input', adjustHeight);
    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            document.getElementById('messageForm').dispatchEvent(new Event('submit'));
        }
    });
}

function setupChatTabs() {
    const tabButtons = document.querySelectorAll('.chat-tab-button');
    const tabPanels = document.querySelectorAll('.chat-tab-panel');
    if (!tabButtons.length || !tabPanels.length) return;

    tabButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const targetId = button.dataset.tabTarget;
            switchChatTab(targetId);
        });
    });
}

function switchChatTab(targetId) {
    if (!targetId) return;
    const tabButtons = document.querySelectorAll('.chat-tab-button');
    const tabPanels = document.querySelectorAll('.chat-tab-panel');

    tabButtons.forEach((button) => {
        const isActive = button.dataset.tabTarget === targetId;
        button.classList.toggle('border-blue-500', isActive);
        button.classList.toggle('text-blue-600', isActive);
        button.classList.toggle('border-transparent', !isActive);
        button.classList.toggle('text-gray-500', !isActive);
    });

    tabPanels.forEach((panel) => {
        panel.classList.toggle('hidden', panel.id !== targetId);
    });

    // Load visual preview when switching to visual tab
    if (targetId === 'visualTab' && currentDocumentId && !chatVisualLoaded) {
        loadChatVisualPreview(currentDocumentId);
    }
}

function setupModelSelector() {
    const modelSelect = document.getElementById('modelSelect');
    if (!modelSelect) return;

    modelSelect.addEventListener('change', () => {
        currentModel = getSelectedModel();
    });

    loadOllamaModels();
}

async function loadOllamaModels() {
    const modelSelect = document.getElementById('modelSelect');
    if (!modelSelect) return;

    try {
        const response = await fetch('/api/ollama/models');
        if (!response.ok) throw new Error('Failed to load models');
        const data = await response.json();
        populateModelSelect(modelSelect, data);
    } catch (error) {
        console.error('Error loading Ollama models:', error);
        // Fallback: build placeholder list from local configuration inputs so dropdown isn't blank
        const configured = [];
        ['ollamaModel','ollamaVisionModel','ollamaPlannerModel','ollamaRouterModel','ollamaOrchestratorModel'].forEach(id => {
            const el = document.getElementById(id);
            if (el && el.value) configured.push(el.value.trim());
        });
        const data = { models: [], expertModels: [], placeholderModels: Array.from(new Set(configured)).filter(Boolean), defaultModel: modelSelect.dataset.default || '' };
        populateModelSelect(modelSelect, data);
        currentModel = getSelectedModel();
    }
}

function populateModelSelect(modelSelect, data) {
    const installedModels = Array.isArray(data.models) ? data.models : [];
    const expertModels = Array.isArray(data.expertModels)
        ? data.expertModels
        : [];
    const placeholderModels = Array.isArray(data.placeholderModels)
        ? data.placeholderModels
        : [];
    const defaultModel = data.defaultModel || modelSelect.dataset.default || '';

    modelSelect.innerHTML = '';

    const installedSet = new Set();
    installedModels.forEach((model) => {
        if (model) installedSet.add(model);
    });

    const expertEntries = expertModels.filter((entry) => entry && entry.model);
    const expertSet = new Set(expertEntries.map((entry) => entry.model));

    const placeholderEntries = placeholderModels.filter((model) => {
        return model && !installedSet.has(model) && !expertSet.has(model);
    });

    if (installedSet.size) {
        const group = document.createElement('optgroup');
        group.label = 'Installed models';
        Array.from(installedSet).forEach((model) => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            group.appendChild(option);
        });
        modelSelect.appendChild(group);
    }

    if (expertEntries.length) {
        const group = document.createElement('optgroup');
        group.label = 'Expert models';
        expertEntries.forEach((entry) => {
            const option = document.createElement('option');
            option.value = entry.model;
            option.textContent = entry.label
                ? `${entry.label} (${entry.model})`
                : entry.model;
            group.appendChild(option);
        });
        modelSelect.appendChild(group);
    }

    if (placeholderEntries.length) {
        const group = document.createElement('optgroup');
        group.label = data.providerMismatch
            ? 'Configured models (lazy load)'
            : 'Configured models (not verified)';
        placeholderEntries.forEach((model) => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = `${model} (lazy load)`;
            option.dataset.placeholder = 'true';
            group.appendChild(option);
        });
        modelSelect.appendChild(group);
    }

    if (!installedSet.size && !expertEntries.length && !placeholderEntries.length) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No models available';
        modelSelect.appendChild(option);
    }

    const defaultExists = Boolean(defaultModel)
        && (installedSet.has(defaultModel)
            || expertSet.has(defaultModel)
            || placeholderEntries.includes(defaultModel));

    if (defaultExists) {
        modelSelect.value = defaultModel;
    } else if (modelSelect.options.length) {
        modelSelect.selectedIndex = 0;
    }

    currentModel = getSelectedModel();
}

function getSelectedModel() {
    const modelSelect = document.getElementById('modelSelect');
    if (!modelSelect) return null;
    return modelSelect.value || null;
}

async function loadDocumentPreview(documentId) {
    const previewEmpty = document.getElementById('documentPreviewEmpty');
    const preview = document.getElementById('documentPreview');
    if (!previewEmpty || !preview) return;

    if (!documentId) {
        resetDocumentPreview();
        return;
    }

    previewEmpty.textContent = 'Loading document preview...';
    previewEmpty.classList.remove('hidden');
    preview.classList.add('hidden');

    try {
        const response = await fetch(`/manual/preview/${documentId}`);
        if (!response.ok) throw new Error('Failed to load document content');
        const data = await response.json();

        const titleEl = document.getElementById('documentPreviewTitle');
        const metaEl = document.getElementById('documentPreviewMeta');
        const contentEl = document.getElementById('documentPreviewContent');
        const linkEl = document.getElementById('documentPreviewLink');

        const tags = Array.isArray(data.tags) ? data.tags.filter(Boolean) : [];
        const metaParts = [`ID: ${data.id || documentId}`];
        if (tags.length) metaParts.push(`Tags: ${tags.join(', ')}`);

        if (titleEl) titleEl.textContent = data.title || `Document ${documentId}`;
        if (metaEl) metaEl.textContent = metaParts.join(' • ');
        if (contentEl) contentEl.textContent = data.content || 'No content available for this document.';
        if (linkEl) linkEl.href = `/history/doc/${documentId}`;

        previewEmpty.classList.add('hidden');
        preview.classList.remove('hidden');
    } catch (error) {
        console.error('Error loading document preview:', error);
        previewEmpty.textContent = 'Failed to load document preview.';
        previewEmpty.classList.remove('hidden');
        preview.classList.add('hidden');
    }
}

function resetDocumentPreview() {
    const previewEmpty = document.getElementById('documentPreviewEmpty');
    const preview = document.getElementById('documentPreview');
    if (!previewEmpty || !preview) return;

    previewEmpty.textContent = 'Select a document to view its content here.';
    previewEmpty.classList.remove('hidden');
    preview.classList.add('hidden');
}

document.getElementById('documentSelect').addEventListener('change', function() {
    const documentId = this.value;
    if (documentId) {
        currentModel = getSelectedModel();
        resetChatVisualPreview(); // Reset visual preview when document changes
        initializeChat(documentId);
    } else {
        currentDocumentId = null;
        resetDocumentPreview();
        resetChatVisualPreview();
    }
});

document.addEventListener("DOMContentLoaded", function () {
    const documentSelect = document.getElementById('documentSelect');
    const documentId = documentSelect.value;

    if (documentId) {
        initializeChat(documentId);
    } else {
        resetDocumentPreview();
    }
});

document.getElementById('messageForm').querySelector('.send-button').addEventListener('click', async (e) => {
    await submitForm();
})

document.getElementById('messageInput').addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        await submitForm();
    }
});

async function submitForm() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();

    if (!message) return;

    try {
        // Show user message immediately
        addMessage(message, true);

        // Clear input and reset height
        messageInput.value = '';
        messageInput.style.height = 'auto';

        // Send message and handle streaming response
        currentModel = getSelectedModel();
        await sendMessage(message);
    } catch {
        showError('Failed to send message');
    }
}

// Visual Preview State
let chatVisualLoaded = false;
let chatCurrentPage = 1;
let chatTotalPages = 1;
let chatOverlayViewer = null;
let chatOverlayLegend = null;

async function loadChatVisualPreview(documentId) {
    const previewEmpty = document.getElementById('visualPreviewEmpty');
    const preview = document.getElementById('chatVisualPreview');
    const container = document.getElementById('chatOverlayContainer');
    const loading = document.getElementById('chatOverlayLoading');
    const pageNav = document.getElementById('chatPageNav');

    if (!previewEmpty || !preview || !container) return;

    if (!documentId) {
        resetChatVisualPreview();
        return;
    }

    previewEmpty.classList.add('hidden');
    preview.classList.remove('hidden');
    loading.classList.remove('hidden');
    container.innerHTML = '';
    container.appendChild(loading);

    try {
        // Get page count first
        const infoRes = await fetch(`/api/document/${documentId}/page-count`);
        if (infoRes.ok) {
            const info = await infoRes.json();
            chatTotalPages = info.pageCount || 1;
        } else {
            chatTotalPages = 1;
        }

        chatCurrentPage = 1;

        // Load first page
        await loadChatVisualPage(documentId, 1);
        updateChatPageNav();
        chatVisualLoaded = true;

    } catch (error) {
        console.error('Failed to load visual preview:', error);
        loading.classList.add('hidden');
        container.innerHTML = `<div class="text-center text-red-500 py-8">Failed to load visual preview: ${error.message}</div>`;
    }
}

async function loadChatVisualPage(documentId, page) {
    const container = document.getElementById('chatOverlayContainer');
    const loading = document.getElementById('chatOverlayLoading');
    const legendContainer = document.getElementById('chatLegendContainer');
    const statsEl = document.getElementById('chatOverlayStats');

    loading.classList.remove('hidden');

    try {
        const loadImage = (src) => new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error('Failed to load rendered image'));
            image.src = src;
        });

        const normalizedUrl = `/api/visual-rag/normalized/${documentId}?page=${page}`;
        let img;

        try {
            img = await loadImage(normalizedUrl);
        } catch (normalizedError) {
            // Fallback to legacy renderer when normalization fails.
            const renderRes = await fetch(`/api/document/${documentId}/render?page=${page}&dpi=300`);
            if (!renderRes.ok) throw new Error('Failed to render page');
            const renderData = await renderRes.json();
            img = await loadImage(`data:image/png;base64,${renderData.image}`);
            if (renderData.totalPages) {
                chatTotalPages = renderData.totalPages;
            }
        }

        img.style.maxWidth = '100%';
        img.style.height = 'auto';

        // Fetch overlays for this page
        const overlayRes = await fetch(`/api/visual-rag/overlays/${documentId}?page=${page}`);
        const data = await overlayRes.json();

        loading.classList.add('hidden');

        // Clear container and add image
        container.innerHTML = '';
        container.appendChild(img);

        // Initialize overlay viewer
        if (chatOverlayViewer) {
            chatOverlayViewer.destroy();
        }

        chatOverlayViewer = new OverlayViewer(container, {
            onOverlayClick: (overlay) => {
                console.log('Clicked overlay:', overlay);
            },
            onOverlayHover: (overlay) => {
                if (overlay && chatOverlayLegend) {
                    chatOverlayLegend.highlightField(overlay.label.toLowerCase().replace(/\s+/g, '_'));
                } else if (chatOverlayLegend) {
                    chatOverlayLegend.clearHighlights();
                }
            }
        });

        chatOverlayViewer.setImage(img);

        if (data.overlays && data.overlays.length > 0) {
            const domain = data.overlays[0]?.domain || 'GENERAL';
            chatOverlayViewer.setOverlays(data.overlays, domain);

            // Initialize legend
            if (chatOverlayLegend) {
                chatOverlayLegend.destroy();
            }
            chatOverlayLegend = new OverlayLegend(legendContainer, {
                domain: domain,
                onFilterChange: ({ mandatoryOnly }) => {
                    chatOverlayViewer.toggleMandatoryOnly(mandatoryOnly);
                }
            });

            // Show stats
            const stats = chatOverlayViewer.getStats();
            document.getElementById('chatOverlayCount').textContent = stats.total;
            statsEl.classList.remove('hidden');
        } else {
            legendContainer.innerHTML = '';
            statsEl.classList.add('hidden');
        }
    } catch (error) {
        console.error('Failed to load page:', error);
        loading.classList.add('hidden');
        container.innerHTML = `<div class="text-center text-red-500 py-8">Failed to load page: ${error.message}</div>`;
    }
}

function updateChatPageNav() {
    const pageNav = document.getElementById('chatPageNav');
    const pageIndicator = document.getElementById('chatPageIndicator');
    const prevBtn = document.getElementById('chatPrevPage');
    const nextBtn = document.getElementById('chatNextPage');

    if (chatTotalPages > 1) {
        pageNav.classList.remove('hidden');
        pageIndicator.textContent = `Page ${chatCurrentPage} of ${chatTotalPages}`;
        prevBtn.disabled = chatCurrentPage <= 1;
        nextBtn.disabled = chatCurrentPage >= chatTotalPages;
    } else {
        pageNav.classList.add('hidden');
    }
}

function resetChatVisualPreview() {
    const previewEmpty = document.getElementById('visualPreviewEmpty');
    const preview = document.getElementById('chatVisualPreview');

    if (previewEmpty) {
        previewEmpty.textContent = 'Select a document to view its visual preview with overlays.';
        previewEmpty.classList.remove('hidden');
    }
    if (preview) {
        preview.classList.add('hidden');
    }

    chatVisualLoaded = false;
    chatCurrentPage = 1;
    chatTotalPages = 1;

    if (chatOverlayViewer) {
        chatOverlayViewer.destroy();
        chatOverlayViewer = null;
    }
    if (chatOverlayLegend) {
        chatOverlayLegend.destroy();
        chatOverlayLegend = null;
    }
}

// Page navigation event listeners
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('chatPrevPage')?.addEventListener('click', async () => {
        if (chatCurrentPage > 1 && currentDocumentId) {
            chatCurrentPage--;
            await loadChatVisualPage(currentDocumentId, chatCurrentPage);
            updateChatPageNav();
        }
    });

    document.getElementById('chatNextPage')?.addEventListener('click', async () => {
        if (chatCurrentPage < chatTotalPages && currentDocumentId) {
            chatCurrentPage++;
            await loadChatVisualPage(currentDocumentId, chatCurrentPage);
            updateChatPageNav();
        }
    });
});
