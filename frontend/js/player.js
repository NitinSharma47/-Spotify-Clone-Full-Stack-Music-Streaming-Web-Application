/* ============================================================
   player.js — the audio engine + now-playing bar
   Handles: play/pause, next/previous, seek ("scroll"), volume,
   mute, shuffle, repeat (off/all/one), like, queue management.
   ============================================================ */

class Player {
  constructor() {
    this.audio = document.getElementById('audioElement');
    this.queue = [];
    this.currentIndex = -1;
    this.isShuffle = false;
    this.repeatMode = 'off'; // 'off' | 'all' | 'one'
    this.currentlyLiked = false;

    // cache DOM nodes
    this.el = {
      playPauseBtn: document.getElementById('playPauseBtn'),
      nextBtn: document.getElementById('nextBtn'),
      prevBtn: document.getElementById('prevBtn'),
      shuffleBtn: document.getElementById('shuffleBtn'),
      repeatBtn: document.getElementById('repeatBtn'),
      likeBtn: document.getElementById('likeBtn'),
      progressBar: document.getElementById('progressBar'),
      progressFill: document.getElementById('progressFill'),
      progressHandle: document.getElementById('progressHandle'),
      currentTimeEl: document.getElementById('currentTime'),
      durationEl: document.getElementById('duration'),
      volumeBar: document.getElementById('volumeBar'),
      volumeFill: document.getElementById('volumeFill'),
      muteBtn: document.getElementById('muteBtn'),
      nowPlayingCover: document.getElementById('nowPlayingCover'),
      nowPlayingTitle: document.getElementById('nowPlayingTitle'),
      nowPlayingArtist: document.getElementById('nowPlayingArtist'),
      nowPlayingAttribution: document.getElementById('nowPlayingAttribution'),
      playerBar: document.querySelector('.player-bar'),
    };

    this.volume = 0.75;
    this.audio.volume = this.volume;
    this.lastVolume = this.volume;

    this._renderIcons();
    this._bindEvents();
    this._setVolumeUI(this.volume);
  }

  _renderIcons() {
    this.el.playPauseBtn.innerHTML = ICONS.play;
    this.el.nextBtn.innerHTML = ICONS.next;
    this.el.prevBtn.innerHTML = ICONS.prev;
    this.el.shuffleBtn.innerHTML = ICONS.shuffle;
    this.el.repeatBtn.innerHTML = ICONS.repeat;
    this.el.likeBtn.innerHTML = ICONS.heart;
    this.el.muteBtn.innerHTML = ICONS.volumeHigh;
  }

  _bindEvents() {
    this.el.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
    this.el.nextBtn.addEventListener('click', () => this.next());
    this.el.prevBtn.addEventListener('click', () => this.prev());
    this.el.shuffleBtn.addEventListener('click', () => this.toggleShuffle());
    this.el.repeatBtn.addEventListener('click', () => this.cycleRepeat());
    this.el.likeBtn.addEventListener('click', () => this.toggleLike());
    this.el.muteBtn.addEventListener('click', () => this.toggleMute());

    this.audio.addEventListener('timeupdate', () => this._updateProgress());
    this.audio.addEventListener('loadedmetadata', () => this._updateDuration());
    this.audio.addEventListener('ended', () => this._handleEnded());
    this.audio.addEventListener('play', () => this._setPlayingUI(true));
    this.audio.addEventListener('pause', () => this._setPlayingUI(false));
    this.audio.addEventListener('waiting', () => this.el.playerBar.classList.add('is-buffering'));
    this.audio.addEventListener('canplay', () => this.el.playerBar.classList.remove('is-buffering'));

    // seek bar — click and drag ("scroll through the track")
    let seeking = false;
    this.el.progressBar.addEventListener('mousedown', (e) => {
      seeking = true;
      this._seekFromEvent(e);
    });
    window.addEventListener('mousemove', (e) => {
      if (seeking) this._seekFromEvent(e);
    });
    window.addEventListener('mouseup', () => (seeking = false));

    // volume bar — click and drag
    let adjustingVolume = false;
    this.el.volumeBar.addEventListener('mousedown', (e) => {
      adjustingVolume = true;
      this._volumeFromEvent(e);
    });
    window.addEventListener('mousemove', (e) => {
      if (adjustingVolume) this._volumeFromEvent(e);
    });
    window.addEventListener('mouseup', () => (adjustingVolume = false));

    // keyboard shortcut: spacebar toggles play/pause (ignored while typing)
    window.addEventListener('keydown', (e) => {
      const tag = document.activeElement.tagName;
      if (e.code === 'Space' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        this.togglePlayPause();
      }
    });
  }

  /* ---------- queue / playback ---------- */

  loadQueue(songs, startIndex, { autoplay = true } = {}) {
    if (!songs || songs.length === 0) return;
    this.queue = songs;
    this.currentIndex = startIndex;
    this._loadCurrentSong(autoplay);
  }

  async _loadCurrentSong(autoplay) {
    const song = this.queue[this.currentIndex];
    if (!song) return;

    this.audio.src = audioUrl(song.audio_file);
    this.el.nowPlayingTitle.textContent = song.title;
    this.el.nowPlayingArtist.textContent = song.artist || 'Unknown Artist';
    if (song.audio_source === 'itunes') {
      this.el.nowPlayingAttribution.textContent = 'Preview via Apple Music \u2197';
      this.el.nowPlayingAttribution.href = `https://music.apple.com/search?term=${encodeURIComponent(song.title + ' ' + (song.artist || ''))}`;
      this.el.nowPlayingAttribution.style.display = '';
    } else {
      this.el.nowPlayingAttribution.style.display = 'none';
    }
    const { background, initial } = getPlaceholderCover(song.title);
    this.el.nowPlayingCover.style.background = background;
    this.el.nowPlayingCover.textContent = initial;
    this.el.playerBar.classList.add('has-track');

    this._updateLikeState(song.id);
    recordRecentlyPlayed(song.id);
    incrementPlayCount(song.id);

    document.dispatchEvent(new CustomEvent('song:changed', { detail: song }));

    if (autoplay) {
      try {
        await this.audio.play();
      } catch (_) {
        /* autoplay may be blocked until the user interacts — that's fine */
      }
    }
  }

  play() {
    this.audio.play().catch(() => {});
  }
  pause() {
    this.audio.pause();
  }
  togglePlayPause() {
    if (this.queue.length === 0) return;
    if (this.audio.paused) this.play();
    else this.pause();
  }

  next() {
    if (this.queue.length === 0) return;
    this.currentIndex = this.isShuffle ? this._randomIndex() : (this.currentIndex + 1) % this.queue.length;
    this._loadCurrentSong(true);
  }

  prev() {
    if (this.queue.length === 0) return;
    // Real-Spotify-like behavior: restart the song if more than 3s in,
    // otherwise go to the previous track.
    if (this.audio.currentTime > 3) {
      this.audio.currentTime = 0;
      return;
    }
    this.currentIndex = this.isShuffle
      ? this._randomIndex()
      : (this.currentIndex - 1 + this.queue.length) % this.queue.length;
    this._loadCurrentSong(true);
  }

  _randomIndex() {
    if (this.queue.length <= 1) return this.currentIndex;
    let idx;
    do {
      idx = Math.floor(Math.random() * this.queue.length);
    } while (idx === this.currentIndex);
    return idx;
  }

  _handleEnded() {
    if (this.repeatMode === 'one') {
      this.audio.currentTime = 0;
      this.play();
      return;
    }
    const isLastTrack = this.currentIndex === this.queue.length - 1;
    if (isLastTrack && !this.isShuffle && this.repeatMode === 'off') {
      this._setPlayingUI(false);
      return;
    }
    this.next();
  }

  /* ---------- shuffle / repeat ---------- */

  toggleShuffle() {
    this.isShuffle = !this.isShuffle;
    this.el.shuffleBtn.classList.toggle('active', this.isShuffle);
  }

  cycleRepeat() {
    const modes = ['off', 'all', 'one'];
    this.repeatMode = modes[(modes.indexOf(this.repeatMode) + 1) % modes.length];
    this.el.repeatBtn.classList.toggle('active', this.repeatMode !== 'off');
    this.el.repeatBtn.innerHTML = this.repeatMode === 'one' ? ICONS.repeatOne : ICONS.repeat;
  }

  /* ---------- progress / seek ("scroll") ---------- */

  _updateProgress() {
    const { currentTime, duration } = this.audio;
    if (isNaN(duration) || duration === 0) return;
    const pct = (currentTime / duration) * 100;
    this.el.progressFill.style.width = `${pct}%`;
    this.el.progressHandle.style.left = `${pct}%`;
    this.el.currentTimeEl.textContent = formatTime(currentTime);
  }

  _updateDuration() {
    this.el.durationEl.textContent = formatTime(this.audio.duration);
  }

  _seekFromEvent(e) {
    if (isNaN(this.audio.duration)) return;
    const rect = this.el.progressBar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    this.audio.currentTime = pct * this.audio.duration;
    this._updateProgress();
  }

  /* ---------- volume ---------- */

  _volumeFromEvent(e) {
    const rect = this.el.volumeBar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    this.setVolume(pct);
  }

  setVolume(pct) {
    this.volume = pct;
    this.audio.volume = pct;
    this._setVolumeUI(pct);
  }

  _setVolumeUI(pct) {
    this.el.volumeFill.style.width = `${pct * 100}%`;
    let icon = ICONS.volumeHigh;
    if (pct === 0) icon = ICONS.volumeMute;
    else if (pct < 0.5) icon = ICONS.volumeLow;
    this.el.muteBtn.innerHTML = icon;
  }

  toggleMute() {
    if (this.volume > 0) {
      this.lastVolume = this.volume;
      this.setVolume(0);
    } else {
      this.setVolume(this.lastVolume || 0.5);
    }
  }

  /* ---------- like current song ---------- */

  async toggleLike() {
    const song = this.queue[this.currentIndex];
    if (!song) return;
    if (!isLoggedIn()) {
      window.location.href = 'login.html';
      return;
    }
    this.currentlyLiked = await toggleLikeSong(song.id, this.currentlyLiked);
    this._setLikeUI(this.currentlyLiked);
    document.dispatchEvent(new CustomEvent('song:like-changed', { detail: { songId: song.id, liked: this.currentlyLiked } }));
  }

  async _updateLikeState(songId) {
    this.currentlyLiked = await checkIfLiked(songId);
    this._setLikeUI(this.currentlyLiked);
  }

  _setLikeUI(liked) {
    this.el.likeBtn.innerHTML = liked ? ICONS.heartFilled : ICONS.heart;
    this.el.likeBtn.classList.toggle('liked', liked);
  }

  /* ---------- UI state ---------- */

  _setPlayingUI(isPlaying) {
    this.el.playPauseBtn.innerHTML = isPlaying ? ICONS.pause : ICONS.play;
    this.el.playerBar.classList.toggle('is-playing', isPlaying);
    document.dispatchEvent(new CustomEvent('player:state-changed', {
      detail: { isPlaying, song: this.queue[this.currentIndex] },
    }));
  }

  getCurrentSong() {
    return this.queue[this.currentIndex] || null;
  }

  isCurrentlyPlaying(songId) {
    const song = this.getCurrentSong();
    return !!song && song.id === songId && !this.audio.paused;
  }
}

// single shared instance used throughout the app
const player = new Player();
