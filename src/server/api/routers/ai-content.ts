import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
} from "@/server/api/trpc";
import {
  AIContentEnhancer,
  AIEnhancementType,
  ContentTone,
  ContentLength
} from "@/server/services/ai-content-enhancer";
import { withFeatureAccess } from "@/server/api/middleware/subscription";
import { Feature } from "@/server/services/subscription";

const AIEnhancementRequestSchema = z.object({
  type: z.enum([
    AIEnhancementType.POLISH,
    AIEnhancementType.GENERATE,
    AIEnhancementType.SUMMARIZE,
    AIEnhancementType.EXPAND,
    AIEnhancementType.TRANSLATE
  ]),
  content: z.string().optional(),
  topic: z.string().optional(),
  tone: z.enum([
    ContentTone.PROFESSIONAL,
    ContentTone.CASUAL,
    ContentTone.FRIENDLY,
    ContentTone.FORMAL,
    ContentTone.HUMOROUS,
    ContentTone.INSPIRATIONAL
  ]).optional(),
  length: z.enum([
    ContentLength.SHORT,
    ContentLength.MEDIUM,
    ContentLength.LONG
  ]).optional(),
  targetLanguage: z.string().optional(),
  additionalInstructions: z.string().optional(),
  includeHashtags: z.boolean().optional(),
  includeEmojis: z.boolean().optional(),
  targetPlatforms: z.array(z.string()).optional(),
});

export const aiContentRouter = createTRPCRouter({
  // Enhance content with AI
  enhance: withFeatureAccess(Feature.AI_CONTENT_GENERATION)
    .input(AIEnhancementRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const enhancer = new AIContentEnhancer();
      return enhancer.enhanceContent(input);
    }),

  // Generate multiple content variations
  generateVariations: withFeatureAccess(Feature.AI_CONTENT_GENERATION)
    .input(z.object({
      request: AIEnhancementRequestSchema,
      count: z.number().min(1).max(5).default(3)
    }))
    .mutation(async ({ ctx, input }) => {
      const enhancer = new AIContentEnhancer();
      return enhancer.generateVariations(input.request, input.count);
    }),

  // Get content suggestions
  getSuggestions: withFeatureAccess(Feature.AI_CONTENT_GENERATION)
    .input(z.object({
      topic: z.string().min(1),
      platform: z.string().optional()
    }))
    .query(async ({ ctx, input }) => {
      const enhancer = new AIContentEnhancer();
      return enhancer.getContentSuggestions(input.topic, input.platform);
    }),

  // Analyze content
  analyzeContent: withFeatureAccess(Feature.AI_CONTENT_GENERATION)
    .input(z.object({
      content: z.string().min(1)
    }))
    .query(async ({ ctx, input }) => {
      const enhancer = new AIContentEnhancer();
      return enhancer.analyzeContent(input.content);
    }),

  // Polish existing content (simplified endpoint)
  polish: withFeatureAccess(Feature.AI_CONTENT_GENERATION)
    .input(z.object({
      content: z.string().min(1),
      tone: z.enum([
        ContentTone.PROFESSIONAL,
        ContentTone.CASUAL,
        ContentTone.FRIENDLY,
        ContentTone.FORMAL,
        ContentTone.HUMOROUS,
        ContentTone.INSPIRATIONAL
      ]).optional(),
      includeHashtags: z.boolean().optional(),
      includeEmojis: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const enhancer = new AIContentEnhancer();
      return enhancer.enhanceContent({
        type: AIEnhancementType.POLISH,
        content: input.content,
        tone: input.tone,
        includeHashtags: input.includeHashtags,
        includeEmojis: input.includeEmojis,
      });
    }),

  // Generate content from topic (simplified endpoint)
  generate: withFeatureAccess(Feature.AI_CONTENT_GENERATION)
    .input(z.object({
      topic: z.string().min(1),
      tone: z.enum([
        ContentTone.PROFESSIONAL,
        ContentTone.CASUAL,
        ContentTone.FRIENDLY,
        ContentTone.FORMAL,
        ContentTone.HUMOROUS,
        ContentTone.INSPIRATIONAL
      ]).optional(),
      length: z.enum([
        ContentLength.SHORT,
        ContentLength.MEDIUM,
        ContentLength.LONG
      ]).optional(),
      targetPlatforms: z.array(z.string()).optional(),
      includeHashtags: z.boolean().optional(),
      includeEmojis: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const enhancer = new AIContentEnhancer();
      return enhancer.enhanceContent({
        type: AIEnhancementType.GENERATE,
        topic: input.topic,
        tone: input.tone,
        length: input.length,
        targetPlatforms: input.targetPlatforms,
        includeHashtags: input.includeHashtags,
        includeEmojis: input.includeEmojis,
      });
    }),
});