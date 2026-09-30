// src/index.ts
import { defineExtension } from "@muclient/sdk";
var isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
var str = (v) => typeof v === "string" ? v : typeof v === "number" ? String(v) : "";
function openSpec(data) {
  const d = isObj(data) ? data : typeof data === "string" ? { url: data } : null;
  if (!d) return null;
  const url = str(d.url);
  if (!url) return null;
  return { url, id: str(d.id) || void 0, title: str(d.title) || void 0 };
}
function closeId(data) {
  return isObj(data) ? str(data.id) : typeof data === "string" ? data : "";
}
var index_default = defineExtension({
  activate(ctx) {
    const mu = ctx.mu;
    const opened = /* @__PURE__ */ new Map();
    const open = (data, sid) => {
      const spec = openSpec(data);
      if (!spec) return;
      const where = mu.panels.openWeb(spec, sid);
      if (where === "blocked") {
        mu.log.warn(`Client.Web.Open: refused url ${JSON.stringify(spec.url)} (only http(s) opens)`);
        return;
      }
      let ids = opened.get(sid);
      if (!ids) opened.set(sid, ids = /* @__PURE__ */ new Set());
      ids.add(spec.id || spec.url);
    };
    const close = (data, sid) => {
      const id = closeId(data);
      const ids = opened.get(sid);
      if (id) {
        mu.panels.closeWeb(id, sid);
        ids?.delete(id);
        return;
      }
      for (const k of ids ?? []) mu.panels.closeWeb(k, sid);
      opened.delete(sid);
    };
    mu.gmcp.on("Client.Web", (data, { sid, pkg }) => {
      const leaf = pkg.toLowerCase();
      if (leaf === "client.web.open") open(data, sid);
      else if (leaf === "client.web.close") close(data, sid);
    });
    mu.gmcp.supports(["Client.Web 1"]);
    return { openSpec, closeId };
  }
});
export {
  closeId,
  index_default as default,
  openSpec
};
