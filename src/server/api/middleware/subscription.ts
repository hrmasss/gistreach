import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../trpc";
import { SubscriptionService, Feature } from "@/server/services/subscription";

/**
 * Middleware to check if user has an active subscription
 */
export const withActiveSubscription = protectedProcedure.use(async ({ ctx, next }) => {
  const service = new SubscriptionService(ctx.db);
  const isActive = await service.isSubscriptionActive(ctx.session.user.id);

  if (!isActive) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Active subscription required for this action",
    });
  }

  return next({ ctx });
});

/**
 * Middleware to check if user has access to a specific feature
 */
export function withFeatureAccess(feature: Feature) {
  return protectedProcedure.use(async ({ ctx, next }) => {
    const service = new SubscriptionService(ctx.db);
    const hasAccess = await service.checkFeatureAccess(ctx.session.user.id, feature);

    if (!hasAccess) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Your subscription plan doesn't include access to ${feature}`,
      });
    }

    return next({ ctx });
  });
}

/**
 * Middleware to check usage limits before performing an action
 */
export function withUsageLimit(resource: "socialAccounts" | "monthlyPosts" | "teamMembers" | "aiGenerations") {
  return protectedProcedure.use(async ({ ctx, next }) => {
    const service = new SubscriptionService(ctx.db);
    const usageCheck = await service.checkUsageLimit(ctx.session.user.id, resource);

    if (!usageCheck.allowed) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Usage limit exceeded for ${resource}. Current: ${usageCheck.current}, Limit: ${usageCheck.limit === Infinity ? 'unlimited' : usageCheck.limit}`,
      });
    }

    return next({
      ctx: {
        ...ctx,
        usageCheck,
      },
    });
  });
}

/**
 * Middleware to track usage after a successful action
 */
export function withUsageTracking(resource: "socialAccounts" | "monthlyPosts" | "teamMembers" | "aiGenerations", amount: number = 1) {
  return protectedProcedure.use(async ({ ctx, next }) => {
    const result = await next({ ctx });

    // Only track usage if the operation was successful
    if (result.ok) {
      const service = new SubscriptionService(ctx.db);
      try {
        await service.trackUsage(ctx.session.user.id, resource, amount);
      } catch (error) {
        // Log the error but don't fail the request
        console.error(`Failed to track usage for ${resource}:`, error);
      }
    }

    return result;
  });
}

/**
 * Combined middleware for usage limit checking and tracking
 */
export function withUsageLimitAndTracking(resource: "socialAccounts" | "monthlyPosts" | "teamMembers" | "aiGenerations", amount: number = 1) {
  return withUsageLimit(resource).use(async ({ ctx, next }) => {
    const result = await next({ ctx });

    // Track usage after successful operation
    if (result.ok) {
      const service = new SubscriptionService(ctx.db);
      try {
        await service.trackUsage(ctx.session.user.id, resource, amount);
      } catch (error) {
        console.error(`Failed to track usage for ${resource}:`, error);
      }
    }

    return result;
  });
}