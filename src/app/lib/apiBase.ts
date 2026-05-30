const LOCAL_API_BASE = 'http://localhost:8000/api/v1';
const HOSTED_API_BASE =
  'https://carwash-ajfpdje5h5dqdjfj.centralus-01.azurewebsites.net/api/v1';

/** Set VITE_API_BASE_URL in .env to override. Dev server → local FastAPI; production build → hosted API. */
export const API_BASE: string =
  (import.meta as any).env?.VITE_API_BASE_URL ??
  (import.meta.env.DEV ? LOCAL_API_BASE : HOSTED_API_BASE);
