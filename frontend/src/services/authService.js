import api, { refreshAccessToken } from './api';
import { setAccessToken, clearAccessToken } from '../utils/tokenStore';

async function register({ fullName, email, password, confirmPassword, role }) {
  const { data } = await api.post('/auth/register', { fullName, email, password, confirmPassword, role });
  setAccessToken(data.data.accessToken);
  return data.data.user;
}

async function login({ email, password, rememberMe }) {
  const { data } = await api.post('/auth/login', { email, password, rememberMe });
  setAccessToken(data.data.accessToken);
  return data.data.user;
}

async function logout() {
  try {
    await api.post('/auth/logout');
  } finally {
    clearAccessToken();
  }
}

async function fetchCurrentUser() {
  const { data } = await api.get('/auth/me');
  return data.data.user;
}

/** Called once on app boot to silently resume a session from the refresh cookie. */
async function resumeSession() {
  const accessToken = await refreshAccessToken(); // throws if no valid session
  const user = await fetchCurrentUser();
  return { user, accessToken };
}

export default { register, login, logout, fetchCurrentUser, resumeSession };
