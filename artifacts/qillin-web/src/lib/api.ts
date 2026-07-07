import { CUSTOM_FETCH_SYMBOL } from '@workspace/api-client-react';

export function getToken(): string | null {
  return localStorage.getItem('qillin_token');
}

export function setToken(t: string) {
  localStorage.setItem('qillin_token', t);
}

export function clearToken() {
  localStorage.removeItem('qillin_token');
}

export const customFetch: typeof fetch = async (url, options = {}) => {
  const token = getToken();
  const headers = new Headers((options.headers as HeadersInit) ?? {});
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  const res = await fetch(url, { ...options, headers });
  
  if (res.status === 401) {
    clearToken();
    if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
      window.location.href = '/login';
    }
  }
  
  return res;
};
