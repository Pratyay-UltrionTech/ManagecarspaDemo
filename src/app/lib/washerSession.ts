const SESSION_KEY = 'carwash_washer_session_v1';

export interface WasherSession {
  branchId: string;
  branchName: string;
  washerId: string;
  washerName: string;
  loginId: string;
  accessToken: string;
}

export function readWasherSessionFromStorage(): WasherSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as WasherSession;
    if (!p?.branchId || !p?.loginId || !p?.accessToken) return null;
    return p;
  } catch {
    return null;
  }
}

export function writeWasherSessionToStorage(session: WasherSession): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearWasherSessionStorage(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

