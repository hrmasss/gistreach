"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/trpc/react";
import { ContentType, ContentStatus } from "@/server/services/content";
import { AIEnhancementType, ContentTone, ContentLength } from "@/server/services/ai-content-enhancer";
import { AIGenerationGuard } from "./usage-guard";

interface ContentEditorProps {
  workspaceId: string;
  contentId?: string; // For editing existing content
  onSave?: (contentId: string) => void;
  onCancel?: () => void;
}

export function ContentEditor({ workspaceId, contentId, onSave, onCancel }: ContentEditorProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [contentType, setContentType] = useState<ContentType>(ContentType.TEXT);
  const [mediaAssets, setMediaAssets] = useState<any[]>([]);
  const [isAIEnhancing, setIsAIEnhancing] = useState(false);
  const [showAIOptions, setShowAIOptions] = useState(false);
  const [aiTone, setAiTone] = useState<ContentTone>(ContentTone.PROFESSIONAL);
  const [aiLength, setAiLength] = useState<ContentLength>(ContentLength.MEDIUM);
  const [includeHashtags, setIncludeHashtags] = useState(false);
  const [includeEmojis, setIncludeEmojis] = useState(false);
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null);

  const utils = api.useUtils();

  // Load existing content if editing
  const { data: existingContent, isLoading } = api.content.getById.useQuery(
    { contentId: contentId! },
    { enabled: !!contentId }
  );

  // Mutations
  const createContent = api.content.create.useMutation({
    onSuccess: (result) => {
      onSave?.(result.id);
    }
  });

  const updateContent = api.content.update.useMutation({
    onSuccess: () => {
      utils.content.getById.invalidate({ contentId: contentId! });
    }
  });

  const autoSaveContent = api.content.autoSave.useMutation();

  const polishContent = api.aiContent.polish.useMutation({
    onSuccess: (result) => {
      setContent(result.enhancedContent);
      setIsAIEnhancing(false);
      setShowAIOptions(false);
    },
    onError: () => {
      setIsAIEnhancing(false);
    }
  });

  const generateContent = api.aiContent.generate.useMutation({
    onSuccess: (result) => {
      setContent(result.enhancedContent);
      setIsAIEnhancing(false);
      setShowAIOptions(false);
    },
    onError: () => {
      setIsAIEnhancing(false);
    }
  });

  // Load existing content
  useEffect(() => {
    if (existingContent) {
      setTitle(existingContent.title);
      setContent(existingContent.aiEnhancedContent || existingContent.rawContent);
      setContentType(existingContent.type as ContentType);
      setMediaAssets(existingContent.mediaAssets as any[] || []);
    }
  }, [existingContent]);

  // Auto-save functionality
  const triggerAutoSave = useCallback(() => {
    if (!contentId || !title.trim() || !content.trim()) return;

    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
    }

    const timer = setTimeout(() => {
      autoSaveContent.mutate({
        contentId,
        updates: { title, rawContent: content, mediaAssets }
      });
    }, 2000); // Auto-save after 2 seconds of inactivity

    setAutoSaveTimer(timer);
  }, [contentId, title, content, mediaAssets, autoSaveTimer, autoSaveContent]);

  useEffect(() => {
    if (contentId) {
      triggerAutoSave();
    }
    return () => {
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
      }
    };
  }, [title, content, contentId, triggerAutoSave, autoSaveTimer]);

  const handleSave = async (status: ContentStatus = ContentStatus.DRAFT) => {
    if (!title.trim() || !content.trim()) {
      alert("Please fill in both title and content");
      return;
    }

    try {
      if (contentId) {
        await updateContent.mutateAsync({
          contentId,
          updates: {
            title,
            rawContent: content,
            mediaAssets,
            status
          }
        });
      } else {
        const result = await createContent.mutateAsync({
          workspaceId,
          title,
          rawContent: content,
          type: contentType,
          mediaAssets
        });
        onSave?.(result.id);
      }
    } catch (error) {
      console.error("Failed to save content:", error);
    }
  };

  const handleAIPolish = async () => {
    if (!content.trim()) {
      alert("Please enter some content to polish");
      return;
    }

    setIsAIEnhancing(true);
    try {
      await polishContent.mutateAsync({
        content,
        tone: aiTone,
        includeHashtags,
        includeEmojis
      });
    } catch (error) {
      console.error("Failed to polish content:", error);
      setIsAIEnhancing(false);
    }
  };

  const handleAIGenerate = async () => {
    if (!title.trim()) {
      alert("Please enter a title/topic to generate content");
      return;
    }

    setIsAIEnhancing(true);
    try {
      await generateContent.mutateAsync({
        topic: title,
        tone: aiTone,
        length: aiLength,
        includeHashtags,
        includeEmojis
      });
    } catch (error) {
      console.error("Failed to generate content:", error);
      setIsAIEnhancing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          {contentId ? "Edit Content" : "Create New Content"}
        </h1>
        <div className="flex items-center space-x-3">
          {autoSaveContent.isPending && (
            <span className="text-sm text-gray-500">Saving...</span>
          )}
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
          )}
          <button
            onClick={() => handleSave(ContentStatus.DRAFT)}
            disabled={createContent.isPending || updateContent.isPending}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Save Draft
          </button>
          <button
            onClick={() => handleSave(ContentStatus.READY)}
            disabled={createContent.isPending || updateContent.isPending}
            className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            Save & Ready
          </button>
        </div>
      </div>

      {/* Content Type Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Content Type
        </label>
        <div className="flex space-x-4">
          {Object.values(ContentType).map((type) => (
            <label key={type} className="flex items-center">
              <input
                type="radio"
                value={type}
                checked={contentType === type}
                onChange={(e) => setContentType(e.target.value as ContentType)}
                className="mr-2"
              />
              <span className="capitalize">{type}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Title Input */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
          Title / Topic
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter your content title or topic..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          maxLength={200}
        />
        <div className="mt-1 text-xs text-gray-500">
          {title.length}/200 characters
        </div>
      </div>

      {/* Content Input */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label htmlFor="content" className="block text-sm font-medium text-gray-700">
            Content
          </label>
          <AIGenerationGuard>
            <button
              onClick={() => setShowAIOptions(!showAIOptions)}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
            >
              <span>✨</span>
              <span>AI Enhance</span>
            </button>
          </AIGenerationGuard>
        </div>

        {/* AI Options Panel */}
        {showAIOptions && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tone
                </label>
                <select
                  value={aiTone}
                  onChange={(e) => setAiTone(e.target.value as ContentTone)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  {Object.values(ContentTone).map((tone) => (
                    <option key={tone} value={tone}>
                      {tone.charAt(0).toUpperCase() + tone.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Length
                </label>
                <select
                  value={aiLength}
                  onChange={(e) => setAiLength(e.target.value as ContentLength)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  {Object.values(ContentLength).map((length) => (
                    <option key={length} value={length}>
                      {length.charAt(0).toUpperCase() + length.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={includeHashtags}
                  onChange={(e) => setIncludeHashtags(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm">Include hashtags</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={includeEmojis}
                  onChange={(e) => setIncludeEmojis(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm">Include emojis</span>
              </label>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={handleAIPolish}
                disabled={isAIEnhancing || !content.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isAIEnhancing ? "Polishing..." : "Polish Content"}
              </button>
              <button
                onClick={handleAIGenerate}
                disabled={isAIEnhancing || !title.trim()}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {isAIEnhancing ? "Generating..." : "Generate from Topic"}
              </button>
              <button
                onClick={() => setShowAIOptions(false)}
                className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        )}

        <textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your content here..."
          rows={12}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          maxLength={10000}
        />
        <div className="mt-1 text-xs text-gray-500">
          {content.length}/10,000 characters
        </div>
      </div>

      {/* Media Assets (placeholder for now) */}
      {(contentType === ContentType.IMAGE || contentType === ContentType.VIDEO) && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Media Assets
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <div className="text-gray-500">
              <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="mt-2 text-sm">
                Media upload functionality will be implemented in a future update
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}