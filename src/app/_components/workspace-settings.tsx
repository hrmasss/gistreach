"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import { WorkspaceRole } from "@/server/services/workspace";

interface WorkspaceSettingsProps {
  workspaceId: string;
}

export function WorkspaceSettings({ workspaceId }: WorkspaceSettingsProps) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>(WorkspaceRole.MEMBER);
  const [isInviting, setIsInviting] = useState(false);

  const utils = api.useUtils();

  const { data: workspace, isLoading } = api.workspace.getById.useQuery({ workspaceId });

  const inviteMember = api.workspace.inviteMember.useMutation({
    onSuccess: () => {
      utils.workspace.getById.invalidate({ workspaceId });
      setInviteEmail("");
      setInviteRole(WorkspaceRole.MEMBER);
    },
    onError: (error) => {
      console.error("Failed to invite member:", error);
    },
    onSettled: () => {
      setIsInviting(false);
    }
  });

  const updateMemberRole = api.workspace.updateMemberRole.useMutation({
    onSuccess: () => {
      utils.workspace.getById.invalidate({ workspaceId });
    }
  });

  const removeMember = api.workspace.removeMember.useMutation({
    onSuccess: () => {
      utils.workspace.getById.invalidate({ workspaceId });
    }
  });

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || isInviting) return;

    setIsInviting(true);
    inviteMember.mutate({
      workspaceId,
      email: inviteEmail.trim(),
      role: inviteRole
    });
  };

  const handleRoleChange = (userId: string, newRole: WorkspaceRole) => {
    updateMemberRole.mutate({
      workspaceId,
      userId,
      role: newRole
    });
  };

  const handleRemoveMember = (userId: string) => {
    if (confirm("Are you sure you want to remove this member?")) {
      removeMember.mutate({
        workspaceId,
        userId
      });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="p-6">
        <p className="text-red-600">Workspace not found or access denied.</p>
      </div>
    );
  }

  const currentUserRole = workspace.members.find(m => m.user.id === workspace.ownerId)?.role;
  const canManageMembers = currentUserRole === WorkspaceRole.OWNER || currentUserRole === WorkspaceRole.ADMIN;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{workspace.name}</h2>
        <p className="text-gray-600">Manage your workspace settings and team members</p>
      </div>

      {/* Team Members Section */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Team Members</h3>

        {canManageMembers && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Invite New Member</h4>
            <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Enter email address"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
                className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={WorkspaceRole.MEMBER}>Member</option>
                <option value={WorkspaceRole.ADMIN}>Admin</option>
                <option value={WorkspaceRole.VIEWER}>Viewer</option>
              </select>
              <button
                type="submit"
                disabled={!inviteEmail.trim() || isInviting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isInviting ? "Inviting..." : "Invite"}
              </button>
            </form>
            {inviteMember.error && (
              <p className="mt-2 text-sm text-red-600">{inviteMember.error.message}</p>
            )}
          </div>
        )}

        <div className="space-y-3">
          {workspace.members.map((member) => (
            <div key={member.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">
                  {member.user.name?.charAt(0).toUpperCase() ?? member.user.email?.charAt(0).toUpperCase() ?? "U"}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {member.user.name ?? member.user.email}
                  </p>
                  <p className="text-xs text-gray-500">{member.user.email}</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                {canManageMembers && member.role !== WorkspaceRole.OWNER ? (
                  <select
                    value={member.role}
                    onChange={(e) => handleRoleChange(member.user.id, e.target.value as WorkspaceRole)}
                    className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={WorkspaceRole.MEMBER}>Member</option>
                    <option value={WorkspaceRole.ADMIN}>Admin</option>
                    <option value={WorkspaceRole.VIEWER}>Viewer</option>
                  </select>
                ) : (
                  <span className="text-sm text-gray-600 capitalize">{member.role}</span>
                )}

                {canManageMembers && member.role !== WorkspaceRole.OWNER && (
                  <button
                    onClick={() => handleRemoveMember(member.user.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Workspace Stats */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Workspace Overview</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-white border border-gray-200 rounded-lg">
            <p className="text-sm text-gray-600">Team Members</p>
            <p className="text-2xl font-semibold text-gray-900">{workspace._count.members}</p>
          </div>
          <div className="p-4 bg-white border border-gray-200 rounded-lg">
            <p className="text-sm text-gray-600">Social Accounts</p>
            <p className="text-2xl font-semibold text-gray-900">{workspace._count.socialAccounts}</p>
          </div>
          <div className="p-4 bg-white border border-gray-200 rounded-lg">
            <p className="text-sm text-gray-600">Content Items</p>
            <p className="text-2xl font-semibold text-gray-900">{workspace._count.content}</p>
          </div>
        </div>
      </div>
    </div>
  );
}