/** The exported API of `@runmu.sh/ext-webpages` (`ctx.api('webpages')`). */
export type { WebpagesApi } from './index.ts';
/** `Client.Web.Open` body: an object, or a bare URL string. */
export type WebOpen = { url: string; id?: string | number; title?: string } | string;
/** `Client.Web.Close` body: `{ id }`, a bare id, or `{}` for every page this extension opened in the session. */
export type WebClose = { id?: string | number } | string;
