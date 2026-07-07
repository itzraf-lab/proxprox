import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Initialize the API client fetcher globally
import { customFetch } from './lib/api';
import { setAuthTokenGetter, setBaseUrl } from '@workspace/api-client-react';

setBaseUrl(import.meta.env.VITE_API_URL || null);
// We are using customFetch directly in the React components by passing it, 
// but we can also set the token getter. The generated api uses `customFetch` locally
// and relies on its own `custom-fetch.ts` unless overridden or if we modify it.
// The provided prompt explicitly says: "Pass `customFetch` to the Orval-generated client. In `main.tsx`, wrap the QueryClientProvider and set the global custom fetch via `CUSTOM_FETCH_SYMBOL` if available, or use the pattern from the generated `custom-fetch.ts`."

// We'll override the global fetch object for the custom-fetch module by just using the auth getter.
import { getToken } from './lib/api';
setAuthTokenGetter(async () => getToken());

createRoot(document.getElementById('root')!).render(<App />);