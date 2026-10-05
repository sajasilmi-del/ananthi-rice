import type { AuthAdapter, AuthResult, PasswordResetResult } from "@/lib/auth/types";

const refused: AuthResult = { ok: false, error: "not_configured" };

const resetRefused: PasswordResetResult = {
  mode: "unconfigured",
  emailSent: false,
  accepted: false,
};

/**
 * Production authentication is not connected.
 *
 * Replace this stub with a server adapter. That adapter must:
 * - keep the session in an httpOnly cookie
 * - hash passwords on the server (argon2 or bcrypt)
 * - never hash or store passwords in the browser
 * - never place API keys, tokens, or other secrets in frontend code
 *
 * This stub refuses every account action and does not write user records.
 */
export function createUnconfiguredAuthAdapter(): AuthAdapter {
  return {
    mode: "unconfigured",
    label: "UNCONFIGURED",
    configured: false,
    async signUp() {
      return refused;
    },
    async login() {
      return refused;
    },
    async logout() {},
    async getSession() {
      return null;
    },
    async requestPasswordReset() {
      return resetRefused;
    },
    async devSetPassword() {
      return refused;
    },
    async updateProfile() {
      return refused;
    },
  };
}
