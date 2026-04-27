const BASE = process.env.REACT_APP_API_URL || '';

function getHeaders() {
  const userId = localStorage.getItem('harmonia_user_id');
  return {
    'Content-Type': 'application/json',
    ...(userId ? { 'X-User-Id': userId } : {}),
  };
}

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: getHeaders(),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  getLoginUrl:      ()          => `${BASE}/auth/login`,
  getProfile:       ()          => req('GET',  '/profile'),
  refreshProfile:   ()          => req('POST', '/profile/refresh'),
  createGroup:      (name)      => req('POST', '/groups', { name }),
  listGroups:       ()          => req('GET',  '/groups'),
  getGroup:         (id)        => req('GET',  `/groups/${id}`),
  joinGroup:        (id)        => req('POST', `/groups/${id}/join`),
  getScores:        (id)        => req('GET',  `/groups/${id}/scores`),
  generatePlaylist: (id, opts)  => req('POST', `/groups/${id}/playlist`, opts),
};
