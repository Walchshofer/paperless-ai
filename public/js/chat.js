let currentDocumentId = null;
let currentModel = null;

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
        modelSelect.innerHTML = '<option value="">Models unavailable</option>';
        currentModel = getSelectedModel();
    }
}

function populateModelSelect(modelSelect, data) {
    const installedModels = Array.isArray(data.models) ? data.models : [];
    const expertModels = Array.isArray(data.expertModels) ? data.expertModels : [];
    const defaultModel = data.defaultModel || modelSelect.dataset.default || '';

    modelSelect.innerHTML = '';

    const seen = new Set();
    const uniqueInstalled = installedModels.filter((model) => {
        if (!model || seen.has(model)) return false;
        seen.add(model);
        return true;
    });

    if (uniqueInstalled.length) {
        const group = document.createElement('optgroup');
        group.label = 'Installed models';
        uniqueInstalled.forEach((model) => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            group.appendChild(option);
        });
        modelSelect.appendChild(group);
    }

    if (expertModels.length) {
        const group = document.createElement('optgroup');
        group.label = 'Expert models';
        expertModels.forEach((entry) => {
            if (!entry.model) return;
            const option = document.createElement('option');
            option.value = entry.model;
            option.textContent = entry.label
                ? `${entry.label} (${entry.model})`
                : entry.model;
            group.appendChild(option);
        });
        modelSelect.appendChild(group);
    }

    if (!uniqueInstalled.length && !expertModels.length) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No models available';
        modelSelect.appendChild(option);
    }

    const defaultExists = defaultModel
        && (uniqueInstalled.includes(defaultModel)
            || expertModels.some((entry) => entry.model === defaultModel));

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
        initializeChat(documentId);
    } else {
        currentDocumentId = null;
        resetDocumentPreview();
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
