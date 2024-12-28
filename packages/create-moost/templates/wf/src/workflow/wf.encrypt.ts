/**
 * @file Workflow State Encryption Module
 *
 * This module is responsible for encrypting and decrypting the workflow state,
 * allowing secure sharing of state data between the backend and frontend.
 *
 * **Important:** This example is highly simplified and is intended solely for
 * demonstration purposes. For production use, ensure that encryption keys are
 * managed securely and consider using more robust encryption strategies.
 *
 * The module utilizes AES-256-GCM for encryption, providing confidentiality
 * and integrity of the workflow state. The encrypted state is converted to a
 * Base64 string for easy transmission and storage.
 *
 * For more information on Moost Workflows, visit: https://moost.org/wf/
 */

import crypto from "crypto";

import type { TWfState } from "./wf.types";

/**
 * Encryption configuration constants.
 *
 * - `KEY`: A randomly generated 32-byte key used for AES-256 encryption.
 * - `ALGORITHM`: The encryption algorithm to use (AES-256-GCM).
 * - `IV_LENGTH`: The length of the Initialization Vector (IV) in bytes.
 *                AES-GCM recommends a 12-byte IV for optimal security.
 */
const KEY = crypto.randomBytes(32);
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // Recommended IV length for GCM

/**
 * Encrypts the given workflow state object.
 *
 * This function serializes the workflow state to a JSON string, encrypts it using
 * AES-256-GCM, and returns the encrypted data as a Base64-encoded string. The IV
 * and authentication tag are prepended to the encrypted data to ensure successful
 * decryption.
 *
 * **Note:** This implementation is simplified for demonstration purposes. In a
 * real-world scenario, manage encryption keys securely and consider key rotation.
 *
 * @param {TWfState} state - The workflow state object to encrypt.
 * @returns {string} The encrypted state as a Base64-encoded string.
 */
export function encryptState(state: TWfState): string {
  // Generate a random Initialization Vector (IV)
  const iv = crypto.randomBytes(IV_LENGTH);

  // Create a Cipher instance using the specified algorithm, key, and IV
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

  // Convert the state object to a JSON string
  const stateString = JSON.stringify(state);

  // Encrypt the state string
  let encrypted = cipher.update(stateString, "utf8", "hex");
  encrypted += cipher.final("hex");

  // Retrieve the authentication tag generated during encryption
  const authTag = cipher.getAuthTag();

  // Combine IV, Auth Tag, and Encrypted Data into a single Buffer
  const encryptedBuffer = Buffer.concat([
    iv,
    authTag,
    Buffer.from(encrypted, "hex"),
  ]);

  // Convert the combined Buffer to a Base64 string for transmission/storage
  return encryptedBuffer.toString("base64");
}

/**
 * Decrypts the given Base64-encoded encrypted state string.
 *
 * This function decodes the Base64 string, extracts the IV and authentication tag,
 * and decrypts the encrypted data to retrieve the original workflow state object.
 *
 * **Note:** This implementation is simplified for demonstration purposes. Ensure
 * that decryption keys are managed securely and handle potential decryption errors
 * appropriately in production environments.
 *
 * @param {string} encryptedState - The encrypted workflow state as a Base64 string.
 * @returns {TWfState} The decrypted workflow state object.
 * @throws {Error} Throws an error if decryption fails (e.g., due to invalid data).
 */
export function decryptState(encryptedState: string): TWfState {
  try {
    // Decode the Base64-encoded string to a Buffer
    const encryptedBuffer = Buffer.from(encryptedState, "base64");

    // Extract the IV from the beginning of the Buffer
    const iv = encryptedBuffer.subarray(0, IV_LENGTH);

    // Extract the authentication tag following the IV
    const authTag = encryptedBuffer.subarray(IV_LENGTH, IV_LENGTH + 16); // GCM auth tag is 16 bytes

    // Extract the actual encrypted text following the IV and auth tag
    const encryptedText = encryptedBuffer.subarray(IV_LENGTH + 16);

    // Create a Decipher instance using the specified algorithm, key, and IV
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);

    // Set the authentication tag for verification during decryption
    decipher.setAuthTag(authTag);

    // Decrypt the encrypted text
    let decrypted = decipher.update(encryptedText, undefined, "utf8");
    decrypted += decipher.final("utf8");

    // Parse the decrypted JSON string back to the workflow state object
    return JSON.parse(decrypted) as TWfState;
  } catch (error) {
    // Handle decryption errors (e.g., invalid data or tampering)
    throw new Error(
      `Failed to decrypt workflow state: ${(error as Error).message}`
    );
  }
}
