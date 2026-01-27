const assert = require('assert');
const chatService = require('../../services/chatService');
const chatRepository = require('../../services/repositories/chatRepository');
const PaperlessService = require('../../services/paperlessService');
const config = require('../../config/config');

describe('ChatService persistence integration (unit)', function() {
  it('creates session and persists initial system message when enabled', async function() {
    // stub blog
    config.chatPersistence = 'yes';

    // stub PaperlessService
    const doc = { id: 42, title: 'Test Doc', original_filename: 'test.txt', mime_type: 'text/plain' };
    PaperlessService.getDocument = async (id) => doc;
    PaperlessService.getDocumentContent = async (id) => 'Document contents here';

    // stub repository methods
    let gotSessionArg = null;
    let appended = [];
    chatRepository.getOrCreateSession = async (documentId) => { gotSessionArg = documentId; return 'sess-123'; };
    chatRepository.appendMessage = async (sessionId, role, content, metadata) => { appended.push({ sessionId, role, content, metadata }); return { id: 'm1' }; };

    // Ensure chatService uses our stub repo
    chatService.setChatRepository(chatRepository);
    // sanity check
    const ptr = chatService._getChatRepository();
    assert.strictEqual(ptr, chatRepository, 'chatService should use injected repo');
    console.log('config.chatPersistence=', config.chatPersistence);

    const res = await chatService.initializeChat('42', { chatPersistence: 'yes' });
    console.log('chat data after init:', chatService.chats.get('42'));
    assert.strictEqual(res.initialized, true);
    assert.strictEqual(gotSessionArg, 42);
    assert.ok(appended.length >= 1);
    assert.strictEqual(appended[0].role, 'system');

    // cleanup
    config.chatPersistence = 'no';
  });
});