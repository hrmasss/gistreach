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

interface LinkedInTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope: string;
}

interface LinkedInUserInfo {
  sub: string;
  name: string;
  given_name: string;
  family_name: string;
  picture?: string;
  email?: string;
  email_verified?: boolean;
  locale?: {
    country: string;
    language: string;
  };
}

interface LinkedInOrganization {
  id: string;
  name: string;
  vanityName?: string;
  logoV2?: {
    original?: string;
  };
  organizationType: string;
}

export class LinkedInAuthProvider extends SocialAuthProvider {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly apiVersion = "v2";
  private readonly baseUrl = "https://api.linkedin.com";

  constructor(db: PrismaClient) {
    super(db, SocialPlatform.LINKEDIN);

    this.clientId = process.env.LINKEDIN_CLIENT_ID!;
    this.clientSecret = process.env.LINKEDIN_CLIENT_SECRET!;

    if (!this.clientId || !this.clientSecret) {
      throw new Error("LinkedIn OAuth credentials not configured");
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
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: redirectUri,
      state,
      scope: scopes.join(' '),
    });

    const url = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;

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

      // If requesting organization access, get organizations
      if (stateResult.data.accountType === AccountType.BUSINESS) {
        const organizations = await this.getUserOrganizations(tokens.accessToken);
        account.metadata.availableOrganizations = organizations;
      }

      // Store credentials
      await this.storeCredentials(stateResult.data.workspaceId, account, tokens);

      return { account, tokens };
    } catch (error) {
      this.handleOAuthError(error, "LinkedIn OAuth callback");
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

      const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.statusText}`);
      }

      const tokenData: LinkedInTokenResponse = await response.json();

      const tokens: OAuthTokens = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        scope: tokenData.scope.split(' '),
      };

      // Update stored credentials
      await this.updateStoredCredentials(accountId, {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        scope: tokens.scope,
      });

      return tokens;
    } catch (error) {
      this.handleOAuthError(error, "LinkedIn token refresh");
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
        client_secret: this.clientSecret,
      });

      const response = await fetch('https://www.linkedin.com/oauth/v2/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        console.warn(`Failed to revoke LinkedIn token: ${response.statusText}`);
      }

      // Mark credentials as revoked in our system
      await this.credentialService.revokeCredentials(accountId);
    } catch (error) {
      console.error("Error revoking LinkedIn access:", error);
      // Still mark as revoked in our system even if API call fails
      await this.credentialService.revokeCredentials(accountId);
    }
  }

  async getAccountInfo(accessToken: string): Promise<PlatformAccount> {
    try {
      // Get user profile using OpenID Connect userinfo endpoint
      const response = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get user info: ${response.statusText}`);
      }

      const userInfo: LinkedInUserInfo = await response.json();

      return {
        id: userInfo.sub,
        name: userInfo.name,
        email: userInfo.email,
        profilePicture: userInfo.picture,
        accountType: AccountType.PERSONAL,
        permissions: this.getRequiredScopes(), // LinkedIn doesn't provide granular permission info
        metadata: {
          platform: 'linkedin',
          givenName: userInfo.given_name,
          familyName: userInfo.family_name,
          locale: userInfo.locale,
          emailVerified: userInfo.email_verified,
          apiVersion: this.apiVersion,
        }
      };
    } catch (error) {
      this.handleOAuthError(error, "get LinkedIn account info");
    }
  }

  validatePermissions(permissions: string[]): boolean {
    const requiredScopes = this.getRequiredScopes();
    return requiredScopes.every(scope => permissions.includes(scope));
  }

  getRequiredScopes(): string[] {
    return [
      'openid',
      'profile',
      'email',
      'w_member_social', // Post on behalf of user
      'r_organization_social', // Read organization posts
      'w_organization_social', // Post on behalf of organization
    ];
  }

  private async exchangeCodeForTokens(code: string, redirectUri: string): Promise<OAuthTokens> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: redirectUri,
    });

    const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${response.statusText} - ${errorText}`);
    }

    const tokenData: LinkedInTokenResponse = await response.json();

    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
      scope: tokenData.scope.split(' '),
    };
  }

  private async getUserOrganizations(accessToken: string): Promise<LinkedInOrganization[]> {
    try {
      // Get organizations the user can manage
      const response = await fetch(`${this.baseUrl}/${this.apiVersion}/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&projection=(elements*(organization~(id,name,vanityName,logoV2)))`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        console.warn(`Failed to get LinkedIn organizations: ${response.statusText}`);
        return [];
      }

      const data = await response.json();

      return data.elements?.map((element: any) => ({
        id: element.organization?.id,
        name: element.organization?.name,
        vanityName: element.organization?.vanityName,
        logoV2: element.organization?.logoV2,
        organizationType: 'company',
      })) || [];
    } catch (error) {
      console.error("Error getting LinkedIn organizations:", error);
      return [];
    }
  }
}