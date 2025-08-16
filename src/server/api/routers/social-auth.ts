import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
} from "@/server/api/trpc";
import { SocialAuthService } from "@/server/services/auth/social-auth-service";
import { SocialPlatform, AccountType } from "@/server/services/auth/base-auth-provider";
import { withWorkspaceAccess } from "@/server/api/middleware/workspace";

export const socialAuthRouter = createTRPCRouter({
  // Get available platforms
  getAvailablePlatforms: protectedProcedure
    .query(async ({ ctx }) => {
      const service = new SocialAuthService(ctx.db);
      return service.getAvailablePlatforms();
    }),

  // Get required scopes for a platform
  getRequiredScopes: protectedProcedure
    .input(z.object({
      platform: z.enum([SocialPlatform.FACEBOOK, SocialPlatform.X, SocialPlatform.LINKEDIN])
    }))
    .query(async ({ ctx, input }) => {
      const service = new SocialAuthService(ctx.db);
      return service.getRequiredScopes(input.platform);
    }),

  // Initiate OAuth flow
  initiateAuth: withWorkspaceAccess
    .input(z.object({
      platform: z.enum([SocialPlatform.FACEBOOK, SocialPlatform.X, SocialPlatform.LINKEDIN]),
      accountType: z.enum([AccountType.PERSONAL, AccountType.BUSINESS, AccountType.PAGE]),
      redirectUri: z.string().url()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new SocialAuthService(ctx.db);
      return service.initiateAuth(
        input.platform,
        ctx.workspace.id,
        input.accountType,
        input.redirectUri
      );
    }),

  // Handle OAuth callback
  handleCallback: protectedProcedure
    .input(z.object({
      platform: z.enum([SocialPlatform.FACEBOOK, SocialPlatform.X, SocialPlatform.LINKEDIN]),
      code: z.string(),
      state: z.string(),
      redirectUri: z.string().url()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new SocialAuthService(ctx.db);
      return service.handleCallback(
        input.platform,
        input.code,
        input.state,
        input.redirectUri
      );
    }),

  // Refresh token for an account
  refreshToken: protectedProcedure
    .input(z.object({
      platform: z.enum([SocialPlatform.FACEBOOK, SocialPlatform.X, SocialPlatform.LINKEDIN]),
      accountId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify the account belongs to a workspace the user has access to
      const account = await ctx.db.socialAccount.findFirst({
        where: {
          id: input.accountId,
          workspace: {
            members: {
              some: {
                userId: ctx.session.user.id
              }
            }
          }
        }
      });

      if (!account) {
        throw new Error("Account not found or access denied");
      }

      const service = new SocialAuthService(ctx.db);
      return service.refreshToken(input.platform, input.accountId);
    }),

  // Revoke access for an account
  revokeAccess: protectedProcedure
    .input(z.object({
      platform: z.enum([SocialPlatform.FACEBOOK, SocialPlatform.X, SocialPlatform.LINKEDIN]),
      accountId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify the account belongs to a workspace the user has access to
      const account = await ctx.db.socialAccount.findFirst({
        where: {
          id: input.accountId,
          workspace: {
            members: {
              some: {
                userId: ctx.session.user.id
              }
            }
          }
        }
      });

      if (!account) {
        throw new Error("Account not found or access denied");
      }

      const service = new SocialAuthService(ctx.db);
      await service.revokeAccess(input.platform, input.accountId);
      return { success: true };
    }),
});