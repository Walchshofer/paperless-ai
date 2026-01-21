import { G as l, _ as m } from "./hooks.module-DczbA9Kc.mjs";
import c from "./visual-annotation.island.js";
import f from "./feedback-controls.island.js";
import p from "./manual-editor.island.js";
import w from "./history-tabs.island.js";
import y from "./overlay-viewer.island.js";
import g from "./playground.island.js";
const i = {
  "visual-annotation-island": c,
  "feedback-controls-island": f,
  "manual-editor-island": p,
  "history-tabs-island": w,
  "overlay-viewer-island": y,
  "playground-island": g
};
function I(t) {
  const o = t.getAttribute("data-props") || "{}";
  try {
    return JSON.parse(o);
  } catch (n) {
    return console.warn("island-runtime: failed to parse props", n), null;
  }
}
function b(t, o) {
  i[t] = o;
}
function d(t = document) {
  typeof window < "u" && (window.__islandRuntimeMounted = !0), t.querySelectorAll("[data-island]").forEach((n) => {
    const e = n.getAttribute("data-island");
    if (!e) return;
    const s = i[e];
    if (!s) {
      console.warn(`island-runtime: no component for '${e}'`);
      return;
    }
    const u = I(n);
    if (u === null) return;
    l(m(s, u), n);
    const r = n;
    r.dataset && (r.dataset.mounted = "true");
    const a = r.querySelector('[data-testid$="-root"]');
    a && !a.getAttribute("data-hydrated") && a.setAttribute("data-hydrated", "true");
  });
}
if (typeof window < "u") {
  window.mountIslands = d, window.islandRuntime = {
    mountIslands: d,
    registerIsland: b,
    _registry: i
  };
  const t = () => {
    window.__islandRuntimeMounted || document.querySelector("[data-island]") && d(document);
  };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", t) : setTimeout(t, 0);
}
export {
  d as mountIslands,
  b as registerIsland
};
