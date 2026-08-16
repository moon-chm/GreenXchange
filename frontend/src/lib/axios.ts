import axios from 'axios';

export const getBaseUrl = () => {
  let url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) {
    return '/api';
  }
  url = url.trim();
  // If provided as a hostname without protocol (e.g. greenxchange-backend.onrender.com)
  if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('/')) {
    url = `https://${url}`;
  }
  // Ensure /api suffix
  if (url.startsWith('http://') || url.startsWith('https://')) {
    if (!url.endsWith('/api') && !url.endsWith('/api/')) {
      url = `${url.replace(/\/+$/, '')}/api`;
    }
  }
  return url;
};

const api = axios.create({
  baseURL: getBaseUrl(),
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const rootApi = getBaseUrl();
        const res = await axios.post(
          `${rootApi}/auth/refresh`,
          {},
          { withCredentials: true }
        );
        const { access_token } = res.data;
        api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
        originalRequest.headers['Authorization'] = `Bearer ${access_token}`;
        
        if (typeof window !== 'undefined') {
          localStorage.setItem('access_token', access_token);
        }
        return api(originalRequest);
      } catch (err) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('access_token');
          window.location.href = '/login';
        }
        return Promise.reject(err);
      }
    }
    return Promise.reject(error);
  }
);

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

export default api;
