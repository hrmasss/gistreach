import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { WorkspaceRole } from "@/server/services/workspace";
import { protectedProcedure } from "../trpc";

/**
 * Middleware to ensure user has access to a workspace
 */
export const withWorkspaceAccess = protectedProcedure
  .input(z.object({ workspaceId: z.string() }))
  .use(async ({ ctx, next, input }) => {
    const member = await ctx.db.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: ctx.session.user.id,
          workspaceId: input.workspaceId,
        },
      },
      include: {
        workspace: true,
      },
    });

    if (!member) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You don't have access to this workspace",
      });
    }

    return next({
      ctx: {
        ...ctx,
        workspace: member.workspace,
        userRole: member.role as WorkspaceRole,
        workspaceMember: member,
      },
    });
  });

/**
 * Middleware to ensure user has admin or owner role in workspace
 */
export const withWorkspaceAdmin = withWorkspaceAccess.use(async ({ ctx, next }) => {
  if (ctx.userRole !== WorkspaceRole.OWNER && ctx.userRole !== WorkspaceRole.ADMIN) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You need admin or owner permissions for this action",
    });
  }

  return next({ ctx });
});

/**
 * Middleware to ensure user is workspace owner
 */
export const withWorkspaceOwner = withWorkspaceAccess.use(async ({ ctx, next }) => {
  if (ctx.userRole !== WorkspaceRole.OWNER) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only workspace owners can perform this action",
    });
  }

  return next({ ctx });
});

/**
 * Middleware to ensure user has at least member role (can read/write content)
 */
export const withWorkspaceMember = withWorkspaceAccess.use(async ({ ctx, next }) => {
  if (ctx.userRole === WorkspaceRole.VIEWER) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Viewers cannot perform this action",
    });
  }

  return next({ ctx });
});

/**
 * Utility function to check if user can manage another user's role
 */
export function canManageUserRole(managerRole: WorkspaceRole, targetRole: WorkspaceRole): boolean {
  // Owners can manage everyone except other owners
  if (managerRole === WorkspaceRole.OWNER) {
    return targetRole !== WorkspaceRole.OWNER;
  }

  // Admins can manage members and viewers
  if (managerRole === WorkspaceRole.ADMIN) {
    return targetRole === WorkspaceRole.MEMBER || targetRole === WorkspaceRole.VIEWER;
  }

  // Members and viewers cannot manage anyone
  return false;
}

/**
 * Utility function to get role hierarchy level (higher number = more permissions)
 */
export function getRoleLevel(role: WorkspaceRole): number {
  switch (role) {
    case WorkspaceRole.OWNER:
      return 4;
    case WorkspaceRole.ADMIN:
      return 3;
    case WorkspaceRole.MEMBER:
      return 2;
    case WorkspaceRole.VIEWER:
      return 1;
    default:
      return 0;
  }
}

/**
 * Check if a role has permission for a specific action
 */
export function hasPermission(role: WorkspaceRole, permission: WorkspacePermission): boolean {
  const permissions = getPermissionsForRole(role);
  return permissions.includes(permission);
}

export enum WorkspacePermission {
  // Content permissions
  CREATE_CONTENT = "create_content",
  EDIT_CONTENT = "edit_content",
  DELETE_CONTENT = "delete_content",
  PUBLISH_CONTENT = "publish_content",

  // Social account permissions
  CONNECT_SOCIAL_ACCOUNTS = "connect_social_accounts",
  DISCONNECT_SOCIAL_ACCOUNTS = "disconnect_social_accounts",

  // Analytics permissions
  VIEW_ANALYTICS = "view_analytics",
  EXPORT_ANALYTICS = "export_analytics",

  // Team management permissions
  INVITE_MEMBERS = "invite_members",
  REMOVE_MEMBERS = "remove_members",
  MANAGE_ROLES = "manage_roles",

  // Workspace management permissions
  EDIT_WORKSPACE_SETTINGS = "edit_workspace_settings",
  DELETE_WORKSPACE = "delete_workspace",
  MANAGE_BILLING = "manage_billing",
}

function getPermissionsForRole(role: WorkspaceRole): WorkspacePermission[] {
  switch (role) {
    case WorkspaceRole.OWNER:
      return [
        // All permissions
        WorkspacePermission.CREATE_CONTENT,
        WorkspacePermission.EDIT_CONTENT,
        WorkspacePermission.DELETE_CONTENT,
        WorkspacePermission.PUBLISH_CONTENT,
        WorkspacePermission.CONNECT_SOCIAL_ACCOUNTS,
        WorkspacePermission.DISCONNECT_SOCIAL_ACCOUNTS,
        WorkspacePermission.VIEW_ANALYTICS,
        WorkspacePermission.EXPORT_ANALYTICS,
        WorkspacePermission.INVITE_MEMBERS,
        WorkspacePermission.REMOVE_MEMBERS,
        WorkspacePermission.MANAGE_ROLES,
        WorkspacePermission.EDIT_WORKSPACE_SETTINGS,
        WorkspacePermission.DELETE_WORKSPACE,
        WorkspacePermission.MANAGE_BILLING,
      ];

    case WorkspaceRole.ADMIN:
      return [
        WorkspacePermission.CREATE_CONTENT,
        WorkspacePermission.EDIT_CONTENT,
        WorkspacePermission.DELETE_CONTENT,
        WorkspacePermission.PUBLISH_CONTENT,
        WorkspacePermission.CONNECT_SOCIAL_ACCOUNTS,
        WorkspacePermission.DISCONNECT_SOCIAL_ACCOUNTS,
        WorkspacePermission.VIEW_ANALYTICS,
        WorkspacePermission.EXPORT_ANALYTICS,
        WorkspacePermission.INVITE_MEMBERS,
        WorkspacePermission.REMOVE_MEMBERS,
        WorkspacePermission.MANAGE_ROLES,
        WorkspacePermission.EDIT_WORKSPACE_SETTINGS,
      ];

    case WorkspaceRole.MEMBER:
      return [
        WorkspacePermission.CREATE_CONTENT,
        WorkspacePermission.EDIT_CONTENT,
        WorkspacePermission.PUBLISH_CONTENT,
        WorkspacePermission.CONNECT_SOCIAL_ACCOUNTS,
        WorkspacePermission.VIEW_ANALYTICS,
      ];

    case WorkspaceRole.VIEWER:
      return [
        WorkspacePermission.VIEW_ANALYTICS,
      ];

    default:
      return [];
  }
}