import { useState, useEffect } from 'react';

// Simple global state for reports settings
let mobileMode = localStorage.getItem('reports_mobile_mode') === 'true';
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function setReportsMobileMode(value: boolean) {
  mobileMode = value;
  localStorage.setItem('reports_mobile_mode', String(value));
  emit();
}

export function useReportsSettings() {
  const [mode, setMode] = useState(mobileMode);

  useEffect(() => {
    const listener = () => setMode(mobileMode);
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, []);

  return {
    mobileMode: mode,
    setMobileMode: setReportsMobileMode
  };
}
