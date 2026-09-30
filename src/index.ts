/**
 * @runmu.sh/ext-webpages: GMCP `Client.Web.Open` / `Client.Web.Close` → `mu.panels.openWeb` / `closeWeb`
 * (R-WEB-OPEN). The μClient counterpart of Underspire's `web_panel` OOB (Notes, Help, the NOUS deck).
 *
 * This is an extension, not core, on purpose: a game may open pages in a player's client only once the
 * player has installed and enabled this for that world. The core keeps the Web panel, the SDK method and
 * the "Open web pages" setting; the wire handler is here. On activation it tells the game the client
 * supports the package (`Core.Supports.Add ["Client.Web 1"]`), and `Remove`s it when disabled.
 */
import { defineExtension, type Mu } from '@muclient/sdk';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');

/** Parse an Open body: an object with url/id/title, or a bare URL string. Exported for tests. */
export function openSpec(data: unknown): { url: string; id?: string; title?: string } | null {
  const d = isObj(data) ? data : typeof data === 'string' ? { url: data } : null;
  if (!d) return null;
  const url = str(d.url);
  if (!url) return null;
  return { url, id: str(d.id) || undefined, title: str(d.title) || undefined };
}
/** Parse a Close body: `{id}`, a bare id string, or `{}` / nothing → '' meaning "every page this extension opened". */
export function closeId(data: unknown): string {
  return isObj(data) ? str(data.id) : typeof data === 'string' ? data : '';
}

export default defineExtension({
  activate(ctx) {
    const mu: Mu = ctx.mu;
    const opened = new Map<string, Set<string>>(); // sid → page ids this extension opened
    const open = (data: unknown, sid: string) => {
      const spec = openSpec(data);
      if (!spec) return;
      const where = mu.panels.openWeb(spec, sid);
      if (where === 'blocked') { mu.log.warn(`Client.Web.Open: refused url ${JSON.stringify(spec.url)} (only http(s) opens)`); return; }
      let ids = opened.get(sid);
      if (!ids) opened.set(sid, (ids = new Set()));
      ids.add(spec.id || spec.url);
    };
    const close = (data: unknown, sid: string) => {
      const id = closeId(data);
      const ids = opened.get(sid);
      if (id) { mu.panels.closeWeb(id, sid); ids?.delete(id); return; }
      for (const k of ids ?? []) mu.panels.closeWeb(k, sid);
      opened.delete(sid);
    };
    // Package names are case-insensitive; take the Client.Web namespace and match the leaf here.
    mu.gmcp.on('Client.Web', (data, { sid, pkg }) => {
      const leaf = pkg.toLowerCase();
      if (leaf === 'client.web.open') open(data, sid);
      else if (leaf === 'client.web.close') close(data, sid);
    });
    mu.gmcp.supports(['Client.Web 1']);
    return { openSpec, closeId };
  },
});
