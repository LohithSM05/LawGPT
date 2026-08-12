import api from './api';

async function updateProfile({ fullName, avatar }) {
  const { data } = await api.put('/users/profile', { fullName, avatar });
  return data.data.user;
}

export default { updateProfile };
