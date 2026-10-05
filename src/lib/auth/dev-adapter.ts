import type { AuthAdapter, AuthResult, AuthUser, SignUpInput } from "@/lib/auth/types";

const USERS_KEY = "ananthi.dev.users";
const SESSION_KEY = "ananthi.dev.session";

type StoredUser = AuthUser & { passwordHash: string };

async function hashDevPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(`ananthi-development-only:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function readUsers(storage: Storage): StoredUser[] {
  const raw = storage.getItem(USERS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as StoredUser[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeUsers(storage: Storage, users: StoredUser[]): void {
  storage.setItem(USERS_KEY, JSON.stringify(users));
}

function nextProfileText(current: string, value: string | undefined): string | null {
  if (value === undefined) return current;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function publicUser(user: StoredUser): AuthUser {
  return {
    id: user.id,
    name: user.name,
    mobile: user.mobile,
    email: user.email,
    address: user.address,
  };
}

export function createDevAuthAdapter(storage: Storage): AuthAdapter {
  return {
    mode: "development",
    label: "DEVELOPMENT STORE",
    configured: true,
    async signUp(input: SignUpInput): Promise<AuthResult> {
      const email = input.email.trim().toLowerCase();
      const password = input.password.trim();
      const users = readUsers(storage);
      if (users.some((user) => user.email === email)) return { ok: false, error: "exists" };
      if (password.length < 8) return { ok: false, error: "weak_password" };
      const user: StoredUser = {
        id: crypto.randomUUID(),
        name: input.name.trim(),
        mobile: input.mobile.trim(),
        email,
        address: input.address.trim(),
        passwordHash: await hashDevPassword(password),
      };
      writeUsers(storage, [...users, user]);
      storage.setItem(SESSION_KEY, user.id);
      return { ok: true, user: publicUser(user) };
    },
    async login(input): Promise<AuthResult> {
      const email = input.email.trim().toLowerCase();
      const users = readUsers(storage);
      const user = users.find((item) => item.email === email);
      if (!user) return { ok: false, error: "invalid" };
      const hash = await hashDevPassword(input.password.trim());
      if (hash !== user.passwordHash) return { ok: false, error: "invalid" };
      storage.setItem(SESSION_KEY, user.id);
      return { ok: true, user: publicUser(user) };
    },
    async logout() {
      storage.removeItem(SESSION_KEY);
    },
    async getSession() {
      const id = storage.getItem(SESSION_KEY);
      if (!id) return null;
      const user = readUsers(storage).find((item) => item.id === id);
      return user ? publicUser(user) : null;
    },
    async requestPasswordReset(input) {
      const email = input.email.trim().toLowerCase();
      const accepted = readUsers(storage).some((user) => user.email === email);
      return { mode: "development", emailSent: false, accepted };
    },
    async devSetPassword(input): Promise<AuthResult> {
      const password = input.password.trim();
      if (password.length < 8) return { ok: false, error: "weak_password" };
      const email = input.email.trim().toLowerCase();
      const users = readUsers(storage);
      const index = users.findIndex((user) => user.email === email);
      if (index === -1) return { ok: false, error: "not_found" };
      users[index] = { ...users[index], passwordHash: await hashDevPassword(password) };
      writeUsers(storage, users);
      return { ok: true, user: publicUser(users[index]) };
    },
    async updateProfile(input): Promise<AuthResult> {
      const id = storage.getItem(SESSION_KEY);
      if (!id) return { ok: false, error: "missing" };
      const users = readUsers(storage);
      const index = users.findIndex((user) => user.id === id);
      if (index === -1) return { ok: false, error: "missing" };
      const name = nextProfileText(users[index].name, input.name);
      const mobile = nextProfileText(users[index].mobile, input.mobile);
      const address = nextProfileText(users[index].address, input.address);
      if (!name || !mobile || !address) return { ok: false, error: "invalid" };
      users[index] = {
        ...users[index],
        name,
        mobile,
        address,
      };
      writeUsers(storage, users);
      return { ok: true, user: publicUser(users[index]) };
    },
  };
}
