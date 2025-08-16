import { type PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import {
  SocialAuthProvider,
  SocialPlatform,
  AccountType,
  type AuthUrl,
  type OAuthTokens,
  type PlatformAccount,
  type AuthCallbackResult
} from "./base-auth-provider";
import { OAuthStateManager } from "./oauth-state-manager";

interface FacebookTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

interface FacebookUserInfo {
  id: string;
  name: string;
  email?: string;
  picture?: {
    data: {
      url: string;
    };
  };
}

interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
  category: string;
  tasks: string[];
}

export class FacebookAuthProvider extends SocialAuthProvider {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly apiVersion = "v19.0";
  private readonly baseUrl = "https://graph.facebook.com";

  constructor(db: PrismaClient) {
    super(db, SocialPlatform.FACEBOOK);

    this.clientId = process.env.FACEBOOK_APP_ID!;
    this.clientSecret = process.env.FACEBOOK_APP_SECRET!;

    if (!this.clientId || !this.clientSecret) {
      throw new Error("Facebook OAuth credentials not configured");
    }
  }

  async initiateAuth(
    workspaceId: string,
    accountType: AccountType,
    redirectUri: string
  ): Promise<AuthUrl> {
    const state = OAuthStateManager.generateState(workspaceId, this.platform, accountType);
    const scopes = this.getRequiredScopes();

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      scope: scopes.join(','),
      response_type: 'code',
      state,
    });

    const url = `https://www.facebook.com/${this.apiVersion}/dialog/oauth?${params.toString()}`;

    return { url, state };
  }

  async handleCallback(
    code: string,
    state: string,
    redirectUri: string
  ): Promise<AuthCallbackResult> {
    // Validate state
    const stateResult = OAuthStateManager.parseState(state);
    if (!stateResult.isValid || !stateResult.data) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid or expired OAuth state"
      });
    }

    try {
      // Exchange code for access token
      const tokens = await this.exchangeCodeForTokens(code, redirectUri);

      // Get account information
      const account = await this.getAccountInfo(tokens.accessToken);

      // If requesting page access, get page tokens
      if (stateResult.data.accountType === AccountType.PAGE) {
        const pages = await this.getUserPages(tokens.accessToken);
        // For now, we'll handle page selection in the UI
        // Store the available pages in metadata
        account.metadata.availablePages = pages;
      }

      // Store credentials
      await this.storeCredentials(stateResult.data.workspaceId, account, tokens);

      return { account, tokens };
    } catch (error) {
      this.handleOAuthError(error, "Facebook OAuth callback");
    }
  }

  async refreshToken(accountId: string): Promise<OAuthTokens> {
    const credentials = await this.getStoredCredentials(accountId);
    if (!credentials || !credentials.refreshToken) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No refresh token available"
      });
    }

    try {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: credentials.refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      });

      const response = await fetch(`${this.baseUrl}/oauth/access_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.statusText}`);
      }

      const tokenData: FacebookTokenResponse = await response.json();

      const tokens: OAuthTokens = {
        accessToken: tokenData.access_token,
        expiresIn: tokenData.expires_in,
      };

      // Update stored credentials
      await this.updateStoredCredentials(accountId, {
        accessToken: tokens.accessToken,
        expiresAt: tokens.expiresIn ? new Date(Date.now() + tokens.expiresIn * 1000) : undefined,
      });

      return tokens;
    } catch (error) {
      this.handleOAuthError(error, "Facebook token refresh");
    }
  }

  async revokeAccess(accountId: string): Promise<void> {
    const credentials = await this.getStoredCredentials(accountId);
    if (!credentials) {
      return; // Already revoked or doesn't exist
    }

    try {
      // Revoke the access token
      const params = new URLSearchParams({
        access_token: credentials.accessToken,
      });

      const response = await fetch(`${this.baseUrl}/${this.apiVersion}/me/permissions`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        console.warn(`Failed to revoke Facebook token: ${response.statusText}`);
      }

      // Mark credentials as revoked in our system
      await this.credentialService.revokeCredentials(accountId);
    } catch (error) {
      console.error("Error revoking Facebook access:", error);
      // Still mark as revoked in our system even if API call fails
      await this.credentialService.revokeCredentials(accountId);
    }
  }

  async getAccountInfo(accessToken: string): Promise<PlatformAccount> {
    try {
      const params = new URLSearchParams({
        fields: 'id,name,email,picture',
        access_token: accessToken,
      });

      const response = await fetch(`${this.baseUrl}/${this.apiVersion}/me?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Failed to get user info: ${response.statusText}`);
      }

      const userInfo: FacebookUserInfo = await response.json();

      // Get user permissions
      const permissions = await this.getUserPermissions(accessToken);

      return {
        id: userInfo.id,
        name: userInfo.name,
        email: userInfo.email,
        profilePicture: userInfo.picture?.data?.url,
        accountType: AccountType.PERSONAL,
        permissions,
        metadata: {
          platform: 'facebook',
          apiVersion: this.apiVersion,
        }
      };
    } catch (error) {
      this.handleOAuthError(error, "get Facebook account info");
    }
  }

  validatePermissions(permissions: string[]): boolean {
    const requiredScopes = this.getRequiredScopes();
    return requiredScopes.every(scope => permissions.includes(scope));
  }

  getRequiredScopes(): string[] {
    return [
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_posts',
      'publish_to_groups',
      'read_insights'
    ];
  }

  private async exchangeCodeForTokens(code: string, redirectUri: string): Promise<OAuthTokens> {
    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: redirectUri,
      code,
    });

    const response = await fetch(`${this.baseUrl}/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.statusText}`);
    }

    const tokenData: FacebookTokenResponse = await response.json();

    return {
      accessToken: tokenData.access_token,
      expiresIn: tokenData.expires_in,
    };
  }

  private async getUserPermissions(accessToken: string): Promise<string[]> {
    try {
      const params = new URLSearchParams({
        access_token: accessToken,
      });

      const response = await fetch(`${this.baseUrl}/${this.apiVersion}/me/permissions?${params.toString()}`);

      if (!response.ok) {
        console.warn(`Failed to get Facebook permissions: ${response.statusText}`);
        return [];
      }

      const data = await response.json();
      return data.data
        .filter((perm: any) => perm.status === 'granted')
        .map((perm: any) => perm.permission);
    } catch (error) {
      console.error("Error getting Facebook permissions:", error);
      return [];
    }
  }

  private async getUserPages(accessToken: string): Promise<FacebookPage[]> {
    try {
      const params = new URLSearchParams({
        fields: 'id,name,access_token,category,tasks',
        access_token: accessToken,
      });

      const response = await fetch(`${this.baseUrl}/${this.apiVersion}/me/accounts?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Failed to get user pages: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error("Error getting Facebook pages:", error);
      return [];
    }
  }
}