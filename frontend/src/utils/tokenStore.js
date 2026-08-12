/**
 * The access token lives in memory only — never localStorage/sessionStorage
 * — so it isn't readable by an XSS payload that persists across reloads.
 * The refresh token (httpOnly cookie, set by the backend) is what survives
 * a page reload; on boot the app calls /auth/refresh to mint a fresh access
 * token from that cookie. This module is a plain JS singleton (not React
 * state) so the axios interceptor can read/write it outside the component
 * tree, while AuthContext mirrors it into state for re-renders.
 */
let accessToken = null;

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token) {
  accessToken = token;
}

export function clearAccessToken() {
  accessToken = null;
}
