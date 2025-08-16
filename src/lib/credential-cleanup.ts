import { db } from "@/server/db";
import { CredentialService } from "@/server/services/credential";

/**
 * Background job to clean up expired credentials
 * This should be run periodically (e.g., every hour)
 */
export async function cleanupExpiredCredentials(): Promise<void> {
  try {
    console.log("[CREDENTIAL_CLEANUP] Starting cleanup of expired credentials...");

    const service = new CredentialService(db);
    const cleanedUp = await service.cleanupExpiredCredentials();

    console.log(`[CREDENTIAL_CLEANUP] Cleaned up ${cleanedUp} expired credentials`);
  } catch (error) {
    console.error("[CREDENTIAL_CLEANUP] Failed to cleanup expired credentials:", error);
  }
}

/**
 * Secure memory cleanup utility
 * Call this after using sensitive credential data
 */
export function secureCleanup(sensitiveData: any): void {
  if (typeof sensitiveData === "object" && sensitiveData !== null) {
    Object.keys(sensitiveData).forEach(key => {
      if (typeof sensitiveData[key] === "string") {
        // Overwrite string values with random data
        const originalLength = sensitiveData[key].length;
        sensitiveData[key] = Array(originalLength).fill(0).map(() =>
          Math.random().toString(36).charAt(2)
        ).join('');
      }
      delete sensitiveData[key];
    });
  }
}

/**
 * Validate credential expiration
 */
export function isCredentialExpired(expiresAt: Date | null | undefined): boolean {
  if (!expiresAt) return false;
  return expiresAt <= new Date();
}

/**
 * Check if credential expires soon (within 5 minutes)
 */
export function isCredentialExpiringSoon(expiresAt: Date | null | undefined): boolean {
  if (!expiresAt) return false;
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
  return expiresAt <= fiveMinutesFromNow;
}

/**
 * Generate a secure state parameter for OAuth flows
 */
export function generateOAuthState(workspaceId: string, platform: string): string {
  const crypto = require('crypto');
  const timestamp = Date.now().toString();
  const randomBytes = crypto.randomBytes(16).toString('hex');
  const data = `${workspaceId}:${platform}:${timestamp}:${randomBytes}`;
  return Buffer.from(data).toString('base64url');
}

/**
 * Parse and validate OAuth state parameter
 */
export function parseOAuthState(state: string): {
  workspaceId: string;
  platform: string;
  timestamp: number;
  isValid: boolean;
} {
  try {
    const decoded = Buffer.from(state, 'base64url').toString();
    const [workspaceId, platform, timestampStr, randomBytes] = decoded.split(':');

    if (!workspaceId || !platform || !timestampStr || !randomBytes) {
      return { workspaceId: '', platform: '', timestamp: 0, isValid: false };
    }

    const timestamp = parseInt(timestampStr, 10);
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 minutes

    // Check if state is not too old
    const isValid = (now - timestamp) <= maxAge;

    return {
      workspaceId,
      platform,
      timestamp,
      isValid
    };
  } catch (error) {
    console.error("Failed to parse OAuth state:", error);
    return { workspaceId: '', platform: '', timestamp: 0, isValid: false };
  }
}

/**
 * Rate limiting for credential operations
 */
const credentialOperationLimits = new Map<string, { count: number; resetTime: number }>();

export function checkCredentialRateLimit(userId: string, operation: string): boolean {
  const key = `${userId}:${operation}`;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const maxOperations = 10; // Max 10 operations per minute

  const current = credentialOperationLimits.get(key);

  if (!current || now > current.resetTime) {
    credentialOperationLimits.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (current.count >= maxOperations) {
    return false;
  }

  current.count++;
  return true;
}

/**
 * Audit log entry for credential operations
 */
export interface CredentialAuditEntry {
  userId: string;
  workspaceId: string;
  accountId: string;
  operation: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'REFRESH';
  platform: string;
  success: boolean;
  error?: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Log credential operation for audit purposes
 */
export async function logCredentialOperation(entry: CredentialAuditEntry): Promise<void> {
  try {
    // In production, this should write to a secure audit log
    console.log(`[CREDENTIAL_AUDIT] ${JSON.stringify({
      ...entry,
      timestamp: entry.timestamp.toISOString()
    })}`);

    // TODO: Implement database audit logging
    // await db.credentialAuditLog.create({ data: entry });
  } catch (error) {
    console.error("Failed to log credential operation:", error);
  }
}