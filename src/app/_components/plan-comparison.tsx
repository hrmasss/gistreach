"use client";

import { useState } from "react";
import { useSubscription } from "@/hooks/use-subscription";
import { SubscriptionPlan, Feature } from "@/server/services/subscription";

interface PlanComparisonProps {
  onSelectPlan?: (planId: SubscriptionPlan) => void;
  showCurrentPlan?: boolean;
}

export function PlanComparison({ onSelectPlan, showCurrentPlan = true }: PlanComparisonProps) {
  const { subscription, plans, updatePlan, isUpdating } = useSubscription();
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);

  if (!plans) {
    return (
      <div className="animate-pulse">
        <div className="grid grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-96 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  const handleSelectPlan = async (planId: SubscriptionPlan) => {
    if (onSelectPlan) {
      onSelectPlan(planId);
    } else {
      setSelectedPlan(planId);
      try {
        await updatePlan(planId);
        setSelectedPlan(null);
      } catch (error) {
        console.error("Failed to update plan:", error);
        setSelectedPlan(null);
      }
    }
  };

  const getPlanPrice = (planId: SubscriptionPlan) => {
    switch (planId) {
      case SubscriptionPlan.FREE:
        return { amount: 0, display: "Free" };
      case SubscriptionPlan.PRO:
        return { amount: 29, display: "$29" };
      case SubscriptionPlan.ENTERPRISE:
        return { amount: 99, display: "$99" };
      default:
        return { amount: 0, display: "Custom" };
    }
  };

  const getFeatureList = (features: string[]) => {
    const featureDescriptions: Record<string, string> = {
      [Feature.AI_CONTENT_GENERATION]: "AI Content Generation",
      [Feature.ADVANCED_ANALYTICS]: "Advanced Analytics & Insights",
      [Feature.TEAM_COLLABORATION]: "Team Collaboration Tools",
      [Feature.BULK_SCHEDULING]: "Bulk Post Scheduling",
      [Feature.CUSTOM_BRANDING]: "Custom Branding",
      [Feature.API_ACCESS]: "API Access",
      [Feature.PRIORITY_SUPPORT]: "Priority Support",
      [Feature.WHITE_LABEL]: "White Label Solution",
    };

    return features.map(feature => featureDescriptions[feature] || feature);
  };

  return (
    <div className="py-12">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Choose Your Plan</h2>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Select the perfect plan for your social media management needs.
          Upgrade or downgrade anytime.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {Object.entries(plans).map(([planId, limits]) => {
          const plan = planId as SubscriptionPlan;
          const price = getPlanPrice(plan);
          const isCurrentPlan = showCurrentPlan && subscription?.planId === planId;
          const isPopular = plan === SubscriptionPlan.PRO;
          const isProcessing = selectedPlan === plan || isUpdating;

          return (
            <div
              key={planId}
              className={`relative bg-white rounded-2xl shadow-lg p-8 ${isPopular ? "ring-2 ring-blue-500 scale-105" : ""
                } ${isCurrentPlan ? "ring-2 ring-green-500" : ""}`}
            >
              {isPopular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                    Most Popular
                  </span>
                </div>
              )}

              {isCurrentPlan && (
                <div className="absolute -top-4 right-4">
                  <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                    Current
                  </span>
                </div>
              )}

              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900 capitalize mb-2">
                  {planId}
                </h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold text-gray-900">
                    {price.display}
                  </span>
                  {price.amount > 0 && (
                    <span className="text-gray-600 ml-1">/month</span>
                  )}
                </div>
                <p className="text-gray-600 text-sm">
                  {plan === SubscriptionPlan.FREE && "Perfect for getting started"}
                  {plan === SubscriptionPlan.PRO && "Best for growing businesses"}
                  {plan === SubscriptionPlan.ENTERPRISE && "For large organizations"}
                </p>
              </div>

              {/* Limits */}
              <div className="space-y-4 mb-8">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">Social Accounts</span>
                  <span className="font-semibold">
                    {limits.socialAccounts === -1 ? "Unlimited" : limits.socialAccounts}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">Monthly Posts</span>
                  <span className="font-semibold">
                    {limits.monthlyPosts === -1 ? "Unlimited" : limits.monthlyPosts}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">Team Members</span>
                  <span className="font-semibold">
                    {limits.teamMembers === -1 ? "Unlimited" : limits.teamMembers}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">AI Generations</span>
                  <span className="font-semibold">
                    {limits.aiGenerations === -1 ? "Unlimited" : limits.aiGenerations}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600">Analytics Retention</span>
                  <span className="font-semibold">{limits.analyticsRetention} days</span>
                </div>
              </div>

              {/* Features */}
              <div className="mb-8">
                <h4 className="font-semibold text-gray-900 mb-4">Features Included</h4>
                <div className="space-y-3">
                  {getFeatureList(limits.features).map((feature, index) => (
                    <div key={index} className="flex items-center">
                      <svg className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-gray-700 text-sm">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA Button */}
              {!isCurrentPlan && (
                <button
                  onClick={() => handleSelectPlan(plan)}
                  disabled={isProcessing}
                  className={`w-full py-3 px-6 rounded-lg font-semibold text-center transition-all duration-200 ${isPopular
                    ? "bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-xl"
                    : plan === SubscriptionPlan.ENTERPRISE
                      ? "bg-purple-600 text-white hover:bg-purple-700"
                      : "bg-gray-800 text-white hover:bg-gray-900"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isProcessing ? (
                    <div className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </div>
                  ) : (
                    <>
                      {price.amount === 0 ? "Get Started" :
                        subscription && price.amount > getPlanPrice(subscription.planId as SubscriptionPlan).amount ? "Upgrade" : "Choose Plan"}
                    </>
                  )}
                </button>
              )}

              {isCurrentPlan && (
                <div className="text-center py-3 px-6 bg-green-50 text-green-700 rounded-lg font-medium">
                  Current Plan
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* FAQ or additional info */}
      <div className="mt-16 text-center">
        <p className="text-gray-600 mb-4">
          Need help choosing? All plans include a 14-day free trial.
        </p>
        <div className="flex justify-center space-x-6 text-sm text-gray-500">
          <span>✓ Cancel anytime</span>
          <span>✓ No setup fees</span>
          <span>✓ 24/7 support</span>
        </div>
      </div>
    </div>
  );
}