const SESSION_KEY = 'carwash_manager_session_v1';

export interface ManagerSession {
  branchId: string;
  branchName: string;
  managerId: string;
  managerName: string;
  loginId: string;
  accessToken?: string;
}

export function readManagerSessionFromStorage(): ManagerSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as ManagerSession;
    if (!p?.branchId || !p?.managerId || !p?.loginId) return null;
    return p;
  } catch {
    return null;
  }
}

export function writeManagerSessionToStorage(session: ManagerSession): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearManagerSessionStorage(): void {
  sessionStorage.removeItem(SESSION_KEY);
}
