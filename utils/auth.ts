/**
 * Portal login.
 *
 * On the live portal the server checks the username and password against the staff list it
 * keeps (see /usr/local/bin/portal-user on the server). A correct login gives this browser a
 * session cookie for 12 hours that scripts cannot read; Logout ends it at once. No username or
 * password is stored anywhere in this code.
 *
 * In the AI Studio preview there is no server, and the preview only ever uses this browser's own
 * storage, so any username and password are accepted there.
 */
import { isHostingerConfigured, LOGIN_REQUIRED_EVENT, LOGGED_IN_EVENT } from './hostinger.ts';

export { LOGIN_REQUIRED_EVENT, LOGGED_IN_EVENT };

export type LoginFailure = 'invalid' | 'locked' | 'offline';
export interface LoginResult { ok: boolean; reason?: LoginFailure }

// Only a time stamp, no secret: lets a device that logged in keep working from its own copy of
// the data when the internet is down. The server still checks the real session for every request.
const SESSION_HINT = 'gd_session_until';
const SESSION_MS = 12 * 60 * 60 * 1000;

export const login = async (username: string, password: string): Promise<LoginResult> => {
  if (!isHostingerConfigured) {
    window.dispatchEvent(new Event(LOGGED_IN_EVENT));
    return { ok: true };
  }
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim(), password }),
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (response.ok) {
      localStorage.setItem(SESSION_HINT, String(Date.now() + SESSION_MS));
      window.dispatchEvent(new Event(LOGGED_IN_EVENT));
      return { ok: true };
    }
    return { ok: false, reason: response.status === 429 ? 'locked' : 'invalid' };
  } catch {
    return { ok: false, reason: 'offline' };
  }
};

export type SessionState = 'active' | 'none' | 'offline';

/** Is this browser logged in? 'offline' = no internet, but it logged in within the last 12 hours. */
export const checkSession = async (): Promise<SessionState> => {
  if (!isHostingerConfigured) return 'none';
  try {
    const response = await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' });
    if (response.ok) return 'active';
    localStorage.removeItem(SESSION_HINT);
    return 'none';
  } catch {
    return Number(localStorage.getItem(SESSION_HINT) || 0) > Date.now() ? 'offline' : 'none';
  }
};

export const logout = async (): Promise<void> => {
  localStorage.removeItem(SESSION_HINT);
  if (!isHostingerConfigured) return;
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  } catch {
    /* without internet the session simply runs out on its own */
  }
};
