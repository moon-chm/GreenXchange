import axios from 'axios';

export const getBaseUrl = () => {
  let url = process.env.NEXT_PUBLIC_API_URL;
  if (!url || url === '/api' || (url.includes('greenxchange-backend') && !url.includes('.onrender.com'))) {
    return 'https://greenxchange-backend.onrender.com';
  }
  url = url.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  // Strip trailing slash
  return url.replace(/\/+$/, '');
};

const api = axios.create({
  baseURL: getBaseUrl(),
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
          {}
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
