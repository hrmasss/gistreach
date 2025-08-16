import { TRPCError } from "@trpc/server";
import { type PrismaClient } from "@prisma/client";

export interface SubscriptionLimits {
  socialAccounts: number;
  monthlyPosts: number;
  teamMembers: number;
  aiGenerations: number;
  analyticsRetention: number; // days
  features: string[];
}

export interface UsageStats {
  socialAccounts: number;
  monthlyPosts: number;
  teamMembers: number;
  aiGenerations: number;
}

export enum SubscriptionPlan {
  FREE = "free",
  PRO = "pro", 
  ENTERPRISE = "enterprise"
}

export enum SubscriptionStatus {
  ACTIVE = "active",
  CANCELLED = "cancelled",
  PAST_DUE = "past_due",
  TRIALING = "trialing",
  INCOMPLETE = "incomplete",
  INCOMPLETE_EXPIRED = "incomplete_expired",
  UNPAID = "unpaid"
}

export enum Feature {
  AI_CONTENT_GENERATION = "ai_content_generation",
  ADVANCED_ANALYTICS = "advanced_analytics",
  TEAM_COLLABORATION = "team_collaboration",
  BULK_SCHEDULING = "bulk_scheduling",
  CUSTOM_BRANDING = "custom_branding",
  API_ACCESS = "api_access",
  PRIORITY_SUPPORT = "priority_support",
  WHITE_LABEL = "white_label"
}

export class SubscriptionService {
  constructor(private db: PrismaClient) {}

  // Plan configurations
  private readonly planConfigs: Record<SubscriptionPlan, SubscriptionLimits> = {
    [SubscriptionPlan.FREE]: {
      socialAccounts: 3,
      monthlyPosts: 50,
      teamMembers: 2,
      aiGenerations: 10,
      analyticsRetention: 30,
      features: [Feature.AI_CONTENT_GENERATION]
    },
    [SubscriptionPlan.PRO]: {
      socialAccounts: 10,
      monthlyPosts: 500,
      teamMembers: 10,
      aiGenerations: 200,
      analyticsRetention: 90,
      features: [
        Feature.AI_CONTENT_GENERATION,
        Feature.ADVANCED_ANALYTICS,
        Feature.TEAM_COLLABORATION,
        Feature.BULK_SCHEDULING,
        Feature.PRIORITY_SUPPORT
      ]
    },
    [SubscriptionPlan.ENTERPRISE]: {
      socialAccounts: -1, // unlimited
      monthlyPosts: -1, // unlimited
      teamMembers: -1, // unlimited
      aiGenerations: -1, // unlimited
      analyticsRetention: 365,
      features: [
        Feature.AI_CONTENT_GENERATION,
        Feature.ADVANCED_ANALYTICS,
        Feature.TEAM_COLLABORATION,
        Feature.BULK_SCHEDULING,
        Feature.CUSTOM_BRANDING,
        Feature.API_ACCESS,
        Feature.PRIORITY_SUPPORT,
        Feature.WHITE_LABEL
      ]
    }
  };

  async createSubscription(userId: string, planId: SubscriptionPlan): Promise<any> {
    const existingSubscription = await this.db.subscription.findUnique({
      where: { userId }
    });

    if (existingSubscription) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "User already has a subscription"
      });
    }

    const limits = this.planConfigs[planId];
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const subscription = await this.db.subscription.create({
      data: {
        userId,
        planId,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        limits: limits as any
      }
    });

    return subscription;
  }

  async getSubscription(userId: string) {
    const subscription = await this.db.subscription.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!subscription) {
      // Create default free subscription
      return this.createSubscription(userId, SubscriptionPlan.FREE);
    }

    return subscription;
  }

  async updateSubscription(userId: string, planId: SubscriptionPlan): Promise<any> {
    const subscription = await this.getSubscription(userId);
    const limits = this.planConfigs[planId];

    const updatedSubscription = await this.db.subscription.update({
      where: { userId },
      data: {
        planId,
        limits: limits as any,
        updatedAt: new Date()
      }
    });

    return updatedSubscription;
  }

  async cancelSubscription(userId: string): Promise<any> {
    const subscription = await this.db.subscription.findUnique({
      where: { userId }
    });

    if (!subscription) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Subscription not found"
      });
    }

    const updatedSubscription = await this.db.subscription.update({
      where: { userId },
      data: {
        status: SubscriptionStatus.CANCELLED,
        updatedAt: new Date()
      }
    });

    return updatedSubscription;
  }

  async checkFeatureAccess(userId: string, feature: Feature): Promise<boolean> {
    const subscription = await this.getSubscription(userId);
    const limits = subscription.limits as SubscriptionLimits;
    
    return limits.features.includes(feature);
  }

  async checkUsageLimit(userId: string, resource: keyof UsageStats): Promise<{ allowed: boolean; current: number; limit: number }> {
    const subscription = await this.getSubscription(userId);
    const limits = subscription.limits as SubscriptionLimits;
    const usage = await this.getCurrentUsage(userId);

    const limit = limits[resource];
    const current = usage[resource];

    return {
      allowed: limit === -1 || current < limit,
      current,
      limit: limit === -1 ? Infinity : limit
    };
  }

  async getCurrentUsage(userId: string): Promise<UsageStats> {
    // Get user's workspaces
    const workspaces = await this.db.workspace.findMany({
      where: {
        members: {
          some: { userId }
        }
      },
      include: {
        _count: {
          select: {
            socialAccounts: true,
            members: true
          }
        }
      }
    });

    // Calculate current month's posts
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyPosts = await this.db.publishedPost.count({
      where: {
        socialAccount: {
          workspace: {
            members: {
              some: { userId }
            }
          }
        },
        publishedAt: {
          gte: startOfMonth
        }
      }
    });

    // Calculate AI generations this month (placeholder - would need to track this)
    const aiGenerations = 0; // TODO: Implement AI usage tracking

    // Aggregate usage across all workspaces
    const totalSocialAccounts = workspaces.reduce((sum, ws) => sum + ws._count.socialAccounts, 0);
    const totalTeamMembers = workspaces.reduce((sum, ws) => sum + ws._count.members, 0);

    return {
      socialAccounts: totalSocialAccounts,
      monthlyPosts,
      teamMembers: totalTeamMembers,
      aiGenerations
    };
  }

  async trackUsage(userId: string, resource: keyof UsageStats, amount: number = 1): Promise<void> {
    // This would typically update a usage tracking table
    // For now, we'll just validate the usage doesn't exceed limits
    const usageCheck = await this.checkUsageLimit(userId, resource);
    
    if (!usageCheck.allowed) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Usage limit exceeded for ${resource}. Current: ${usageCheck.current}, Limit: ${usageCheck.limit}`
      });
    }
  }

  async getUsageStats(userId: string) {
    const subscription = await this.getSubscription(userId);
    const usage = await this.getCurrentUsage(userId);
    const limits = subscription.limits as SubscriptionLimits;

    return {
      subscription,
      usage,
      limits,
      utilization: {
        socialAccounts: limits.socialAccounts === -1 ? 0 : (usage.socialAccounts / limits.socialAccounts) * 100,
        monthlyPosts: limits.monthlyPosts === -1 ? 0 : (usage.monthlyPosts / limits.monthlyPosts) * 100,
        teamMembers: limits.teamMembers === -1 ? 0 : (usage.teamMembers / limits.teamMembers) * 100,
        aiGenerations: limits.aiGenerations === -1 ? 0 : (usage.aiGenerations / limits.aiGenerations) * 100,
      }
    };
  }

  async renewSubscription(userId: string): Promise<any> {
    const subscription = await this.db.subscription.findUnique({
      where: { userId }
    });

    if (!subscription) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Subscription not found"
      });
    }

    const newPeriodStart = subscription.currentPeriodEnd;
    const newPeriodEnd = new Date(newPeriodStart);
    newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);

    const renewedSubscription = await this.db.subscription.update({
      where: { userId },
      data: {
        currentPeriodStart: newPeriodStart,
        currentPeriodEnd: newPeriodEnd,
        status: SubscriptionStatus.ACTIVE,
        updatedAt: new Date()
      }
    });

    return renewedSubscription;
  }

  getPlanConfig(planId: SubscriptionPlan): SubscriptionLimits {
    return this.planConfigs[planId];
  }

  getAllPlans(): Record<SubscriptionPlan, SubscriptionLimits> {
    return this.planConfigs;
  }

  async isSubscriptionActive(userId: string): Promise<boolean> {
    const subscription = await this.getSubscription(userId);
    return subscription.status === SubscriptionStatus.ACTIVE || 
           subscription.status === SubscriptionStatus.TRIALING;
  }

  async getSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
    const subscription = await this.getSubscription(userId);
    return subscription.status as SubscriptionStatus;
  }
}