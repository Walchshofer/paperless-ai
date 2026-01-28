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

  it('hydrates persisted messages when session already has history', async function() {
    config.chatPersistence = 'yes';

    const doc = { id: 42, title: 'Test Doc', original_filename: 'test.txt', mime_type: 'text/plain' };
    PaperlessService.getDocument = async (id) => doc;
    PaperlessService.getDocumentContent = async (id) => 'Document contents here';

    let gotSessionArg = null;
    let appended = [];
    // Simulate existing history present in DB
    chatRepository.getOrCreateSession = async (documentId) => { gotSessionArg = documentId; return 'sess-456'; };
    chatRepository.getMessages = async (sessionId) => {
      return [
        { id: 'm1', role: 'system', content: 'persisted system', metadata: null, message_index: 0, created_at: new Date().toISOString() },
        { id: 'm2', role: 'user', content: 'persisted user', metadata: null, message_index: 1, created_at: new Date().toISOString() }
      ];
    };
    chatRepository.appendMessage = async (sessionId, role, content, metadata) => { appended.push({ sessionId, role, content, metadata }); return { id: 'm3' }; };

    chatService.setChatRepository(chatRepository);

    const res = await chatService.initializeChat('42', { chatPersistence: 'yes' });
    const chatData = chatService.chats.get('42');

    // Ensure messages were hydrated and not re-appended
    assert.strictEqual(gotSessionArg, 42);
    assert.strictEqual(chatData.messages.length, 2);
    assert.strictEqual(chatData.messages[0].content, 'persisted system');
    assert.strictEqual(res.history && res.history.length, 2);
    assert.strictEqual(appended.length, 0, 'Should not append system message when history is present');

    config.chatPersistence = 'no';
  });
});