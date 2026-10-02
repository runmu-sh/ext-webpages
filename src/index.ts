/**
 * @runmu.sh/ext-webpages: GMCP `Client.Web.Open` / `Client.Web.Close` → `mu.panels.openWeb` / `closeWeb`.
 * The μClient counterpart of Underspire's `web_panel` OOB (Notes, Help, the NOUS deck).
 *
 * This is an extension, not core, on purpose: a game may open pages in a player's client only once the
 * player has installed and enabled this for that world. The core keeps the Web panel, the SDK method and
 * the "Open web pages" setting; the wire handler is here. The host declares `Client.Web 1` to the game from
 * the manifest while the extension is enabled in a world, and withdraws it when it is disabled.
 *
 * Since 1.1 (SDK 1.12): payload contracts in the manifest (a malformed body never reaches the handlers), a
 * replayed Open (reconnect, late activation) opens nothing, the per-session bookkeeping is released with the
 * session, the screen-reader announcement Underspire makes, and a ☰ "Game notes" row when the game names its
 * notes page (scene extra `notes_url`).
 */
import { defineExtension, type Dispose, type Mu } from '@muclient/sdk';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');

/** Parse an Open body: an object with url/id/title, or a bare URL string. Exported for tests. */
export function openSpec(data: unknown): { url: string; id?: string; title?: string } | null {
  const d = isObj(data) ? data : typeof data === 'string' ? { url: data } : null;
  if (!d) return null;
  const url = str(d.url).trim();
  if (!url) return null;
  return { url, id: str(d.id) || undefined, title: str(d.title) || undefined };
}
/** Parse a Close body: `{id}`, a bare id string, or `{}` / nothing → '' meaning "every page this extension opened". */
export function closeId(data: unknown): string {
  return isObj(data) ? str(data.id) : typeof data === 'string' ? data : '';
}

/** The page id `openWeb` keys a spec by: its id, else its URL. */
export const pageId = (spec: { url: string; id?: string }): string => spec.id || spec.url;

/** The scene extra a game sets to name its notes page (Underspire's `notes_url`). */
export const NOTES_EXTRA = 'notes_url';
/** The notes URL in a scene's extras, when it is an http(s) URL; '' otherwise. */
export function notesUrl(extras: Record<string, string> | undefined | null): string {
  const u = String(extras?.[NOTES_EXTRA] ?? '').trim();
  return /^https?:\/\//i.test(u) ? u : '';
}

export const COPY = {
  title: 'Web page',
  notes: 'Game notes',
  opened: (title: string) => `${title} opened in a new view tab. Alt+O returns to the game output.`,
  shown: (title: string) => `${title} shown in its view tab. Alt+O returns to the game output.`,
};

export interface WebpagesApi {
  openSpec: typeof openSpec;
  closeId: typeof closeId;
  /** The ids of the pages this extension opened in `sid` (default: the active session). @since 1.1.0 */
  pages(sid?: string): string[];
}

export default defineExtension({
  activate(ctx) {
    const mu: Mu = ctx.mu;
    const opened = new Map<string, Set<string>>(); // sid → page ids this extension opened
    const activeSid = () => mu.sessions.active()?.id ?? '';

    const open = (data: unknown, sid: string) => {
      const spec = openSpec(data);
      if (!spec) return;
      const id = pageId(spec);
      const again = opened.get(sid)?.has(id) ?? false;
      const where = mu.panels.openWeb(spec, sid);
      if (where === 'blocked') { mu.log.warn(`Client.Web.Open: refused url ${JSON.stringify(spec.url)} (only http(s) opens)`); return; }
      let ids = opened.get(sid);
      if (!ids) opened.set(sid, (ids = new Set()));
      ids.add(id);
      // Underspire tells a screen reader where the page went; only where the player is.
      if (where === 'panel' && mu.effects.owner(sid)) {
        const title = spec.title || COPY.title;
        mu.a11y.announce(again ? COPY.shown(title) : COPY.opened(title));
      }
    };
    const close = (data: unknown, sid: string) => {
      const id = closeId(data);
      const ids = opened.get(sid);
      if (id) { mu.panels.closeWeb(id, sid); ids?.delete(id); return; }
      for (const k of ids ?? []) mu.panels.closeWeb(k, sid);
      opened.delete(sid);
    };

    // Package names are case-insensitive; take the Client.Web namespace and match the leaf here. A replayed
    // Open (the snapshot on reconnect or late activation) must not reopen a page by itself; a replayed Close
    // is harmless.
    ctx.subscriptions.push(mu.gmcp.on('Client.Web', (data, { sid, pkg, replay }) => {
      const leaf = pkg.toLowerCase();
      if (leaf === 'client.web.open') { if (!replay) open(data, sid); }
      else if (leaf === 'client.web.close') close(data, sid);
    }));

    // Per-session state goes with the session (the host closes the pages themselves).
    ctx.subscriptions.push(mu.sessions.each((s) => () => { opened.delete(s.id); }));

    // ☰ Game notes: Underspire's Views → Notes, listed only while the active session's game names its notes
    // page (scene extra `notes_url`). The ☰ menu greys a row whose `when` fails, so the row comes and goes instead.
    const notesOf = (sid: string | null) => (sid ? notesUrl(mu.scene.get(sid)?.extras) : '');
    let row: Dispose | null = null;
    const sync = () => {
      const want = !!notesOf(activeSid() || null);
      if (want && !row) {
        row = mu.menus.add({
          id: 'webpages.notes', slot: 'main', title: COPY.notes, icon: '≡', order: 60,
          run: () => {
            const sid = activeSid();
            const url = notesOf(sid);
            if (url) open({ url, id: 'notes', title: 'Notes' }, sid);
          },
        });
      } else if (!want && row) { row(); row = null; }
    };
    let sceneOff: Dispose | null = null;
    const follow = () => {
      sceneOff?.();
      const sid = activeSid();
      sceneOff = sid ? mu.scene.watch(sync, sid) : null;
      sync();
    };
    ctx.subscriptions.push(mu.sessions.on('switch', follow));
    follow();
    ctx.subscriptions.push(() => { sceneOff?.(); row?.(); row = null; });

    const api: WebpagesApi = { openSpec, closeId, pages: (sid) => [...(opened.get(sid ?? activeSid()) ?? [])] };
    const off: Dispose = () => { opened.clear(); };
    ctx.subscriptions.push(off);
    return api;
  },
});
