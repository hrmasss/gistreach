"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ContentEditor } from "@/app/_components/content-editor";

interface EditContentPageProps {
  params: Promise<{
    workspaceId: string;
    contentId: string;
  }>;
}

export default function EditContentPage({ params }: EditContentPageProps) {
  const router = useRouter();
  
  const [workspaceId, setWorkspaceId] = useState<string>("");
  const [contentId, setContentId] = useState<string>("");

  useEffect(() => {
    const initializeParams = async () => {
      const resolvedParams = await params;
      setWorkspaceId(resolvedParams.workspaceId);
      setContentId(resolvedParams.contentId);
    };
    initializeParams();
  }, [params]);

  const handleSave = () => {
    router.push(`/workspace/${workspaceId}/content`);
  };

  const handleCancel = () => {
    router.push(`/workspace/${workspaceId}/content`);
  };

  if (!workspaceId || !contentId) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ContentEditor
        workspaceId={workspaceId}
        contentId={contentId}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </div>
  );
}