"use client";

import { useState } from "react";
import { useSubscription } from "@/hooks/use-subscription";
import { SubscriptionPlan, Feature } from "@/server/services/subscription";
import { UsageMonitor } from "./usage-monitor";

export function SubscriptionDashboard() {
  const { subscription, usage, plans, updatePlan, cancelSubscription, isLoading, isUpdating, isCancelling } = useSubscription();
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);

  if (isLoading || !subscription || !usage || !plans) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/4"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const handlePlanUpdate = async (planId: SubscriptionPlan) => {
    try {
      await updatePlan(planId);
      setSelectedPlan(null);
    } catch (error) {
      console.error("Failed to update plan:", error);
    }
  };

  const handleCancelSubscription = async () => {
    if (confirm("Are you sure you want to cancel your subscription? You'll lose access to premium features.")) {
      try {
        await cancelSubscription();
      } catch (error) {
        console.error("Failed to cancel subscription:", error);
      }
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString();
  };

  const getPlanPrice = (planId: SubscriptionPlan) => {
    switch (planId) {
      case SubscriptionPlan.FREE:
        return "$0";
      case SubscriptionPlan.PRO:
        return "$29";
      case SubscriptionPlan.ENTERPRISE:
        return "$99";
      default:
        return "Custom";
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Current Subscription */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Subscription Management</h1>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 capitalize">
                {subscription.planId} Plan
              </h2>
              <p className="text-gray-600">
                {subscription.status === "active" ? "Active" : subscription.status} •
                Renews on {formatDate(subscription.currentPeriodEnd)}
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">
                {getPlanPrice(subscription.planId as SubscriptionPlan)}
                <span className="text-sm font-normal text-gray-600">/month</span>
              </div>
            </div>
          </div>

          {subscription.planId !== SubscriptionPlan.FREE && (
            <div className="flex justify-end">
              <button
                onClick={handleCancelSubscription}
                disabled={isCancelling}
                className="text-red-600 hover:text-red-800 text-sm disabled:opacity-50"
              >
                {isCancelling ? "Cancelling..." : "Cancel Subscription"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Usage Overview */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Usage Overview</h2>
        <div className="bg-white rounded-lg shadow p-6">
          <UsageMonitor showDetails={true} />
        </div>
      </div>

      {/* Available Plans */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Available Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Object.entries(plans).map(([planId, limits]) => {
            const isCurrentPlan = subscription.planId === planId;
            const plan = planId as SubscriptionPlan;

            return (
              <div
                key={planId}
                className={`bg-white rounded-lg shadow-lg p-6 relative ${isCurrentPlan ? "ring-2 ring-blue-500" : ""
                  }`}
              >
                {isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                      Current Plan
                    </span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-gray-900 capitalize mb-2">
                    {planId}
                  </h3>
                  <div className="text-3xl font-bold text-gray-900">
                    {getPlanPrice(plan)}
                    <span className="text-sm font-normal text-gray-600">/month</span>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Social Accounts</span>
                    <span className="font-medium">
                      {limits.socialAccounts === -1 ? "Unlimited" : limits.socialAccounts}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Monthly Posts</span>
                    <span className="font-medium">
                      {limits.monthlyPosts === -1 ? "Unlimited" : limits.monthlyPosts}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Team Members</span>
                    <span className="font-medium">
                      {limits.teamMembers === -1 ? "Unlimited" : limits.teamMembers}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">AI Generations</span>
                    <span className="font-medium">
                      {limits.aiGenerations === -1 ? "Unlimited" : limits.aiGenerations}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 mb-6">
                  <h4 className="text-sm font-medium text-gray-900">Features</h4>
                  <div className="space-y-1">
                    {limits.features.map((feature) => (
                      <div key={feature} className="flex items-center text-sm text-gray-600">
                        <svg className="h-4 w-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        {formatFeatureName(feature)}
                      </div>
                    ))}
                  </div>
                </div>

                {!isCurrentPlan && (
                  <button
                    onClick={() => handlePlanUpdate(plan)}
                    disabled={isUpdating}
                    className={`w-full py-2 px-4 rounded-lg font-medium text-sm transition-colors ${plan === SubscriptionPlan.PRO
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : plan === SubscriptionPlan.ENTERPRISE
                        ? "bg-purple-600 text-white hover:bg-purple-700"
                        : "bg-gray-600 text-white hover:bg-gray-700"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {isUpdating ? "Updating..." :
                      plan === SubscriptionPlan.FREE ? "Downgrade" : "Upgrade"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Billing History */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Billing History</h2>
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 text-center text-gray-500">
            <svg className="h-12 w-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p>No billing history available</p>
            <p className="text-sm mt-1">Your billing history will appear here once you have transactions</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatFeatureName(feature: string): string {
  return feature
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}