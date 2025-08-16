import crypto from "crypto";
import { env } from "@/env";

// AES-256-GCM encryption for secure token storage
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // For GCM, this is always 16
const SALT_LENGTH = 32;
const TAG_LENGTH = 16;

/**
 * Derives a key from the master key using PBKDF2
 */
function deriveKey(masterKey: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(masterKey, salt, 100000, 32, "sha256");
}

/**
 * Encrypts a string using AES-256-GCM
 */
export function encrypt(text: string): string {
  try {
    const masterKey = env.ENCRYPTION_KEY;
    if (!masterKey) {
      throw new Error("ENCRYPTION_KEY environment variable is not set");
    }

    // Generate random salt and IV
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);

    // Derive key from master key and salt
    const key = deriveKey(masterKey, salt);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    cipher.setAAD(salt); // Use salt as additional authenticated data

    // Encrypt the text
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    // Get the authentication tag
    const tag = cipher.getAuthTag();

    // Combine salt + iv + tag + encrypted data
    const combined = Buffer.concat([
      salt,
      iv,
      tag,
      Buffer.from(encrypted, "hex")
    ]);

    return combined.toString("base64");
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt data");
  }
}

/**
 * Decrypts a string using AES-256-GCM
 */
export function decrypt(encryptedData: string): string {
  try {
    const masterKey = env.ENCRYPTION_KEY;
    if (!masterKey) {
      throw new Error("ENCRYPTION_KEY environment variable is not set");
    }

    // Parse the combined data
    const combined = Buffer.from(encryptedData, "base64");

    // Extract components
    const salt = combined.subarray(0, SALT_LENGTH);
    const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const tag = combined.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

    // Derive key from master key and salt
    const key = deriveKey(masterKey, salt);

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAAD(salt); // Use salt as additional authenticated data
    decipher.setAuthTag(tag);

    // Decrypt the data
    let decrypted = decipher.update(encrypted, undefined, "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error("Failed to decrypt data");
  }
}

/**
 * Generates a secure random string for use as encryption keys
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Hashes a string using SHA-256 (for non-reversible hashing)
 */
export function hash(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

/**
 * Verifies a hash against the original text
 */
export function verifyHash(text: string, hashedText: string): boolean {
  return hash(text) === hashedText;
}

/**
 * Generates a secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString("hex");
}

/**
 * Encrypts an object by converting it to JSON first
 */
export function encryptObject(obj: any): string {
  return encrypt(JSON.stringify(obj));
}

/**
 * Decrypts an object by parsing the JSON after decryption
 */
export function decryptObject<T>(encryptedData: string): T {
  const decryptedJson = decrypt(encryptedData);
  return JSON.parse(decryptedJson) as T;
}

/**
 * Secure comparison of two strings to prevent timing attacks
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Utility class for managing encrypted credentials
 */
export class CredentialManager {
  /**
   * Encrypts and stores credentials
   */
  static encryptCredentials(credentials: {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
    scope?: string[];
    [key: string]: any;
  }): {
    encryptedAccessToken: string;
    encryptedRefreshToken?: string;
    encryptedMetadata?: string;
  } {
    const result: any = {
      encryptedAccessToken: encrypt(credentials.accessToken),
    };

    if (credentials.refreshToken) {
      result.encryptedRefreshToken = encrypt(credentials.refreshToken);
    }

    // Encrypt additional metadata
    const metadata: Record<string, any> = { ...credentials };
    delete (metadata as any).accessToken;
    delete (metadata as any).refreshToken;

    if (Object.keys(metadata).length > 0) {
      result.encryptedMetadata = encryptObject(metadata);
    }

    return result;
  }

  /**
   * Decrypts stored credentials
   */
  static decryptCredentials(encryptedData: {
    encryptedAccessToken: string;
    encryptedRefreshToken?: string;
    encryptedMetadata?: string;
  }): {
    accessToken: string;
    refreshToken?: string;
    [key: string]: any;
  } {
    const result: any = {
      accessToken: decrypt(encryptedData.encryptedAccessToken),
    };

    if (encryptedData.encryptedRefreshToken) {
      result.refreshToken = decrypt(encryptedData.encryptedRefreshToken);
    }

    if (encryptedData.encryptedMetadata) {
      const metadata = decryptObject(encryptedData.encryptedMetadata);
      Object.assign(result, metadata);
    }

    return result;
  }

  /**
   * Safely clears credentials from memory
   */
  static clearCredentials(credentials: any): void {
    if (typeof credentials === "object" && credentials !== null) {
      Object.keys(credentials).forEach(key => {
        if (typeof credentials[key] === "string") {
          // Overwrite string values with random data
          credentials[key] = crypto.randomBytes(credentials[key].length).toString("hex");
        }
        delete credentials[key];
      });
    }
  }
}