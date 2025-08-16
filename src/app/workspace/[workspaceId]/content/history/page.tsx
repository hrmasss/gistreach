import { ContentHistory } from "@/app/_components/content-history";

interface ContentHistoryPageProps {
  params: Promise<{
    workspaceId: string;
  }>;
}

export default async function ContentHistoryPage({ params }: ContentHistoryPageProps) {
  const { workspaceId } = await params;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <ContentHistory workspaceId={workspaceId} />
      </div>
    </div>
  );
}