/* ============================================================
   app.js — app shell: navigation, shared rendering, sidebar,
   playlists, modals, toasts. This is the entry point.
   ============================================================ */

const state = {
  view: 'home',
  renderedLists: {}, // listId -> array of songs currently shown in that container
  userPlaylists: [],
  allGenres: [],
};

const viewContainer = document.getElementById('viewContainer');

/* ---------- toast notifications ---------- */
function showToast(message, isError = false) {
  const toast = document.createElement('div');
  toast.className = `toast ${isError ? 'toast-error' : ''}`;
  toast.textContent = message;
  document.getElementById('toastContainer').appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('visible'));
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 250);
  }, 2500);
}

/* ---------- modal ---------- */
function openModal(titleText, bodyHtml) {
  const overlay = document.getElementById('modalOverlay');
  document.getElementById('modalTitle').textContent = titleText;
  document.getElementById('modalBody').innerHTML = bodyHtml;
  overlay.classList.add('visible');
}
function closeModal() {
  document.getElementById('modalOverlay').classList.remove('visible');
}
document.getElementById('modalOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'modalOverlay') closeModal();
});
document.getElementById('modalCloseBtn').addEventListener('click', closeModal);

/* ---------- shared song row rendering ---------- */
function renderSongList(songs, listId, { showAlbum = true } = {}) {
  state.renderedLists[listId] = songs;
  if (songs.length === 0) {
    return `<p class="empty-hint">Nothing here yet.</p>`;
  }
  const rows = songs
    .map((song, index) => `
      <div class="song-row" data-list-id="${listId}" data-index="${index}">
        <div class="song-row-number">
          <span class="row-index">${index + 1}</span>
          <span class="row-eq">${ICONS.equalizer}</span>
          <button class="row-play-btn" aria-label="Play ${escapeHtml(song.title)}">${ICONS.playSmall}</button>
        </div>
        <div class="song-row-info">
          ${coverDiv(song.title)}
          <div class="song-row-text">
            <span class="song-row-title">${escapeHtml(song.title)}</span>
            <span class="song-row-artist">${escapeHtml(song.artist || 'Unknown Artist')}</span>
          </div>
        </div>
        ${showAlbum ? `<div class="song-row-album">${escapeHtml(song.album || '')}</div>` : '<div></div>'}
        <div class="song-row-actions">
          <button class="icon-btn row-like-btn" data-song-id="${song.id}" aria-label="Like">${ICONS.heart}</button>
          <button class="icon-btn row-add-btn" data-song-id="${song.id}" aria-label="Add to playlist">${ICONS.plus}</button>
          <span class="song-row-duration">${formatTime(song.duration)}</span>
        </div>
      </div>
    `)
    .join('');
  return `<div class="song-list">${rows}</div>`;
}

// Event delegation — handles clicks for every song row on the page,
// no matter which view rendered it or how many times it's re-rendered.
document.addEventListener('click', async (e) => {
  const playTarget = e.target.closest('.row-play-btn, .song-row-info');
  if (playTarget) {
    const row = playTarget.closest('.song-row');
    const listId = row.dataset.listId;
    const index = Number(row.dataset.index);
    const list = state.renderedLists[listId];
    if (!list) return;
    const song = list[index];
    if (player.getCurrentSong() && player.getCurrentSong().id === song.id) {
      player.togglePlayPause();
    } else {
      player.loadQueue(list, index);
    }
    return;
  }

  const likeBtn = e.target.closest('.row-like-btn');
  if (likeBtn) {
    if (!isLoggedIn()) return (window.location.href = 'login.html');
    const songId = Number(likeBtn.dataset.songId);
    const wasLiked = likeBtn.classList.contains('liked');
    try {
      const nowLiked = await toggleLikeSong(songId, wasLiked);
      likeBtn.classList.toggle('liked', nowLiked);
      likeBtn.innerHTML = nowLiked ? ICONS.heartFilled : ICONS.heart;
      showToast(nowLiked ? 'Added to Liked Songs' : 'Removed from Liked Songs');
      if (player.getCurrentSong() && player.getCurrentSong().id === songId) {
        player.currentlyLiked = nowLiked;
        player._setLikeUI(nowLiked);
      }
    } catch (err) {
      showToast(err.message, true);
    }
    return;
  }

  const addBtn = e.target.closest('.row-add-btn');
  if (addBtn) {
    if (!isLoggedIn()) return (window.location.href = 'login.html');
    openAddToPlaylistModal(Number(addBtn.dataset.songId));
    return;
  }

  const playlistCard = e.target.closest('[data-open-playlist]');
  if (playlistCard) {
    renderPlaylistView(Number(playlistCard.dataset.openPlaylist));
  }
});

// Reflect liked state once rows are in the DOM (batched, non-blocking)
async function hydrateLikedStates(container) {
  if (!isLoggedIn()) return;
  const buttons = container.querySelectorAll('.row-like-btn');
  for (const btn of buttons) {
    const songId = Number(btn.dataset.songId);
    checkIfLiked(songId).then((liked) => {
      if (liked) {
        btn.classList.add('liked');
        btn.innerHTML = ICONS.heartFilled;
      }
    });
  }
}

/* ---------- add to playlist modal ---------- */
async function openAddToPlaylistModal(songId) {
  await refreshUserPlaylists();
  const options = state.userPlaylists.length
    ? state.userPlaylists
        .map(
          (p) => `<button class="modal-list-item" data-add-song="${songId}" data-playlist-id="${p.id}">
            ${coverDiv(p.name, 'cover-sm')}
            <span>${escapeHtml(p.name)}</span>
          </button>`
        )
        .join('')
    : `<p class="empty-hint">You don't have any playlists yet.</p>`;

  openModal(
    'Add to Playlist',
    `<div class="modal-list">${options}</div>
     <button class="btn btn-secondary btn-full" id="modalCreatePlaylistBtn">+ Create New Playlist</button>`
  );

  document.getElementById('modalCreatePlaylistBtn').addEventListener('click', async () => {
    const playlist = await promptCreatePlaylist();
    if (playlist) {
      await api.post(`/playlists/${playlist.id}/songs`, { songId });
      showToast(`Added to ${playlist.name}`);
      closeModal();
    }
  });

  document.querySelectorAll('[data-add-song]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const playlistId = btn.dataset.playlistId;
      try {
        await api.post(`/playlists/${playlistId}/songs`, { songId });
        showToast('Added to playlist');
        closeModal();
      } catch (err) {
        showToast(err.message, true);
      }
    });
  });
}

/* ---------- playlists: sidebar + create + view ---------- */
async function refreshUserPlaylists() {
  if (!isLoggedIn()) return;
  state.userPlaylists = await api.get('/playlists');
  renderSidebarPlaylists();
}

function renderSidebarPlaylists() {
  const list = document.getElementById('playlistList');
  list.innerHTML = state.userPlaylists
    .map(
      (p) => `<li>
        <a href="#" class="nav-item playlist-link" data-open-playlist="${p.id}">
          ${coverDiv(p.name, 'cover-sm')}
          <span class="playlist-link-text">
            <strong>${escapeHtml(p.name)}</strong>
            <small>Playlist · ${p.song_count} song${p.song_count === 1 ? '' : 's'}</small>
          </span>
        </a>
      </li>`
    )
    .join('');
}

function promptCreatePlaylist() {
  return new Promise((resolve) => {
    openModal(
      'Create Playlist',
      `<form id="createPlaylistForm">
        <label class="field-label" for="playlistNameInput">Name</label>
        <input id="playlistNameInput" class="text-input" placeholder="My Playlist #${state.userPlaylists.length + 1}" autofocus>
        <label class="field-label" for="playlistDescInput">Description (optional)</label>
        <input id="playlistDescInput" class="text-input" placeholder="Add an optional description">
        <button type="submit" class="btn btn-primary btn-full">Create</button>
      </form>`
    );
    const form = document.getElementById('createPlaylistForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('playlistNameInput').value.trim() || `My Playlist #${state.userPlaylists.length + 1}`;
      const description = document.getElementById('playlistDescInput').value.trim();
      try {
        const playlist = await api.post('/playlists', { name, description });
        await refreshUserPlaylists();
        closeModal();
        resolve(playlist);
      } catch (err) {
        showToast(err.message, true);
        resolve(null);
      }
    });
  });
}

document.getElementById('createPlaylistBtn').addEventListener('click', async () => {
  if (!isLoggedIn()) return (window.location.href = 'login.html');
  const playlist = await promptCreatePlaylist();
  if (playlist) {
    showToast(`Created "${playlist.name}"`);
    setActiveView('playlist');
    renderPlaylistView(playlist.id);
  }
});

async function renderPlaylistView(playlistId) {
  setActiveView('playlist');
  viewContainer.innerHTML = `<p class="loading-hint">Loading playlist…</p>`;
  try {
    const playlist = await api.get(`/playlists/${playlistId}`);
    const isOwner = isLoggedIn() && getUser() && getUser().id === playlist.user_id;
    viewContainer.innerHTML = `
      <div class="detail-header">
        ${coverDiv(playlist.name, 'cover-xl')}
        <div class="detail-header-text">
          <span class="detail-kicker">Playlist</span>
          <h1>${escapeHtml(playlist.name)}</h1>
          <p class="detail-desc">${escapeHtml(playlist.description || '')}</p>
          <p class="detail-meta">${playlist.songs.length} song${playlist.songs.length === 1 ? '' : 's'}</p>
        </div>
      </div>
      <div class="detail-actions">
        <button class="play-fab" id="playPlaylistBtn" aria-label="Play playlist">${ICONS.play}</button>
        ${isOwner ? `<button class="icon-btn" id="deletePlaylistBtn" aria-label="Delete playlist">${ICONS.trash}</button>` : ''}
      </div>
      ${renderSongList(playlist.songs, `playlist-${playlist.id}`, { showAlbum: false })}
    `;
    hydrateLikedStates(viewContainer);

    document.getElementById('playPlaylistBtn').addEventListener('click', () => {
      if (playlist.songs.length) player.loadQueue(playlist.songs, 0);
    });

    const delBtn = document.getElementById('deletePlaylistBtn');
    if (delBtn) {
      delBtn.addEventListener('click', async () => {
        if (!confirm(`Delete "${playlist.name}"? This can't be undone.`)) return;
        await api.del(`/playlists/${playlistId}`);
        await refreshUserPlaylists();
        showToast('Playlist deleted');
        renderHomeView();
      });
    }

    // allow removing songs from within this view (owner only)
    if (isOwner) {
      viewContainer.querySelectorAll('.song-row').forEach((row, i) => {
        const removeBtn = document.createElement('button');
        removeBtn.className = 'icon-btn row-remove-btn';
        removeBtn.innerHTML = ICONS.close;
        removeBtn.setAttribute('aria-label', 'Remove from playlist');
        removeBtn.addEventListener('click', async (ev) => {
          ev.stopPropagation();
          const songId = playlist.songs[i].id;
          await api.del(`/playlists/${playlistId}/songs/${songId}`);
          showToast('Removed from playlist');
          renderPlaylistView(playlistId);
        });
        row.querySelector('.song-row-actions').appendChild(removeBtn);
      });
    }
  } catch (err) {
    viewContainer.innerHTML = `<p class="empty-hint">${escapeHtml(err.message)}</p>`;
  }
}

/* ---------- liked songs view ---------- */
async function renderLikedSongsView() {
  setActiveView('liked');
  viewContainer.innerHTML = `<p class="loading-hint">Loading Liked Songs…</p>`;
  const songs = await api.get('/users/me/liked-songs');
  viewContainer.innerHTML = `
    <div class="detail-header">
      <div class="cover-art cover-xl liked-cover">${ICONS.heartFilled}</div>
      <div class="detail-header-text">
        <span class="detail-kicker">Playlist</span>
        <h1>Liked Songs</h1>
        <p class="detail-meta">${songs.length} song${songs.length === 1 ? '' : 's'}</p>
      </div>
    </div>
    <div class="detail-actions">
      <button class="play-fab" id="playLikedBtn" aria-label="Play Liked Songs">${ICONS.play}</button>
    </div>
    ${renderSongList(songs, 'liked-songs', { showAlbum: false })}
  `;
  viewContainer.querySelectorAll('.row-like-btn').forEach((btn) => {
    btn.classList.add('liked');
    btn.innerHTML = ICONS.heartFilled;
  });
  document.getElementById('playLikedBtn').addEventListener('click', () => {
    if (songs.length) player.loadQueue(songs, 0);
  });
}

/* ---------- home view ---------- */
async function renderHomeView() {
  setActiveView('home');
  viewContainer.innerHTML = `<p class="loading-hint">Loading your music…</p>`;

  const [topSongs, genres] = await Promise.all([
    api.get('/songs/top', { auth: false }),
    api.get('/songs/genres', { auth: false }),
  ]);
  state.allGenres = genres;

  const greeting = getGreeting();
  let html = `<h1 class="view-title">${greeting}</h1>`;

  html += `<section class="home-section">
    <h2>Popular right now</h2>
    ${renderSongList(topSongs, 'home-top', { showAlbum: false })}
  </section>`;

  // Fetch a page per genre in parallel and render a row per genre —
  // gives the browsing experience real Spotify has (rows by category).
  const genreSongLists = await Promise.all(
    genres.slice(0, 8).map((g) => api.get(`/songs?genre=${encodeURIComponent(g.genre)}&limit=8`, { auth: false }))
  );

  genres.slice(0, 8).forEach((g, i) => {
    const listId = `home-genre-${i}`;
    html += `<section class="home-section">
      <h2>${escapeHtml(g.genre)}</h2>
      <div class="card-grid">
        ${genreSongLists[i]
          .map(
            (song, idx) => `
          <button class="song-card" data-genre-list="${listId}" data-index="${idx}">
            <span class="card-cover-wrap">
              ${coverDiv(song.title, 'cover-card')}
              <span class="song-card-play">${ICONS.play}</span>
            </span>
            <span class="song-card-title">${escapeHtml(song.title)}</span>
            <span class="song-card-artist">${escapeHtml(song.artist || '')}</span>
          </button>`
          )
          .join('')}
      </div>
    </section>`;
    state.renderedLists[listId] = genreSongLists[i];
  });

  viewContainer.innerHTML = html;
  hydrateLikedStates(viewContainer);
}

// card clicks (genre browse grid) — separate delegated handler since
// cards use a different data attribute shape than song-list rows
document.addEventListener('click', (e) => {
  const card = e.target.closest('.song-card');
  if (!card) return;
  const list = state.renderedLists[card.dataset.genreList];
  const index = Number(card.dataset.index);
  if (list) player.loadQueue(list, index);
});

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/* ---------- navigation ---------- */
function setActiveView(view) {
  state.view = view;
  document.querySelectorAll('.nav-item[data-view]').forEach((el) => {
    el.classList.toggle('active', el.dataset.view === view);
  });
}

document.querySelectorAll('.nav-item[data-view]').forEach((el) => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    const view = el.dataset.view;
    if (view === 'home') renderHomeView();
    if (view === 'search') renderSearchLanding();
    if (view === 'liked') {
      if (!isLoggedIn()) return (window.location.href = 'login.html');
      renderLikedSongsView();
    }
  });
});

/* ---------- user menu ---------- */
function renderUserMenu() {
  const menu = document.getElementById('userMenu');
  if (isLoggedIn()) {
    const user = getUser();
    menu.innerHTML = `
      <button class="user-chip" id="userChipBtn">
        <span class="user-avatar" style="background:${user.avatar_color || '#1ED760'}">${escapeHtml(user.username[0].toUpperCase())}</span>
        <span>${escapeHtml(user.username)}</span>
      </button>`;
    document.getElementById('userChipBtn').addEventListener('click', () => {
      openModal('Account', `
        <div class="modal-list">
          <div class="modal-list-item" style="cursor:default">
            <span class="user-avatar" style="background:${user.avatar_color}">${escapeHtml(user.username[0].toUpperCase())}</span>
            <span>${escapeHtml(user.username)} · ${escapeHtml(user.email)}</span>
          </div>
        </div>
        <button class="btn btn-secondary btn-full" id="logoutBtn">Log Out</button>
      `);
      document.getElementById('logoutBtn').addEventListener('click', logout);
    });
  } else {
    menu.innerHTML = `
      <a href="login.html" class="btn btn-text">Log in</a>
      <a href="signup.html" class="btn btn-primary">Sign up</a>
    `;
  }
}

/* ---------- init ---------- */
document.addEventListener('DOMContentLoaded', async () => {
  renderUserMenu();
  initSearch();
  if (isLoggedIn()) {
    refreshUserPlaylists().catch(() => {});
  }
  renderHomeView();
});
