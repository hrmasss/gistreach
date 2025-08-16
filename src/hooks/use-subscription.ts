"use client";

import { api } from "@/trpc/react";
import { Feature, SubscriptionPlan } from "@/server/services/subscription";

export function useSubscription() {
  const { data: subscription, isLoading: subscriptionLoading } = api.subscription.getCurrent.useQuery();
  const { data: usage, isLoading: usageLoading } = api.subscription.getUsage.useQuery();
  const { data: plans } = api.subscription.getPlans.useQuery();

  const updatePlan = api.subscription.updatePlan.useMutation();
  const cancelSubscription = api.subscription.cancel.useMutation();

  return {
    subscription,
    usage,
    plans,
    isLoading: subscriptionLoading || usageLoading,
    updatePlan: updatePlan.mutateAsync,
    cancelSubscription: cancelSubscription.mutateAsync,
    isUpdating: updatePlan.isPending,
    isCancelling: cancelSubscription.isPending,
  };
}

export function useFeatureAccess(feature: Feature) {
  const { data: hasAccess, isLoading } = api.subscription.checkFeature.useQuery({ feature });

  return {
    hasAccess: hasAccess ?? false,
    isLoading,
  };
}

export function useUsageLimit(resource: "socialAccounts" | "monthlyPosts" | "teamMembers" | "aiGenerations") {
  const { data: usageCheck, isLoading } = api.subscription.checkUsageLimit.useQuery({ resource });

  return {
    allowed: usageCheck?.allowed ?? false,
    current: usageCheck?.current ?? 0,
    limit: usageCheck?.limit ?? 0,
    isAtLimit: usageCheck ? usageCheck.current >= usageCheck.limit : false,
    utilizationPercentage: usageCheck ? Math.min((usageCheck.current / usageCheck.limit) * 100, 100) : 0,
    isLoading,
  };
}

export function useSubscriptionGuard() {
  const { subscription, usage } = useSubscription();

  const checkLimit = (resource: keyof typeof usage.usage) => {
    if (!usage || !subscription) return { allowed: false, reason: "Loading..." };

    const current = usage.usage[resource];
    const limit = usage.limits[resource];

    if (limit === -1) return { allowed: true }; // Unlimited

    if (current >= limit) {
      return {
        allowed: false,
        reason: `You've reached your ${resource} limit (${current}/${limit}). Upgrade your plan to continue.`
      };
    }

    return { allowed: true };
  };

  const checkFeature = (feature: Feature) => {
    if (!usage) return { allowed: false, reason: "Loading..." };

    const hasFeature = usage.limits.features.includes(feature);

    if (!hasFeature) {
      return {
        allowed: false,
        reason: `This feature is not available in your current plan. Upgrade to access ${feature}.`
      };
    }

    return { allowed: true };
  };

  const getUpgradeMessage = (currentPlan: SubscriptionPlan) => {
    switch (currentPlan) {
      case SubscriptionPlan.FREE:
        return "Upgrade to Pro to unlock more features and higher limits.";
      case SubscriptionPlan.PRO:
        return "Upgrade to Enterprise for unlimited access and advanced features.";
      default:
        return "Contact us for custom enterprise solutions.";
    }
  };

  return {
    checkLimit,
    checkFeature,
    getUpgradeMessage,
    isLoading: !subscription || !usage,
  };
}

export function useUsageWarnings() {
  const { usage } = useSubscription();

  if (!usage) return { warnings: [], isLoading: true };

  const warnings = [];
  const { utilization } = usage;

  // Check for high usage (>80%)
  Object.entries(utilization).forEach(([resource, percentage]) => {
    if (percentage > 80 && percentage < 100) {
      warnings.push({
        type: "warning" as const,
        resource,
        message: `You're using ${percentage.toFixed(0)}% of your ${resource} limit.`,
        action: "Consider upgrading your plan."
      });
    } else if (percentage >= 100) {
      warnings.push({
        type: "error" as const,
        resource,
        message: `You've reached your ${resource} limit.`,
        action: "Upgrade your plan to continue."
      });
    }
  });

  return { warnings, isLoading: false };
}

// Hook for tracking usage in components
export function useUsageTracker() {
  const trackUsage = api.subscription.trackUsage.useMutation();
  const utils = api.useUtils();

  const track = async (resource: "socialAccounts" | "monthlyPosts" | "teamMembers" | "aiGenerations", amount: number = 1) => {
    try {
      await trackUsage.mutateAsync({ resource, amount });
      // Invalidate usage queries to refresh the UI
      utils.subscription.getUsage.invalidate();
      utils.subscription.checkUsageLimit.invalidate({ resource });
    } catch (error) {
      console.error(`Failed to track usage for ${resource}:`, error);
      throw error;
    }
  };

  return {
    track,
    isTracking: trackUsage.isPending,
  };
}