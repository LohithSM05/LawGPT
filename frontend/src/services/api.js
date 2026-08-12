import axios from 'axios';
import { getAccessToken, setAccessToken, clearAccessToken } from '../utils/tokenStore';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export const api = axios.create({
  baseURL,
  withCredentials: true, // sends/receives the httpOnly refresh-token cookie
});

// Separate, un-intercepted client for the refresh call itself — reusing
// `api` here would recurse into the response interceptor below.
const rawClient = axios.create({ baseURL, withCredentials: true });

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise = null;

/** Ensures concurrent 401s trigger only one /auth/refresh call. */
function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = rawClient
      .post('/auth/refresh')
      .then((res) => {
        const { accessToken } = res.data.data;
        setAccessToken(accessToken);
        return accessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const isAuthRoute = original?.url?.includes('/auth/login') || original?.url?.includes('/auth/register');

    if (status === 401 && !original._retry && !isAuthRoute) {
      original._retry = true;
      try {
        const newToken = await refreshAccessToken();
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch (refreshError) {
        clearAccessToken();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export { refreshAccessToken };
export default api;
