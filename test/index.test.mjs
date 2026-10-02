/**
 * `npm test`: the bridge against a small fake `mu` (the headless host does not model openWeb, menus or a11y).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load } from './load.mjs';

function fakeMu({ owner = true, extras = {} } = {}) {
  const calls = [], subs = { gmcp: [], each: [] }, menus = [];
  const sessions = new Map([['s1', { id: 's1' }], ['s2', { id: 's2' }]]);
  const cleanups = new Map();
  const state = { extras, watch: null };
  const mu = {
    sessions: {
      active: () => sessions.get('s1'),
      on: () => () => {},
      each: (setup) => { for (const s of sessions.values()) { const c = setup(s); if (c) cleanups.set(s.id, c); } subs.each.push(setup); return () => {}; },
    },
    gmcp: { on: (pkg, fn) => { subs.gmcp.push({ pkg, fn }); return () => {}; } },
    panels: {
      openWeb: (spec, sid) => { calls.push(['open', sid, spec]); return /^https?:/i.test(spec.url) ? 'panel' : 'blocked'; },
      closeWeb: (id, sid) => { calls.push(['close', sid, id]); },
    },
    effects: { owner: () => owner },
    a11y: { announce: (t) => calls.push(['say', t]) },
    scene: { get: () => ({ extras: state.extras }), watch: (fn) => { state.watch = fn; fn({ extras: state.extras }); return () => {}; } },
    menus: { add: (spec) => { menus.push(spec); return () => { menus.splice(menus.indexOf(spec), 1); }; } },
    log: { warn: (m) => calls.push(['warn', m]), info() {}, error() {} },
  };
  const gmcp = (sid, pkg, data, replay = false) => { for (const s of subs.gmcp) if (pkg.toLowerCase().startsWith(s.pkg.toLowerCase())) s.fn(data, { sid, pkg, replay }); };
  const endSession = (sid) => { cleanups.get(sid)?.(); cleanups.delete(sid); };
  const setExtras = (x) => { state.extras = x; state.watch?.({ extras: x }); };
  return { mu, calls, menus, gmcp, endSession, setExtras };
}
async function start(opts) {
  const mod = await load('src/index.ts');
  const f = fakeMu(opts);
  const ctx = { mu: f.mu, subscriptions: [] };
  const api = mod.default.activate(ctx);
  return { ...f, api, mod, ctx };
}

test('parsers: openSpec / closeId accept objects and bare strings', async () => {
  const { openSpec, closeId, notesUrl } = await load('src/index.ts');
  assert.deepEqual(openSpec({ url: ' https://x/ ', id: 7, title: 'T' }), { url: 'https://x/', id: '7', title: 'T' });
  assert.deepEqual(openSpec('https://y/'), { url: 'https://y/', id: undefined, title: undefined });
  assert.equal(openSpec({}), null);
  assert.equal(openSpec([1, 2]), null);
  assert.equal(closeId({ id: 3 }), '3');
  assert.equal(closeId('deck'), 'deck');
  assert.equal(closeId(undefined), '');
  assert.equal(notesUrl({ notes_url: 'https://n/' }), 'https://n/');
  assert.equal(notesUrl({ notes_url: 'javascript:alert(1)' }), '');
});

test('Open opens, announces once as opened then as shown; replay opens nothing', async () => {
  const t = await start();
  t.gmcp('s1', 'Client.Web.Open', { url: 'https://deck/', id: 'deck', title: 'NOUS' }, true);
  assert.deepEqual(t.calls, [], 'replayed Open is ignored, without a warning');
  t.gmcp('s1', 'client.web.open', { url: 'https://deck/', id: 'deck', title: 'NOUS' });
  t.gmcp('s1', 'Client.Web.Open', { url: 'https://deck/', id: 'deck', title: 'NOUS' });
  assert.deepEqual(t.calls.filter((c) => c[0] === 'say').map((c) => c[1]), [
    'NOUS opened in a new view tab. Alt+O returns to the game output.',
    'NOUS shown in its view tab. Alt+O returns to the game output.',
  ]);
  assert.deepEqual(t.api.pages('s1'), ['deck']);
});

test('no announcement away from the effect owner; a refused URL warns', async () => {
  const t = await start({ owner: false });
  t.gmcp('s1', 'Client.Web.Open', { url: 'https://a/' });
  t.gmcp('s1', 'Client.Web.Open', { url: 'javascript:alert(1)' });
  assert.equal(t.calls.filter((c) => c[0] === 'say').length, 0);
  assert.equal(t.calls.filter((c) => c[0] === 'warn').length, 1);
  assert.deepEqual(t.api.pages('s1'), ['https://a/']);
});

test('Close by id, and Close {} closes every page opened in that session only', async () => {
  const t = await start();
  t.gmcp('s1', 'Client.Web.Open', { url: 'https://a/', id: 'a' });
  t.gmcp('s1', 'Client.Web.Open', { url: 'https://b/', id: 'b' });
  t.gmcp('s2', 'Client.Web.Open', { url: 'https://c/', id: 'c' });
  t.gmcp('s1', 'Client.Web.Close', { id: 'a' });
  assert.deepEqual(t.api.pages('s1'), ['b']);
  t.gmcp('s1', 'Client.Web.Close', {});
  assert.deepEqual(t.calls.filter((c) => c[0] === 'close'), [['close', 's1', 'a'], ['close', 's1', 'b']]);
  assert.deepEqual(t.api.pages('s2'), ['c']);
});

test('a session leaving scope releases its bookkeeping', async () => {
  const t = await start();
  t.gmcp('s2', 'Client.Web.Open', { url: 'https://c/', id: 'c' });
  t.endSession('s2');
  assert.deepEqual(t.api.pages('s2'), []);
});

test('☰ Game notes: listed only while the scene names an http(s) notes page; opens it', async () => {
  const t = await start();
  assert.equal(t.menus.length, 0);
  t.setExtras({ notes_url: 'javascript:x' });
  assert.equal(t.menus.length, 0);
  t.setExtras({ notes_url: 'https://notes/' });
  assert.equal(t.menus.length, 1);
  const row = t.menus[0];
  assert.equal(row.slot, 'main');
  assert.equal(row.title, 'Game notes');
  assert.equal(row.icon, '≡');
  row.run();
  assert.deepEqual(t.calls.find((c) => c[0] === 'open'), ['open', 's1', { url: 'https://notes/', id: 'notes', title: 'Notes' }]);
  t.setExtras({});
  assert.equal(t.menus.length, 0);
});

test('manifest: SDK 1.12, Client.Web contracts, no undeclared capability', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
  const m = pkg.muclient;
  assert.equal(m.api, '^1.12');
  const g = m.contributes.gmcp[0];
  assert.equal(g.package, 'Client.Web 1');
  assert.deepEqual(Object.keys(g.messages).sort(), ['Client.Web.Close', 'Client.Web.Open']);
  assert.ok(Object.values(g.messages).every((x) => x.dir === 'in'));
  assert.deepEqual(m.capabilities, ['open-web']);
});
