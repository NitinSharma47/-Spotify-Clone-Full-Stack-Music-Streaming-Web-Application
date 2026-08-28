/**
 * Tests the matching logic in fetch_real_previews.js against realistic
 * mock iTunes API responses, without needing network access. Run:
 *   node database/test_matching_logic.js
 */
const { normalize, scoreMatch, pickBestMatch } = require('./fetch_real_previews');

let passed = 0;
let failed = 0;

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  ${ok ? '' : `(got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`}`);
  ok ? passed++ : failed++;
}

// ---------- normalize() ----------
check('normalize: lowercases + strips punctuation', normalize("Shape of You!"), 'shape of you');
check('normalize: strips accents (Señorita)', normalize('Señorita'), 'senorita');
check('normalize: strips accents (Für Elise)', normalize('Für Elise'), 'fur elise');
check('normalize: drops "feat." tail', normalize('Best Part feat. H.E.R.'), 'best part');

// ---------- scoreMatch() ----------
const exactMatch = scoreMatch(
  { title: 'Shape of You', artist: 'Ed Sheeran' },
  { trackName: 'Shape of You', artistName: 'Ed Sheeran' }
);
check('scoreMatch: exact title + exact artist = 100', exactMatch, 100);

const accentedMatch = scoreMatch(
  { title: 'Senorita', artist: 'Shawn Mendes & Camila Cabello' },
  { trackName: 'Señorita', artistName: 'Shawn Mendes & Camila Cabello' }
);
check('scoreMatch: accented title still matches exactly', accentedMatch, 100);

// classical piece: catalog lists the COMPOSER, iTunes returns a PERFORMER
const classicalMatch = scoreMatch(
  { title: 'Fur Elise', artist: 'Ludwig van Beethoven' },
  { trackName: 'Für Elise', artistName: 'Lang Lang' }
);
console.log(`classical (composer vs performer) score: ${classicalMatch} (need >= 40 to be accepted)`);
if (classicalMatch >= 40) { passed++; console.log('PASS  classical piece matches on title alone'); }
else { failed++; console.log('FAIL  classical piece should still match on title alone'); }

const totallyUnrelated = scoreMatch(
  { title: 'Kesariya', artist: 'Arijit Singh' },
  { trackName: 'Baby Shark', artistName: 'Pinkfong' }
);
check('scoreMatch: unrelated song scores 0', totallyUnrelated, 0);

const extendedClassicalTitle = scoreMatch(
  { title: 'Canon in D', artist: 'Johann Pachelbel' },
  { trackName: 'Canon in D Major, P. 37', artistName: 'Berliner Philharmoniker' }
);
console.log(`extended classical title score: ${extendedClassicalTitle} (need >= 40)`);
if (extendedClassicalTitle >= 40) { passed++; console.log('PASS  extended/annotated classical title still matches'); }
else { failed++; console.log('FAIL  extended classical title should still match via substring'); }

// ---------- pickBestMatch() ----------
const mockResults = [
  { trackName: 'Perfect (Acoustic)', artistName: 'Ed Sheeran', previewUrl: 'https://example.com/a.m4a' },
  { trackName: 'Perfect', artistName: 'Ed Sheeran', previewUrl: 'https://example.com/b.m4a' }, // best match
  { trackName: 'Perfect Symphony', artistName: 'Ed Sheeran & Andrea Bocelli', previewUrl: 'https://example.com/c.m4a' },
  { trackName: 'Some Other Song', artistName: 'Nobody Related', previewUrl: 'https://example.com/d.m4a' },
];
const best = pickBestMatch({ title: 'Perfect', artist: 'Ed Sheeran' }, mockResults);
check('pickBestMatch: picks the exact match over close variants', best && best.previewUrl, 'https://example.com/b.m4a');

const noPreviewResults = [{ trackName: 'Perfect', artistName: 'Ed Sheeran', previewUrl: null }];
check('pickBestMatch: rejects candidates with no previewUrl', pickBestMatch({ title: 'Perfect', artist: 'Ed Sheeran' }, noPreviewResults), null);

const emptyResults = pickBestMatch({ title: 'Kesariya', artist: 'Arijit Singh' }, []);
check('pickBestMatch: handles empty results array', emptyResults, null);

const nullResults = pickBestMatch({ title: 'Kesariya', artist: 'Arijit Singh' }, null);
check('pickBestMatch: handles null results (failed/malformed API response)', nullResults, null);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
