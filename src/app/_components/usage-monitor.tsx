"use client";

import { useSubscription, useUsageWarnings } from "@/hooks/use-subscription";
import { SubscriptionPlan } from "@/server/services/subscription";

interface UsageMonitorProps {
  showDetails?: boolean;
  className?: string;
}

export function UsageMonitor({ showDetails = false, className = "" }: UsageMonitorProps) {
  const { usage, subscription, isLoading } = useSubscription();
  const { warnings } = useUsageWarnings();

  if (isLoading || !usage || !subscription) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div className="h-2 bg-gray-200 rounded w-full"></div>
      </div>
    );
  }

  const { utilization, limits } = usage;
  const isFreePlan = subscription.planId === SubscriptionPlan.FREE;

  return (
    <div className={className}>
      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="mb-4 space-y-2">
          {warnings.map((warning, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg text-sm ${warning.type === "error"
                  ? "bg-red-50 text-red-700 border border-red-200"
                  : "bg-yellow-50 text-yellow-700 border border-yellow-200"
                }`}
            >
              <div className="font-medium">{warning.message}</div>
              <div className="text-xs mt-1">{warning.action}</div>
            </div>
          ))}
        </div>
      )}

      {/* Usage Overview */}
      {showDetails && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900">Usage Overview</h3>
            <span className="text-xs text-gray-500 capitalize">
              {subscription.planId} Plan
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Social Accounts */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Social Accounts</span>
                <span className="font-medium">
                  {usage.usage.socialAccounts} / {limits.socialAccounts === -1 ? "∞" : limits.socialAccounts}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${utilization.socialAccounts > 90 ? "bg-red-500" :
                      utilization.socialAccounts > 70 ? "bg-yellow-500" : "bg-green-500"
                    }`}
                  style={{ width: `${Math.min(utilization.socialAccounts, 100)}%` }}
                ></div>
              </div>
            </div>

            {/* Monthly Posts */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Monthly Posts</span>
                <span className="font-medium">
                  {usage.usage.monthlyPosts} / {limits.monthlyPosts === -1 ? "∞" : limits.monthlyPosts}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${utilization.monthlyPosts > 90 ? "bg-red-500" :
                      utilization.monthlyPosts > 70 ? "bg-yellow-500" : "bg-green-500"
                    }`}
                  style={{ width: `${Math.min(utilization.monthlyPosts, 100)}%` }}
                ></div>
              </div>
            </div>

            {/* Team Members */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Team Members</span>
                <span className="font-medium">
                  {usage.usage.teamMembers} / {limits.teamMembers === -1 ? "∞" : limits.teamMembers}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${utilization.teamMembers > 90 ? "bg-red-500" :
                      utilization.teamMembers > 70 ? "bg-yellow-500" : "bg-green-500"
                    }`}
                  style={{ width: `${Math.min(utilization.teamMembers, 100)}%` }}
                ></div>
              </div>
            </div>

            {/* AI Generations */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">AI Generations</span>
                <span className="font-medium">
                  {usage.usage.aiGenerations} / {limits.aiGenerations === -1 ? "∞" : limits.aiGenerations}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${utilization.aiGenerations > 90 ? "bg-red-500" :
                      utilization.aiGenerations > 70 ? "bg-yellow-500" : "bg-green-500"
                    }`}
                  style={{ width: `${Math.min(utilization.aiGenerations, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Upgrade CTA for free plan */}
          {isFreePlan && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-sm text-blue-700">
                <div className="font-medium">Ready to grow?</div>
                <div className="mt-1">Upgrade to Pro for higher limits and advanced features.</div>
                <button className="mt-2 text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">
                  Upgrade Now
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Compact usage bar for navigation/header
export function UsageBar() {
  const { usage, isLoading } = useSubscription();
  const { warnings } = useUsageWarnings();

  if (isLoading || !usage) {
    return (
      <div className="h-1 bg-gray-200 rounded-full animate-pulse"></div>
    );
  }

  const maxUtilization = Math.max(
    usage.utilization.socialAccounts,
    usage.utilization.monthlyPosts,
    usage.utilization.teamMembers,
    usage.utilization.aiGenerations
  );

  const hasErrors = warnings.some(w => w.type === "error");
  const hasWarnings = warnings.some(w => w.type === "warning");

  return (
    <div className="space-y-1">
      <div className="w-full bg-gray-200 rounded-full h-1">
        <div
          className={`h-1 rounded-full transition-all duration-300 ${hasErrors ? "bg-red-500" :
              hasWarnings ? "bg-yellow-500" :
                maxUtilization > 70 ? "bg-orange-500" : "bg-green-500"
            }`}
          style={{ width: `${Math.min(maxUtilization, 100)}%` }}
        ></div>
      </div>
      {(hasErrors || hasWarnings) && (
        <div className="text-xs text-gray-600">
          {hasErrors ? "Usage limits reached" : "Approaching usage limits"}
        </div>
      )}
    </div>
  );
}