import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
} from "@/server/api/trpc";
import { CredentialService } from "@/server/services/credential";
import { withWorkspaceAccess } from "@/server/api/middleware/workspace";

export const credentialRouter = createTRPCRouter({
  // Get all social accounts for a workspace
  getWorkspaceAccounts: withWorkspaceAccess
    .query(async ({ ctx }) => {
      const service = new CredentialService(ctx.db);
      return service.getWorkspaceAccounts(ctx.workspace.id);
    }),

  // Check if credentials need refresh
  needsRefresh: protectedProcedure
    .input(z.object({
      accountId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      const service = new CredentialService(ctx.db);
      return service.needsRefresh(input.accountId);
    }),

  // Revoke credentials for an account
  revokeCredentials: protectedProcedure
    .input(z.object({
      accountId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new CredentialService(ctx.db);

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

      await service.revokeCredentials(input.accountId);
      return { success: true };
    }),

  // Admin function to cleanup expired credentials
  cleanupExpired: protectedProcedure
    .mutation(async ({ ctx }) => {
      // This should probably be restricted to admin users or run as a cron job
      const service = new CredentialService(ctx.db);
      const cleanedUp = await service.cleanupExpiredCredentials();
      return { cleanedUp };
    }),
});