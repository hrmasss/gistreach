"use client";

import { type ReactNode } from "react";
import { useSubscriptionGuard } from "@/hooks/use-subscription";
import { Feature } from "@/server/services/subscription";

interface UsageGuardProps {
  children: ReactNode;
  resource?: "socialAccounts" | "monthlyPosts" | "teamMembers" | "aiGenerations";
  feature?: Feature;
  fallback?: ReactNode;
  showUpgrade?: boolean;
}

export function UsageGuard({
  children,
  resource,
  feature,
  fallback,
  showUpgrade = true
}: UsageGuardProps) {
  const { checkLimit, checkFeature, isLoading } = useSubscriptionGuard();

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-10 bg-gray-200 rounded"></div>
      </div>
    );
  }

  // Check resource limit
  if (resource) {
    const limitCheck = checkLimit(resource);
    if (!limitCheck.allowed) {
      return fallback || (
        <UsageLimitReached
          message={limitCheck.reason!}
          showUpgrade={showUpgrade}
        />
      );
    }
  }

  // Check feature access
  if (feature) {
    const featureCheck = checkFeature(feature);
    if (!featureCheck.allowed) {
      return fallback || (
        <FeatureNotAvailable
          message={featureCheck.reason!}
          showUpgrade={showUpgrade}
        />
      );
    }
  }

  return <>{children}</>;
}

interface UsageLimitReachedProps {
  message: string;
  showUpgrade: boolean;
}

function UsageLimitReached({ message, showUpgrade }: UsageLimitReachedProps) {
  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-800">Usage Limit Reached</h3>
          <p className="mt-1 text-sm text-red-700">{message}</p>
          {showUpgrade && (
            <div className="mt-3">
              <button className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700">
                Upgrade Plan
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface FeatureNotAvailableProps {
  message: string;
  showUpgrade: boolean;
}

function FeatureNotAvailable({ message, showUpgrade }: FeatureNotAvailableProps) {
  return (
    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-yellow-800">Feature Not Available</h3>
          <p className="mt-1 text-sm text-yellow-700">{message}</p>
          {showUpgrade && (
            <div className="mt-3">
              <button className="bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700">
                Upgrade Plan
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Specific guards for common use cases
export function SocialAccountGuard({ children }: { children: ReactNode }) {
  return (
    <UsageGuard resource="socialAccounts">
      {children}
    </UsageGuard>
  );
}

export function PostPublishGuard({ children }: { children: ReactNode }) {
  return (
    <UsageGuard resource="monthlyPosts">
      {children}
    </UsageGuard>
  );
}

export function TeamMemberGuard({ children }: { children: ReactNode }) {
  return (
    <UsageGuard resource="teamMembers">
      {children}
    </UsageGuard>
  );
}

export function AIGenerationGuard({ children }: { children: ReactNode }) {
  return (
    <UsageGuard resource="aiGenerations" feature={Feature.AI_CONTENT_GENERATION}>
      {children}
    </UsageGuard>
  );
}

export function AdvancedAnalyticsGuard({ children }: { children: ReactNode }) {
  return (
    <UsageGuard feature={Feature.ADVANCED_ANALYTICS}>
      {children}
    </UsageGuard>
  );
}

export function BulkSchedulingGuard({ children }: { children: ReactNode }) {
  return (
    <UsageGuard feature={Feature.BULK_SCHEDULING}>
      {children}
    </UsageGuard>
  );
}