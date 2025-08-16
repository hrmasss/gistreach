import { TRPCError } from "@trpc/server";
import { type PrismaClient } from "@prisma/client";
import { CredentialManager } from "@/lib/encryption";

export interface SocialCredentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string[];
  platformAccountId: string;
  displayName: string;
  permissions: string[];
  platformMetadata: Record<string, any>;
}

export interface StoredCredentials {
  id: string;
  workspaceId: string;
  platform: string;
  accountType: string;
  platformAccountId: string;
  displayName: string;
  isActive: boolean;
  tokenExpiresAt?: Date;
  permissions: string[];
  platformMetadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export class CredentialService {
  constructor(private db: PrismaClient) { }

  /**
   * Store encrypted social media credentials
   */
  async storeCredentials(
    workspaceId: string,
    platform: string,
    accountType: string,
    credentials: SocialCredentials
  ): Promise<StoredCredentials> {
    try {
      // Encrypt the credentials
      const encryptedData = CredentialManager.encryptCredentials({
        accessToken: credentials.accessToken,
        refreshToken: credentials.refreshToken,
        expiresAt: credentials.expiresAt,
        scope: credentials.scope,
      });

      // Check if account already exists
      const existingAccount = await this.db.socialAccount.findUnique({
        where: {
          workspaceId_platform_platformAccountId: {
            workspaceId,
            platform,
            platformAccountId: credentials.platformAccountId,
          },
        },
      });

      let socialAccount;

      if (existingAccount) {
        // Update existing account
        socialAccount = await this.db.socialAccount.update({
          where: { id: existingAccount.id },
          data: {
            displayName: credentials.displayName,
            encryptedAccessToken: encryptedData.encryptedAccessToken,
            encryptedRefreshToken: encryptedData.encryptedRefreshToken,
            tokenExpiresAt: credentials.expiresAt,
            isActive: true,
            permissions: credentials.permissions,
            platformMetadata: credentials.platformMetadata,
            updatedAt: new Date(),
          },
        });
      } else {
        // Create new account
        socialAccount = await this.db.socialAccount.create({
          data: {
            workspaceId,
            platform,
            accountType,
            platformAccountId: credentials.platformAccountId,
            displayName: credentials.displayName,
            encryptedAccessToken: encryptedData.encryptedAccessToken,
            encryptedRefreshToken: encryptedData.encryptedRefreshToken,
            tokenExpiresAt: credentials.expiresAt,
            isActive: true,
            permissions: credentials.permissions,
            platformMetadata: credentials.platformMetadata,
          },
        });
      }

      // Log the credential storage for audit purposes
      await this.logCredentialAccess(socialAccount.id, "STORED", "Credentials stored successfully");

      return this.mapToStoredCredentials(socialAccount);
    } catch (error) {
      console.error("Failed to store credentials:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to store credentials securely",
      });
    }
  }

  /**
   * Retrieve and decrypt social media credentials
   */
  async getCredentials(accountId: string): Promise<SocialCredentials | null> {
    try {
      const socialAccount = await this.db.socialAccount.findUnique({
        where: { id: accountId },
      });

      if (!socialAccount || !socialAccount.isActive) {
        return null;
      }

      // Check if token is expired
      if (socialAccount.tokenExpiresAt && socialAccount.tokenExpiresAt < new Date()) {
        await this.logCredentialAccess(accountId, "EXPIRED", "Token expired");
        return null;
      }

      // Decrypt the credentials
      const decryptedData = CredentialManager.decryptCredentials({
        encryptedAccessToken: socialAccount.encryptedAccessToken,
        encryptedRefreshToken: socialAccount.encryptedRefreshToken || undefined,
      });

      // Log the credential access for audit purposes
      await this.logCredentialAccess(accountId, "ACCESSED", "Credentials accessed for API call");

      return {
        accessToken: decryptedData.accessToken,
        refreshToken: decryptedData.refreshToken,
        expiresAt: socialAccount.tokenExpiresAt || undefined,
        scope: decryptedData.scope,
        platformAccountId: socialAccount.platformAccountId,
        displayName: socialAccount.displayName,
        permissions: socialAccount.permissions as string[],
        platformMetadata: socialAccount.platformMetadata as Record<string, any>,
      };
    } catch (error) {
      console.error("Failed to retrieve credentials:", error);
      await this.logCredentialAccess(accountId, "ERROR", `Failed to retrieve credentials: ${error}`);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to retrieve credentials",
      });
    }
  }

  /**
   * Update stored credentials (e.g., after token refresh)
   */
  async updateCredentials(
    accountId: string,
    updates: Partial<SocialCredentials>
  ): Promise<StoredCredentials> {
    try {
      const socialAccount = await this.db.socialAccount.findUnique({
        where: { id: accountId },
      });

      if (!socialAccount) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Social account not found",
        });
      }

      // Prepare update data
      const updateData: any = {
        updatedAt: new Date(),
      };

      // If updating tokens, encrypt them
      if (updates.accessToken || updates.refreshToken) {
        const currentCredentials = await this.getCredentials(accountId);
        const encryptedData = CredentialManager.encryptCredentials({
          accessToken: updates.accessToken || currentCredentials?.accessToken || "",
          refreshToken: updates.refreshToken || currentCredentials?.refreshToken,
          expiresAt: updates.expiresAt || currentCredentials?.expiresAt,
          scope: updates.scope || currentCredentials?.scope,
        });

        updateData.encryptedAccessToken = encryptedData.encryptedAccessToken;
        if (encryptedData.encryptedRefreshToken) {
          updateData.encryptedRefreshToken = encryptedData.encryptedRefreshToken;
        }
      }

      // Update other fields
      if (updates.expiresAt !== undefined) {
        updateData.tokenExpiresAt = updates.expiresAt;
      }
      if (updates.displayName !== undefined) {
        updateData.displayName = updates.displayName;
      }
      if (updates.permissions !== undefined) {
        updateData.permissions = updates.permissions;
      }
      if (updates.platformMetadata !== undefined) {
        updateData.platformMetadata = updates.platformMetadata;
      }

      const updatedAccount = await this.db.socialAccount.update({
        where: { id: accountId },
        data: updateData,
      });

      await this.logCredentialAccess(accountId, "UPDATED", "Credentials updated successfully");

      return this.mapToStoredCredentials(updatedAccount);
    } catch (error) {
      console.error("Failed to update credentials:", error);
      await this.logCredentialAccess(accountId, "ERROR", `Failed to update credentials: ${error}`);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to update credentials",
      });
    }
  }

  /**
   * Revoke and delete stored credentials
   */
  async revokeCredentials(accountId: string): Promise<void> {
    try {
      const socialAccount = await this.db.socialAccount.findUnique({
        where: { id: accountId },
      });

      if (!socialAccount) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Social account not found",
        });
      }

      // Mark as inactive first
      await this.db.socialAccount.update({
        where: { id: accountId },
        data: {
          isActive: false,
          updatedAt: new Date(),
        },
      });

      await this.logCredentialAccess(accountId, "REVOKED", "Credentials revoked and deactivated");

      // TODO: Call platform APIs to revoke tokens if needed
      // This would be implemented in the specific platform services
    } catch (error) {
      console.error("Failed to revoke credentials:", error);
      await this.logCredentialAccess(accountId, "ERROR", `Failed to revoke credentials: ${error}`);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to revoke credentials",
      });
    }
  }

  /**
   * Get all social accounts for a workspace
   */
  async getWorkspaceAccounts(workspaceId: string): Promise<StoredCredentials[]> {
    try {
      const socialAccounts = await this.db.socialAccount.findMany({
        where: {
          workspaceId,
          isActive: true,
        },
        orderBy: { createdAt: "desc" },
      });

      return socialAccounts.map(account => this.mapToStoredCredentials(account));
    } catch (error) {
      console.error("Failed to get workspace accounts:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to retrieve workspace accounts",
      });
    }
  }

  /**
   * Check if credentials need refresh
   */
  async needsRefresh(accountId: string): Promise<boolean> {
    try {
      const socialAccount = await this.db.socialAccount.findUnique({
        where: { id: accountId },
        select: { tokenExpiresAt: true, isActive: true },
      });

      if (!socialAccount || !socialAccount.isActive) {
        return false;
      }

      if (!socialAccount.tokenExpiresAt) {
        return false; // No expiration set
      }

      // Check if token expires within the next 5 minutes
      const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
      return socialAccount.tokenExpiresAt <= fiveMinutesFromNow;
    } catch (error) {
      console.error("Failed to check refresh status:", error);
      return true; // Err on the side of caution
    }
  }

  /**
   * Clean up expired credentials
   */
  async cleanupExpiredCredentials(): Promise<number> {
    try {
      const result = await this.db.socialAccount.updateMany({
        where: {
          tokenExpiresAt: {
            lt: new Date(),
          },
          isActive: true,
        },
        data: {
          isActive: false,
          updatedAt: new Date(),
        },
      });

      console.log(`Cleaned up ${result.count} expired credentials`);
      return result.count;
    } catch (error) {
      console.error("Failed to cleanup expired credentials:", error);
      return 0;
    }
  }

  /**
   * Log credential access for audit purposes
   */
  private async logCredentialAccess(
    accountId: string,
    action: "STORED" | "ACCESSED" | "UPDATED" | "REVOKED" | "EXPIRED" | "ERROR",
    details: string
  ): Promise<void> {
    try {
      // In a production system, you might want to store this in a separate audit log table
      console.log(`[CREDENTIAL_AUDIT] ${new Date().toISOString()} - Account: ${accountId}, Action: ${action}, Details: ${details}`);

      // TODO: Implement proper audit logging to database
      // await this.db.credentialAuditLog.create({
      //   data: {
      //     accountId,
      //     action,
      //     details,
      //     timestamp: new Date(),
      //   },
      // });
    } catch (error) {
      console.error("Failed to log credential access:", error);
      // Don't throw here as this is just logging
    }
  }

  /**
   * Map database record to StoredCredentials interface
   */
  private mapToStoredCredentials(account: any): StoredCredentials {
    return {
      id: account.id,
      workspaceId: account.workspaceId,
      platform: account.platform,
      accountType: account.accountType,
      platformAccountId: account.platformAccountId,
      displayName: account.displayName,
      isActive: account.isActive,
      tokenExpiresAt: account.tokenExpiresAt,
      permissions: account.permissions as string[],
      platformMetadata: account.platformMetadata as Record<string, any>,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }
}