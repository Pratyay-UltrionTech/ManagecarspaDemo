const SESSION_KEY = 'carwash_mobile_manager_session_v1';

/** Logged-in mobile manager (city PIN scope; display zip from admin profile). */
export interface MobileManagerSession {
  cityPinCode: string;
  /** Postal / ZIP from admin "Zip / postal code" field */
  displayZip: string;
  managerName: string;
  loginId: string;
  accessToken: string;
}

export function readMobileManagerSessionFromStorage(): MobileManagerSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as MobileManagerSession;
    if (!p?.cityPinCode || !p?.loginId || !p?.accessToken) return null;
    return p;
  } catch {
    return null;
  }
}

export function writeMobileManagerSessionToStorage(session: MobileManagerSession): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearMobileManagerSessionStorage(): void {
  sessionStorage.removeItem(SESSION_KEY);
}
