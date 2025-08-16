import { WorkspaceSettings } from "@/app/_components/workspace-settings";

interface WorkspaceSettingsPageProps {
  params: {
    workspaceId: string;
  };
}

export default function WorkspaceSettingsPage({ params }: WorkspaceSettingsPageProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <WorkspaceSettings workspaceId={params.workspaceId} />
      </div>
    </div>
  );
}