# Changelog

## 1.0.1

- Its own repository, [runmu-sh/ext-webpages](https://github.com/runmu-sh/ext-webpages), made with `npm create @runmu.sh/extension` and published to the marketplace from its version tags. The package is `@runmu.sh/ext-webpages`, built against `@runmu.sh/sdk` from npm. Nothing changes in the extension itself.

## 1.0.0

- First release (`webpages` on the marketplace). GMCP `Client.Web.Open {url,id?,title?}` / `Client.Web.Close {id?}` → `mu.panels.openWeb` / `closeWeb` (SDK 1.6, R-WEB-OPEN). Advertises `Client.Web 1` with `Core.Supports.Add` while enabled. Moved out of the μClient core so that a game can open pages in a player's client only after the player opts in per world.
