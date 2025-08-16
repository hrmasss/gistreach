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
import { OAuthStateManager, OAuthSessionStore } from "./oauth-state-manager";

interface XTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type: string;
}

interface XUserInfo {
  data: {
    id: string;
    name: string;
    username: string;
    profile_image_url?: string;
    public_metrics?: {
      followers_count: number;
      following_count: number;
      tweet_count: number;
      listed_count: number;
    };
  };
}

export class XAuthProvider extends SocialAuthProvider {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly apiVersion = "2";
  private readonly baseUrl = "https://api.twitter.com";

  constructor(db: PrismaClient) {
    super(db, SocialPlatform.X);

    this.clientId = process.env.TWITTER_CLIENT_ID!;
    this.clientSecret = process.env.TWITTER_CLIENT_SECRET!;

    if (!this.clientId || !this.clientSecret) {
      throw new Error("X (Twitter) OAuth credentials not configured");
    }
  }

  async initiateAuth(
    workspaceId: string,
    accountType: AccountType,
    redirectUri: string
  ): Promise<AuthUrl> {
    const state = OAuthStateManager.generateState(workspaceId, this.platform, accountType);
    const codeVerifier = OAuthStateManager.generateCodeVerifier();
    const codeChallenge = OAuthStateManager.generateCodeChallenge(codeVerifier);

    // Store code verifier for later use
    OAuthSessionStore.set(`pkce:${state}`, { codeVerifier });

    const scopes = this.getRequiredScopes();

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: redirectUri,
      scope: scopes.join(' '),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    const url = `https://twitter.com/i/oauth2/authorize?${params.toString()}`;

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

    // Get stored code verifier
    const pkceData = OAuthSessionStore.get(`pkce:${state}`);
    if (!pkceData?.codeVerifier) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "PKCE code verifier not found"
      });
    }

    try {
      // Exchange code for access token
      const tokens = await this.exchangeCodeForTokens(code, redirectUri, pkceData.codeVerifier);

      // Get account information
      const account = await this.getAccountInfo(tokens.accessToken);

      // Store credentials
      await this.storeCredentials(stateResult.data.workspaceId, account, tokens);

      return { account, tokens };
    } catch (error) {
      this.handleOAuthError(error, "X OAuth callback");
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
      });

      const authHeader = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

      const response = await fetch(`${this.baseUrl}/${this.apiVersion}/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${authHeader}`,
        },
        body: params.toString(),
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.statusText}`);
      }

      const tokenData: XTokenResponse = await response.json();

      const tokens: OAuthTokens = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        scope: tokenData.scope?.split(' '),
      };

      // Update stored credentials
      await this.updateStoredCredentials(accountId, {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresIn ? new Date(Date.now() + tokens.expiresIn * 1000) : undefined,
        scope: tokens.scope,
      });

      return tokens;
    } catch (error) {
      this.handleOAuthError(error, "X token refresh");
    }
  }

  async revokeAccess(accountId: string): Promise<void> {
    const credentials = await this.getStoredCredentials(accountId);
    if (!credentials) {
      return; // Already revoked or doesn't exist
    }

    try {
      const params = new URLSearchParams({
        token: credentials.accessToken,
        client_id: this.clientId,
      });

      const authHeader = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

      const response = await fetch(`${this.baseUrl}/${this.apiVersion}/oauth2/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${authHeader}`,
        },
        body: params.toString(),
      });

      if (!response.ok) {
        console.warn(`Failed to revoke X token: ${response.statusText}`);
      }

      // Mark credentials as revoked in our system
      await this.credentialService.revokeCredentials(accountId);
    } catch (error) {
      console.error("Error revoking X access:", error);
      // Still mark as revoked in our system even if API call fails
      await this.credentialService.revokeCredentials(accountId);
    }
  }

  async getAccountInfo(accessToken: string): Promise<PlatformAccount> {
    try {
      const params = new URLSearchParams({
        'user.fields': 'id,name,username,profile_image_url,public_metrics',
      });

      const response = await fetch(`${this.baseUrl}/${this.apiVersion}/users/me?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get user info: ${response.statusText}`);
      }

      const userInfo: XUserInfo = await response.json();
      const user = userInfo.data;

      return {
        id: user.id,
        name: user.name,
        username: user.username,
        profilePicture: user.profile_image_url,
        accountType: AccountType.PERSONAL,
        permissions: this.getRequiredScopes(), // X doesn't provide granular permission info
        metadata: {
          platform: 'x',
          username: user.username,
          publicMetrics: user.public_metrics,
          apiVersion: this.apiVersion,
        }
      };
    } catch (error) {
      this.handleOAuthError(error, "get X account info");
    }
  }

  validatePermissions(permissions: string[]): boolean {
    const requiredScopes = this.getRequiredScopes();
    return requiredScopes.every(scope => permissions.includes(scope));
  }

  getRequiredScopes(): string[] {
    return [
      'tweet.read',
      'tweet.write',
      'users.read',
      'offline.access' // For refresh tokens
    ];
  }

  private async exchangeCodeForTokens(code: string, redirectUri: string, codeVerifier: string): Promise<OAuthTokens> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.clientId,
      redirect_uri: redirectUri,
      code,
      code_verifier: codeVerifier,
    });

    const authHeader = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const response = await fetch(`${this.baseUrl}/${this.apiVersion}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${authHeader}`,
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${response.statusText} - ${errorText}`);
    }

    const tokenData: XTokenResponse = await response.json();

    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
      scope: tokenData.scope?.split(' '),
    };
  }
}