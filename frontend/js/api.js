/* ============================================================
   api.js — thin wrapper around fetch for talking to the REST API
   ============================================================ */

async function apiRequest(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && getToken()) {
    headers['Authorization'] = `Bearer ${getToken()}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch (_) {
    /* no JSON body (e.g. 204) */
  }

  if (!res.ok) {
    const message = (data && data.message) || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return data;
}

const api = {
  get: (path, opts) => apiRequest(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => apiRequest(path, { ...opts, method: 'POST', body }),
  put: (path, body, opts) => apiRequest(path, { ...opts, method: 'PUT', body }),
  del: (path, opts) => apiRequest(path, { ...opts, method: 'DELETE' }),
};

/* ---------- convenience wrappers used by multiple modules ---------- */
function audioUrl(filename) {
  if (/^https?:\/\//i.test(filename)) return filename; // real preview URL (e.g. Apple's CDN) — use as-is
  return filename.startsWith('/') ? filename : `${AUDIO_BASE}/${filename}`;
}

async function recordRecentlyPlayed(songId) {
  if (!isLoggedIn()) return;
  try {
    await api.post('/users/me/recently-played', { songId });
  } catch (_) {
    /* non-critical, ignore */
  }
}

async function incrementPlayCount(songId) {
  try {
    await api.post(`/songs/${songId}/play`);
  } catch (_) {
    /* non-critical, ignore */
  }
}

async function toggleLikeSong(songId, currentlyLiked) {
  if (currentlyLiked) {
    await api.del(`/users/me/liked-songs/${songId}`);
    return false;
  }
  await api.post('/users/me/liked-songs', { songId });
  return true;
}

async function checkIfLiked(songId) {
  if (!isLoggedIn()) return false;
  try {
    const res = await api.get(`/users/me/liked-songs/${songId}/check`);
    return res.liked;
  } catch (_) {
    return false;
  }
}
