"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import { ContentType, ContentStatus } from "@/server/services/content";

interface ContentLibraryProps {
  workspaceId: string;
  onSelectContent?: (contentId: string) => void;
  onUseTemplate?: (contentId: string) => void;
}

export function ContentLibrary({ workspaceId, onSelectContent, onUseTemplate }: ContentLibraryProps) {
  const [selectedTab, setSelectedTab] = useState<"all" | "templates" | "published" | "drafts">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "popular" | "performance">("recent");

  const utils = api.useUtils();

  // Get content based on selected tab
  const getFilters = () => {
    const baseFilters = {
      workspaceId,
      search: searchQuery || undefined,
      limit: 50,
    };

    switch (selectedTab) {
      case "templates":
        return { ...baseFilters, status: ContentStatus.READY };
      case "published":
        return { ...baseFilters, status: ContentStatus.PUBLISHED };
      case "drafts":
        return { ...baseFilters, status: ContentStatus.DRAFT };
      default:
        return baseFilters;
    }
  };

  const { data: contentData, isLoading } = api.content.getList.useQuery(getFilters());
  const { data: stats } = api.content.getStats.useQuery({ workspaceId });

  const duplicateContent = api.content.duplicate.useMutation({
    onSuccess: () => {
      utils.content.getList.invalidate();
      utils.content.getStats.invalidate({ workspaceId });
    }
  });

  const handleUseAsTemplate = async (contentId: string) => {
    try {
      const result = await duplicateContent.mutateAsync({ contentId });
      onUseTemplate?.(result.id);
    } catch (error) {
      console.error("Failed to create template:", error);
    }
  };

  const getPerformanceScore = (content: any) => {
    // This would calculate based on analytics data
    // For now, return a mock score based on published posts count
    return content._count?.publishedPosts || 0;
  };

  const sortContent = (content: any[]) => {
    switch (sortBy) {
      case "popular":
        return [...content].sort((a, b) => (b._count?.publishedPosts || 0) - (a._count?.publishedPosts || 0));
      case "performance":
        return [...content].sort((a, b) => getPerformanceScore(b) - getPerformanceScore(a));
      case "recent":
      default:
        return [...content].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
  };

  const getContentPreview = (content: any) => {
    const text = content.aiEnhancedContent || content.rawContent;
    return text.length > 150 ? text.substring(0, 150) + "..." : text;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case ContentType.TEXT:
        return "📝";
      case ContentType.IMAGE:
        return "🖼️";
      case ContentType.VIDEO:
        return "🎥";
      default:
        return "📄";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case ContentStatus.DRAFT:
        return "bg-gray-100 text-gray-800";
      case ContentStatus.READY:
        return "bg-blue-100 text-blue-800";
      case ContentStatus.PUBLISHED:
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-48 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const sortedContent = contentData?.content ? sortContent(contentData.content) : [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Content Library</h2>
          {stats && (
            <p className="text-gray-600 mt-1">
              {stats.total} items • {stats.published} published • {stats.draft} drafts
            </p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: "all", label: "All Content", count: stats?.total },
            { key: "published", label: "Published", count: stats?.published },
            { key: "templates", label: "Ready to Use", count: stats?.byType?.ready },
            { key: "drafts", label: "Drafts", count: stats?.draft },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSelectedTab(tab.key as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${selectedTab === tab.key
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-2 bg-gray-100 text-gray-900 py-0.5 px-2.5 rounded-full text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Search and Sort */}
      <div className="flex items-center justify-between">
        <div className="flex-1 max-w-md">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search content..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="ml-4">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="recent">Most Recent</option>
            <option value="popular">Most Used</option>
            <option value="performance">Best Performance</option>
          </select>
        </div>
      </div>

      {/* Content Grid */}
      {sortedContent.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedContent.map((content) => (
            <div
              key={content.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => onSelectContent?.(content.id)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">{getTypeIcon(content.type)}</span>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(content.status)}`}>
                    {content.status}
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUseAsTemplate(content.id);
                    }}
                    disabled={duplicateContent.isPending}
                    className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-50"
                    title="Use as template"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              </div>

              <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                {content.title}
              </h3>

              <p className="text-gray-600 text-sm mb-3 line-clamp-3">
                {getContentPreview(content)}
              </p>

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>
                  {new Date(content.updatedAt).toLocaleDateString()}
                </span>
                <div className="flex items-center space-x-3">
                  {content._count?.publishedPosts > 0 && (
                    <span className="flex items-center">
                      <svg className="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {content._count.publishedPosts} posts
                    </span>
                  )}
                  <span>
                    By {content.createdBy.name || content.createdBy.email?.split('@')[0]}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">
            {selectedTab === "templates" ? "📋" :
              selectedTab === "published" ? "✅" :
                selectedTab === "drafts" ? "📝" : "📚"}
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchQuery ? "No content found" :
              selectedTab === "templates" ? "No templates available" :
                selectedTab === "published" ? "No published content" :
                  selectedTab === "drafts" ? "No drafts" : "No content yet"}
          </h3>
          <p className="text-gray-600">
            {searchQuery ? "Try adjusting your search terms." :
              selectedTab === "templates" ? "Create content and mark it as 'Ready' to use as templates." :
                selectedTab === "published" ? "Publish some content to see it here." :
                  selectedTab === "drafts" ? "Start creating content to see drafts here." :
                    "Create your first piece of content to get started."}
          </p>
        </div>
      )}

      {/* Performance Insights */}
      {selectedTab === "published" && sortedContent.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">📊 Performance Insights</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-blue-700">Most Used Content:</span>
              <p className="font-medium text-blue-900">
                {sortedContent[0]?.title || "N/A"}
              </p>
            </div>
            <div>
              <span className="text-blue-700">Average Reuse:</span>
              <p className="font-medium text-blue-900">
                {(sortedContent.reduce((acc, c) => acc + (c._count?.publishedPosts || 0), 0) / sortedContent.length).toFixed(1)} times
              </p>
            </div>
            <div>
              <span className="text-blue-700">Content Types:</span>
              <p className="font-medium text-blue-900">
                {stats?.byType ? Object.entries(stats.byType).map(([type, count]) => `${count} ${type}`).join(", ") : "N/A"}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}