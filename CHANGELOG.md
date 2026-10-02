# Changelog

## 1.1.0

- SDK 1.12 (`api ^1.12`, built against `@runmu.sh/sdk@^1.12`, tested with `@runmu.sh/dev@^0.2`).
- `Client.Web.Open` / `Client.Web.Close` contracts in the manifest: a body that is neither an object nor a string (an array, a number) is refused by the host with one `session.error` line and never reaches the extension.
- A replayed `Client.Web.Open` (the GMCP snapshot on reconnect or late activation) opens nothing and no longer logs a bogus "refused url" warning.
- The screen reader hears where a page went, as on Underspire: "<title> opened in a new view tab." / "<title> shown in its view tab.", followed by "Alt+O returns to the game output." This is announced only on the client that owns the session's effects.
- ☰ **Game notes**: the game's notes page, when a scene provider names it (`notes_url` extra, Underspire's Views → Notes). The row is listed only while the active session has one.
- Per-session bookkeeping is released when a session leaves scope; `ctx.api('webpages').pages(sid)` lists the open ids.
- `Client.Web 1` is declared from the manifest by the host (the runtime `supports` call is gone); the unused `read-output` capability is dropped.
- Types: `src/types.ts` (`WebpagesApi`, `WebOpen`, `WebClose`).

## 1.0.1

- Its own repository, [runmu-sh/ext-webpages](https://github.com/runmu-sh/ext-webpages), made with `npm create @runmu.sh/extension` and published to the marketplace from its version tags. The package is `@runmu.sh/ext-webpages`, built against `@runmu.sh/sdk` from npm. Nothing changes in the extension itself.

## 1.0.0

- First release (`webpages` on the marketplace). GMCP `Client.Web.Open {url,id?,title?}` / `Client.Web.Close {id?}` → `mu.panels.openWeb` / `closeWeb` (SDK 1.6, R-WEB-OPEN). Advertises `Client.Web 1` with `Core.Supports.Add` while enabled. Moved out of the μClient core so that a game can open pages in a player's client only after the player opts in per world.
