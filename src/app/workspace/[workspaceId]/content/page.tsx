import { ContentList } from "@/app/_components/content-list";

interface ContentPageProps {
  params: Promise<{
    workspaceId: string;
  }>;
}

export default async function ContentPage({ params }: ContentPageProps) {
  const { workspaceId } = await params;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <ContentList workspaceId={workspaceId} />
      </div>
    </div>
  );
}