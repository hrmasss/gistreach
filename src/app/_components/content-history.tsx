"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import { ContentStatus } from "@/server/services/content";

interface ContentHistoryProps {
  workspaceId: string;
  contentId?: string; // If provided, show history for specific content
}

export function ContentHistory({ workspaceId, contentId }: ContentHistoryProps) {
  const [timeRange, setTimeRange] = useState<"week" | "month" | "quarter" | "year">("month");
  const [selectedContent, setSelectedContent] = useState<string | null>(null);

  // Get content list with publishing history
  const { data: contentData, isLoading } = api.content.getList.useQuery({
    workspaceId,
    status: ContentStatus.PUBLISHED,
    limit: 100,
  });

  const getTimeRangeFilter = () => {
    const now = new Date();
    const ranges = {
      week: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      month: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      quarter: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
      year: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
    };
    return ranges[timeRange];
  };

  const getPublishingActivity = () => {
    if (!contentData?.content) return [];

    const fromDate = getTimeRangeFilter();
    const activity: Array<{
      date: string;
      content: any[];
      totalPosts: number;
    }> = [];

    // Group content by publish date
    const groupedByDate = contentData.content.reduce((acc, content) => {
      // For now, we'll use createdAt as a proxy for publish date
      // In a real implementation, you'd track actual publish dates
      const publishDate = new Date(content.createdAt);
      if (publishDate >= fromDate) {
        const dateKey = publishDate.toISOString().split('T')[0];
        if (!acc[dateKey]) {
          acc[dateKey] = [];
        }
        acc[dateKey].push(content);
      }
      return acc;
    }, {} as Record<string, any[]>);

    // Convert to array and sort by date
    Object.entries(groupedByDate).forEach(([date, content]) => {
      activity.push({
        date,
        content,
        totalPosts: content.reduce((sum, c) => sum + (c._count?.publishedPosts || 0), 0)
      });
    });

    return activity.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const getActivityStats = () => {
    const activity = getPublishingActivity();
    const totalContent = activity.reduce((sum, day) => sum + day.content.length, 0);
    const totalPosts = activity.reduce((sum, day) => sum + day.totalPosts, 0);
    const avgPerDay = activity.length > 0 ? (totalContent / activity.length).toFixed(1) : "0";

    return { totalContent, totalPosts, avgPerDay, activeDays: activity.length };
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const activity = getPublishingActivity();
  const stats = getActivityStats();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Publishing History</h2>
          <p className="text-gray-600 mt-1">
            Track your content creation and publishing activity
          </p>
        </div>
        <div>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="week">Last Week</option>
            <option value="month">Last Month</option>
            <option value="quarter">Last Quarter</option>
            <option value="year">Last Year</option>
          </select>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-blue-600 text-sm">📝</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Content Created</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalContent}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-green-600 text-sm">🚀</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Posts Published</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalPosts}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <span className="text-purple-600 text-sm">📊</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Avg per Day</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.avgPerDay}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                <span className="text-orange-600 text-sm">🔥</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Days</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.activeDays}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Activity Timeline</h3>
        </div>

        {activity.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {activity.map((day) => (
              <div key={day.date} className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <h4 className="text-sm font-medium text-gray-900">
                      {formatDate(day.date)}
                    </h4>
                    <span className="text-sm text-gray-500">
                      {day.content.length} content • {day.totalPosts} posts
                    </span>
                  </div>
                </div>

                <div className="ml-6 space-y-3">
                  {day.content.map((content) => (
                    <div
                      key={content.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                      onClick={() => setSelectedContent(selectedContent === content.id ? null : content.id)}
                    >
                      <div className="flex-1">
                        <h5 className="text-sm font-medium text-gray-900">
                          {content.title}
                        </h5>
                        <p className="text-xs text-gray-600 mt-1">
                          {content.type} • {content._count?.publishedPosts || 0} posts
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-500">
                          {new Date(content.createdAt).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                        <svg
                          className={`w-4 h-4 text-gray-400 transition-transform ${selectedContent === content.id ? 'rotate-180' : ''
                            }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <div className="text-4xl mb-4">📅</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No activity in this period</h3>
            <p className="text-gray-600">
              Try selecting a different time range or create some content to see your publishing history.
            </p>
          </div>
        )}
      </div>

      {/* Content Performance Insights */}
      {activity.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
          <h4 className="font-medium text-blue-900 mb-4">📈 Publishing Insights</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h5 className="text-sm font-medium text-blue-800 mb-2">Most Productive Day</h5>
              <p className="text-blue-900">
                {activity.reduce((max, day) =>
                  day.content.length > max.content.length ? day : max
                ).date ? formatDate(activity.reduce((max, day) =>
                  day.content.length > max.content.length ? day : max
                ).date) : "N/A"}
              </p>
            </div>
            <div>
              <h5 className="text-sm font-medium text-blue-800 mb-2">Publishing Consistency</h5>
              <p className="text-blue-900">
                {stats.activeDays > 0 ?
                  `${((stats.activeDays / (timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : timeRange === 'quarter' ? 90 : 365)) * 100).toFixed(0)}% of days active` :
                  "No activity"
                }
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}