"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ContentEditor } from "@/app/_components/content-editor";

interface NewContentPageProps {
  params: Promise<{
    workspaceId: string;
  }>;
}

export default function NewContentPage({ params }: NewContentPageProps) {
  const router = useRouter();
  
  const [workspaceId, setWorkspaceId] = useState<string>("");

  useEffect(() => {
    const initializeParams = async () => {
      const resolvedParams = await params;
      setWorkspaceId(resolvedParams.workspaceId);
    };
    initializeParams();
  }, [params]);

  const handleSave = (contentId: string) => {
    router.push(`/workspace/${workspaceId}/content`);
  };

  const handleCancel = () => {
    router.push(`/workspace/${workspaceId}/content`);
  };

  if (!workspaceId) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ContentEditor
        workspaceId={workspaceId}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </div>
  );
}