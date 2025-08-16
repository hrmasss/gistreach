import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
} from "@/server/api/trpc";
import { ContentService, ContentType, ContentStatus } from "@/server/services/content";
import { withWorkspaceAccess, withWorkspaceMember } from "@/server/api/middleware/workspace";

const MediaAssetSchema = z.object({
  id: z.string(),
  type: z.enum(["image", "video"]),
  url: z.string().url(),
  filename: z.string(),
  size: z.number(),
  mimeType: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
  duration: z.number().optional(),
});

const ContentInputSchema = z.object({
  title: z.string().min(1).max(200),
  rawContent: z.string().min(1).max(10000),
  type: z.enum([ContentType.TEXT, ContentType.IMAGE, ContentType.VIDEO]),
  mediaAssets: z.array(MediaAssetSchema).optional(),
});

const ContentUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  rawContent: z.string().min(1).max(10000).optional(),
  aiEnhancedContent: z.string().max(10000).optional(),
  mediaAssets: z.array(MediaAssetSchema).optional(),
  status: z.enum([ContentStatus.DRAFT, ContentStatus.READY, ContentStatus.PUBLISHED, ContentStatus.ARCHIVED]).optional(),
});

const ContentFiltersSchema = z.object({
  status: z.enum([ContentStatus.DRAFT, ContentStatus.READY, ContentStatus.PUBLISHED, ContentStatus.ARCHIVED]).optional(),
  type: z.enum([ContentType.TEXT, ContentType.IMAGE, ContentType.VIDEO]).optional(),
  search: z.string().optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

export const contentRouter = createTRPCRouter({
  // Create new content
  create: withWorkspaceMember
    .input(ContentInputSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ContentService(ctx.db);
      return service.createContent(ctx.workspace.id, ctx.session.user.id, input);
    }),

  // Update existing content
  update: protectedProcedure
    .input(z.object({
      contentId: z.string(),
      updates: ContentUpdateSchema
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new ContentService(ctx.db);
      return service.updateContent(input.contentId, ctx.session.user.id, input.updates);
    }),

  // Get content by ID
  getById: protectedProcedure
    .input(z.object({
      contentId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      const service = new ContentService(ctx.db);
      return service.getContentById(input.contentId, ctx.session.user.id);
    }),

  // Get content list with filters
  getList: withWorkspaceAccess
    .input(ContentFiltersSchema)
    .query(async ({ ctx, input }) => {
      const service = new ContentService(ctx.db);
      return service.getContentList(ctx.workspace.id, ctx.session.user.id, input);
    }),

  // Delete content
  delete: protectedProcedure
    .input(z.object({
      contentId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new ContentService(ctx.db);
      return service.deleteContent(input.contentId, ctx.session.user.id);
    }),

  // Duplicate content
  duplicate: protectedProcedure
    .input(z.object({
      contentId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new ContentService(ctx.db);
      return service.duplicateContent(input.contentId, ctx.session.user.id);
    }),

  // Auto-save draft
  autoSave: protectedProcedure
    .input(z.object({
      contentId: z.string(),
      updates: z.object({
        title: z.string().optional(),
        rawContent: z.string().optional(),
        mediaAssets: z.array(MediaAssetSchema).optional(),
      })
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new ContentService(ctx.db);
      return service.autoSaveDraft(input.contentId, ctx.session.user.id, input.updates);
    }),

  // Get content statistics
  getStats: withWorkspaceAccess
    .query(async ({ ctx }) => {
      const service = new ContentService(ctx.db);
      return service.getContentStats(ctx.workspace.id, ctx.session.user.id);
    }),
});