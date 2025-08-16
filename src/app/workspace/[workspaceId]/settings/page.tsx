import { WorkspaceSettings } from "@/app/_components/workspace-settings";

interface WorkspaceSettingsPageProps {
  params: Promise<{
    workspaceId: string;
  }>;
}

export default async function WorkspaceSettingsPage({ params }: WorkspaceSettingsPageProps) {
  const { workspaceId } = await params;
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <WorkspaceSettings workspaceId={workspaceId} />
      </div>
    </div>
  );
}