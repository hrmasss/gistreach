"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import { WorkspaceRole } from "@/server/services/workspace";

interface WorkspaceSwitcherProps {
  currentWorkspaceId?: string;
  onWorkspaceChange?: (workspaceId: string) => void;
}

export function WorkspaceSwitcher({ currentWorkspaceId, onWorkspaceChange }: WorkspaceSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { data: workspaces, isLoading } = api.workspace.getAll.useQuery();

  const currentWorkspace = workspaces?.find(w => w.id === currentWorkspaceId);

  const handleWorkspaceSelect = (workspaceId: string) => {
    onWorkspaceChange?.(workspaceId);
    setIsOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2">
        <div className="h-8 w-8 animate-pulse rounded bg-gray-200"></div>
        <div className="h-4 w-24 animate-pulse rounded bg-gray-200"></div>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <div className="h-6 w-6 rounded bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
          {currentWorkspace?.name.charAt(0).toUpperCase() ?? "W"}
        </div>
        <span>{currentWorkspace?.name ?? "Select Workspace"}</span>
        <svg
          className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="p-2">
            <div className="mb-2 px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
              Your Workspaces
            </div>
            {workspaces?.map((workspace) => (
              <button
                key={workspace.id}
                onClick={() => handleWorkspaceSelect(workspace.id)}
                className={`w-full flex items-center space-x-3 rounded-md px-2 py-2 text-left text-sm hover:bg-gray-100 ${workspace.id === currentWorkspaceId ? "bg-blue-50 text-blue-700" : "text-gray-700"
                  }`}
              >
                <div className="h-8 w-8 rounded bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
                  {workspace.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{workspace.name}</div>
                  <div className="text-xs text-gray-500 capitalize">
                    {workspace.userRole} • {workspace._count.members} members
                  </div>
                </div>
              </button>
            ))}
            <div className="mt-2 border-t border-gray-100 pt-2">
              <button
                onClick={() => {
                  // TODO: Open create workspace modal
                  setIsOpen(false);
                }}
                className="w-full flex items-center space-x-3 rounded-md px-2 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
              >
                <div className="h-8 w-8 rounded border-2 border-dashed border-gray-300 flex items-center justify-center">
                  <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <span>Create workspace</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}