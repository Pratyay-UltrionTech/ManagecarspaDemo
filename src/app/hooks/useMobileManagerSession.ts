import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { MobileManagerSession } from '../lib/mobileManagerSession';
import {
  clearMobileManagerSessionStorage,
  readMobileManagerSessionFromStorage,
  writeMobileManagerSessionToStorage,
} from '../lib/mobileManagerSession';
import { setManagerSession } from './useManagerSession';

let session: MobileManagerSession | null = readMobileManagerSessionFromStorage();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function setMobileManagerSession(next: MobileManagerSession | null) {
  session = next;
  if (next) writeMobileManagerSessionToStorage(next);
  else clearMobileManagerSessionStorage();
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): MobileManagerSession | null {
  return session;
}

function getServerSnapshot(): MobileManagerSession | null {
  return null;
}

export function useMobileManagerSession() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const login = useCallback((s: MobileManagerSession) => {
    setManagerSession(null);
    setMobileManagerSession(s);
  }, []);

  const logout = useCallback(() => {
    setMobileManagerSession(null);
  }, []);

  return useMemo(
    () => ({
      session: snap,
      isMobileManager: snap !== null,
      login,
      logout,
    }),
    [snap, login, logout]
  );
}
