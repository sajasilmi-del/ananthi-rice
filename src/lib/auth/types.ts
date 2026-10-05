export type AuthUser = {
  id: string;
  name: string;
  mobile: string;
  email: string;
  address: string;
};

export type AuthSuccess = { ok: true; user: AuthUser };
export type AuthFailure = {
  ok: false;
  error: "invalid" | "exists" | "not_found" | "weak_password" | "missing" | "not_configured";
};
export type AuthResult = AuthSuccess | AuthFailure;

export type SignUpInput = {
  name: string;
  mobile: string;
  email: string;
  password: string;
  address: string;
};

export type PasswordResetResult = {
  mode: "development" | "unconfigured";
  emailSent: false;
  accepted: boolean;
};

export interface AuthAdapter {
  readonly mode: "development" | "unconfigured";
  readonly label: string;
  readonly configured: boolean;
  signUp(input: SignUpInput): Promise<AuthResult>;
  login(input: { email: string; password: string }): Promise<AuthResult>;
  logout(): Promise<void>;
  getSession(): Promise<AuthUser | null>;
  requestPasswordReset(input: { email: string }): Promise<PasswordResetResult>;
  devSetPassword(input: { email: string; password: string }): Promise<AuthResult>;
  updateProfile(input: Partial<Pick<AuthUser, "name" | "mobile" | "address">>): Promise<AuthResult>;
}
