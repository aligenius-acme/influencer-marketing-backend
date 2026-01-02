import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import * as messagingController from '../controllers/messaging.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Conversations
router.post('/conversations', messagingController.getOrCreateConversation);
router.get('/conversations', messagingController.getConversations);
router.get('/conversations/:conversationId', messagingController.getConversation);
router.delete('/conversations/:conversationId', messagingController.deleteConversation);

// Messages within a conversation
router.get('/conversations/:conversationId/messages', messagingController.getMessages);
router.post('/conversations/:conversationId/messages', messagingController.sendMessage);
router.post('/conversations/:conversationId/messages/simulate', messagingController.simulateReply);
router.put('/conversations/:conversationId/read', messagingController.markAsRead);

// Conversation actions
router.put('/conversations/:conversationId/archive', messagingController.archiveConversation);
router.put('/conversations/:conversationId/unarchive', messagingController.unarchiveConversation);
router.put('/conversations/:conversationId/block', messagingController.blockConversation);
router.put('/conversations/:conversationId/labels', messagingController.updateLabels);
router.put('/conversations/:conversationId/notes', messagingController.updateNotes);

// Stats and search
router.get('/unread-count', messagingController.getUnreadCount);
router.get('/stats', messagingController.getStats);
router.get('/search', messagingController.searchMessages);

export default router;
