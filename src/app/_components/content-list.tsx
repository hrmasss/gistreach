"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import { ContentType, ContentStatus } from "@/server/services/content";
import Link from "next/link";

interface ContentListProps {
  workspaceId: string;
  onEditContent?: (contentId: string) => void;
}

export function ContentList({ workspaceId, onEditContent }: ContentListProps) {
  const [filters, setFilters] = useState({
    status: undefined as ContentStatus | undefined,
    type: undefined as ContentType | undefined,
    search: "",
  });
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 20;

  const utils = api.useUtils();

  const { data: contentData, isLoading } = api.content.getList.useQuery({
    workspaceId,
    ...filters,
    limit: pageSize,
    offset: currentPage * pageSize,
  });

  const { data: stats } = api.content.getStats.useQuery({ workspaceId });

  const deleteContent = api.content.delete.useMutation({
    onSuccess: () => {
      utils.content.getList.invalidate({ workspaceId });
      utils.content.getStats.invalidate({ workspaceId });
    }
  });

  const duplicateContent = api.content.duplicate.useMutation({
    onSuccess: () => {
      utils.content.getList.invalidate({ workspaceId });
      utils.content.getStats.invalidate({ workspaceId });
    }
  });

  const handleDelete = async (contentId: string, title: string) => {
    if (confirm(`Are you sure you want to delete "${title}"?`)) {
      await deleteContent.mutateAsync({ contentId });
    }
  };

  const handleDuplicate = async (contentId: string) => {
    await duplicateContent.mutateAsync({ contentId });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case ContentStatus.DRAFT:
        return "bg-gray-100 text-gray-800";
      case ContentStatus.READY:
        return "bg-blue-100 text-blue-800";
      case ContentStatus.PUBLISHED:
        return "bg-green-100 text-green-800";
      case ContentStatus.ARCHIVED:
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
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

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header with Stats */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Content Library</h2>
          {stats && (
            <p className="text-gray-600 mt-1">
              {stats.total} total • {stats.draft} drafts • {stats.published} published
            </p>
          )}
        </div>
        <Link
          href={`/workspace/${workspaceId}/content/new`}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Create Content
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Search content..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filters.status || ""}
              onChange={(e) => setFilters({ ...filters, status: e.target.value as ContentStatus || undefined })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">All Statuses</option>
              {Object.values(ContentStatus).map((status) => (
                <option key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              value={filters.type || ""}
              onChange={(e) => setFilters({ ...filters, type: e.target.value as ContentType || undefined })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">All Types</option>
              {Object.values(ContentType).map((type) => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setFilters({ status: undefined, type: undefined, search: "" })}
              className="px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 text-sm"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Content List */}
      {contentData?.content && contentData.content.length > 0 ? (
        <div className="space-y-4">
          {contentData.content.map((content) => (
            <div key={content.id} className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <span className="text-xl">{getTypeIcon(content.type)}</span>
                    <h3 className="text-lg font-semibold text-gray-900">{content.title}</h3>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(content.status)}`}>
                      {content.status}
                    </span>
                  </div>

                  <p className="text-gray-600 mb-3 line-clamp-2">
                    {content.aiEnhancedContent || content.rawContent}
                  </p>

                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span>By {content.createdBy.name || content.createdBy.email}</span>
                    <span>•</span>
                    <span>{new Date(content.createdAt).toLocaleDateString()}</span>
                    <span>•</span>
                    <span>{content._count.publishedPosts} posts</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={() => onEditContent?.(content.id)}
                    className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDuplicate(content.id)}
                    disabled={duplicateContent.isPending}
                    className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
                  >
                    Duplicate
                  </button>
                  <button
                    onClick={() => handleDelete(content.id, content.title)}
                    disabled={deleteContent.isPending}
                    className="px-3 py-1 text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">📝</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No content found</h3>
          <p className="text-gray-600 mb-4">
            {filters.search || filters.status || filters.type
              ? "Try adjusting your filters or create new content."
              : "Get started by creating your first piece of content."}
          </p>
          <Link
            href={`/workspace/${workspaceId}/content/new`}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Create Content
          </Link>
        </div>
      )}

      {/* Pagination */}
      {contentData && contentData.total > pageSize && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {currentPage * pageSize + 1} to {Math.min((currentPage + 1) * pageSize, contentData.total)} of {contentData.total} results
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={!contentData.hasMore}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}