import { TRPCError } from "@trpc/server";
import { type PrismaClient } from "@prisma/client";
import { CredentialService, type SocialCredentials } from "@/server/services/credential";

export enum SocialPlatform {
  FACEBOOK = "facebook",
  X = "x",
  LINKEDIN = "linkedin"
}

export enum AccountType {
  PERSONAL = "personal",
  BUSINESS = "business",
  PAGE = "page"
}

export interface AuthUrl {
  url: string;
  state: string;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  scope?: string[];
}

export interface PlatformAccount {
  id: string;
  name: string;
  username?: string;
  email?: string;
  profilePicture?: string;
  accountType: AccountType;
  permissions: string[];
  metadata: Record<string, any>;
}

export interface AuthCallbackResult {
  account: PlatformAccount;
  tokens: OAuthTokens;
}

/**
 * Abstract base class for social media OAuth providers
 */
export abstract class SocialAuthProvider {
  protected credentialService: CredentialService;

  constructor(
    protected db: PrismaClient,
    protected platform: SocialPlatform
  ) {
    this.credentialService = new CredentialService(db);
  }

  /**
   * Get the platform this provider handles
   */
  getPlatform(): SocialPlatform {
    return this.platform;
  }

  /**
   * Initiate OAuth flow and return authorization URL
   */
  abstract initiateAuth(
    workspaceId: string,
    accountType: AccountType,
    redirectUri: string
  ): Promise<AuthUrl>;

  /**
   * Handle OAuth callback and exchange code for tokens
   */
  abstract handleCallback(
    code: string,
    state: string,
    redirectUri: string
  ): Promise<AuthCallbackResult>;

  /**
   * Refresh access token using refresh token
   */
  abstract refreshToken(accountId: string): Promise<OAuthTokens>;

  /**
   * Revoke access token and permissions
   */
  abstract revokeAccess(accountId: string): Promise<void>;

  /**
   * Get account information from the platform
   */
  abstract getAccountInfo(accessToken: string): Promise<PlatformAccount>;

  /**
   * Validate that the required permissions are granted
   */
  abstract validatePermissions(permissions: string[]): boolean;

  /**
   * Get the required scopes/permissions for this platform
   */
  abstract getRequiredScopes(): string[];

  /**
   * Store credentials after successful authentication
   */
  protected async storeCredentials(
    workspaceId: string,
    account: PlatformAccount,
    tokens: OAuthTokens
  ): Promise<void> {
    const expiresAt = tokens.expiresIn
      ? new Date(Date.now() + tokens.expiresIn * 1000)
      : undefined;

    const credentials: SocialCredentials = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt,
      scope: tokens.scope,
      platformAccountId: account.id,
      displayName: account.name,
      permissions: account.permissions,
      platformMetadata: account.metadata
    };

    await this.credentialService.storeCredentials(
      workspaceId,
      this.platform,
      account.accountType,
      credentials
    );
  }

  /**
   * Get stored credentials for an account
   */
  protected async getStoredCredentials(accountId: string): Promise<SocialCredentials | null> {
    return this.credentialService.getCredentials(accountId);
  }

  /**
   * Update stored credentials (e.g., after token refresh)
   */
  protected async updateStoredCredentials(
    accountId: string,
    updates: Partial<SocialCredentials>
  ): Promise<void> {
    await this.credentialService.updateCredentials(accountId, updates);
  }

  /**
   * Generate OAuth state parameter with workspace and platform info
   */
  protected generateState(workspaceId: string, accountType: AccountType): string {
    const crypto = require('crypto');
    const timestamp = Date.now().toString();
    const randomBytes = crypto.randomBytes(16).toString('hex');
    const data = `${workspaceId}:${this.platform}:${accountType}:${timestamp}:${randomBytes}`;
    return Buffer.from(data).toString('base64url');
  }

  /**
   * Parse and validate OAuth state parameter
   */
  protected parseState(state: string): {
    workspaceId: string;
    platform: SocialPlatform;
    accountType: AccountType;
    timestamp: number;
    isValid: boolean;
  } {
    try {
      const decoded = Buffer.from(state, 'base64url').toString();
      const [workspaceId, platform, accountType, timestampStr, randomBytes] = decoded.split(':');

      if (!workspaceId || !platform || !accountType || !timestampStr || !randomBytes) {
        return { workspaceId: '', platform: this.platform, accountType: AccountType.PERSONAL, timestamp: 0, isValid: false };
      }

      const timestamp = parseInt(timestampStr, 10);
      const now = Date.now();
      const maxAge = 10 * 60 * 1000; // 10 minutes

      // Check if state is not too old and platform matches
      const isValid = (now - timestamp) <= maxAge && platform === this.platform;

      return {
        workspaceId,
        platform: platform as SocialPlatform,
        accountType: accountType as AccountType,
        timestamp,
        isValid
      };
    } catch (error) {
      console.error("Failed to parse OAuth state:", error);
      return { workspaceId: '', platform: this.platform, accountType: AccountType.PERSONAL, timestamp: 0, isValid: false };
    }
  }

  /**
   * Handle common OAuth errors
   */
  protected handleOAuthError(error: any, context: string): never {
    console.error(`OAuth error in ${context}:`, error);

    if (error.response?.status === 401) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Authentication failed. Please try connecting your account again."
      });
    }

    if (error.response?.status === 403) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Insufficient permissions. Please grant the required permissions."
      });
    }

    if (error.response?.status === 429) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Rate limit exceeded. Please try again later."
      });
    }

    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to ${context}. Please try again.`
    });
  }
}