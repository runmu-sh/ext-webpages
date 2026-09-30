# Web pages (`@runmu.sh/ext-webpages`, id `webpages`)

First-party extension on the marketplace (`webpages`, R-WEB-OPEN). Install it from Extensions → Discover and enable it per world; from then on that game can open web pages in your client, the way Underspire's `web_panel` opens its Notes, Help and NOUS deck. It is **not** part of the core on purpose: without it, GMCP `Client.Web.*` is ignored, so no game can push pages at you unless you opted in for that world.

## GMCP contract
While enabled it sends `Core.Supports.Add ["Client.Web 1"]` (and `Remove` when disabled). Names are case-insensitive.

| Package (game → client) | Body | Effect |
|---|---|---|
| `Client.Web.Open` | `{ "url": "https://…", "id": "deck", "title": "NOUS // DECK" }`. `id` defaults to the URL, `title` to "Web page"; a bare string is a URL. | `mu.panels.openWeb`: per Settings → Access → "Open web pages", a Web tab per `id` (the same `id` replaces its page; your own Views → Web page is a separate tab) or a new window (a blocked popup falls back to the tab with a toast). Only `http:`/`https:` URLs open. |
| `Client.Web.Close` | `{ "id": "deck" }`, a bare id, or `{}` for every page this extension opened in the session | `mu.panels.closeWeb`. Never closes your own Web page. |

A site that refuses to be framed (`X-Frame-Options`, CSP `frame-ancestors`, e.g. underspire.net's `/matrix/` and Notes) shows the browser's error in the tab; press **Always** on the tab's bar to send that site's pages to a new window from then on (remembered on this device).

Nothing is sent to the game besides the `Core.Supports` line. The pages a game opened close with the extension.

## API
`ctx.api('webpages')` returns `{ openSpec, closeId }` (the body parsers, exported for tests too).
