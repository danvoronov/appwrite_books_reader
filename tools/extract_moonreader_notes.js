#!/usr/bin/env node
/*
  Moon+ Reader (.mrpro) notes extractor using sql.js (pure JS SQLite)
  - Finds data/mrpro_extracted or extracts the latest data/*.mrpro via tar
  - Scans for com.flyersoft.moonreaderp/*.tag (SQLite DBs)
  - Reads table `notes` and (optionally) enriches with `books` when present
  - Writes output/moonreader_notes.json and output/moonreader_notes.md
*/

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

async function ensureDir(p) {
  await fs.promises.mkdir(p, { recursive: true });
}

function findLatestMrpro(dataDir) {
  const files = fs.readdirSync(dataDir)
    .filter(f => f.toLowerCase().endsWith('.mrpro'))
    .map(f => ({ f, stat: fs.statSync(path.join(dataDir, f)) }))
    .sort((a,b) => b.stat.mtimeMs - a.stat.mtimeMs);
  return files.length ? path.join(dataDir, files[0].f) : null;
}

function pathExists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

function tryExtractMrpro(mrproPath, outDir) {
  try {
    if (!pathExists(mrproPath)) return false;
    ensureDir(outDir);
    // Use system tar to extract
    cp.execFileSync('tar', ['-xf', mrproPath, '-C', outDir]);
    return true;
  } catch (e) {
    console.error('Extraction failed (tar). You may need to extract manually:', e.message);
    return false;
  }
}

function listTagFiles(extractRoot) {
  const base = path.join(extractRoot, 'com.flyersoft.moonreaderp');
  if (!pathExists(base)) return [];
  return fs.readdirSync(base)
    .filter(f => f.endsWith('.tag'))
    .map(f => path.join(base, f))
    .sort();
}

function bufToUint8Array(buf) {
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

function intToHexColor(code) {
  if (code == null || isNaN(code)) return null;
  // Android ARGB signed int -> extract RGB
  let n = Number(code);
  if (n < 0) n = 0xFFFFFFFF + n + 1; // convert to unsigned
  const rgb = n & 0x00FFFFFF; // drop alpha
  const hex = '#' + rgb.toString(16).padStart(6, '0');
  return hex.toLowerCase();
}

function mapColor(code) {
  // Moon+ uses integer color codes; provide a friendly mapping for common values
  const known = {
    0: 'yellow',
    1: 'green',
    2: 'blue',
    3: 'pink',
    4: 'underline',
    5: 'strike',
  };
  if (code == null) return null;
  // Fallback to hex color for unknown integers
  const hex = intToHexColor(code);
  return known[code] || hex || String(code);
}

function toDateStr(ms) {
  if (!ms || isNaN(ms)) return null;
  try { return new Date(Number(ms)).toISOString(); } catch { return null; }
}

async function loadSqlJs() {
  // Lazy import to avoid requiring at top-level if not installed
  const initSqlJs = require('sql.js');
  return await initSqlJs();
}

function queryAll(db, sql) {
  const res = db.exec(sql);
  if (!res || res.length === 0) return [];
  const { columns, values } = res[0];
  return values.map(row => Object.fromEntries(row.map((v,i)=>[columns[i], v])));
}

function safeQuery(db, sql) {
  try { return queryAll(db, sql); } catch { return []; }
}

async function extractNotesFromTag(sqljs, tagPath) {
  const buf = fs.readFileSync(tagPath);
  const db = new sqljs.Database(bufToUint8Array(buf));

  // Try to fetch books table for metadata (filename, author, description)
  // Some exports may use table names like 'books' or 'Books'
  let books = safeQuery(db, 'SELECT * FROM books');
  if (!books.length) books = safeQuery(db, 'SELECT * FROM Books');
  const booksByLower = new Map();
  for (const b of books) {
    const key = (b.lowerFilename || b.filename || '').toString().toLowerCase();
    if (key) booksByLower.set(key, b);
  }

  let notes = safeQuery(db, 'SELECT * FROM notes');
  if (!notes.length) notes = safeQuery(db, 'SELECT * FROM Notes');

  const items = notes.map(n => {
    const fileLower = (n.lowerFilename || n.filename || '').toString().toLowerCase();
    const bookMeta = booksByLower.get(fileLower) || null;
    return {
      sourceTag: path.basename(tagPath),
      book: n.book || bookMeta?.book || null,
      filename: n.filename || bookMeta?.filename || null,
      author: bookMeta?.author || null,
      description: bookMeta?.description || null,
      category: bookMeta?.category || null,
      chapter: n.lastChapter ?? null,
      splitIndex: n.lastSplitIndex ?? null,
      position: n.lastPosition ?? null,
      highlightLength: n.highlightLength ?? null,
      highlightColor: mapColor(n.highlightColor),
      timeMs: n.time ?? null,
      time: toDateStr(n.time),
      bookmark: n.bookmark || null,
      note: n.note || null,
      original: n.original || null,
      underline: !!n.underline,
      strikethrough: !!n.strikethrough,
    };
  });

  db.close();
  return items;
}

function groupBy(arr, keyFn) {
  const m = new Map();
  for (const item of arr) {
    const k = keyFn(item);
    const list = m.get(k) || [];
    list.push(item);
    m.set(k, list);
  }
  return m;
}

function escapeMd(s) {
  if (s == null) return '';
  return String(s)
    .replace(/\|/g, '\\|')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/`/g, '\\`');
}

function buildMarkdown(all) {
  const byBook = groupBy(all, it => (it.book || it.filename || 'Unknown'));
  const lines = [];
  lines.push('# Moon+ Reader Notes Export');
  lines.push('');
  for (const [book, items] of byBook) {
    // sort by time then position
    items.sort((a,b)=> (a.timeMs||0) - (b.timeMs||0) || (a.position||0) - (b.position||0));
    const meta = items.find(x=>x.author || x.category || x.description) || {};
    lines.push(`## ${escapeMd(book)}`);
    if (meta.author) lines.push(`- Author: ${escapeMd(meta.author)}`);
    if (meta.category) lines.push(`- Category: ${escapeMd(meta.category)}`);
    if (items[0]?.filename) lines.push(`- File: ${escapeMd(items[0].filename)}`);
    lines.push('');
    for (const it of items) {
      const t = it.time ? ` (${it.time})` : '';
      const ch = it.chapter != null ? ` [chapter ${it.chapter}]` : '';
      const pos = it.position != null ? ` [pos ${it.position}]` : '';
      const color = it.highlightColor ? ` [${it.highlightColor}]` : '';
      const src = it.sourceTag ? ` {${it.sourceTag}}` : '';
      const original = it.original ? `\n> ${escapeMd(it.original)}` : '';
      const note = it.note ? `\nNote: ${escapeMd(it.note)}` : '';
      lines.push(`- ${t}${ch}${pos}${color}${src}${original}${note}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function normalize(str) {
  return (str||'').toString().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function similarity(a, b) {
  // Simple token-based Jaccard similarity
  const A = new Set(normalize(a).split(' ').filter(Boolean));
  const B = new Set(normalize(b).split(' ').filter(Boolean));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const union = new Set([...A, ...B]).size;
  return inter / union;
}

function listLocalEpubs(projectRoot) {
  const fs = require('fs');
  const path = require('path');
  const epubDir = path.join(projectRoot, '..', 'epub');
  if (!fs.existsSync(epubDir)) return [];
  return fs.readdirSync(epubDir)
    .filter(f => f.toLowerCase().endsWith('.epub'))
    .map(f => ({ name: f.replace(/\.epub$/i, ''), file: path.join(epubDir, f) }));
}

function findBestEpubMatch(bookTitle, epubList) {
  let best = null;
  for (const e of epubList) {
    const score = Math.max(
      similarity(bookTitle, e.name),
      similarity(bookTitle.replace(/—.+$/, ''), e.name) // remove subtitles
    );
    if (!best || score > best.score) best = { ...e, score };
  }
  return best && best.score >= 0.35 ? best : null; // threshold can be tuned
}

async function main() {
  const dataDir = path.join(__dirname, '..', 'data');
  const outDir = path.join(__dirname, '..', 'output');
  const extractRoot = path.join(dataDir, 'mrpro_extracted');

  await ensureDir(outDir);

  let tagFiles = listTagFiles(extractRoot);
  if (tagFiles.length === 0) {
    // Try to extract
    const mrpro = findLatestMrpro(dataDir);
    if (!mrpro) {
      console.error('No .mrpro found in data/. Please place your export there.');
      process.exitCode = 1;
      return;
    }
    console.log('Extracting', mrpro);
    if (!tryExtractMrpro(mrpro, extractRoot)) {
      process.exitCode = 1;
      return;
    }
    tagFiles = listTagFiles(extractRoot);
  }

  if (tagFiles.length === 0) {
    console.error('No .tag files found after extraction.');
    process.exitCode = 1;
    return;
  }

  console.log(`Found ${tagFiles.length} tag DB files`);

  const sqljs = await loadSqlJs();

  const all = [];
  for (const tagPath of tagFiles) {
    try {
      const items = await extractNotesFromTag(sqljs, tagPath);
      console.log(path.basename(tagPath), '-', items.length, 'notes');
      all.push(...items);
    } catch (e) {
      console.warn('Failed to parse', tagPath, e.message);
    }
  }

  // Filter out items with neither original nor note
  const filtered = all.filter(x => (x.original && String(x.original).trim()) || (x.note && String(x.note).trim()));

  // Write JSON (all notes)
  const jsonPath = path.join(outDir, 'moonreader_notes.json');
  await fs.promises.writeFile(jsonPath, JSON.stringify(filtered, null, 2), 'utf8');

  // Per-book JSON folder
  const perBookDir = path.join(outDir, 'moonreader_books');
  await ensureDir(perBookDir);
  const byBook = groupBy(filtered, it => (it.book || it.filename || 'Unknown'));
  const index = [];
  const epubs = listLocalEpubs(path.join(__dirname, '..'));
  const crypto = require('crypto');
  for (const [book, items] of byBook) {
    const base = book.replace(/[\\\/:*?"<>|]/g, '_').trim();
    const hash = crypto.createHash('md5').update(book).digest('hex').slice(8,16);
    const safe = (base && base.slice(0, 80)) || 'book';
    const file = path.join(perBookDir, `${safe}_${hash}.json`);
    await fs.promises.writeFile(file, JSON.stringify(items, null, 2), 'utf8');
    const match = findBestEpubMatch(book, epubs);
    index.push({ 
      book, 
      file: `moonreader_books/${path.basename(file)}`, 
      count: items.length, 
      anyNote: items.some(x=>x.note), 
      anyBookmark: items.some(x=>!x.original && x.note),
      linkedEpub: match ? { name: match.name, score: Number(match.score.toFixed(3)) } : null
    });
  }
  await fs.promises.writeFile(path.join(outDir, 'moonreader_index.json'), JSON.stringify(index, null, 2), 'utf8');

  // Write Markdown
  const md = buildMarkdown(filtered);
  const mdPath = path.join(outDir, 'moonreader_notes.md');
  await fs.promises.writeFile(mdPath, md, 'utf8');

  console.log('Export complete:');
  console.log(' -', jsonPath);
  console.log(' -', mdPath);
  console.log(' - per-book:', perBookDir);
  console.log(' - index:', path.join(outDir, 'moonreader_index.json'));
}

main().catch(err => { console.error(err); process.exitCode = 1; });
