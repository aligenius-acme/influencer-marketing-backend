/**
 * Workspace Controller
 *
 * Handles team and workspace management endpoints
 */

import { Request, Response } from 'express';
import { workspaceService, ROLE_PERMISSIONS, PLAN_LIMITS } from '../services/workspace.service.js';
import { auditService, AUDIT_ACTIONS, RESOURCE_TYPES } from '../services/audit.service.js';
import { WorkspaceRole } from '@prisma/client';

interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

/**
 * Create a new workspace
 */
export const createWorkspace = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name, description, logoUrl } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Workspace name is required' });
    }

    const workspace = await workspaceService.createWorkspace(userId, {
      name,
      description,
      logoUrl,
    });

    // Log audit event
    await auditService.logCreate(
      RESOURCE_TYPES.WORKSPACE,
      workspace.id,
      workspace.name,
      { name, description },
      { workspaceId: workspace.id, userId }
    );

    res.status(201).json({
      message: 'Workspace created successfully',
      workspace,
    });
  } catch (error) {
    console.error('[WorkspaceController] Create error:', error);
    res.status(500).json({ error: 'Failed to create workspace' });
  }
};

/**
 * Get user's workspaces
 */
export const getWorkspaces = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const workspaces = await workspaceService.getUserWorkspaces(userId);

    res.json({ workspaces });
  } catch (error) {
    console.error('[WorkspaceController] Get workspaces error:', error);
    res.status(500).json({ error: 'Failed to get workspaces' });
  }
};

/**
 * Get workspace by ID
 */
export const getWorkspace = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const workspace = await workspaceService.getWorkspace(id);

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    res.json({ workspace });
  } catch (error) {
    console.error('[WorkspaceController] Get workspace error:', error);
    res.status(500).json({ error: 'Failed to get workspace' });
  }
};

/**
 * Update workspace
 */
export const updateWorkspace = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const { name, description, logoUrl, settings } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const existing = await workspaceService.getWorkspace(id);
    if (!existing) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const workspace = await workspaceService.updateWorkspace(id, {
      name,
      description,
      logoUrl,
      settings,
    });

    // Log audit event
    await auditService.logUpdate(
      RESOURCE_TYPES.WORKSPACE,
      id,
      workspace.name,
      { name: existing.name, description: existing.description },
      { name, description },
      { workspaceId: id, userId }
    );

    res.json({
      message: 'Workspace updated successfully',
      workspace,
    });
  } catch (error) {
    console.error('[WorkspaceController] Update error:', error);
    res.status(500).json({ error: 'Failed to update workspace' });
  }
};

/**
 * Delete workspace
 */
export const deleteWorkspace = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const workspace = await workspaceService.getWorkspace(id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Only owner can delete
    if (workspace.ownerId !== userId) {
      return res.status(403).json({ error: 'Only workspace owner can delete the workspace' });
    }

    await workspaceService.deleteWorkspace(id);

    // Log audit event
    await auditService.logDelete(
      RESOURCE_TYPES.WORKSPACE,
      id,
      workspace.name,
      { name: workspace.name },
      { userId }
    );

    res.json({ message: 'Workspace deleted successfully' });
  } catch (error) {
    console.error('[WorkspaceController] Delete error:', error);
    res.status(500).json({ error: 'Failed to delete workspace' });
  }
};

/**
 * Get workspace members
 */
export const getMembers = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const members = await workspaceService.getMembers(id);

    res.json({ members });
  } catch (error) {
    console.error('[WorkspaceController] Get members error:', error);
    res.status(500).json({ error: 'Failed to get members' });
  }
};

/**
 * Update member role
 */
export const updateMemberRole = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id, memberId } = req.params;
    const { role } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!role || !Object.keys(ROLE_PERMISSIONS).includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const member = await workspaceService.updateMemberRole(id, memberId, role as WorkspaceRole);

    // Log audit event
    await auditService.log({
      workspaceId: id,
      userId,
      action: AUDIT_ACTIONS.ROLE_CHANGE,
      resourceType: RESOURCE_TYPES.MEMBER,
      resourceId: memberId,
      newValue: { role },
    });

    res.json({
      message: 'Member role updated successfully',
      member,
    });
  } catch (error) {
    console.error('[WorkspaceController] Update role error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update member role';
    res.status(400).json({ error: message });
  }
};

/**
 * Remove member from workspace
 */
export const removeMember = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id, memberId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await workspaceService.removeMember(id, memberId);

    // Log audit event
    await auditService.log({
      workspaceId: id,
      userId,
      action: AUDIT_ACTIONS.LEAVE,
      resourceType: RESOURCE_TYPES.MEMBER,
      resourceId: memberId,
    });

    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('[WorkspaceController] Remove member error:', error);
    const message = error instanceof Error ? error.message : 'Failed to remove member';
    res.status(400).json({ error: message });
  }
};

/**
 * Transfer workspace ownership
 */
export const transferOwnership = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const { newOwnerId } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!newOwnerId) {
      return res.status(400).json({ error: 'New owner ID is required' });
    }

    const workspace = await workspaceService.transferOwnership(id, userId, newOwnerId);

    // Log audit event
    await auditService.log({
      workspaceId: id,
      userId,
      action: AUDIT_ACTIONS.ROLE_CHANGE,
      resourceType: RESOURCE_TYPES.WORKSPACE,
      resourceId: id,
      newValue: { ownerId: newOwnerId },
    });

    res.json({
      message: 'Ownership transferred successfully',
      workspace,
    });
  } catch (error) {
    console.error('[WorkspaceController] Transfer ownership error:', error);
    const message = error instanceof Error ? error.message : 'Failed to transfer ownership';
    res.status(400).json({ error: message });
  }
};

/**
 * Create invitation
 */
export const createInvitation = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const { email, role } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check plan limits
    const limitCheck = await workspaceService.checkPlanLimit(id, 'members');
    if (!limitCheck.allowed) {
      return res.status(403).json({
        error: 'Member limit reached for your plan',
        current: limitCheck.current,
        limit: limitCheck.limit,
      });
    }

    const invitation = await workspaceService.createInvitation(id, userId, {
      email,
      role,
    });

    // Log audit event
    await auditService.log({
      workspaceId: id,
      userId,
      action: AUDIT_ACTIONS.INVITE,
      resourceType: RESOURCE_TYPES.MEMBER,
      resourceName: email,
      newValue: { email, role },
    });

    res.status(201).json({
      message: 'Invitation created successfully',
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        workspace: invitation.workspace,
      },
    });
  } catch (error) {
    console.error('[WorkspaceController] Create invitation error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create invitation';
    res.status(400).json({ error: message });
  }
};

/**
 * Get pending invitations
 */
export const getInvitations = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const invitations = await workspaceService.getInvitations(id);

    res.json({ invitations });
  } catch (error) {
    console.error('[WorkspaceController] Get invitations error:', error);
    res.status(500).json({ error: 'Failed to get invitations' });
  }
};

/**
 * Accept invitation
 */
export const acceptInvitation = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { token } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const workspace = await workspaceService.acceptInvitation(token, userId);

    // Log audit event
    await auditService.log({
      workspaceId: workspace?.id,
      userId,
      action: AUDIT_ACTIONS.JOIN,
      resourceType: RESOURCE_TYPES.MEMBER,
      resourceId: userId,
    });

    res.json({
      message: 'Invitation accepted successfully',
      workspace,
    });
  } catch (error) {
    console.error('[WorkspaceController] Accept invitation error:', error);
    const message = error instanceof Error ? error.message : 'Failed to accept invitation';
    res.status(400).json({ error: message });
  }
};

/**
 * Decline invitation
 */
export const declineInvitation = async (req: AuthRequest, res: Response) => {
  try {
    const { token } = req.params;

    await workspaceService.declineInvitation(token);

    res.json({ message: 'Invitation declined' });
  } catch (error) {
    console.error('[WorkspaceController] Decline invitation error:', error);
    res.status(500).json({ error: 'Failed to decline invitation' });
  }
};

/**
 * Cancel invitation
 */
export const cancelInvitation = async (req: AuthRequest, res: Response) => {
  try {
    const { id, invitationId } = req.params;

    await workspaceService.cancelInvitation(invitationId);

    res.json({ message: 'Invitation cancelled' });
  } catch (error) {
    console.error('[WorkspaceController] Cancel invitation error:', error);
    res.status(500).json({ error: 'Failed to cancel invitation' });
  }
};

/**
 * Get plan limits
 */
export const getPlanLimits = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const [members, campaigns, influencers] = await Promise.all([
      workspaceService.checkPlanLimit(id, 'members'),
      workspaceService.checkPlanLimit(id, 'campaigns'),
      workspaceService.checkPlanLimit(id, 'influencers'),
    ]);

    res.json({
      limits: {
        members,
        campaigns,
        influencers,
      },
    });
  } catch (error) {
    console.error('[WorkspaceController] Get plan limits error:', error);
    res.status(500).json({ error: 'Failed to get plan limits' });
  }
};

/**
 * Get available roles and permissions
 */
export const getRoles = async (_req: Request, res: Response) => {
  try {
    res.json({
      roles: ROLE_PERMISSIONS,
      plans: PLAN_LIMITS,
    });
  } catch (error) {
    console.error('[WorkspaceController] Get roles error:', error);
    res.status(500).json({ error: 'Failed to get roles' });
  }
};
