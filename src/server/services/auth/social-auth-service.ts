import { type PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { SocialAuthProvider, SocialPlatform, AccountType } from "./base-auth-provider";
import { FacebookAuthProvider } from "./facebook-auth-provider";
import { XAuthProvider } from "./x-auth-provider";
import { LinkedInAuthProvider } from "./linkedin-auth-provider";

export class SocialAuthService {
  private providers: Map<SocialPlatform, SocialAuthProvider> = new Map();

  constructor(private db: PrismaClient) {
    // Initialize providers
    this.providers.set(SocialPlatform.FACEBOOK, new FacebookAuthProvider(db));
    this.providers.set(SocialPlatform.X, new XAuthProvider(db));
    this.providers.set(SocialPlatform.LINKEDIN, new LinkedInAuthProvider(db));
  }

  /**
   * Get a provider for a specific platform
   */
  getProvider(platform: SocialPlatform): SocialAuthProvider {
    const provider = this.providers.get(platform);
    if (!provider) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Unsupported platform: ${platform}`
      });
    }
    return provider;
  }

  /**
   * Get all available platforms
   */
  getAvailablePlatforms(): SocialPlatform[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Initiate OAuth flow for a platform
   */
  async initiateAuth(
    platform: SocialPlatform,
    workspaceId: string,
    accountType: AccountType,
    redirectUri: string
  ) {
    const provider = this.getProvider(platform);
    return provider.initiateAuth(workspaceId, accountType, redirectUri);
  }

  /**
   * Handle OAuth callback for a platform
   */
  async handleCallback(
    platform: SocialPlatform,
    code: string,
    state: string,
    redirectUri: string
  ) {
    const provider = this.getProvider(platform);
    return provider.handleCallback(code, state, redirectUri);
  }

  /**
   * Refresh token for an account
   */
  async refreshToken(platform: SocialPlatform, accountId: string) {
    const provider = this.getProvider(platform);
    return provider.refreshToken(accountId);
  }

  /**
   * Revoke access for an account
   */
  async revokeAccess(platform: SocialPlatform, accountId: string) {
    const provider = this.getProvider(platform);
    return provider.revokeAccess(accountId);
  }

  /**
   * Get account info from platform
   */
  async getAccountInfo(platform: SocialPlatform, accessToken: string) {
    const provider = this.getProvider(platform);
    return provider.getAccountInfo(accessToken);
  }

  /**
   * Get required scopes for a platform
   */
  getRequiredScopes(platform: SocialPlatform): string[] {
    const provider = this.getProvider(platform);
    return provider.getRequiredScopes();
  }
}