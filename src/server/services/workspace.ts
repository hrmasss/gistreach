import { TRPCError } from "@trpc/server";
import { type PrismaClient } from "@prisma/client";
import { generateSlug } from "@/lib/utils";

export interface WorkspaceUsage {
  socialAccounts: { used: number; limit: number };
  monthlyPosts: { used: number; limit: number };
  teamMembers: { used: number; limit: number };
}

export enum WorkspaceRole {
  OWNER = "owner",
  ADMIN = "admin",
  MEMBER = "member",
  VIEWER = "viewer"
}

export class WorkspaceService {
  constructor(private db: PrismaClient) { }

  async createWorkspace(userId: string, name: string) {
    const slug = generateSlug(name);

    // Check if slug already exists
    const existingWorkspace = await this.db.workspace.findUnique({
      where: { slug }
    });

    if (existingWorkspace) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "A workspace with this name already exists"
      });
    }

    // Create workspace and add owner as member
    const workspace = await this.db.workspace.create({
      data: {
        name,
        slug,
        ownerId: userId,
        members: {
          create: {
            userId,
            role: WorkspaceRole.OWNER
          }
        }
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true
              }
            }
          }
        },
        subscription: true,
        _count: {
          select: {
            socialAccounts: true,
            content: true
          }
        }
      }
    });

    return workspace;
  }

  async getUserWorkspaces(userId: string) {
    const workspaces = await this.db.workspace.findMany({
      where: {
        members: {
          some: {
            userId
          }
        }
      },
      include: {
        members: {
          where: { userId },
          select: { role: true }
        },
        subscription: true,
        _count: {
          select: {
            socialAccounts: true,
            content: true,
            members: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return workspaces.map(workspace => ({
      ...workspace,
      userRole: workspace.members[0]?.role as WorkspaceRole
    }));
  }

  async getWorkspaceById(workspaceId: string, userId: string) {
    const workspace = await this.db.workspace.findFirst({
      where: {
        id: workspaceId,
        members: {
          some: { userId }
        }
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true
              }
            }
          }
        },
        subscription: true,
        _count: {
          select: {
            socialAccounts: true,
            content: true,
            members: true
          }
        }
      }
    });

    if (!workspace) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Workspace not found or access denied"
      });
    }

    return workspace;
  }

  async inviteMember(workspaceId: string, inviterUserId: string, email: string, role: WorkspaceRole) {
    // Check if inviter has permission (owner or admin)
    const inviterMember = await this.db.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: inviterUserId,
        role: { in: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN] }
      }
    });

    if (!inviterMember) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only workspace owners and admins can invite members"
      });
    }

    // Check team member limit
    const currentMemberCount = await this.db.workspaceMember.count({
      where: { workspaceId }
    });

    // Get workspace owner's subscription to check limits
    const workspace = await this.db.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        owner: {
          include: {
            subscription: true
          }
        }
      }
    });

    if (workspace?.owner.subscription) {
      const limits = workspace.owner.subscription.limits as any;
      const teamMemberLimit = limits.teamMembers;

      if (teamMemberLimit !== -1 && currentMemberCount >= teamMemberLimit) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Team member limit reached (${currentMemberCount}/${teamMemberLimit}). Upgrade your subscription to add more members.`
        });
      }
    }

    // Find user by email
    const user = await this.db.user.findUnique({
      where: { email }
    });

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User with this email not found"
      });
    }

    // Check if user is already a member
    const existingMember = await this.db.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: user.id,
          workspaceId
        }
      }
    });

    if (existingMember) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "User is already a member of this workspace"
      });
    }

    // Add member
    const member = await this.db.workspaceMember.create({
      data: {
        userId: user.id,
        workspaceId,
        role
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        }
      }
    });

    return member;
  }

  async updateMemberRole(workspaceId: string, updaterUserId: string, targetUserId: string, newRole: WorkspaceRole) {
    // Check if updater has permission (owner or admin)
    const updaterMember = await this.db.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: updaterUserId,
        role: { in: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN] }
      }
    });

    if (!updaterMember) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only workspace owners and admins can update member roles"
      });
    }

    // Can't change owner role
    const targetMember = await this.db.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: targetUserId,
          workspaceId
        }
      }
    });

    if (!targetMember) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Member not found"
      });
    }

    if (targetMember.role === WorkspaceRole.OWNER) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Cannot change workspace owner role"
      });
    }

    // Update role
    const updatedMember = await this.db.workspaceMember.update({
      where: {
        userId_workspaceId: {
          userId: targetUserId,
          workspaceId
        }
      },
      data: { role: newRole },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        }
      }
    });

    return updatedMember;
  }

  async removeMember(workspaceId: string, removerUserId: string, targetUserId: string) {
    // Check if remover has permission (owner or admin)
    const removerMember = await this.db.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: removerUserId,
        role: { in: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN] }
      }
    });

    if (!removerMember) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only workspace owners and admins can remove members"
      });
    }

    // Can't remove owner
    const targetMember = await this.db.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: targetUserId,
          workspaceId
        }
      }
    });

    if (!targetMember) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Member not found"
      });
    }

    if (targetMember.role === WorkspaceRole.OWNER) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Cannot remove workspace owner"
      });
    }

    // Remove member
    await this.db.workspaceMember.delete({
      where: {
        userId_workspaceId: {
          userId: targetUserId,
          workspaceId
        }
      }
    });

    return { success: true };
  }

  async getWorkspaceUsage(workspaceId: string, userId: string): Promise<WorkspaceUsage> {
    // Verify user has access to workspace
    const member = await this.db.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId
        }
      }
    });

    if (!member) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Access denied to workspace"
      });
    }

    // Get workspace with subscription
    const workspace = await this.db.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        subscription: true,
        _count: {
          select: {
            socialAccounts: true,
            members: true
          }
        }
      }
    });

    if (!workspace) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Workspace not found"
      });
    }

    // Get current month's post count
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyPostCount = await this.db.publishedPost.count({
      where: {
        socialAccount: {
          workspaceId
        },
        publishedAt: {
          gte: startOfMonth
        }
      }
    });

    // Default limits for free plan
    const defaultLimits = {
      socialAccounts: 3,
      monthlyPosts: 50,
      teamMembers: 2
    };

    const limits = workspace.subscription?.limits as any ?? defaultLimits;

    return {
      socialAccounts: {
        used: workspace._count.socialAccounts,
        limit: limits.socialAccounts ?? defaultLimits.socialAccounts
      },
      monthlyPosts: {
        used: monthlyPostCount,
        limit: limits.monthlyPosts ?? defaultLimits.monthlyPosts
      },
      teamMembers: {
        used: workspace._count.members,
        limit: limits.teamMembers ?? defaultLimits.teamMembers
      }
    };
  }
}