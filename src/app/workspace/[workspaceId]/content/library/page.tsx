import { ContentLibrary } from "@/app/_components/content-library";

interface ContentLibraryPageProps {
  params: Promise<{
    workspaceId: string;
  }>;
}

export default async function ContentLibraryPage({ params }: ContentLibraryPageProps) {
  const { workspaceId } = await params;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <ContentLibrary workspaceId={workspaceId} />
      </div>
    </div>
  );
}