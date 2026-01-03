/**
 * Workspace Routes
 *
 * Team and workspace management endpoints
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import * as workspaceController from '../controllers/workspace.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Workspace CRUD
router.post('/', workspaceController.createWorkspace);
router.get('/', workspaceController.getWorkspaces);
router.get('/roles', workspaceController.getRoles);
router.get('/:id', workspaceController.getWorkspace);
router.patch('/:id', workspaceController.updateWorkspace);
router.delete('/:id', workspaceController.deleteWorkspace);

// Plan limits
router.get('/:id/limits', workspaceController.getPlanLimits);

// Member management
router.get('/:id/members', workspaceController.getMembers);
router.patch('/:id/members/:memberId/role', workspaceController.updateMemberRole);
router.delete('/:id/members/:memberId', workspaceController.removeMember);
router.post('/:id/transfer-ownership', workspaceController.transferOwnership);

// Invitations
router.get('/:id/invitations', workspaceController.getInvitations);
router.post('/:id/invitations', workspaceController.createInvitation);
router.delete('/:id/invitations/:invitationId', workspaceController.cancelInvitation);

// Invitation acceptance (token-based)
router.post('/invitations/:token/accept', workspaceController.acceptInvitation);
router.post('/invitations/:token/decline', workspaceController.declineInvitation);

export default router;
