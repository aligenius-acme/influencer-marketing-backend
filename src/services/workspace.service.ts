/**
 * Workspace Service
 *
 * Handles team and workspace management:
 * - Workspace CRUD operations
 * - Team member management
 * - Invitations
 * - Role-based permissions
 */

import { PrismaClient, Prisma, WorkspaceRole, InvitationStatus, WorkspacePlan } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Permission definitions for each role
export const ROLE_PERMISSIONS = {
  OWNER: [
    'workspace:manage',
    'workspace:delete',
    'members:manage',
    'members:invite',
    'members:remove',
    'campaigns:create',
    'campaigns:edit',
    'campaigns:delete',
    'campaigns:view',
    'influencers:manage',
    'contracts:manage',
    'payments:manage',
    'analytics:view',
    'analytics:export',
    'settings:manage',
    'api:manage',
    'webhooks:manage',
    'branding:manage',
  ],
  ADMIN: [
    'members:manage',
    'members:invite',
    'members:remove',
    'campaigns:create',
    'campaigns:edit',
    'campaigns:delete',
    'campaigns:view',
    'influencers:manage',
    'contracts:manage',
    'payments:manage',
    'analytics:view',
    'analytics:export',
    'settings:manage',
    'api:manage',
    'webhooks:manage',
  ],
  MANAGER: [
    'members:invite',
    'campaigns:create',
    'campaigns:edit',
    'campaigns:delete',
    'campaigns:view',
    'influencers:manage',
    'contracts:manage',
    'analytics:view',
    'analytics:export',
  ],
  MEMBER: [
    'campaigns:create',
    'campaigns:edit',
    'campaigns:view',
    'influencers:manage',
    'analytics:view',
  ],
  VIEWER: [
    'campaigns:view',
    'analytics:view',
  ],
};

// Plan limits
export const PLAN_LIMITS = {
  STARTER: {
    maxMembers: 3,
    maxCampaigns: 5,
    maxInfluencers: 200,
    features: ['basic_analytics'],
  },
  PROFESSIONAL: {
    maxMembers: 10,
    maxCampaigns: 20,
    maxInfluencers: 1000,
    features: ['basic_analytics', 'advanced_analytics', 'api_access'],
  },
  BUSINESS: {
    maxMembers: 50,
    maxCampaigns: 100,
    maxInfluencers: 5000,
    features: ['basic_analytics', 'advanced_analytics', 'api_access', 'webhooks', 'white_label_basic'],
  },
  ENTERPRISE: {
    maxMembers: -1, // Unlimited
    maxCampaigns: -1,
    maxInfluencers: -1,
    features: ['basic_analytics', 'advanced_analytics', 'api_access', 'webhooks', 'white_label', 'sso', 'custom_domain'],
  },
};

class WorkspaceService {
  /**
   * Create a new workspace
   */
  async createWorkspace(
    userId: string,
    data: {
      name: string;
      description?: string;
      logoUrl?: string;
    }
  ) {
    // Generate unique slug
    const baseSlug = data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    let slug = baseSlug;
    let counter = 1;

    while (await prisma.workspace.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Create workspace with owner as first member
    const workspace = await prisma.workspace.create({
      data: {
        name: data.name,
        slug,
        ownerId: userId,
        description: data.description,
        logoUrl: data.logoUrl,
        members: {
          create: {
            userId,
            role: 'OWNER',
          },
        },
      },
      include: {
        members: true,
      },
    });

    return workspace;
  }

  /**
   * Get workspace by ID
   */
  async getWorkspace(workspaceId: string) {
    return prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: true,
        branding: true,
      },
    });
  }

  /**
   * Get workspace by slug
   */
  async getWorkspaceBySlug(slug: string) {
    return prisma.workspace.findUnique({
      where: { slug },
      include: {
        members: true,
        branding: true,
      },
    });
  }

  /**
   * Get all workspaces for a user
   */
  async getUserWorkspaces(userId: string) {
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId },
      include: {
        workspace: {
          include: {
            members: {
              select: {
                userId: true,
                role: true,
              },
            },
          },
        },
      },
    });

    return memberships.map((m) => ({
      ...m.workspace,
      userRole: m.role,
      memberCount: m.workspace.members.length,
    }));
  }

  /**
   * Update workspace
   */
  async updateWorkspace(
    workspaceId: string,
    data: {
      name?: string;
      description?: string;
      logoUrl?: string;
      settings?: Prisma.InputJsonValue;
    }
  ) {
    return prisma.workspace.update({
      where: { id: workspaceId },
      data,
    });
  }

  /**
   * Delete workspace
   */
  async deleteWorkspace(workspaceId: string) {
    return prisma.workspace.delete({
      where: { id: workspaceId },
    });
  }

  /**
   * Get workspace members
   */
  async getMembers(workspaceId: string) {
    return prisma.workspaceMember.findMany({
      where: { workspaceId },
      orderBy: [
        { role: 'asc' },
        { joinedAt: 'asc' },
      ],
    });
  }

  /**
   * Get member by user ID
   */
  async getMember(workspaceId: string, userId: string) {
    return prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
    });
  }

  /**
   * Update member role
   */
  async updateMemberRole(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole
  ) {
    // Can't change owner's role
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (workspace?.ownerId === userId && role !== 'OWNER') {
      throw new Error('Cannot change owner role. Transfer ownership first.');
    }

    return prisma.workspaceMember.update({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      data: { role },
    });
  }

  /**
   * Remove member from workspace
   */
  async removeMember(workspaceId: string, userId: string) {
    // Can't remove owner
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (workspace?.ownerId === userId) {
      throw new Error('Cannot remove workspace owner. Transfer ownership first.');
    }

    return prisma.workspaceMember.delete({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
    });
  }

  /**
   * Transfer workspace ownership
   */
  async transferOwnership(
    workspaceId: string,
    currentOwnerId: string,
    newOwnerId: string
  ) {
    // Verify new owner is a member
    const newOwnerMember = await this.getMember(workspaceId, newOwnerId);
    if (!newOwnerMember) {
      throw new Error('New owner must be a workspace member');
    }

    // Update workspace and member roles
    await prisma.$transaction([
      prisma.workspace.update({
        where: { id: workspaceId },
        data: { ownerId: newOwnerId },
      }),
      prisma.workspaceMember.update({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId: currentOwnerId,
          },
        },
        data: { role: 'ADMIN' },
      }),
      prisma.workspaceMember.update({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId: newOwnerId,
          },
        },
        data: { role: 'OWNER' },
      }),
    ]);

    return this.getWorkspace(workspaceId);
  }

  // ==================== Invitations ====================

  /**
   * Create invitation
   */
  async createInvitation(
    workspaceId: string,
    invitedBy: string,
    data: {
      email: string;
      role?: WorkspaceRole;
    }
  ) {
    // Check if user is already a member (need to look up by email)
    // For now, we'll just create the invitation

    // Check for existing pending invitation
    const existing = await prisma.workspaceInvitation.findFirst({
      where: {
        workspaceId,
        email: data.email.toLowerCase(),
        status: 'PENDING',
      },
    });

    if (existing) {
      throw new Error('Invitation already pending for this email');
    }

    // Generate token
    const token = crypto.randomBytes(32).toString('hex');

    // Set expiration (7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    return prisma.workspaceInvitation.create({
      data: {
        workspaceId,
        email: data.email.toLowerCase(),
        role: data.role || 'MEMBER',
        token,
        invitedBy,
        expiresAt,
      },
      include: {
        workspace: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
    });
  }

  /**
   * Get pending invitations for a workspace
   */
  async getInvitations(workspaceId: string) {
    return prisma.workspaceInvitation.findMany({
      where: {
        workspaceId,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get invitation by token
   */
  async getInvitationByToken(token: string) {
    return prisma.workspaceInvitation.findUnique({
      where: { token },
      include: {
        workspace: true,
      },
    });
  }

  /**
   * Accept invitation
   */
  async acceptInvitation(token: string, userId: string) {
    const invitation = await this.getInvitationByToken(token);

    if (!invitation) {
      throw new Error('Invitation not found');
    }

    if (invitation.status !== 'PENDING') {
      throw new Error('Invitation is no longer valid');
    }

    if (invitation.expiresAt < new Date()) {
      await prisma.workspaceInvitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      });
      throw new Error('Invitation has expired');
    }

    // Check if user is already a member
    const existingMember = await this.getMember(invitation.workspaceId, userId);
    if (existingMember) {
      throw new Error('Already a member of this workspace');
    }

    // Create membership and update invitation
    await prisma.$transaction([
      prisma.workspaceMember.create({
        data: {
          workspaceId: invitation.workspaceId,
          userId,
          role: invitation.role,
          invitedBy: invitation.invitedBy,
        },
      }),
      prisma.workspaceInvitation.update({
        where: { id: invitation.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
        },
      }),
    ]);

    return this.getWorkspace(invitation.workspaceId);
  }

  /**
   * Decline invitation
   */
  async declineInvitation(token: string) {
    return prisma.workspaceInvitation.update({
      where: { token },
      data: { status: 'DECLINED' },
    });
  }

  /**
   * Cancel invitation
   */
  async cancelInvitation(invitationId: string) {
    return prisma.workspaceInvitation.delete({
      where: { id: invitationId },
    });
  }

  /**
   * Resend invitation (regenerate token and extend expiration)
   */
  async resendInvitation(invitationId: string) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    return prisma.workspaceInvitation.update({
      where: { id: invitationId },
      data: {
        token,
        expiresAt,
        status: 'PENDING',
      },
    });
  }

  // ==================== Permissions ====================

  /**
   * Check if user has permission
   */
  hasPermission(role: WorkspaceRole, permission: string): boolean {
    const permissions = ROLE_PERMISSIONS[role] || [];
    return permissions.includes(permission);
  }

  /**
   * Get all permissions for a role
   */
  getRolePermissions(role: WorkspaceRole): string[] {
    return ROLE_PERMISSIONS[role] || [];
  }

  /**
   * Check workspace plan limits
   */
  async checkPlanLimit(
    workspaceId: string,
    limitType: 'members' | 'campaigns' | 'influencers'
  ): Promise<{ allowed: boolean; current: number; limit: number }> {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: true,
      },
    });

    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const limits = PLAN_LIMITS[workspace.plan];
    let current = 0;
    let limit = 0;

    switch (limitType) {
      case 'members':
        current = workspace.members.length;
        limit = limits.maxMembers;
        break;
      case 'campaigns':
        // Would need to count campaigns - simplified for now
        current = 0;
        limit = limits.maxCampaigns;
        break;
      case 'influencers':
        // Would need to count saved influencers - simplified for now
        current = 0;
        limit = limits.maxInfluencers;
        break;
    }

    return {
      allowed: limit === -1 || current < limit,
      current,
      limit,
    };
  }

  /**
   * Check if workspace has feature
   */
  async hasFeature(workspaceId: string, feature: string): Promise<boolean> {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      return false;
    }

    const limits = PLAN_LIMITS[workspace.plan];
    return limits.features.includes(feature);
  }

  /**
   * Upgrade workspace plan
   */
  async upgradePlan(workspaceId: string, plan: WorkspacePlan) {
    return prisma.workspace.update({
      where: { id: workspaceId },
      data: { plan },
    });
  }
}

export const workspaceService = new WorkspaceService();
export default workspaceService;
