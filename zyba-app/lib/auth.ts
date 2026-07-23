export const SESSION_TOKEN_KEY = "zyba_session_token";
// Temporary App Store review default. Change back to "/login" after approval.
export const DEFAULT_LOGIN_PATH = "/apple-review-login";

export function getSessionToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(SESSION_TOKEN_KEY) || "";
}

export function setSessionToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_TOKEN_KEY, token);
}

export function clearSessionToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_TOKEN_KEY);
}
