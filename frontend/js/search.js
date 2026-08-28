/* ============================================================
   search.js — top-bar song search
   ============================================================ */

function initSearch() {
  const input = document.getElementById('searchInput');
  const runSearch = debounce(async (query) => {
    if (!query.trim()) {
      renderSearchLanding();
      return;
    }
    setActiveView('search');
    try {
      const results = await api.get(`/songs/search?q=${encodeURIComponent(query)}`, { auth: false });
      renderSearchResults(query, results);
    } catch (err) {
      viewContainer.innerHTML = `<p class="empty-hint">${escapeHtml(err.message)}</p>`;
    }
  }, 300);

  input.addEventListener('input', (e) => runSearch(e.target.value));
  input.addEventListener('focus', () => setActiveView('search'));
}

function renderSearchResults(query, songs) {
  viewContainer.innerHTML = `
    <h1 class="view-title">Results for "${escapeHtml(query)}"</h1>
    <p class="detail-meta">${songs.length} song${songs.length === 1 ? '' : 's'} found</p>
    ${renderSongList(songs, 'search-results')}
  `;
  hydrateLikedStates(viewContainer);
}

async function renderSearchLanding() {
  setActiveView('search');
  document.getElementById('searchInput').focus();
  const genres = state.allGenres.length ? state.allGenres : await api.get('/songs/genres', { auth: false });
  state.allGenres = genres;

  viewContainer.innerHTML = `
    <h1 class="view-title">Browse all</h1>
    <div class="genre-grid">
      ${genres
        .map((g, i) => {
          const { background } = getPlaceholderCover(g.genre);
          return `<button class="genre-tile" style="background:${background}" data-browse-genre="${escapeHtml(g.genre)}">
            <span>${escapeHtml(g.genre)}</span>
          </button>`;
        })
        .join('')}
    </div>
  `;
}

document.addEventListener('click', async (e) => {
  const tile = e.target.closest('[data-browse-genre]');
  if (!tile) return;
  const genre = tile.dataset.browseGenre;
  const songs = await api.get(`/songs?genre=${encodeURIComponent(genre)}&limit=100`, { auth: false });
  viewContainer.innerHTML = `
    <h1 class="view-title">${escapeHtml(genre)}</h1>
    <p class="detail-meta">${songs.length} song${songs.length === 1 ? '' : 's'}</p>
    ${renderSongList(songs, `genre-browse-${genre}`)}
  `;
  hydrateLikedStates(viewContainer);
});
