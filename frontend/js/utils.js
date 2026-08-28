/* ============================================================
   utils.js — shared helpers used across the app
   ============================================================ */

const API_BASE = '/api';
const AUDIO_BASE = '/audio';

/* ---------- time formatting ---------- */
function formatTime(seconds) {
  if (isNaN(seconds) || seconds === Infinity || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/* ---------- XSS-safe text insertion ---------- */
function escapeHtml(str = '') {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ---------- debounce ---------- */
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/* ---------- placeholder cover art ----------
   There's no licensed album art to show, so every song/album/playlist
   gets a deterministic gradient (derived from its title) with its
   initial letter overlaid — same idea Slack/Gmail/Spotify itself use
   for entities that don't have uploaded art. */
const COVER_GRADIENTS = [
  ['#1ED760', '#0B4F2C'], ['#F037A5', '#7A1A5C'], ['#509BF5', '#1B3F82'],
  ['#FFA42B', '#8A4B00'], ['#E8115B', '#5C0924'], ['#8D67AB', '#3E2C56'],
  ['#DC148C', '#4A0A2E'], ['#27856A', '#0F3A2E'], ['#E1118C', '#450636'],
  ['#F59B23', '#5C3900'], ['#477D95', '#1B333D'], ['#7358FF', '#2E2166'],
];

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getPlaceholderCover(title = '?') {
  const idx = hashString(title) % COVER_GRADIENTS.length;
  const [c1, c2] = COVER_GRADIENTS[idx];
  return {
    background: `linear-gradient(135deg, ${c1}, ${c2})`,
    initial: (title.trim()[0] || '?').toUpperCase(),
  };
}

function coverDiv(title, extraClass = '') {
  const { background, initial } = getPlaceholderCover(title);
  return `<div class="cover-art ${extraClass}" style="background:${background}">${escapeHtml(initial)}</div>`;
}

/* ---------- auth / localStorage ---------- */
function getToken() {
  return localStorage.getItem('token');
}
function setSession(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}
function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}
function getUser() {
  const raw = localStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}
function isLoggedIn() {
  return !!getToken();
}

/* ---------- icon set (inline SVG strings, 24x24 viewBox) ---------- */
const ICONS = {
  play: `<svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg>`,
  pause: `<svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>`,
  next: `<svg viewBox="0 0 24 24"><path d="M6 5v14l10-7zM17 5h2v14h-2z"/></svg>`,
  prev: `<svg viewBox="0 0 24 24"><path d="M18 5v14L8 12zM5 5h2v14H5z"/></svg>`,
  shuffle: `<svg viewBox="0 0 24 24"><path d="M17.5 5h3v3M20.5 5 14 11.5M6.5 8.5 4 6M17.5 19h3v-3M20.5 19 14 12.5M6.5 15.5 4 18M4 6h3l3 3.2M4 18h3l9.5-10.5M13.5 15.2 20.5 19" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  repeat: `<svg viewBox="0 0 24 24"><path d="M6 4v3H5a3 3 0 0 0-3 3v2h2V10a1 1 0 0 1 1-1h1v3l4-4-4-4zm12 16v-3h1a3 3 0 0 0 3-3v-2h-2v2a1 1 0 0 1-1 1h-1v-3l-4 4 4 4z"/></svg>`,
  repeatOne: `<svg viewBox="0 0 24 24"><path d="M6 4v3H5a3 3 0 0 0-3 3v2h2V10a1 1 0 0 1 1-1h1v3l4-4-4-4zm12 16v-3h1a3 3 0 0 0 3-3v-2h-2v2a1 1 0 0 1-1 1h-1v-3l-4 4 4 4z"/><text x="11" y="15" font-size="8" fill="currentColor" stroke="none">1</text></svg>`,
  volumeHigh: `<svg viewBox="0 0 24 24"><path d="M3 10v4h4l5 5V5L7 10H3z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  volumeLow: `<svg viewBox="0 0 24 24"><path d="M3 10v4h4l5 5V5L7 10H3z"/><path d="M16 9.5a3.5 3.5 0 0 1 0 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  volumeMute: `<svg viewBox="0 0 24 24"><path d="M3 10v4h4l5 5V5L7 10H3z"/><path d="M15.5 9.5l5 5m0-5l-5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  heart: `<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-10-9.3C.3 8 2 4.5 5.6 4.1c2-.2 3.7.8 4.9 2.4 1.2-1.6 2.9-2.6 4.9-2.4C19 4.5 20.7 8 22 11.7 19.5 16.4 12 21 12 21z" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>`,
  heartFilled: `<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-10-9.3C.3 8 2 4.5 5.6 4.1c2-.2 3.7.8 4.9 2.4 1.2-1.6 2.9-2.6 4.9-2.4C19 4.5 20.7 8 22 11.7 19.5 16.4 12 21 12 21z"/></svg>`,
  search: `<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M20 20l-4.8-4.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  home: `<svg viewBox="0 0 24 24"><path d="M12 3 2 11h3v9h5v-6h4v6h5v-9h3z"/></svg>`,
  library: `<svg viewBox="0 0 24 24"><path d="M3 3h4v18H3zM10 3h4v18h-4zM17 4l4 .8-3.2 17-4-.8z"/></svg>`,
  plus: `<svg viewBox="0 0 24 24"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg>`,
  logout: `<svg viewBox="0 0 24 24"><path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5v-2H5V5h5zM16 8l-1.4 1.4L16.2 11H9v2h7.2l-1.6 1.6L16 16l4-4z"/></svg>`,
  playSmall: `<svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg>`,
  dots: `<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>`,
  trash: `<svg viewBox="0 0 24 24"><path d="M6 7h12l-1 14H7zM9 4h6l1 2H8z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
  close: `<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  equalizer: `<span class="eq-bars"><span></span><span></span><span></span></span>`,
};
