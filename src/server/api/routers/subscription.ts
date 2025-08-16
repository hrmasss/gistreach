import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
} from "@/server/api/trpc";
import {
  SubscriptionService,
  SubscriptionPlan,
  Feature
} from "@/server/services/subscription";

export const subscriptionRouter = createTRPCRouter({
  // Get current user's subscription
  getCurrent: protectedProcedure
    .query(async ({ ctx }) => {
      const service = new SubscriptionService(ctx.db);
      return service.getSubscription(ctx.session.user.id);
    }),

  // Get usage statistics
  getUsage: protectedProcedure
    .query(async ({ ctx }) => {
      const service = new SubscriptionService(ctx.db);
      return service.getUsageStats(ctx.session.user.id);
    }),

  // Update subscription plan
  updatePlan: protectedProcedure
    .input(z.object({
      planId: z.nativeEnum(SubscriptionPlan)
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new SubscriptionService(ctx.db);
      return service.updateSubscription(ctx.session.user.id, input.planId);
    }),

  // Cancel subscription
  cancel: protectedProcedure
    .mutation(async ({ ctx }) => {
      const service = new SubscriptionService(ctx.db);
      return service.cancelSubscription(ctx.session.user.id);
    }),

  // Check feature access
  checkFeature: protectedProcedure
    .input(z.object({
      feature: z.nativeEnum(Feature)
    }))
    .query(async ({ ctx, input }) => {
      const service = new SubscriptionService(ctx.db);
      return service.checkFeatureAccess(ctx.session.user.id, input.feature);
    }),

  // Check usage limit for a resource
  checkUsageLimit: protectedProcedure
    .input(z.object({
      resource: z.enum(["socialAccounts", "monthlyPosts", "teamMembers", "aiGenerations"])
    }))
    .query(async ({ ctx, input }) => {
      const service = new SubscriptionService(ctx.db);
      return service.checkUsageLimit(ctx.session.user.id, input.resource);
    }),

  // Get all available plans
  getPlans: protectedProcedure
    .query(async ({ ctx }) => {
      const service = new SubscriptionService(ctx.db);
      return service.getAllPlans();
    }),

  // Track usage (internal use)
  trackUsage: protectedProcedure
    .input(z.object({
      resource: z.enum(["socialAccounts", "monthlyPosts", "teamMembers", "aiGenerations"]),
      amount: z.number().optional().default(1)
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new SubscriptionService(ctx.db);
      await service.trackUsage(ctx.session.user.id, input.resource, input.amount);
      return { success: true };
    }),

  // Renew subscription (for billing integration)
  renew: protectedProcedure
    .mutation(async ({ ctx }) => {
      const service = new SubscriptionService(ctx.db);
      return service.renewSubscription(ctx.session.user.id);
    }),

  // Check if subscription is active
  isActive: protectedProcedure
    .query(async ({ ctx }) => {
      const service = new SubscriptionService(ctx.db);
      return service.isSubscriptionActive(ctx.session.user.id);
    }),
});