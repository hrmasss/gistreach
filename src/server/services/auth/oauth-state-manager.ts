import crypto from "crypto";
import { SocialPlatform, AccountType } from "./base-auth-provider";

export interface OAuthState {
  workspaceId: string;
  platform: SocialPlatform;
  accountType: AccountType;
  timestamp: number;
  nonce: string;
}

export class OAuthStateManager {
  private static readonly STATE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

  /**
   * Generate a secure OAuth state parameter
   */
  static generateState(
    workspaceId: string,
    platform: SocialPlatform,
    accountType: AccountType
  ): string {
    const timestamp = Date.now();
    const nonce = crypto.randomBytes(16).toString('hex');

    const stateData: OAuthState = {
      workspaceId,
      platform,
      accountType,
      timestamp,
      nonce
    };

    // Encrypt the state data
    const stateJson = JSON.stringify(stateData);
    const cipher = crypto.createCipher('aes-256-cbc', this.getStateSecret());
    let encrypted = cipher.update(stateJson, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return Buffer.from(encrypted, 'hex').toString('base64url');
  }

  /**
   * Parse and validate OAuth state parameter
   */
  static parseState(state: string): {
    data: OAuthState | null;
    isValid: boolean;
    error?: string;
  } {
    try {
      // Decrypt the state data
      const encrypted = Buffer.from(state, 'base64url').toString('hex');
      const decipher = crypto.createDecipher('aes-256-cbc', this.getStateSecret());
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      const stateData: OAuthState = JSON.parse(decrypted);

      // Validate required fields
      if (!stateData.workspaceId || !stateData.platform || !stateData.accountType || !stateData.timestamp || !stateData.nonce) {
        return {
          data: null,
          isValid: false,
          error: "Invalid state format"
        };
      }

      // Check if state has expired
      const now = Date.now();
      if (now - stateData.timestamp > this.STATE_EXPIRY_MS) {
        return {
          data: stateData,
          isValid: false,
          error: "State has expired"
        };
      }

      return {
        data: stateData,
        isValid: true
      };
    } catch (error) {
      console.error("Failed to parse OAuth state:", error);
      return {
        data: null,
        isValid: false,
        error: "Failed to parse state"
      };
    }
  }

  /**
   * Generate a secure random string for PKCE code verifier
   */
  static generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Generate PKCE code challenge from verifier
   */
  static generateCodeChallenge(verifier: string): string {
    return crypto
      .createHash('sha256')
      .update(verifier)
      .digest('base64url');
  }

  /**
   * Generate a secure nonce for OpenID Connect
   */
  static generateNonce(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Validate CSRF token to prevent CSRF attacks
   */
  static validateCSRFToken(token: string, expectedToken: string): boolean {
    if (!token || !expectedToken) {
      return false;
    }

    // Use constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(token, 'utf8'),
      Buffer.from(expectedToken, 'utf8')
    );
  }

  /**
   * Get the secret used for state encryption
   */
  private static getStateSecret(): string {
    // In production, this should come from environment variables
    const secret = process.env.OAUTH_STATE_SECRET || process.env.AUTH_SECRET;
    if (!secret) {
      throw new Error("OAuth state secret not configured");
    }
    return secret;
  }
}

/**
 * In-memory store for temporary OAuth data (PKCE verifiers, etc.)
 * In production, this should be replaced with Redis or similar
 */
export class OAuthSessionStore {
  private static store = new Map<string, { data: any; expiresAt: number }>();
  private static readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private static cleanupTimer: NodeJS.Timeout | null = null;

  /**
   * Store temporary OAuth session data
   */
  static set(key: string, data: any, ttlMs: number = 10 * 60 * 1000): void {
    const expiresAt = Date.now() + ttlMs;
    this.store.set(key, { data, expiresAt });

    // Start cleanup timer if not already running
    if (!this.cleanupTimer) {
      this.startCleanup();
    }
  }

  /**
   * Retrieve and remove temporary OAuth session data
   */
  static get(key: string): any | null {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    // Remove after retrieval (one-time use)
    this.store.delete(key);
    return entry.data;
  }

  /**
   * Check if a key exists and is not expired
   */
  static has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) {
      return false;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Clear expired entries
   */
  private static cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }

    // Stop cleanup timer if store is empty
    if (this.store.size === 0 && this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Start periodic cleanup of expired entries
   */
  private static startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.CLEANUP_INTERVAL);
  }
}