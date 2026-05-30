import type { AdminSession } from './adminAuth';

const SESSION_KEY = 'carwash_admin_session_v1';

export function readAdminSessionFromStorage(): AdminSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as AdminSession;
    if (!p?.loginId) return null;
    return p;
  } catch {
    return null;
  }
}

export function writeAdminSessionToStorage(session: AdminSession): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearAdminSessionStorage(): void {
  sessionStorage.removeItem(SESSION_KEY);
}
