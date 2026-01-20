import { G as s, _ as u } from "./hooks.module-DczbA9Kc.mjs";
import l from "./visual-annotation.island.js";
import m from "./feedback-controls.island.js";
import f from "./manual-editor.island.js";
import c from "./history-tabs.island.js";
import p from "./overlay-viewer.island.js";
import w from "./playground.island.js";
const a = {
  "visual-annotation-island": l,
  "feedback-controls-island": m,
  "manual-editor-island": f,
  "history-tabs-island": c,
  "overlay-viewer-island": p,
  "playground-island": w
};
function y(n) {
  const o = n.getAttribute("data-props") || "{}";
  try {
    return JSON.parse(o);
  } catch (t) {
    return console.warn("island-runtime: failed to parse props", t), null;
  }
}
function I(n, o) {
  a[n] = o;
}
function r(n = document) {
  typeof window < "u" && (window.__islandRuntimeMounted = !0), n.querySelectorAll("[data-island]").forEach((t) => {
    const e = t.getAttribute("data-island");
    if (!e) return;
    const i = a[e];
    if (!i) {
      console.warn(`island-runtime: no component for '${e}'`);
      return;
    }
    const d = y(t);
    d !== null && (s(u(i, d), t), t.dataset && (t.dataset.mounted = "true"));
  });
}
if (typeof window < "u") {
  window.mountIslands = r, window.islandRuntime = {
    mountIslands: r,
    registerIsland: I,
    _registry: a
  };
  const n = () => {
    window.__islandRuntimeMounted || document.querySelector("[data-island]") && r(document);
  };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", n) : setTimeout(n, 0);
}
export {
  r as mountIslands,
  I as registerIsland
};
