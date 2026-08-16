import axios from 'axios';

/**
 * Resolves the backend API base URL.
 * Priority: NEXT_PUBLIC_API_URL env var → onrender.com hardcoded fallback → empty (localhost proxy)
 */
export const getBaseUrl = (): string => {
  // Server-side or build time: use env var
  const envUrl = process.env.NEXT_PUBLIC_API_URL;

  if (envUrl && envUrl.startsWith('http')) {
    return envUrl.replace(/\/+$/, '');
  }

  // Client-side: detect onrender.com deployment
  if (typeof window !== 'undefined') {
    if (window.location.hostname.includes('onrender.com')) {
      return 'https://greenxchange-backend.onrender.com';
    }
    // Local development — use relative URL (Next.js proxy or direct)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:8000';
    }
  }

  return 'https://greenxchange-backend.onrender.com';
};

const api = axios.create({
  baseURL: getBaseUrl(),
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Inject stored access token into every request
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('access_token');
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Auto-refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const rootApi = getBaseUrl();
        const res = await axios.post(`${rootApi}/auth/refresh`, {}, { timeout: 10000 });
        const { access_token } = res.data;

        if (typeof window !== 'undefined') {
          localStorage.setItem('access_token', access_token);
        }

        api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
        originalRequest.headers['Authorization'] = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('access_token');
          localStorage.removeItem('gx_user');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
