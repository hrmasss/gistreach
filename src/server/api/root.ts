import { postRouter } from "@/server/api/routers/post";
import { workspaceRouter } from "@/server/api/routers/workspace";
import { subscriptionRouter } from "@/server/api/routers/subscription";
import { credentialRouter } from "@/server/api/routers/credential";
import { socialAuthRouter } from "@/server/api/routers/social-auth";
import { contentRouter } from "@/server/api/routers/content";
import { aiContentRouter } from "@/server/api/routers/ai-content";
import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  post: postRouter,
  workspace: workspaceRouter,
  subscription: subscriptionRouter,
  credential: credentialRouter,
  socialAuth: socialAuthRouter,
  content: contentRouter,
  aiContent: aiContentRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
