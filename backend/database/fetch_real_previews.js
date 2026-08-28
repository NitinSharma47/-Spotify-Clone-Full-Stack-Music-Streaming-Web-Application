/**
 * Enriches the song catalog with REAL 30-second preview clips of the
 * actual commercial recordings, fetched live from Apple's public iTunes
 * Search API (https://itunes.apple.com/search) — free, no API key needed.
 *
 * IMPORTANT — what this does and doesn't do:
 *   - It does NOT download or bundle copyrighted audio into this repo.
 *   - For each song, it asks Apple's API for a match and, if found, stores
 *     the *URL* (pointing at Apple's own CDN) in the audio_file column.
 *     Your browser streams directly from Apple's servers at playback
 *     time — nothing is copied, cached, or redistributed by this app.
 *   - Songs with no confident match keep their synthesized placeholder
 *     audio (from scripts/generate_demo_audio.py) automatically, so every
 *     song stays playable either way.
 *   - This only gets you 30-second previews, not full tracks — there is
 *     no legitimate way for an individual project to distribute full
 *     commercial recordings without an actual label license.
 *
 * NOTE: this needs a normal internet connection to itunes.apple.com.
 * It will NOT run inside network-restricted sandboxes/CI — run it on
 * your own machine, same as any other one-time setup script.
 *
 * Usage:
 *   node database/fetch_real_previews.js            (skips songs already matched)
 *   node database/fetch_real_previews.js --force     (re-checks every song)
 */
require('dotenv').config();
const pool = require('../config/db');

const ITUNES_SEARCH_URL = 'https://itunes.apple.com/search';
const REQUEST_DELAY_MS = 600; // stay comfortably under iTunes' informal rate limit
const MIN_SCORE_TO_ACCEPT = 40;
const SEARCH_LIMIT = 10;
const ITUNES_REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  Accept: 'application/json',
};

/** Lowercase, strip accents/diacritics, drop "feat. X", collapse punctuation. */
function normalize(str = '') {
  let s = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  s = s.replace(/\(feat[^)]*\)/g, '').replace(/\bfeat\.?.*$/, '').replace(/\bft\.?.*$/, '');
  s = s.replace(/[^a-z0-9]+/g, ' ').trim();
  return s;
}

/**
 * Scores how well an iTunes result matches our catalog entry.
 * Title is the primary signal (a candidate with zero title relation is
 * disqualified outright, even if the artist matches — otherwise a totally
 * different song by the same artist could get picked). Artist match adds
 * confidence on top, but isn't required — several catalog entries for
 * classical pieces list the *composer* as "artist", and iTunes will
 * return a *performer* instead, which is still a correct, real recording
 * of the right piece.
 */
function scoreMatch(song, candidate) {
  const wantTitle = normalize(song.title);
  const wantArtist = normalize(song.artist);
  const gotTitle = normalize(candidate.trackName);
  const gotArtist = normalize(candidate.artistName);

  let titleScore = 0;
  if (gotTitle === wantTitle) titleScore = 50;
  else if (wantTitle.length > 3 && (gotTitle.includes(wantTitle) || wantTitle.includes(gotTitle))) titleScore = 40;
  if (titleScore === 0) return 0;

  let artistScore = 0;
  if (gotArtist === wantArtist) artistScore = 50;
  else if (wantArtist.length > 3 && (gotArtist.includes(wantArtist) || wantArtist.includes(gotArtist))) artistScore = 25;

  return titleScore + artistScore;
}

function pickBestMatch(song, results) {
  const withPreview = (results || []).filter((r) => r.previewUrl && r.trackName);
  if (withPreview.length === 0) return null;
  const scored = withPreview.map((r) => ({ r, score: scoreMatch(song, r) })).sort((a, b) => b.score - a.score);
  return scored[0].score >= MIN_SCORE_TO_ACCEPT ? scored[0].r : null;
}

async function searchItunes(song) {
  const searchTerms = [
    `${song.title} ${song.artist}`,
    song.title,
    song.artist,
  ].filter(Boolean);

  for (const term of searchTerms) {
    const url = `${ITUNES_SEARCH_URL}?term=${encodeURIComponent(term)}&media=music&entity=song&limit=${SEARCH_LIMIT}&country=US&lang=en_us`;
    const res = await fetch(url, { headers: ITUNES_REQUEST_HEADERS });
    if (!res.ok) {
      // Retry with a simpler query if iTunes returns 403/429 or another transient error.
      if (res.status === 403 || res.status === 429) {
        continue;
      }
      throw new Error(`iTunes API returned HTTP ${res.status}`);
    }
    const data = await res.json();
    if (!Array.isArray(data.results)) {
      continue;
    }
    const match = pickBestMatch(song, data.results);
    if (match) return match;
  }
  return null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  const forceFlag = process.argv.includes('--force');

  const [songs] = await pool.query(
    `SELECT s.id, s.title, a.name AS artist FROM songs s
     LEFT JOIN artists a ON s.artist_id = a.id
     ${forceFlag ? '' : "WHERE s.audio_source != 'itunes' OR s.audio_source IS NULL"}
     ORDER BY s.id`
  );

  if (songs.length === 0) {
    console.log('Every song already has a real preview matched. Run with --force to re-check all of them.');
    process.exit(0);
  }

  console.log(`Looking up real previews for ${songs.length} song(s) via the iTunes Search API...`);
  console.log(`(~${Math.ceil((songs.length * REQUEST_DELAY_MS) / 1000)}s at a polite request rate)\n`);

  let matched = 0;
  const unmatched = [];

  for (const song of songs) {
    try {
      const best = await searchItunes(song);
      if (best) {
        await pool.query('UPDATE songs SET audio_file = ?, audio_source = ? WHERE id = ?', [
          best.previewUrl,
          'itunes',
          song.id,
        ]);
        matched++;
        console.log(`  \u2713 ${song.title} \u2014 ${song.artist}  ->  "${best.trackName}" by ${best.artistName}`);
      } else {
        unmatched.push(song);
        console.log(`  \u2717 ${song.title} \u2014 ${song.artist}  ->  no confident match, keeping placeholder`);
      }
    } catch (err) {
      unmatched.push(song);
      console.log(`  ! ${song.title} \u2014 ${song.artist}  ->  lookup failed (${err.message}), keeping placeholder`);
    }
    await sleep(REQUEST_DELAY_MS);
  }

  console.log(`\nDone. ${matched}/${songs.length} song(s) now have real preview audio.`);
  if (unmatched.length) {
    console.log(`${unmatched.length} kept the synthesized placeholder (safe to re-run later — it'll only retry these):`);
    unmatched.forEach((s) => console.log(`   - ${s.title} \u2014 ${s.artist}`));
  }

  const pruneFlag = process.argv.includes('--prune') || process.argv.includes('--delete-placeholders');
  if (pruneFlag && unmatched.length) {
    const ids = unmatched.map((s) => s.id);
    await pool.query('DELETE FROM songs WHERE id IN (?)', [ids]);
    console.log(`\nDeleted ${ids.length} placeholder song(s) from the database.`);
  }

  process.exit(0);
}

// Exported for the (network-free) unit test alongside this script.
module.exports = { normalize, scoreMatch, pickBestMatch };

if (require.main === module) {
  run().catch((err) => {
    console.error('Failed:', err.message);
    process.exit(1);
  });
}
