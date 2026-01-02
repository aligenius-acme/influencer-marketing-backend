import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import * as contentController from '../controllers/contentApproval.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Submissions CRUD
router.post('/', contentController.createSubmission);
router.get('/', contentController.getSubmissions);
router.get('/stats', contentController.getStats);
router.get('/campaign/:campaignId', contentController.getCampaignSubmissions);
router.get('/:submissionId', contentController.getSubmission);
router.patch('/:submissionId', contentController.updateSubmission);
router.delete('/:submissionId', contentController.deleteSubmission);

// Workflow actions
router.post('/:submissionId/submit', contentController.submitForReview);
router.post('/:submissionId/review', contentController.startReview);
router.post('/:submissionId/revision', contentController.requestRevision);
router.post('/:submissionId/approve', contentController.approveContent);
router.post('/:submissionId/reject', contentController.rejectContent);
router.post('/:submissionId/publish', contentController.markAsPublished);
router.post('/:submissionId/revert', contentController.revertToDraft);

// Feedback
router.post('/:submissionId/feedback', contentController.addFeedback);

export default router;
