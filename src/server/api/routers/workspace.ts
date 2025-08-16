import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProcedure,
} from "@/server/api/trpc";
import { WorkspaceService, WorkspaceRole } from "@/server/services/workspace";
import {
  withWorkspaceAccess,
  withWorkspaceAdmin,
  withWorkspaceOwner,
  canManageUserRole
} from "@/server/api/middleware/workspace";

const workspaceService = new WorkspaceService(undefined as any); // Will be injected via context

export const workspaceRouter = createTRPCRouter({
  // Create a new workspace
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(50)
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new WorkspaceService(ctx.db);
      return service.createWorkspace(ctx.session.user.id, input.name);
    }),

  // Get all workspaces for the current user
  getAll: protectedProcedure
    .query(async ({ ctx }) => {
      const service = new WorkspaceService(ctx.db);
      return service.getUserWorkspaces(ctx.session.user.id);
    }),

  // Get a specific workspace by ID
  getById: withWorkspaceAccess
    .query(async ({ ctx }) => {
      return ctx.workspace;
    }),

  // Invite a member to the workspace
  inviteMember: withWorkspaceAdmin
    .input(z.object({
      email: z.string().email(),
      role: z.nativeEnum(WorkspaceRole)
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new WorkspaceService(ctx.db);
      return service.inviteMember(
        ctx.workspace.id,
        ctx.session.user.id,
        input.email,
        input.role
      );
    }),

  // Update a member's role
  updateMemberRole: withWorkspaceAdmin
    .input(z.object({
      userId: z.string(),
      role: z.nativeEnum(WorkspaceRole)
    }))
    .mutation(async ({ ctx, input }) => {
      // Additional check: ensure user can manage the target user's role
      const targetMember = await ctx.db.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: input.userId,
            workspaceId: ctx.workspace.id,
          },
        },
      });

      if (!targetMember) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Member not found",
        });
      }

      if (!canManageUserRole(ctx.userRole, targetMember.role as WorkspaceRole)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You cannot manage this user's role",
        });
      }

      const service = new WorkspaceService(ctx.db);
      return service.updateMemberRole(
        ctx.workspace.id,
        ctx.session.user.id,
        input.userId,
        input.role
      );
    }),

  // Remove a member from the workspace
  removeMember: withWorkspaceAdmin
    .input(z.object({
      userId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      // Additional check: ensure user can manage the target user
      const targetMember = await ctx.db.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: input.userId,
            workspaceId: ctx.workspace.id,
          },
        },
      });

      if (!targetMember) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Member not found",
        });
      }

      if (!canManageUserRole(ctx.userRole, targetMember.role as WorkspaceRole)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You cannot remove this user",
        });
      }

      const service = new WorkspaceService(ctx.db);
      return service.removeMember(
        ctx.workspace.id,
        ctx.session.user.id,
        input.userId
      );
    }),

  // Get workspace usage statistics
  getUsage: withWorkspaceAccess
    .query(async ({ ctx }) => {
      const service = new WorkspaceService(ctx.db);
      return service.getWorkspaceUsage(ctx.workspace.id, ctx.session.user.id);
    }),
});