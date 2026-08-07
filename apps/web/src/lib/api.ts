export function getToken(): string | null {
  return localStorage.getItem('qillin_token');
}

export function setToken(t: string) {
  localStorage.setItem('qillin_token', t);
}

export function clearToken() {
  localStorage.removeItem('qillin_token');
}

/** Prefix an app path with the router base (BASE_URL), e.g. '/app' + '/login'. */
function withBase(path: string): string {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
  return `${base}${path}`;
}

/** Pages that must not trigger a login redirect on 401 (they are public). */
const PUBLIC_PATHS = ['/', '/login', '/register', '/models'].map(withBase);

export const customFetch: typeof fetch = async (url, options = {}) => {
  const token = getToken();
  const headers = new Headers((options.headers as HeadersInit) ?? {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
    if (!PUBLIC_PATHS.includes(currentPath)) {
      window.location.href = withBase('/login');
    }
  }

  return res;
};
