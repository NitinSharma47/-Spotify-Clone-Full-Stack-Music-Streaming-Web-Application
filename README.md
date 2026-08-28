# Spotify Clone — Full Stack Music Streaming Web Application

A full-stack music streaming web application inspired by Spotify, built with a responsive
dark-themed UI, a RESTful API, and a relational MySQL database. Built as a portfolio project
to demonstrate full-stack development skills.

**Tech Stack:** HTML5 · CSS3 · JavaScript (vanilla ES6+) · Node.js · Express.js · MySQL

---

## ✨ Features

- **Song search** — live, debounced search across song title, artist, and album
- **Playlist management** — create, rename, delete playlists; add/remove songs; public/private playlists
- **Liked Songs** — like/unlike any track, with a dedicated Liked Songs library view
- **Full music player controls** — play, pause, next, previous, seek/scrub the progress bar,
  volume up/down with mute, shuffle, and repeat (off → all → one)
- **Browse by genre** — 11 genres including Bollywood, Punjabi, Pop, Rock, Hip-Hop, EDM, K-Pop,
  Classical, R&B, Country, and Latin
- **User accounts** — registration and login secured with hashed passwords (bcrypt) and JWT auth
- **Recently played tracking** and **play counts** ("Popular right now" on the home screen)
- **Responsive design** — usable on desktop, tablet, and mobile
- **137-song catalog** of real, accurately-credited tracks (see [About the catalog](#-about-the-song-catalog--demo-audio) below)

## 🖼 Screenshots

*Run the app locally (see [Setup](#-setup) below) and drop your own screenshots here —
`home view`, `now playing bar`, `playlist view`, `search results`, `login screen`.*

## 🧱 Tech Stack & Architecture

| Layer          | Technology                                              |
|----------------|-----------------------------------------------------------|
| Frontend       | HTML5, CSS3 (hand-written, no framework), vanilla JavaScript |
| Backend        | Node.js, Express.js — RESTful API                       |
| Database       | MySQL 8 (normalized schema — see below)                 |
| Auth           | JWT (`jsonwebtoken`) + password hashing (`bcryptjs`)     |

The backend serves both the REST API (`/api/*`) **and** the static frontend from a single
Express server, so the whole app runs from one `npm start` — while still being architected as
a proper decoupled API underneath (the frontend only ever talks to `/api/*` over `fetch()`,
so it could just as easily be deployed separately and pointed at the API on another host).

### Project structure

```
spotify-clone/
├── backend/
│   ├── config/db.js              # MySQL connection pool
│   ├── controllers/              # business logic (auth, songs, playlists, users, artists)
│   ├── middleware/                # JWT auth + centralized error handling
│   ├── routes/                    # Express route definitions
│   ├── database/
│   │   ├── schema.sql             # full DB schema
│   │   ├── songsData.js           # 137-song catalog (metadata)
│   │   ├── seed.js                # seeds artists/albums/songs into MySQL
│   │   ├── fetch_real_previews.js # optional: pulls real 30s previews via iTunes API
│   │   └── test_matching_logic.js # unit tests for the above (no network needed)
│   ├── public/audio/              # placeholder playback audio (see below)
│   ├── server.js                  # Express app entry point
│   └── package.json
├── frontend/
│   ├── index.html / login.html / signup.html
│   ├── css/                       # style.css, player.css, auth.css, responsive.css
│   ├── js/                        # api.js, auth.js, player.js, search.js, app.js, utils.js
│   └── assets/                    # logo + icons
├── scripts/
│   └── generate_demo_audio.py     # regenerates the placeholder audio tracks
└── README.md
```

## 🎵 About the song catalog & real audio

The catalog (`backend/database/songsData.js`) lists **137 real, commercially released songs**
with accurate title / artist / album / genre / year metadata — a mix of Bollywood, Punjabi,
Hollywood pop, rock, hip-hop, EDM, K-pop, classical, and more.

**Every song ships with playable audio out of the box** — 13 original instrumental tracks,
algorithmically synthesized by `scripts/generate_demo_audio.py` and mapped by genre, so
play/pause/seek/next/previous/volume/shuffle/repeat all work immediately with zero setup.

**To upgrade to real audio of the real songs**, run one more command after seeding:
```bash
npm run fetch-previews
```
This looks each song up against **Apple's public iTunes Search API** (free, no API key) and,
where it finds a confident match, replaces that song's placeholder with a **real 30-second
preview clip of the actual commercial recording** — streamed live from Apple's own CDN at
playback time. A small "Preview via Apple Music ↗" attribution appears in the player bar
whenever a real preview is playing.

A few things worth understanding about this:
- **Nothing is downloaded or bundled into the repo.** The database only stores a URL; your
  browser streams the audio directly from Apple's servers each time. No copyrighted files are
  copied, cached, or redistributed by this app or its Git history.
- **It's 30 seconds, not the full track.** There's no legitimate way for an individual project
  to distribute full commercial recordings without an actual label license — this is the same
  constraint real Spotify solves by signing deals with labels, not something unique to this
  project. 30-second previews are what Apple's API is designed and authorized to serve.
- **Coverage isn't guaranteed for every song.** Older catalog entries and some classical pieces
  (where the catalog lists the *composer*, not a performer) may not find a confident match —
  those simply keep their synthesized placeholder automatically, so nothing ever breaks.
- **This needs a normal internet connection** to `itunes.apple.com` — it won't run inside
  network-restricted CI/sandbox environments. Run it locally, same as `npm run seed`.
- The matching logic has its own test suite: `npm run test-matching` (no network required).

Re-running `npm run fetch-previews` only retries songs that weren't matched yet; add `--force`
to re-check everything.

**To use your own audio instead:** replace files in `backend/public/audio/`, or directly set
a song's `audio_file` in the database to any URL or local filename — the player doesn't care
which, as long as it resolves to a playable audio file.

## 🗄 Database Schema

Normalized MySQL schema — `artists` and `albums` are proper tables (not just text fields on
`songs`), so the catalog supports real relational queries (e.g. "all songs by this artist").

```
users            — id, username, email, password_hash, avatar_color
artists          — id, name, bio
albums           — id, title, artist_id (FK), release_year
songs            — id, title, artist_id (FK), album_id (FK), genre, language,
                    duration, release_year, audio_file, audio_source, play_count
playlists        — id, user_id (FK), name, description, is_public
playlist_songs   — playlist_id (FK), song_id (FK), position   [junction table]
liked_songs      — user_id (FK), song_id (FK)                 [junction table]
recently_played  — user_id (FK), song_id (FK), played_at
```

Full definitions with indexes and foreign keys: [`backend/database/schema.sql`](backend/database/schema.sql)

## 🔌 API Reference

All endpoints are prefixed with `/api`. Protected endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint                                   | Auth | Description                       |
|--------|---------------------------------------------|------|------------------------------------|
| POST   | `/auth/register`                            | —    | Create an account                  |
| POST   | `/auth/login`                               | —    | Log in, receive a JWT              |
| GET    | `/auth/me`                                  | ✅   | Current user profile               |
| GET    | `/songs?genre=&limit=&offset=`              | —    | List songs (optionally by genre)   |
| GET    | `/songs/search?q=`                          | —    | Search title / artist / album      |
| GET    | `/songs/genres`                             | —    | List genres with counts            |
| GET    | `/songs/top`                                | —    | Most-played songs                  |
| GET    | `/songs/:id`                                | —    | Single song detail                 |
| POST   | `/songs/:id/play`                           | —    | Increment play count               |
| GET    | `/playlists`                                | ✅   | Current user's playlists           |
| POST   | `/playlists`                                | ✅   | Create a playlist                  |
| GET    | `/playlists/:id`                            | opt. | Playlist detail + songs            |
| PUT    | `/playlists/:id`                            | ✅   | Rename / edit a playlist           |
| DELETE | `/playlists/:id`                            | ✅   | Delete a playlist                  |
| POST   | `/playlists/:id/songs`                      | ✅   | Add a song to a playlist           |
| DELETE | `/playlists/:id/songs/:songId`              | ✅   | Remove a song from a playlist      |
| GET    | `/users/me/liked-songs`                     | ✅   | List liked songs                   |
| POST   | `/users/me/liked-songs`                     | ✅   | Like a song                        |
| DELETE | `/users/me/liked-songs/:songId`             | ✅   | Unlike a song                      |
| GET    | `/users/me/recently-played`                 | ✅   | Recently played history            |
| GET    | `/artists` / `/artists/:id`                 | —    | Browse artists                     |

## ⚙️ Setup

### Prerequisites
- [Node.js](https://nodejs.org/) v18+
- [MySQL](https://dev.mysql.com/downloads/) 8.x running locally (or update `.env` to point elsewhere)
- Python 3 + `numpy` (only if you want to *regenerate* the placeholder audio — not required to run the app, since the `.wav` files are already included)

### 1. Clone and install
```bash
git clone <your-repo-url>
cd spotify-clone/backend
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```
Edit `.env` with your MySQL credentials and a JWT secret:
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=spotify_clone
JWT_SECRET=some_long_random_string
```

> Tip: don't run the app as MySQL `root` in anything beyond local dev. Create a dedicated user:
> ```sql
> CREATE USER 'spotify_app'@'localhost' IDENTIFIED WITH mysql_native_password BY 'yourpassword';
> GRANT ALL PRIVILEGES ON spotify_clone.* TO 'spotify_app'@'localhost';
> ```

### 3. Create the database
```bash
mysql -u root -p < database/schema.sql
```

### 4. Seed the catalog (137 songs, artists, albums)
```bash
npm run seed
```

### 5. (Optional but recommended) Get real audio for the real songs
```bash
npm run fetch-previews
```
This fetches real 30-second preview clips from Apple's iTunes API for as many of the 137
songs as it can confidently match — see [About the song catalog & real audio](#-about-the-song-catalog--real-audio)
above for exactly how this works and why it's 30 seconds rather than full tracks. Skip this
step if you just want to try the app quickly — everything works with the placeholder audio too.

### 6. Start the server
```bash
npm start        # production
npm run dev       # auto-restart on file changes (requires nodemon, included in devDependencies)
```

Open **http://localhost:5000** — sign up for an account and start exploring.

### Regenerating the placeholder audio (optional)
```bash
cd scripts
pip install numpy
python3 generate_demo_audio.py
```

## 🧪 Tested

This went through a full end-to-end audit, not just a smoke test:

- **Backend & database**: schema applied to a real MySQL instance, all 137 songs seeded and
  verified via SQL joins, every REST endpoint hit with real requests (register, login, create
  playlist, add/remove songs, like songs, playback/play-count tracking, recently played)
- **Security**: passwords confirmed hashed with bcrypt (never plaintext) directly in the
  database; JWT signature tampering correctly rejected (403); SQL injection payloads on search
  and login neutralized (parameterized queries — verified the `songs` table survives a
  `DROP TABLE` injection attempt); XSS payloads in usernames/playlist names verified to render
  as escaped text, never as live HTML; cross-user authorization boundaries confirmed (a second
  user can't view, edit, or delete another user's private playlist)
- **Audio**: every placeholder `.wav` inspected at the waveform level (correct format, healthy
  signal, no clipping); HTTP Range requests confirmed working (`206 Partial Content` with exact
  byte ranges — this is what makes seeking smooth in a real browser)
- **Frontend**: driven in a real DOM environment — actual simulated clicks and mouse-drags for
  play/pause, seeking, volume, shuffle, repeat cycling, next/previous (including the "restart
  vs. skip back" behavior matching real Spotify), search-as-you-type, and the full
  create-playlist and add-to-playlist modal flows — with zero console errors, logged in and out
- **iTunes preview matching**: the fuzzy title/artist matching logic used by
  `fetch_real_previews.js` has its own unit test suite (`npm run test-matching`) covering
  accented characters, "feat." tails, and composer-vs-performer classical pieces

## 🚀 Possible next steps

- Artist and album detail pages
- Collaborative / shareable playlists
- An "admin" upload flow for adding new songs through the UI instead of the seed script
- Queue view / drag-to-reorder
- Automated test suite (Jest/Supertest for the API)
- Dockerize (backend + MySQL via docker-compose) for one-command setup

## 📄 License

MIT — see [LICENSE](LICENSE).
