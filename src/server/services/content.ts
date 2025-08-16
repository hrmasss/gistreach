import { TRPCError } from "@trpc/server";
import { type PrismaClient } from "@prisma/client";

export enum ContentType {
  TEXT = "text",
  IMAGE = "image",
  VIDEO = "video"
}

export enum ContentStatus {
  DRAFT = "draft",
  READY = "ready",
  PUBLISHED = "published",
  ARCHIVED = "archived"
}

export interface MediaAsset {
  id: string;
  type: "image" | "video";
  url: string;
  filename: string;
  size: number;
  mimeType: string;
  width?: number;
  height?: number;
  duration?: number; // for videos
}

export interface ContentInput {
  title: string;
  rawContent: string;
  type: ContentType;
  mediaAssets?: MediaAsset[];
}

export interface ContentUpdate {
  title?: string;
  rawContent?: string;
  aiEnhancedContent?: string;
  mediaAssets?: MediaAsset[];
  status?: ContentStatus;
}

export interface ContentFilters {
  status?: ContentStatus;
  type?: ContentType;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

export class ContentService {
  constructor(private db: PrismaClient) { }

  /**
   * Create new content
   */
  async createContent(
    workspaceId: string,
    createdById: string,
    input: ContentInput
  ) {
    try {
      // Validate content
      this.validateContentInput(input);

      const content = await this.db.content.create({
        data: {
          workspaceId,
          createdById,
          title: input.title,
          rawContent: input.rawContent,
          type: input.type,
          mediaAssets: input.mediaAssets || [],
          status: ContentStatus.DRAFT,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true
            }
          },
          workspace: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      return content;
    } catch (error) {
      console.error("Failed to create content:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create content"
      });
    }
  }

  /**
   * Update existing content
   */
  async updateContent(
    contentId: string,
    userId: string,
    updates: ContentUpdate
  ) {
    try {
      // Verify user has access to this content
      const existingContent = await this.db.content.findFirst({
        where: {
          id: contentId,
          workspace: {
            members: {
              some: {
                userId
              }
            }
          }
        }
      });

      if (!existingContent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Content not found or access denied"
        });
      }

      // Validate updates
      if (updates.rawContent !== undefined || updates.title !== undefined) {
        this.validateContentInput({
          title: updates.title || existingContent.title,
          rawContent: updates.rawContent || existingContent.rawContent,
          type: existingContent.type as ContentType,
          mediaAssets: updates.mediaAssets || (existingContent.mediaAssets as MediaAsset[])
        });
      }

      const updatedContent = await this.db.content.update({
        where: { id: contentId },
        data: {
          ...updates,
          updatedAt: new Date()
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true
            }
          },
          workspace: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      return updatedContent;
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      console.error("Failed to update content:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to update content"
      });
    }
  }

  /**
   * Get content by ID
   */
  async getContentById(contentId: string, userId: string) {
    try {
      const content = await this.db.content.findFirst({
        where: {
          id: contentId,
          workspace: {
            members: {
              some: {
                userId
              }
            }
          }
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true
            }
          },
          workspace: {
            select: {
              id: true,
              name: true
            }
          },
          publishedPosts: {
            include: {
              socialAccount: {
                select: {
                  id: true,
                  platform: true,
                  displayName: true
                }
              }
            }
          }
        }
      });

      if (!content) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Content not found or access denied"
        });
      }

      return content;
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      console.error("Failed to get content:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to retrieve content"
      });
    }
  }

  /**
   * Get content list with filters
   */
  async getContentList(
    workspaceId: string,
    userId: string,
    filters: ContentFilters = {}
  ) {
    try {
      // Verify user has access to workspace
      const member = await this.db.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId,
            workspaceId
          }
        }
      });

      if (!member) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Access denied to workspace"
        });
      }

      const {
        status,
        type,
        search,
        dateFrom,
        dateTo,
        limit = 20,
        offset = 0
      } = filters;

      const where: any = {
        workspaceId
      };

      if (status) {
        where.status = status;
      }

      if (type) {
        where.type = type;
      }

      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { rawContent: { contains: search, mode: 'insensitive' } },
          { aiEnhancedContent: { contains: search, mode: 'insensitive' } }
        ];
      }

      if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) {
          where.createdAt.gte = dateFrom;
        }
        if (dateTo) {
          where.createdAt.lte = dateTo;
        }
      }

      const [content, total] = await Promise.all([
        this.db.content.findMany({
          where,
          include: {
            createdBy: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true
              }
            },
            _count: {
              select: {
                publishedPosts: true
              }
            }
          },
          orderBy: { updatedAt: 'desc' },
          take: limit,
          skip: offset
        }),
        this.db.content.count({ where })
      ]);

      return {
        content,
        total,
        hasMore: offset + limit < total
      };
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      console.error("Failed to get content list:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to retrieve content list"
      });
    }
  }

  /**
   * Delete content
   */
  async deleteContent(contentId: string, userId: string) {
    try {
      // Verify user has access to this content
      const existingContent = await this.db.content.findFirst({
        where: {
          id: contentId,
          workspace: {
            members: {
              some: {
                userId
              }
            }
          }
        },
        include: {
          publishedPosts: true
        }
      });

      if (!existingContent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Content not found or access denied"
        });
      }

      // Check if content has been published
      if (existingContent.publishedPosts.length > 0) {
        // Archive instead of delete to maintain analytics history
        await this.db.content.update({
          where: { id: contentId },
          data: {
            status: ContentStatus.ARCHIVED,
            updatedAt: new Date()
          }
        });
      } else {
        // Safe to delete if never published
        await this.db.content.delete({
          where: { id: contentId }
        });
      }

      return { success: true };
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      console.error("Failed to delete content:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to delete content"
      });
    }
  }

  /**
   * Duplicate content
   */
  async duplicateContent(contentId: string, userId: string) {
    try {
      const originalContent = await this.getContentById(contentId, userId);

      const duplicatedContent = await this.db.content.create({
        data: {
          workspaceId: originalContent.workspaceId,
          createdById: userId,
          title: `${originalContent.title} (Copy)`,
          rawContent: originalContent.rawContent,
          aiEnhancedContent: originalContent.aiEnhancedContent,
          type: originalContent.type,
          mediaAssets: originalContent.mediaAssets,
          status: ContentStatus.DRAFT,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true
            }
          },
          workspace: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      return duplicatedContent;
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      console.error("Failed to duplicate content:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to duplicate content"
      });
    }
  }

  /**
   * Auto-save draft content
   */
  async autoSaveDraft(
    contentId: string,
    userId: string,
    updates: Partial<ContentInput>
  ) {
    try {
      // Only update if content exists and user has access
      const existingContent = await this.db.content.findFirst({
        where: {
          id: contentId,
          workspace: {
            members: {
              some: {
                userId
              }
            }
          }
        }
      });

      if (!existingContent) {
        return null; // Silently fail for auto-save
      }

      const updatedContent = await this.db.content.update({
        where: { id: contentId },
        data: {
          ...updates,
          updatedAt: new Date()
        }
      });

      return updatedContent;
    } catch (error) {
      console.error("Failed to auto-save content:", error);
      return null; // Silently fail for auto-save
    }
  }

  /**
   * Get content statistics for workspace
   */
  async getContentStats(workspaceId: string, userId: string) {
    try {
      // Verify user has access to workspace
      const member = await this.db.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId,
            workspaceId
          }
        }
      });

      if (!member) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Access denied to workspace"
        });
      }

      const [
        totalContent,
        draftContent,
        publishedContent,
        contentByType
      ] = await Promise.all([
        this.db.content.count({
          where: { workspaceId, status: { not: ContentStatus.ARCHIVED } }
        }),
        this.db.content.count({
          where: { workspaceId, status: ContentStatus.DRAFT }
        }),
        this.db.content.count({
          where: { workspaceId, status: ContentStatus.PUBLISHED }
        }),
        this.db.content.groupBy({
          by: ['type'],
          where: { workspaceId, status: { not: ContentStatus.ARCHIVED } },
          _count: true
        })
      ]);

      return {
        total: totalContent,
        draft: draftContent,
        published: publishedContent,
        byType: contentByType.reduce((acc, item) => {
          acc[item.type] = item._count;
          return acc;
        }, {} as Record<string, number>)
      };
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      console.error("Failed to get content stats:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to retrieve content statistics"
      });
    }
  }

  /**
   * Validate content input
   */
  private validateContentInput(input: ContentInput): void {
    if (!input.title?.trim()) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Content title is required"
      });
    }

    if (input.title.length > 200) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Content title must be less than 200 characters"
      });
    }

    if (!input.rawContent?.trim()) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Content body is required"
      });
    }

    if (input.rawContent.length > 10000) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Content body must be less than 10,000 characters"
      });
    }

    // Validate media assets
    if (input.mediaAssets) {
      for (const asset of input.mediaAssets) {
        if (!asset.url || !asset.filename || !asset.mimeType) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid media asset data"
          });
        }

        // Check file size limits (10MB for images, 100MB for videos)
        const maxSize = asset.type === 'image' ? 10 * 1024 * 1024 : 100 * 1024 * 1024;
        if (asset.size > maxSize) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `File size too large. Maximum ${asset.type === 'image' ? '10MB' : '100MB'} allowed.`
          });
        }
      }
    }
  }
}