"use client";

import { createContext, useContext } from "react";
import { WorkspaceRole } from "@/server/services/workspace";

interface WorkspaceContextType {
  workspaceId: string;
  userRole: WorkspaceRole;
  hasPermission: (permission: string) => boolean;
}

export const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}

export function useWorkspacePermissions() {
  const { userRole, hasPermission } = useWorkspace();

  return {
    userRole,
    canCreateContent: hasPermission("create_content"),
    canEditContent: hasPermission("edit_content"),
    canDeleteContent: hasPermission("delete_content"),
    canPublishContent: hasPermission("publish_content"),
    canConnectAccounts: hasPermission("connect_social_accounts"),
    canDisconnectAccounts: hasPermission("disconnect_social_accounts"),
    canViewAnalytics: hasPermission("view_analytics"),
    canExportAnalytics: hasPermission("export_analytics"),
    canInviteMembers: hasPermission("invite_members"),
    canRemoveMembers: hasPermission("remove_members"),
    canManageRoles: hasPermission("manage_roles"),
    canEditWorkspaceSettings: hasPermission("edit_workspace_settings"),
    canDeleteWorkspace: hasPermission("delete_workspace"),
    canManageBilling: hasPermission("manage_billing"),
    isOwner: userRole === WorkspaceRole.OWNER,
    isAdmin: userRole === WorkspaceRole.ADMIN,
    isMember: userRole === WorkspaceRole.MEMBER,
    isViewer: userRole === WorkspaceRole.VIEWER,
  };
}

// Helper function to check permissions based on role
export function hasRolePermission(role: WorkspaceRole, permission: string): boolean {
  const permissions = getRolePermissions(role);
  return permissions.includes(permission);
}

function getRolePermissions(role: WorkspaceRole): string[] {
  switch (role) {
    case WorkspaceRole.OWNER:
      return [
        "create_content",
        "edit_content",
        "delete_content",
        "publish_content",
        "connect_social_accounts",
        "disconnect_social_accounts",
        "view_analytics",
        "export_analytics",
        "invite_members",
        "remove_members",
        "manage_roles",
        "edit_workspace_settings",
        "delete_workspace",
        "manage_billing",
      ];

    case WorkspaceRole.ADMIN:
      return [
        "create_content",
        "edit_content",
        "delete_content",
        "publish_content",
        "connect_social_accounts",
        "disconnect_social_accounts",
        "view_analytics",
        "export_analytics",
        "invite_members",
        "remove_members",
        "manage_roles",
        "edit_workspace_settings",
      ];

    case WorkspaceRole.MEMBER:
      return [
        "create_content",
        "edit_content",
        "publish_content",
        "connect_social_accounts",
        "view_analytics",
      ];

    case WorkspaceRole.VIEWER:
      return [
        "view_analytics",
      ];

    default:
      return [];
  }
}