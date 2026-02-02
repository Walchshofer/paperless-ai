import { H as Y, k as F, d as P, A as E, h as Ie, T as B, _ as ee, F as Ke, g as He, y as S, P as Ye, x as q, q as R, a as Z, b as Ot, Q, c as D, K as er, G as de, J as tr, l as k, e as nr, u as c } from "./hooks.module-Bbo057yU.mjs";
import rr from "./visual-annotation.island.js";
import or from "./feedback-controls.island.js";
import ar from "./manual-editor.island.js";
import ir from "./smart-metadata.island.js";
import sr from "./history-tabs.island.js";
import cr from "./overlay-viewer.island.js";
import lr from "./visual-overlays.island.js";
import ur from "./playground.island.js";
import dr from "./overview-dashboard.island.js";
import fr from "./settings-sidebar.island.js";
import pr from "./connection-settings.island.js";
import { A as vr, E as mr } from "./AIProviderIsland-DrmQu1S4.mjs";
import hr from "./restart-banner.island.js";
import gr from "./developer-settings.island.js";
import yr from "./presets-manager.island.js";
import br from "./export-panel.island.js";
import _r from "./view-mode-toggle.island.js";
import Cr from "./tags-manager.island.js";
import Er from "./ai-analysis.island.js";
import Sr from "./chat-workspace.island.js";
import wr from "./history-manager.island.js";
import Nr from "./manual-workspace.island.js";
import Ir from "./document-content.island.js";
import Tr from "./unified-workspace.island.js";
import Pr from "./document-context-bar.island.js";
import xr from "./context-sidebar.island.js";
import Dr from "./resizable-layout.island.js";
function Rt(e, t) {
  for (var n in t) e[n] = t[n];
  return e;
}
function Ve(e, t) {
  for (var n in e) if (n !== "__source" && !(n in t)) return !0;
  for (var r in t) if (r !== "__source" && e[r] !== t[r]) return !0;
  return !1;
}
function qe(e, t) {
  var n = t(), r = P({ t: { __: n, u: t } }), o = r[0].t, a = r[1];
  return ee(function() {
    o.__ = n, o.u = t, Re(o) && a({ t: o });
  }, [e, n, t]), S(function() {
    return Re(o) && a({ t: o }), e(function() {
      Re(o) && a({ t: o });
    });
  }, [e]), n;
}
function Re(e) {
  var t, n, r = e.u, o = e.__;
  try {
    var a = r();
    return !((t = o) === (n = a) && (t !== 0 || 1 / t == 1 / n) || t != t && n != n);
  } catch {
    return !0;
  }
}
function Xe(e) {
  e();
}
function Ze(e) {
  return e;
}
function Qe() {
  return [!1, Xe];
}
var Je = ee;
function Se(e, t) {
  this.props = e, this.context = t;
}
function At(e, t) {
  function n(o) {
    var a = this.props.ref, s = a == o.ref;
    return !s && a && (a.call ? a(null) : a.current = null), t ? !t(this.props, o) || !s : Ve(this.props, o);
  }
  function r(o) {
    return this.shouldComponentUpdate = n, D(e, o);
  }
  return r.displayName = "Memo(" + (e.displayName || e.name) + ")", r.prototype.isReactComponent = !0, r.__f = !0, r.type = e, r;
}
(Se.prototype = new Z()).isPureReactComponent = !0, Se.prototype.shouldComponentUpdate = function(e, t) {
  return Ve(this.props, e) || Ve(this.state, t);
};
var st = k.__b;
k.__b = function(e) {
  e.type && e.type.__f && e.ref && (e.props.ref = e.ref, e.ref = null), st && st(e);
};
var Or = typeof Symbol < "u" && Symbol.for && Symbol.for("react.forward_ref") || 3911;
function N(e) {
  function t(n) {
    var r = Rt({}, n);
    return delete r.ref, e(r, n.ref || null);
  }
  return t.$$typeof = Or, t.render = e, t.prototype.isReactComponent = t.__f = !0, t.displayName = "ForwardRef(" + (e.displayName || e.name) + ")", t;
}
var ct = function(e, t) {
  return e == null ? null : Y(Y(e).map(t));
}, $ = { map: ct, forEach: ct, count: function(e) {
  return e ? Y(e).length : 0;
}, only: function(e) {
  var t = Y(e);
  if (t.length !== 1) throw "Children.only";
  return t[0];
}, toArray: Y }, Rr = k.__e;
k.__e = function(e, t, n, r) {
  if (e.then) {
    for (var o, a = t; a = a.__; ) if ((o = a.__c) && o.__c) return t.__e == null && (t.__e = n.__e, t.__k = n.__k), o.__c(e, t);
  }
  Rr(e, t, n, r);
};
var lt = k.unmount;
function Mt(e, t, n) {
  return e && (e.__c && e.__c.__H && (e.__c.__H.__.forEach(function(r) {
    typeof r.__c == "function" && r.__c();
  }), e.__c.__H = null), (e = Rt({}, e)).__c != null && (e.__c.__P === n && (e.__c.__P = t), e.__c.__e = !0, e.__c = null), e.__k = e.__k && e.__k.map(function(r) {
    return Mt(r, t, n);
  })), e;
}
function kt(e, t, n) {
  return e && n && (e.__v = null, e.__k = e.__k && e.__k.map(function(r) {
    return kt(r, t, n);
  }), e.__c && e.__c.__P === t && (e.__e && n.appendChild(e.__e), e.__c.__e = !0, e.__c.__P = n)), e;
}
function le() {
  this.__u = 0, this.o = null, this.__b = null;
}
function Ft(e) {
  var t = e.__.__c;
  return t && t.__a && t.__a(e);
}
function Lt(e) {
  var t, n, r, o = null;
  function a(s) {
    if (t || (t = e()).then(function(i) {
      i && (o = i.default || i), r = !0;
    }, function(i) {
      n = i, r = !0;
    }), n) throw n;
    if (!r) throw t;
    return o ? D(o, s) : null;
  }
  return a.displayName = "Lazy", a.__f = !0, a;
}
function oe() {
  this.i = null, this.l = null;
}
k.unmount = function(e) {
  var t = e.__c;
  t && t.__R && t.__R(), t && 32 & e.__u && (e.type = null), lt && lt(e);
}, (le.prototype = new Z()).__c = function(e, t) {
  var n = t.__c, r = this;
  r.o == null && (r.o = []), r.o.push(n);
  var o = Ft(r.__v), a = !1, s = function() {
    a || (a = !0, n.__R = null, o ? o(i) : i());
  };
  n.__R = s;
  var i = function() {
    if (!--r.__u) {
      if (r.state.__a) {
        var u = r.state.__a;
        r.__v.__k[0] = kt(u, u.__c.__P, u.__c.__O);
      }
      var l;
      for (r.setState({ __a: r.__b = null }); l = r.o.pop(); ) l.forceUpdate();
    }
  };
  r.__u++ || 32 & t.__u || r.setState({ __a: r.__b = r.__v.__k[0] }), e.then(s, s);
}, le.prototype.componentWillUnmount = function() {
  this.o = [];
}, le.prototype.render = function(e, t) {
  if (this.__b) {
    if (this.__v.__k) {
      var n = document.createElement("div"), r = this.__v.__k[0].__c;
      this.__v.__k[0] = Mt(this.__b, n, r.__O = r.__P);
    }
    this.__b = null;
  }
  var o = t.__a && D(F, null, e.fallback);
  return o && (o.__u &= -33), [D(F, null, t.__a ? null : e.children), o];
};
var ut = function(e, t, n) {
  if (++n[1] === n[0] && e.l.delete(t), e.props.revealOrder && (e.props.revealOrder[0] !== "t" || !e.l.size)) for (n = e.i; n; ) {
    for (; n.length > 3; ) n.pop()();
    if (n[1] < n[0]) break;
    e.i = n = n[2];
  }
};
function Ar(e) {
  return this.getChildContext = function() {
    return e.context;
  }, e.children;
}
function Mr(e) {
  var t = this, n = e.h;
  if (t.componentWillUnmount = function() {
    de(null, t.v), t.v = null, t.h = null;
  }, t.h && t.h !== n && t.componentWillUnmount(), !t.v) {
    for (var r = t.__v; r !== null && !r.__m && r.__ !== null; ) r = r.__;
    t.h = n, t.v = { nodeType: 1, parentNode: n, childNodes: [], __k: { __m: r.__m }, contains: function() {
      return !0;
    }, insertBefore: function(o, a) {
      this.childNodes.push(o), t.h.insertBefore(o, a);
    }, removeChild: function(o) {
      this.childNodes.splice(this.childNodes.indexOf(o) >>> 1, 1), t.h.removeChild(o);
    } };
  }
  de(D(Ar, { context: t.context }, e.__v), t.v);
}
function Wt(e, t) {
  var n = D(Mr, { __v: e, h: t });
  return n.containerInfo = t, n;
}
(oe.prototype = new Z()).__a = function(e) {
  var t = this, n = Ft(t.__v), r = t.l.get(e);
  return r[0]++, function(o) {
    var a = function() {
      t.props.revealOrder ? (r.push(o), ut(t, e, r)) : o();
    };
    n ? n(a) : a();
  };
}, oe.prototype.render = function(e) {
  this.i = null, this.l = /* @__PURE__ */ new Map();
  var t = Y(e.children);
  e.revealOrder && e.revealOrder[0] === "b" && t.reverse();
  for (var n = t.length; n--; ) this.l.set(t[n], this.i = [1, 0, this.i]);
  return e.children;
}, oe.prototype.componentDidUpdate = oe.prototype.componentDidMount = function() {
  var e = this;
  this.l.forEach(function(t, n) {
    ut(e, n, t);
  });
};
var Ut = typeof Symbol < "u" && Symbol.for && Symbol.for("react.element") || 60103, kr = /^(?:accent|alignment|arabic|baseline|cap|clip(?!PathU)|color|dominant|fill|flood|font|glyph(?!R)|horiz|image(!S)|letter|lighting|marker(?!H|W|U)|overline|paint|pointer|shape|stop|strikethrough|stroke|text(?!L)|transform|underline|unicode|units|v|vector|vert|word|writing|x(?!C))[A-Z]/, Fr = /^on(Ani|Tra|Tou|BeforeInp|Compo)/, Lr = /[A-Z0-9]/g, Wr = typeof document < "u", Ur = function(e) {
  return (typeof Symbol < "u" && typeof Symbol() == "symbol" ? /fil|che|rad/ : /fil|che|ra/).test(e);
};
function $t(e, t, n) {
  return t.__k == null && (t.textContent = ""), de(e, t), typeof n == "function" && n(), e ? e.__c : null;
}
function Bt(e, t, n) {
  return tr(e, t), typeof n == "function" && n(), e ? e.__c : null;
}
Z.prototype.isReactComponent = {}, ["componentWillMount", "componentWillReceiveProps", "componentWillUpdate"].forEach(function(e) {
  Object.defineProperty(Z.prototype, e, { configurable: !0, get: function() {
    return this["UNSAFE_" + e];
  }, set: function(t) {
    Object.defineProperty(this, e, { configurable: !0, writable: !0, value: t });
  } });
});
var dt = k.event;
function $r() {
}
function Br() {
  return this.cancelBubble;
}
function Vr() {
  return this.defaultPrevented;
}
k.event = function(e) {
  return dt && (e = dt(e)), e.persist = $r, e.isPropagationStopped = Br, e.isDefaultPrevented = Vr, e.nativeEvent = e;
};
var et, Gr = { enumerable: !1, configurable: !0, get: function() {
  return this.class;
} }, ft = k.vnode;
k.vnode = function(e) {
  typeof e.type == "string" && function(t) {
    var n = t.props, r = t.type, o = {}, a = r.indexOf("-") === -1;
    for (var s in n) {
      var i = n[s];
      if (!(s === "value" && "defaultValue" in n && i == null || Wr && s === "children" && r === "noscript" || s === "class" || s === "className")) {
        var u = s.toLowerCase();
        s === "defaultValue" && "value" in n && n.value == null ? s = "value" : s === "download" && i === !0 ? i = "" : u === "translate" && i === "no" ? i = !1 : u[0] === "o" && u[1] === "n" ? u === "ondoubleclick" ? s = "ondblclick" : u !== "onchange" || r !== "input" && r !== "textarea" || Ur(n.type) ? u === "onfocus" ? s = "onfocusin" : u === "onblur" ? s = "onfocusout" : Fr.test(s) && (s = u) : u = s = "oninput" : a && kr.test(s) ? s = s.replace(Lr, "-$&").toLowerCase() : i === null && (i = void 0), u === "oninput" && o[s = u] && (s = "oninputCapture"), o[s] = i;
      }
    }
    r == "select" && o.multiple && Array.isArray(o.value) && (o.value = Y(n.children).forEach(function(l) {
      l.props.selected = o.value.indexOf(l.props.value) != -1;
    })), r == "select" && o.defaultValue != null && (o.value = Y(n.children).forEach(function(l) {
      l.props.selected = o.multiple ? o.defaultValue.indexOf(l.props.value) != -1 : o.defaultValue == l.props.value;
    })), n.class && !n.className ? (o.class = n.class, Object.defineProperty(o, "className", Gr)) : (n.className && !n.class || n.class && n.className) && (o.class = o.className = n.className), t.props = o;
  }(e), e.$$typeof = Ut, ft && ft(e);
};
var pt = k.__r;
k.__r = function(e) {
  pt && pt(e), et = e.__c;
};
var vt = k.diffed;
k.diffed = function(e) {
  vt && vt(e);
  var t = e.props, n = e.__e;
  n != null && e.type === "textarea" && "value" in t && t.value !== n.value && (n.value = t.value == null ? "" : t.value), et = null;
};
var Vt = { ReactCurrentDispatcher: { current: { readContext: function(e) {
  return et.__n[e.__c].props.value;
}, useCallback: R, useContext: q, useDebugValue: Ye, useDeferredValue: Ze, useEffect: S, useId: He, useImperativeHandle: Ke, useInsertionEffect: Je, useLayoutEffect: ee, useMemo: B, useReducer: Ie, useRef: E, useState: P, useSyncExternalStore: qe, useTransition: Qe } } }, zr = "18.3.1";
function Gt(e) {
  return D.bind(null, e);
}
function G(e) {
  return !!e && e.$$typeof === Ut;
}
function zt(e) {
  return G(e) && e.type === F;
}
function jt(e) {
  return !!e && !!e.displayName && (typeof e.displayName == "string" || e.displayName instanceof String) && e.displayName.startsWith("Memo(");
}
function ce(e) {
  return G(e) ? er.apply(null, arguments) : e;
}
function Kt(e) {
  return !!e.__k && (de(null, e), !0);
}
function Ht(e) {
  return e && (e.base || e.nodeType === 1 && e) || null;
}
var Yt = function(e, t) {
  return e(t);
}, tt = function(e, t) {
  return e(t);
}, qt = F, Xt = G, V = { useState: P, useId: He, useReducer: Ie, useEffect: S, useLayoutEffect: ee, useInsertionEffect: Je, useTransition: Qe, useDeferredValue: Ze, useSyncExternalStore: qe, startTransition: Xe, useRef: E, useImperativeHandle: Ke, useMemo: B, useCallback: R, useContext: q, useDebugValue: Ye, version: "18.3.1", Children: $, render: $t, hydrate: Bt, unmountComponentAtNode: Kt, createPortal: Wt, createElement: D, createContext: Q, createFactory: Gt, cloneElement: ce, createRef: Ot, Fragment: F, isValidElement: G, isElement: Xt, isFragment: zt, isMemo: jt, findDOMNode: Ht, Component: Z, PureComponent: Se, memo: At, forwardRef: N, flushSync: tt, unstable_batchedUpdates: Yt, StrictMode: qt, Suspense: le, SuspenseList: oe, lazy: Lt, __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: Vt };
const Zt = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  Children: $,
  Component: Z,
  Fragment: F,
  PureComponent: Se,
  StrictMode: qt,
  Suspense: le,
  SuspenseList: oe,
  __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: Vt,
  cloneElement: ce,
  createContext: Q,
  createElement: D,
  createFactory: Gt,
  createPortal: Wt,
  createRef: Ot,
  default: V,
  findDOMNode: Ht,
  flushSync: tt,
  forwardRef: N,
  hydrate: Bt,
  isElement: Xt,
  isFragment: zt,
  isMemo: jt,
  isValidElement: G,
  lazy: Lt,
  memo: At,
  render: $t,
  startTransition: Xe,
  unmountComponentAtNode: Kt,
  unstable_batchedUpdates: Yt,
  useCallback: R,
  useContext: q,
  useDebugValue: Ye,
  useDeferredValue: Ze,
  useEffect: S,
  useErrorBoundary: nr,
  useId: He,
  useImperativeHandle: Ke,
  useInsertionEffect: Je,
  useLayoutEffect: ee,
  useMemo: B,
  useReducer: Ie,
  useRef: E,
  useState: P,
  useSyncExternalStore: qe,
  useTransition: Qe,
  version: zr
}, Symbol.toStringTag, { value: "Module" }));
function A(e, t, { checkForDefaultPrevented: n = !0 } = {}) {
  return function(o) {
    if (e == null || e(o), n === !1 || !o.defaultPrevented)
      return t == null ? void 0 : t(o);
  };
}
function jr(e, t) {
  const n = Q(t), r = (a) => {
    const { children: s, ...i } = a, u = B(() => i, Object.values(i));
    return /* @__PURE__ */ c(n.Provider, { value: u, children: s });
  };
  r.displayName = e + "Provider";
  function o(a) {
    const s = q(n);
    if (s) return s;
    if (t !== void 0) return t;
    throw new Error(`\`${a}\` must be used within \`${e}\``);
  }
  return [r, o];
}
function fe(e, t = []) {
  let n = [];
  function r(a, s) {
    const i = Q(s), u = n.length;
    n = [...n, s];
    const l = (p) => {
      var g;
      const { scope: v, children: h, ...C } = p, f = ((g = v == null ? void 0 : v[e]) == null ? void 0 : g[u]) || i, m = B(() => C, Object.values(C));
      return /* @__PURE__ */ c(f.Provider, { value: m, children: h });
    };
    l.displayName = a + "Provider";
    function d(p, v) {
      var f;
      const h = ((f = v == null ? void 0 : v[e]) == null ? void 0 : f[u]) || i, C = q(h);
      if (C) return C;
      if (s !== void 0) return s;
      throw new Error(`\`${p}\` must be used within \`${a}\``);
    }
    return [l, d];
  }
  const o = () => {
    const a = n.map((s) => Q(s));
    return function(i) {
      const u = (i == null ? void 0 : i[e]) || a;
      return B(
        () => ({ [`__scope${e}`]: { ...i, [e]: u } }),
        [i, u]
      );
    };
  };
  return o.scopeName = e, [r, Kr(o, ...t)];
}
function Kr(...e) {
  const t = e[0];
  if (e.length === 1) return t;
  const n = () => {
    const r = e.map((o) => ({
      useScope: o(),
      scopeName: o.scopeName
    }));
    return function(a) {
      const s = r.reduce((i, { useScope: u, scopeName: l }) => {
        const p = u(a)[`__scope${l}`];
        return { ...i, ...p };
      }, {});
      return B(() => ({ [`__scope${t.scopeName}`]: s }), [s]);
    };
  };
  return n.scopeName = t.scopeName, n;
}
function mt(e, t) {
  if (typeof e == "function")
    return e(t);
  e != null && (e.current = t);
}
function Qt(...e) {
  return (t) => {
    let n = !1;
    const r = e.map((o) => {
      const a = mt(o, t);
      return !n && typeof a == "function" && (n = !0), a;
    });
    if (n)
      return () => {
        for (let o = 0; o < r.length; o++) {
          const a = r[o];
          typeof a == "function" ? a() : mt(e[o], null);
        }
      };
  };
}
function L(...e) {
  return R(Qt(...e), e);
}
// @__NO_SIDE_EFFECTS__
function we(e) {
  const t = /* @__PURE__ */ Hr(e), n = N((r, o) => {
    const { children: a, ...s } = r, i = $.toArray(a), u = i.find(qr);
    if (u) {
      const l = u.props.children, d = i.map((p) => p === u ? $.count(l) > 1 ? $.only(null) : G(l) ? l.props.children : null : p);
      return /* @__PURE__ */ c(t, { ...s, ref: o, children: G(l) ? ce(l, void 0, d) : null });
    }
    return /* @__PURE__ */ c(t, { ...s, ref: o, children: a });
  });
  return n.displayName = `${e}.Slot`, n;
}
// @__NO_SIDE_EFFECTS__
function Hr(e) {
  const t = N((n, r) => {
    const { children: o, ...a } = n;
    if (G(o)) {
      const s = Zr(o), i = Xr(a, o.props);
      return o.type !== F && (i.ref = r ? Qt(r, s) : s), ce(o, i);
    }
    return $.count(o) > 1 ? $.only(null) : null;
  });
  return t.displayName = `${e}.SlotClone`, t;
}
var Yr = Symbol("radix.slottable");
function qr(e) {
  return G(e) && typeof e.type == "function" && "__radixId" in e.type && e.type.__radixId === Yr;
}
function Xr(e, t) {
  const n = { ...t };
  for (const r in t) {
    const o = e[r], a = t[r];
    /^on[A-Z]/.test(r) ? o && a ? n[r] = (...i) => {
      const u = a(...i);
      return o(...i), u;
    } : o && (n[r] = o) : r === "style" ? n[r] = { ...o, ...a } : r === "className" && (n[r] = [o, a].filter(Boolean).join(" "));
  }
  return { ...e, ...n };
}
function Zr(e) {
  var r, o;
  let t = (r = Object.getOwnPropertyDescriptor(e.props, "ref")) == null ? void 0 : r.get, n = t && "isReactWarning" in t && t.isReactWarning;
  return n ? e.ref : (t = (o = Object.getOwnPropertyDescriptor(e, "ref")) == null ? void 0 : o.get, n = t && "isReactWarning" in t && t.isReactWarning, n ? e.props.ref : e.props.ref || e.ref);
}
function Qr(e) {
  const t = e + "CollectionProvider", [n, r] = fe(t), [o, a] = n(
    t,
    { collectionRef: { current: null }, itemMap: /* @__PURE__ */ new Map() }
  ), s = (f) => {
    const { scope: m, children: g } = f, _ = V.useRef(null), y = V.useRef(/* @__PURE__ */ new Map()).current;
    return /* @__PURE__ */ c(o, { scope: m, itemMap: y, collectionRef: _, children: g });
  };
  s.displayName = t;
  const i = e + "CollectionSlot", u = /* @__PURE__ */ we(i), l = V.forwardRef(
    (f, m) => {
      const { scope: g, children: _ } = f, y = a(i, g), b = L(m, y.collectionRef);
      return /* @__PURE__ */ c(u, { ref: b, children: _ });
    }
  );
  l.displayName = i;
  const d = e + "CollectionItemSlot", p = "data-radix-collection-item", v = /* @__PURE__ */ we(d), h = V.forwardRef(
    (f, m) => {
      const { scope: g, children: _, ...y } = f, b = V.useRef(null), T = L(m, b), O = a(d, g);
      return V.useEffect(() => (O.itemMap.set(b, { ref: b, ...y }), () => void O.itemMap.delete(b))), /* @__PURE__ */ c(v, { [p]: "", ref: T, children: _ });
    }
  );
  h.displayName = d;
  function C(f) {
    const m = a(e + "CollectionConsumer", f);
    return V.useCallback(() => {
      const _ = m.collectionRef.current;
      if (!_) return [];
      const y = Array.from(_.querySelectorAll(`[${p}]`));
      return Array.from(m.itemMap.values()).sort(
        (O, w) => y.indexOf(O.ref.current) - y.indexOf(w.ref.current)
      );
    }, [m.collectionRef, m.itemMap]);
  }
  return [
    { Provider: s, Slot: l, ItemSlot: h },
    C,
    r
  ];
}
var ie = globalThis != null && globalThis.document ? ee : () => {
}, Jr = Zt[" useId ".trim().toString()] || (() => {
}), eo = 0;
function ue(e) {
  const [t, n] = P(Jr());
  return ie(() => {
    n((r) => r ?? String(eo++));
  }, [e]), e || (t ? `radix-${t}` : "");
}
var to = [
  "a",
  "button",
  "div",
  "form",
  "h2",
  "h3",
  "img",
  "input",
  "label",
  "li",
  "nav",
  "ol",
  "p",
  "select",
  "span",
  "svg",
  "ul"
], M = to.reduce((e, t) => {
  const n = /* @__PURE__ */ we(`Primitive.${t}`), r = N((o, a) => {
    const { asChild: s, ...i } = o, u = s ? n : t;
    return typeof window < "u" && (window[Symbol.for("radix-ui")] = !0), /* @__PURE__ */ c(u, { ...i, ref: a });
  });
  return r.displayName = `Primitive.${t}`, { ...e, [t]: r };
}, {});
function no(e, t) {
  e && tt(() => e.dispatchEvent(t));
}
function se(e) {
  const t = E(e);
  return S(() => {
    t.current = e;
  }), B(() => (...n) => {
    var r;
    return (r = t.current) == null ? void 0 : r.call(t, ...n);
  }, []);
}
var ro = Zt[" useInsertionEffect ".trim().toString()] || ie;
function Te({
  prop: e,
  defaultProp: t,
  onChange: n = () => {
  },
  caller: r
}) {
  const [o, a, s] = oo({
    defaultProp: t,
    onChange: n
  }), i = e !== void 0, u = i ? e : o;
  {
    const d = E(e !== void 0);
    S(() => {
      const p = d.current;
      p !== i && console.warn(
        `${r} is changing from ${p ? "controlled" : "uncontrolled"} to ${i ? "controlled" : "uncontrolled"}. Components should not switch from controlled to uncontrolled (or vice versa). Decide between using a controlled or uncontrolled value for the lifetime of the component.`
      ), d.current = i;
    }, [i, r]);
  }
  const l = R(
    (d) => {
      var p;
      if (i) {
        const v = ao(d) ? d(e) : d;
        v !== e && ((p = s.current) == null || p.call(s, v));
      } else
        a(d);
    },
    [i, e, a, s]
  );
  return [u, l];
}
function oo({
  defaultProp: e,
  onChange: t
}) {
  const [n, r] = P(e), o = E(n), a = E(t);
  return ro(() => {
    a.current = t;
  }, [t]), S(() => {
    var s;
    o.current !== n && ((s = a.current) == null || s.call(a, n), o.current = n);
  }, [n, o]), [n, r, a];
}
function ao(e) {
  return typeof e == "function";
}
var io = Q(void 0);
function Jt(e) {
  const t = q(io);
  return e || t || "ltr";
}
var Ae = "rovingFocusGroup.onEntryFocus", so = { bubbles: !1, cancelable: !0 }, pe = "RovingFocusGroup", [Ge, en, co] = Qr(pe), [lo, tn] = fe(
  pe,
  [co]
), [uo, fo] = lo(pe), nn = N(
  (e, t) => /* @__PURE__ */ c(Ge.Provider, { scope: e.__scopeRovingFocusGroup, children: /* @__PURE__ */ c(Ge.Slot, { scope: e.__scopeRovingFocusGroup, children: /* @__PURE__ */ c(po, { ...e, ref: t }) }) })
);
nn.displayName = pe;
var po = N((e, t) => {
  const {
    __scopeRovingFocusGroup: n,
    orientation: r,
    loop: o = !1,
    dir: a,
    currentTabStopId: s,
    defaultCurrentTabStopId: i,
    onCurrentTabStopIdChange: u,
    onEntryFocus: l,
    preventScrollOnEntryFocus: d = !1,
    ...p
  } = e, v = E(null), h = L(t, v), C = Jt(a), [f, m] = Te({
    prop: s,
    defaultProp: i ?? null,
    onChange: u,
    caller: pe
  }), [g, _] = P(!1), y = se(l), b = en(n), T = E(!1), [O, w] = P(0);
  return S(() => {
    const x = v.current;
    if (x)
      return x.addEventListener(Ae, y), () => x.removeEventListener(Ae, y);
  }, [y]), /* @__PURE__ */ c(
    uo,
    {
      scope: n,
      orientation: r,
      dir: C,
      loop: o,
      currentTabStopId: f,
      onItemFocus: R(
        (x) => m(x),
        [m]
      ),
      onItemShiftTab: R(() => _(!0), []),
      onFocusableItemAdd: R(
        () => w((x) => x + 1),
        []
      ),
      onFocusableItemRemove: R(
        () => w((x) => x - 1),
        []
      ),
      children: /* @__PURE__ */ c(
        M.div,
        {
          tabIndex: g || O === 0 ? -1 : 0,
          "data-orientation": r,
          ...p,
          ref: h,
          style: { outline: "none", ...e.style },
          onMouseDown: A(e.onMouseDown, () => {
            T.current = !0;
          }),
          onFocus: A(e.onFocus, (x) => {
            const z = !T.current;
            if (x.target === x.currentTarget && z && !g) {
              const j = new CustomEvent(Ae, so);
              if (x.currentTarget.dispatchEvent(j), !j.defaultPrevented) {
                const K = b().filter((X) => X.focusable), me = K.find((X) => X.active), Qn = K.find((X) => X.id === f), Jn = [me, Qn, ...K].filter(
                  Boolean
                ).map((X) => X.ref.current);
                an(Jn, d);
              }
            }
            T.current = !1;
          }),
          onBlur: A(e.onBlur, () => _(!1))
        }
      )
    }
  );
}), rn = "RovingFocusGroupItem", on = N(
  (e, t) => {
    const {
      __scopeRovingFocusGroup: n,
      focusable: r = !0,
      active: o = !1,
      tabStopId: a,
      children: s,
      ...i
    } = e, u = ue(), l = a || u, d = fo(rn, n), p = d.currentTabStopId === l, v = en(n), { onFocusableItemAdd: h, onFocusableItemRemove: C, currentTabStopId: f } = d;
    return S(() => {
      if (r)
        return h(), () => C();
    }, [r, h, C]), /* @__PURE__ */ c(
      Ge.ItemSlot,
      {
        scope: n,
        id: l,
        focusable: r,
        active: o,
        children: /* @__PURE__ */ c(
          M.span,
          {
            tabIndex: p ? 0 : -1,
            "data-orientation": d.orientation,
            ...i,
            ref: t,
            onMouseDown: A(e.onMouseDown, (m) => {
              r ? d.onItemFocus(l) : m.preventDefault();
            }),
            onFocus: A(e.onFocus, () => d.onItemFocus(l)),
            onKeyDown: A(e.onKeyDown, (m) => {
              if (m.key === "Tab" && m.shiftKey) {
                d.onItemShiftTab();
                return;
              }
              if (m.target !== m.currentTarget) return;
              const g = ho(m, d.orientation, d.dir);
              if (g !== void 0) {
                if (m.metaKey || m.ctrlKey || m.altKey || m.shiftKey) return;
                m.preventDefault();
                let y = v().filter((b) => b.focusable).map((b) => b.ref.current);
                if (g === "last") y.reverse();
                else if (g === "prev" || g === "next") {
                  g === "prev" && y.reverse();
                  const b = y.indexOf(m.currentTarget);
                  y = d.loop ? go(y, b + 1) : y.slice(b + 1);
                }
                setTimeout(() => an(y));
              }
            }),
            children: typeof s == "function" ? s({ isCurrentTabStop: p, hasTabStop: f != null }) : s
          }
        )
      }
    );
  }
);
on.displayName = rn;
var vo = {
  ArrowLeft: "prev",
  ArrowUp: "prev",
  ArrowRight: "next",
  ArrowDown: "next",
  PageUp: "first",
  Home: "first",
  PageDown: "last",
  End: "last"
};
function mo(e, t) {
  return t !== "rtl" ? e : e === "ArrowLeft" ? "ArrowRight" : e === "ArrowRight" ? "ArrowLeft" : e;
}
function ho(e, t, n) {
  const r = mo(e.key, n);
  if (!(t === "vertical" && ["ArrowLeft", "ArrowRight"].includes(r)) && !(t === "horizontal" && ["ArrowUp", "ArrowDown"].includes(r)))
    return vo[r];
}
function an(e, t = !1) {
  const n = document.activeElement;
  for (const r of e)
    if (r === n || (r.focus({ preventScroll: t }), document.activeElement !== n)) return;
}
function go(e, t) {
  return e.map((n, r) => e[(t + r) % e.length]);
}
var yo = nn, bo = on;
function _o(e, t) {
  return Ie((n, r) => t[n][r] ?? n, e);
}
var ve = (e) => {
  const { present: t, children: n } = e, r = Co(t), o = typeof n == "function" ? n({ present: r.isPresent }) : $.only(n), a = L(r.ref, Eo(o));
  return typeof n == "function" || r.isPresent ? ce(o, { ref: a }) : null;
};
ve.displayName = "Presence";
function Co(e) {
  const [t, n] = P(), r = E(null), o = E(e), a = E("none"), s = e ? "mounted" : "unmounted", [i, u] = _o(s, {
    mounted: {
      UNMOUNT: "unmounted",
      ANIMATION_OUT: "unmountSuspended"
    },
    unmountSuspended: {
      MOUNT: "mounted",
      ANIMATION_END: "unmounted"
    },
    unmounted: {
      MOUNT: "mounted"
    }
  });
  return S(() => {
    const l = he(r.current);
    a.current = i === "mounted" ? l : "none";
  }, [i]), ie(() => {
    const l = r.current, d = o.current;
    if (d !== e) {
      const v = a.current, h = he(l);
      e ? u("MOUNT") : h === "none" || (l == null ? void 0 : l.display) === "none" ? u("UNMOUNT") : u(d && v !== h ? "ANIMATION_OUT" : "UNMOUNT"), o.current = e;
    }
  }, [e, u]), ie(() => {
    if (t) {
      let l;
      const d = t.ownerDocument.defaultView ?? window, p = (h) => {
        const f = he(r.current).includes(CSS.escape(h.animationName));
        if (h.target === t && f && (u("ANIMATION_END"), !o.current)) {
          const m = t.style.animationFillMode;
          t.style.animationFillMode = "forwards", l = d.setTimeout(() => {
            t.style.animationFillMode === "forwards" && (t.style.animationFillMode = m);
          });
        }
      }, v = (h) => {
        h.target === t && (a.current = he(r.current));
      };
      return t.addEventListener("animationstart", v), t.addEventListener("animationcancel", p), t.addEventListener("animationend", p), () => {
        d.clearTimeout(l), t.removeEventListener("animationstart", v), t.removeEventListener("animationcancel", p), t.removeEventListener("animationend", p);
      };
    } else
      u("ANIMATION_END");
  }, [t, u]), {
    isPresent: ["mounted", "unmountSuspended"].includes(i),
    ref: R((l) => {
      r.current = l ? getComputedStyle(l) : null, n(l);
    }, [])
  };
}
function he(e) {
  return (e == null ? void 0 : e.animationName) || "none";
}
function Eo(e) {
  var r, o;
  let t = (r = Object.getOwnPropertyDescriptor(e.props, "ref")) == null ? void 0 : r.get, n = t && "isReactWarning" in t && t.isReactWarning;
  return n ? e.ref : (t = (o = Object.getOwnPropertyDescriptor(e, "ref")) == null ? void 0 : o.get, n = t && "isReactWarning" in t && t.isReactWarning, n ? e.props.ref : e.props.ref || e.ref);
}
var Pe = "Tabs", [So] = fe(Pe, [
  tn
]), sn = tn(), [wo, nt] = So(Pe), cn = N(
  (e, t) => {
    const {
      __scopeTabs: n,
      value: r,
      onValueChange: o,
      defaultValue: a,
      orientation: s = "horizontal",
      dir: i,
      activationMode: u = "automatic",
      ...l
    } = e, d = Jt(i), [p, v] = Te({
      prop: r,
      onChange: o,
      defaultProp: a ?? "",
      caller: Pe
    });
    return /* @__PURE__ */ c(
      wo,
      {
        scope: n,
        baseId: ue(),
        value: p,
        onValueChange: v,
        orientation: s,
        dir: d,
        activationMode: u,
        children: /* @__PURE__ */ c(
          M.div,
          {
            dir: d,
            "data-orientation": s,
            ...l,
            ref: t
          }
        )
      }
    );
  }
);
cn.displayName = Pe;
var ln = "TabsList", un = N(
  (e, t) => {
    const { __scopeTabs: n, loop: r = !0, ...o } = e, a = nt(ln, n), s = sn(n);
    return /* @__PURE__ */ c(
      yo,
      {
        asChild: !0,
        ...s,
        orientation: a.orientation,
        dir: a.dir,
        loop: r,
        children: /* @__PURE__ */ c(
          M.div,
          {
            role: "tablist",
            "aria-orientation": a.orientation,
            ...o,
            ref: t
          }
        )
      }
    );
  }
);
un.displayName = ln;
var dn = "TabsTrigger", fn = N(
  (e, t) => {
    const { __scopeTabs: n, value: r, disabled: o = !1, ...a } = e, s = nt(dn, n), i = sn(n), u = mn(s.baseId, r), l = hn(s.baseId, r), d = r === s.value;
    return /* @__PURE__ */ c(
      bo,
      {
        asChild: !0,
        ...i,
        focusable: !o,
        active: d,
        children: /* @__PURE__ */ c(
          M.button,
          {
            type: "button",
            role: "tab",
            "aria-selected": d,
            "aria-controls": l,
            "data-state": d ? "active" : "inactive",
            "data-disabled": o ? "" : void 0,
            disabled: o,
            id: u,
            ...a,
            ref: t,
            onMouseDown: A(e.onMouseDown, (p) => {
              !o && p.button === 0 && p.ctrlKey === !1 ? s.onValueChange(r) : p.preventDefault();
            }),
            onKeyDown: A(e.onKeyDown, (p) => {
              [" ", "Enter"].includes(p.key) && s.onValueChange(r);
            }),
            onFocus: A(e.onFocus, () => {
              const p = s.activationMode !== "manual";
              !d && !o && p && s.onValueChange(r);
            })
          }
        )
      }
    );
  }
);
fn.displayName = dn;
var pn = "TabsContent", vn = N(
  (e, t) => {
    const { __scopeTabs: n, value: r, forceMount: o, children: a, ...s } = e, i = nt(pn, n), u = mn(i.baseId, r), l = hn(i.baseId, r), d = r === i.value, p = E(d);
    return S(() => {
      const v = requestAnimationFrame(() => p.current = !1);
      return () => cancelAnimationFrame(v);
    }, []), /* @__PURE__ */ c(ve, { present: o || d, children: ({ present: v }) => /* @__PURE__ */ c(
      M.div,
      {
        "data-state": d ? "active" : "inactive",
        "data-orientation": i.orientation,
        role: "tabpanel",
        "aria-labelledby": u,
        hidden: !v,
        id: l,
        tabIndex: 0,
        ...s,
        ref: t,
        style: {
          ...e.style,
          animationDuration: p.current ? "0s" : void 0
        },
        children: v && a
      }
    ) });
  }
);
vn.displayName = pn;
function mn(e, t) {
  return `${e}-trigger-${t}`;
}
function hn(e, t) {
  return `${e}-content-${t}`;
}
var No = cn, Io = un, ht = fn, gt = vn;
function To(e, t = globalThis == null ? void 0 : globalThis.document) {
  const n = se(e);
  S(() => {
    const r = (o) => {
      o.key === "Escape" && n(o);
    };
    return t.addEventListener("keydown", r, { capture: !0 }), () => t.removeEventListener("keydown", r, { capture: !0 });
  }, [n, t]);
}
var Po = "DismissableLayer", ze = "dismissableLayer.update", xo = "dismissableLayer.pointerDownOutside", Do = "dismissableLayer.focusOutside", yt, gn = Q({
  layers: /* @__PURE__ */ new Set(),
  layersWithOutsidePointerEventsDisabled: /* @__PURE__ */ new Set(),
  branches: /* @__PURE__ */ new Set()
}), yn = N(
  (e, t) => {
    const {
      disableOutsidePointerEvents: n = !1,
      onEscapeKeyDown: r,
      onPointerDownOutside: o,
      onFocusOutside: a,
      onInteractOutside: s,
      onDismiss: i,
      ...u
    } = e, l = q(gn), [d, p] = P(null), v = (d == null ? void 0 : d.ownerDocument) ?? (globalThis == null ? void 0 : globalThis.document), [, h] = P({}), C = L(t, (w) => p(w)), f = Array.from(l.layers), [m] = [...l.layersWithOutsidePointerEventsDisabled].slice(-1), g = f.indexOf(m), _ = d ? f.indexOf(d) : -1, y = l.layersWithOutsidePointerEventsDisabled.size > 0, b = _ >= g, T = Ao((w) => {
      const x = w.target, z = [...l.branches].some((j) => j.contains(x));
      !b || z || (o == null || o(w), s == null || s(w), w.defaultPrevented || i == null || i());
    }, v), O = Mo((w) => {
      const x = w.target;
      [...l.branches].some((j) => j.contains(x)) || (a == null || a(w), s == null || s(w), w.defaultPrevented || i == null || i());
    }, v);
    return To((w) => {
      _ === l.layers.size - 1 && (r == null || r(w), !w.defaultPrevented && i && (w.preventDefault(), i()));
    }, v), S(() => {
      if (d)
        return n && (l.layersWithOutsidePointerEventsDisabled.size === 0 && (yt = v.body.style.pointerEvents, v.body.style.pointerEvents = "none"), l.layersWithOutsidePointerEventsDisabled.add(d)), l.layers.add(d), bt(), () => {
          n && l.layersWithOutsidePointerEventsDisabled.size === 1 && (v.body.style.pointerEvents = yt);
        };
    }, [d, v, n, l]), S(() => () => {
      d && (l.layers.delete(d), l.layersWithOutsidePointerEventsDisabled.delete(d), bt());
    }, [d, l]), S(() => {
      const w = () => h({});
      return document.addEventListener(ze, w), () => document.removeEventListener(ze, w);
    }, []), /* @__PURE__ */ c(
      M.div,
      {
        ...u,
        ref: C,
        style: {
          pointerEvents: y ? b ? "auto" : "none" : void 0,
          ...e.style
        },
        onFocusCapture: A(e.onFocusCapture, O.onFocusCapture),
        onBlurCapture: A(e.onBlurCapture, O.onBlurCapture),
        onPointerDownCapture: A(
          e.onPointerDownCapture,
          T.onPointerDownCapture
        )
      }
    );
  }
);
yn.displayName = Po;
var Oo = "DismissableLayerBranch", Ro = N((e, t) => {
  const n = q(gn), r = E(null), o = L(t, r);
  return S(() => {
    const a = r.current;
    if (a)
      return n.branches.add(a), () => {
        n.branches.delete(a);
      };
  }, [n.branches]), /* @__PURE__ */ c(M.div, { ...e, ref: o });
});
Ro.displayName = Oo;
function Ao(e, t = globalThis == null ? void 0 : globalThis.document) {
  const n = se(e), r = E(!1), o = E(() => {
  });
  return S(() => {
    const a = (i) => {
      if (i.target && !r.current) {
        let u = function() {
          bn(
            xo,
            n,
            l,
            { discrete: !0 }
          );
        };
        const l = { originalEvent: i };
        i.pointerType === "touch" ? (t.removeEventListener("click", o.current), o.current = u, t.addEventListener("click", o.current, { once: !0 })) : u();
      } else
        t.removeEventListener("click", o.current);
      r.current = !1;
    }, s = window.setTimeout(() => {
      t.addEventListener("pointerdown", a);
    }, 0);
    return () => {
      window.clearTimeout(s), t.removeEventListener("pointerdown", a), t.removeEventListener("click", o.current);
    };
  }, [t, n]), {
    // ensures we check React component tree (not just DOM tree)
    onPointerDownCapture: () => r.current = !0
  };
}
function Mo(e, t = globalThis == null ? void 0 : globalThis.document) {
  const n = se(e), r = E(!1);
  return S(() => {
    const o = (a) => {
      a.target && !r.current && bn(Do, n, { originalEvent: a }, {
        discrete: !1
      });
    };
    return t.addEventListener("focusin", o), () => t.removeEventListener("focusin", o);
  }, [t, n]), {
    onFocusCapture: () => r.current = !0,
    onBlurCapture: () => r.current = !1
  };
}
function bt() {
  const e = new CustomEvent(ze);
  document.dispatchEvent(e);
}
function bn(e, t, n, { discrete: r }) {
  const o = n.originalEvent.target, a = new CustomEvent(e, { bubbles: !1, cancelable: !0, detail: n });
  t && o.addEventListener(e, t, { once: !0 }), r ? no(o, a) : o.dispatchEvent(a);
}
var Me = "focusScope.autoFocusOnMount", ke = "focusScope.autoFocusOnUnmount", _t = { bubbles: !1, cancelable: !0 }, ko = "FocusScope", _n = N((e, t) => {
  const {
    loop: n = !1,
    trapped: r = !1,
    onMountAutoFocus: o,
    onUnmountAutoFocus: a,
    ...s
  } = e, [i, u] = P(null), l = se(o), d = se(a), p = E(null), v = L(t, (f) => u(f)), h = E({
    paused: !1,
    pause() {
      this.paused = !0;
    },
    resume() {
      this.paused = !1;
    }
  }).current;
  S(() => {
    if (r) {
      let f = function(y) {
        if (h.paused || !i) return;
        const b = y.target;
        i.contains(b) ? p.current = b : H(p.current, { select: !0 });
      }, m = function(y) {
        if (h.paused || !i) return;
        const b = y.relatedTarget;
        b !== null && (i.contains(b) || H(p.current, { select: !0 }));
      }, g = function(y) {
        if (document.activeElement === document.body)
          for (const T of y)
            T.removedNodes.length > 0 && H(i);
      };
      document.addEventListener("focusin", f), document.addEventListener("focusout", m);
      const _ = new MutationObserver(g);
      return i && _.observe(i, { childList: !0, subtree: !0 }), () => {
        document.removeEventListener("focusin", f), document.removeEventListener("focusout", m), _.disconnect();
      };
    }
  }, [r, i, h.paused]), S(() => {
    if (i) {
      Et.add(h);
      const f = document.activeElement;
      if (!i.contains(f)) {
        const g = new CustomEvent(Me, _t);
        i.addEventListener(Me, l), i.dispatchEvent(g), g.defaultPrevented || (Fo(Bo(Cn(i)), { select: !0 }), document.activeElement === f && H(i));
      }
      return () => {
        i.removeEventListener(Me, l), setTimeout(() => {
          const g = new CustomEvent(ke, _t);
          i.addEventListener(ke, d), i.dispatchEvent(g), g.defaultPrevented || H(f ?? document.body, { select: !0 }), i.removeEventListener(ke, d), Et.remove(h);
        }, 0);
      };
    }
  }, [i, l, d, h]);
  const C = R(
    (f) => {
      if (!n && !r || h.paused) return;
      const m = f.key === "Tab" && !f.altKey && !f.ctrlKey && !f.metaKey, g = document.activeElement;
      if (m && g) {
        const _ = f.currentTarget, [y, b] = Lo(_);
        y && b ? !f.shiftKey && g === b ? (f.preventDefault(), n && H(y, { select: !0 })) : f.shiftKey && g === y && (f.preventDefault(), n && H(b, { select: !0 })) : g === _ && f.preventDefault();
      }
    },
    [n, r, h.paused]
  );
  return /* @__PURE__ */ c(M.div, { tabIndex: -1, ...s, ref: v, onKeyDown: C });
});
_n.displayName = ko;
function Fo(e, { select: t = !1 } = {}) {
  const n = document.activeElement;
  for (const r of e)
    if (H(r, { select: t }), document.activeElement !== n) return;
}
function Lo(e) {
  const t = Cn(e), n = Ct(t, e), r = Ct(t.reverse(), e);
  return [n, r];
}
function Cn(e) {
  const t = [], n = document.createTreeWalker(e, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (r) => {
      const o = r.tagName === "INPUT" && r.type === "hidden";
      return r.disabled || r.hidden || o ? NodeFilter.FILTER_SKIP : r.tabIndex >= 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    }
  });
  for (; n.nextNode(); ) t.push(n.currentNode);
  return t;
}
function Ct(e, t) {
  for (const n of e)
    if (!Wo(n, { upTo: t })) return n;
}
function Wo(e, { upTo: t }) {
  if (getComputedStyle(e).visibility === "hidden") return !0;
  for (; e; ) {
    if (t !== void 0 && e === t) return !1;
    if (getComputedStyle(e).display === "none") return !0;
    e = e.parentElement;
  }
  return !1;
}
function Uo(e) {
  return e instanceof HTMLInputElement && "select" in e;
}
function H(e, { select: t = !1 } = {}) {
  if (e && e.focus) {
    const n = document.activeElement;
    e.focus({ preventScroll: !0 }), e !== n && Uo(e) && t && e.select();
  }
}
var Et = $o();
function $o() {
  let e = [];
  return {
    add(t) {
      const n = e[0];
      t !== n && (n == null || n.pause()), e = St(e, t), e.unshift(t);
    },
    remove(t) {
      var n;
      e = St(e, t), (n = e[0]) == null || n.resume();
    }
  };
}
function St(e, t) {
  const n = [...e], r = n.indexOf(t);
  return r !== -1 && n.splice(r, 1), n;
}
function Bo(e) {
  return e.filter((t) => t.tagName !== "A");
}
var Vo = "Portal", En = N((e, t) => {
  var i;
  const { container: n, ...r } = e, [o, a] = P(!1);
  ie(() => a(!0), []);
  const s = n || o && ((i = globalThis == null ? void 0 : globalThis.document) == null ? void 0 : i.body);
  return s ? V.createPortal(/* @__PURE__ */ c(M.div, { ...r, ref: t }), s) : null;
});
En.displayName = Vo;
var Fe = 0;
function Go() {
  S(() => {
    const e = document.querySelectorAll("[data-radix-focus-guard]");
    return document.body.insertAdjacentElement("afterbegin", e[0] ?? wt()), document.body.insertAdjacentElement("beforeend", e[1] ?? wt()), Fe++, () => {
      Fe === 1 && document.querySelectorAll("[data-radix-focus-guard]").forEach((t) => t.remove()), Fe--;
    };
  }, []);
}
function wt() {
  const e = document.createElement("span");
  return e.setAttribute("data-radix-focus-guard", ""), e.tabIndex = 0, e.style.outline = "none", e.style.opacity = "0", e.style.position = "fixed", e.style.pointerEvents = "none", e;
}
var U = function() {
  return U = Object.assign || function(t) {
    for (var n, r = 1, o = arguments.length; r < o; r++) {
      n = arguments[r];
      for (var a in n) Object.prototype.hasOwnProperty.call(n, a) && (t[a] = n[a]);
    }
    return t;
  }, U.apply(this, arguments);
};
function Sn(e, t) {
  var n = {};
  for (var r in e) Object.prototype.hasOwnProperty.call(e, r) && t.indexOf(r) < 0 && (n[r] = e[r]);
  if (e != null && typeof Object.getOwnPropertySymbols == "function")
    for (var o = 0, r = Object.getOwnPropertySymbols(e); o < r.length; o++)
      t.indexOf(r[o]) < 0 && Object.prototype.propertyIsEnumerable.call(e, r[o]) && (n[r[o]] = e[r[o]]);
  return n;
}
function zo(e, t, n) {
  if (n || arguments.length === 2) for (var r = 0, o = t.length, a; r < o; r++)
    (a || !(r in t)) && (a || (a = Array.prototype.slice.call(t, 0, r)), a[r] = t[r]);
  return e.concat(a || Array.prototype.slice.call(t));
}
var Ce = "right-scroll-bar-position", Ee = "width-before-scroll-bar", jo = "with-scroll-bars-hidden", Ko = "--removed-body-scroll-bar-size";
function Le(e, t) {
  return typeof e == "function" ? e(t) : e && (e.current = t), e;
}
function Ho(e, t) {
  var n = P(function() {
    return {
      // value
      value: e,
      // last callback
      callback: t,
      // "memoized" public interface
      facade: {
        get current() {
          return n.value;
        },
        set current(r) {
          var o = n.value;
          o !== r && (n.value = r, n.callback(r, o));
        }
      }
    };
  })[0];
  return n.callback = t, n.facade;
}
var Yo = typeof window < "u" ? ee : S, Nt = /* @__PURE__ */ new WeakMap();
function qo(e, t) {
  var n = Ho(null, function(r) {
    return e.forEach(function(o) {
      return Le(o, r);
    });
  });
  return Yo(function() {
    var r = Nt.get(n);
    if (r) {
      var o = new Set(r), a = new Set(e), s = n.current;
      o.forEach(function(i) {
        a.has(i) || Le(i, null);
      }), a.forEach(function(i) {
        o.has(i) || Le(i, s);
      });
    }
    Nt.set(n, e);
  }, [e]), n;
}
function Xo(e) {
  return e;
}
function Zo(e, t) {
  t === void 0 && (t = Xo);
  var n = [], r = !1, o = {
    read: function() {
      if (r)
        throw new Error("Sidecar: could not `read` from an `assigned` medium. `read` could be used only with `useMedium`.");
      return n.length ? n[n.length - 1] : e;
    },
    useMedium: function(a) {
      var s = t(a, r);
      return n.push(s), function() {
        n = n.filter(function(i) {
          return i !== s;
        });
      };
    },
    assignSyncMedium: function(a) {
      for (r = !0; n.length; ) {
        var s = n;
        n = [], s.forEach(a);
      }
      n = {
        push: function(i) {
          return a(i);
        },
        filter: function() {
          return n;
        }
      };
    },
    assignMedium: function(a) {
      r = !0;
      var s = [];
      if (n.length) {
        var i = n;
        n = [], i.forEach(a), s = n;
      }
      var u = function() {
        var d = s;
        s = [], d.forEach(a);
      }, l = function() {
        return Promise.resolve().then(u);
      };
      l(), n = {
        push: function(d) {
          s.push(d), l();
        },
        filter: function(d) {
          return s = s.filter(d), n;
        }
      };
    }
  };
  return o;
}
function Qo(e) {
  e === void 0 && (e = {});
  var t = Zo(null);
  return t.options = U({ async: !0, ssr: !1 }, e), t;
}
var wn = function(e) {
  var t = e.sideCar, n = Sn(e, ["sideCar"]);
  if (!t)
    throw new Error("Sidecar: please provide `sideCar` property to import the right car");
  var r = t.read();
  if (!r)
    throw new Error("Sidecar medium not found");
  return D(r, U({}, n));
};
wn.isSideCarExport = !0;
function Jo(e, t) {
  return e.useMedium(t), wn;
}
var Nn = Qo(), We = function() {
}, xe = N(function(e, t) {
  var n = E(null), r = P({
    onScrollCapture: We,
    onWheelCapture: We,
    onTouchMoveCapture: We
  }), o = r[0], a = r[1], s = e.forwardProps, i = e.children, u = e.className, l = e.removeScrollBar, d = e.enabled, p = e.shards, v = e.sideCar, h = e.noRelative, C = e.noIsolation, f = e.inert, m = e.allowPinchZoom, g = e.as, _ = g === void 0 ? "div" : g, y = e.gapMode, b = Sn(e, ["forwardProps", "children", "className", "removeScrollBar", "enabled", "shards", "sideCar", "noRelative", "noIsolation", "inert", "allowPinchZoom", "as", "gapMode"]), T = v, O = qo([n, t]), w = U(U({}, b), o);
  return D(
    F,
    null,
    d && D(T, { sideCar: Nn, removeScrollBar: l, shards: p, noRelative: h, noIsolation: C, inert: f, setCallbacks: a, allowPinchZoom: !!m, lockRef: n, gapMode: y }),
    s ? ce($.only(i), U(U({}, w), { ref: O })) : D(_, U({}, w, { className: u, ref: O }), i)
  );
});
xe.defaultProps = {
  enabled: !0,
  removeScrollBar: !0,
  inert: !1
};
xe.classNames = {
  fullWidth: Ee,
  zeroRight: Ce
};
var ea = function() {
  if (typeof __webpack_nonce__ < "u")
    return __webpack_nonce__;
};
function ta() {
  if (!document)
    return null;
  var e = document.createElement("style");
  e.type = "text/css";
  var t = ea();
  return t && e.setAttribute("nonce", t), e;
}
function na(e, t) {
  e.styleSheet ? e.styleSheet.cssText = t : e.appendChild(document.createTextNode(t));
}
function ra(e) {
  var t = document.head || document.getElementsByTagName("head")[0];
  t.appendChild(e);
}
var oa = function() {
  var e = 0, t = null;
  return {
    add: function(n) {
      e == 0 && (t = ta()) && (na(t, n), ra(t)), e++;
    },
    remove: function() {
      e--, !e && t && (t.parentNode && t.parentNode.removeChild(t), t = null);
    }
  };
}, aa = function() {
  var e = oa();
  return function(t, n) {
    S(function() {
      return e.add(t), function() {
        e.remove();
      };
    }, [t && n]);
  };
}, In = function() {
  var e = aa(), t = function(n) {
    var r = n.styles, o = n.dynamic;
    return e(r, o), null;
  };
  return t;
}, ia = {
  left: 0,
  top: 0,
  right: 0,
  gap: 0
}, Ue = function(e) {
  return parseInt(e || "", 10) || 0;
}, sa = function(e) {
  var t = window.getComputedStyle(document.body), n = t[e === "padding" ? "paddingLeft" : "marginLeft"], r = t[e === "padding" ? "paddingTop" : "marginTop"], o = t[e === "padding" ? "paddingRight" : "marginRight"];
  return [Ue(n), Ue(r), Ue(o)];
}, ca = function(e) {
  if (e === void 0 && (e = "margin"), typeof window > "u")
    return ia;
  var t = sa(e), n = document.documentElement.clientWidth, r = window.innerWidth;
  return {
    left: t[0],
    top: t[1],
    right: t[2],
    gap: Math.max(0, r - n + t[2] - t[0])
  };
}, la = In(), ae = "data-scroll-locked", ua = function(e, t, n, r) {
  var o = e.left, a = e.top, s = e.right, i = e.gap;
  return n === void 0 && (n = "margin"), `
  .`.concat(jo, ` {
   overflow: hidden `).concat(r, `;
   padding-right: `).concat(i, "px ").concat(r, `;
  }
  body[`).concat(ae, `] {
    overflow: hidden `).concat(r, `;
    overscroll-behavior: contain;
    `).concat([
    t && "position: relative ".concat(r, ";"),
    n === "margin" && `
    padding-left: `.concat(o, `px;
    padding-top: `).concat(a, `px;
    padding-right: `).concat(s, `px;
    margin-left:0;
    margin-top:0;
    margin-right: `).concat(i, "px ").concat(r, `;
    `),
    n === "padding" && "padding-right: ".concat(i, "px ").concat(r, ";")
  ].filter(Boolean).join(""), `
  }
  
  .`).concat(Ce, ` {
    right: `).concat(i, "px ").concat(r, `;
  }
  
  .`).concat(Ee, ` {
    margin-right: `).concat(i, "px ").concat(r, `;
  }
  
  .`).concat(Ce, " .").concat(Ce, ` {
    right: 0 `).concat(r, `;
  }
  
  .`).concat(Ee, " .").concat(Ee, ` {
    margin-right: 0 `).concat(r, `;
  }
  
  body[`).concat(ae, `] {
    `).concat(Ko, ": ").concat(i, `px;
  }
`);
}, It = function() {
  var e = parseInt(document.body.getAttribute(ae) || "0", 10);
  return isFinite(e) ? e : 0;
}, da = function() {
  S(function() {
    return document.body.setAttribute(ae, (It() + 1).toString()), function() {
      var e = It() - 1;
      e <= 0 ? document.body.removeAttribute(ae) : document.body.setAttribute(ae, e.toString());
    };
  }, []);
}, fa = function(e) {
  var t = e.noRelative, n = e.noImportant, r = e.gapMode, o = r === void 0 ? "margin" : r;
  da();
  var a = B(function() {
    return ca(o);
  }, [o]);
  return D(la, { styles: ua(a, !t, o, n ? "" : "!important") });
}, je = !1;
if (typeof window < "u")
  try {
    var ge = Object.defineProperty({}, "passive", {
      get: function() {
        return je = !0, !0;
      }
    });
    window.addEventListener("test", ge, ge), window.removeEventListener("test", ge, ge);
  } catch {
    je = !1;
  }
var te = je ? { passive: !1 } : !1, pa = function(e) {
  return e.tagName === "TEXTAREA";
}, Tn = function(e, t) {
  if (!(e instanceof Element))
    return !1;
  var n = window.getComputedStyle(e);
  return (
    // not-not-scrollable
    n[t] !== "hidden" && // contains scroll inside self
    !(n.overflowY === n.overflowX && !pa(e) && n[t] === "visible")
  );
}, va = function(e) {
  return Tn(e, "overflowY");
}, ma = function(e) {
  return Tn(e, "overflowX");
}, Tt = function(e, t) {
  var n = t.ownerDocument, r = t;
  do {
    typeof ShadowRoot < "u" && r instanceof ShadowRoot && (r = r.host);
    var o = Pn(e, r);
    if (o) {
      var a = xn(e, r), s = a[1], i = a[2];
      if (s > i)
        return !0;
    }
    r = r.parentNode;
  } while (r && r !== n.body);
  return !1;
}, ha = function(e) {
  var t = e.scrollTop, n = e.scrollHeight, r = e.clientHeight;
  return [
    t,
    n,
    r
  ];
}, ga = function(e) {
  var t = e.scrollLeft, n = e.scrollWidth, r = e.clientWidth;
  return [
    t,
    n,
    r
  ];
}, Pn = function(e, t) {
  return e === "v" ? va(t) : ma(t);
}, xn = function(e, t) {
  return e === "v" ? ha(t) : ga(t);
}, ya = function(e, t) {
  return e === "h" && t === "rtl" ? -1 : 1;
}, ba = function(e, t, n, r, o) {
  var a = ya(e, window.getComputedStyle(t).direction), s = a * r, i = n.target, u = t.contains(i), l = !1, d = s > 0, p = 0, v = 0;
  do {
    if (!i)
      break;
    var h = xn(e, i), C = h[0], f = h[1], m = h[2], g = f - m - a * C;
    (C || g) && Pn(e, i) && (p += g, v += C);
    var _ = i.parentNode;
    i = _ && _.nodeType === Node.DOCUMENT_FRAGMENT_NODE ? _.host : _;
  } while (
    // portaled content
    !u && i !== document.body || // self content
    u && (t.contains(i) || t === i)
  );
  return (d && Math.abs(p) < 1 || !d && Math.abs(v) < 1) && (l = !0), l;
}, ye = function(e) {
  return "changedTouches" in e ? [e.changedTouches[0].clientX, e.changedTouches[0].clientY] : [0, 0];
}, Pt = function(e) {
  return [e.deltaX, e.deltaY];
}, xt = function(e) {
  return e && "current" in e ? e.current : e;
}, _a = function(e, t) {
  return e[0] === t[0] && e[1] === t[1];
}, Ca = function(e) {
  return `
  .block-interactivity-`.concat(e, ` {pointer-events: none;}
  .allow-interactivity-`).concat(e, ` {pointer-events: all;}
`);
}, Ea = 0, ne = [];
function Sa(e) {
  var t = E([]), n = E([0, 0]), r = E(), o = P(Ea++)[0], a = P(In)[0], s = E(e);
  S(function() {
    s.current = e;
  }, [e]), S(function() {
    if (e.inert) {
      document.body.classList.add("block-interactivity-".concat(o));
      var f = zo([e.lockRef.current], (e.shards || []).map(xt), !0).filter(Boolean);
      return f.forEach(function(m) {
        return m.classList.add("allow-interactivity-".concat(o));
      }), function() {
        document.body.classList.remove("block-interactivity-".concat(o)), f.forEach(function(m) {
          return m.classList.remove("allow-interactivity-".concat(o));
        });
      };
    }
  }, [e.inert, e.lockRef.current, e.shards]);
  var i = R(function(f, m) {
    if ("touches" in f && f.touches.length === 2 || f.type === "wheel" && f.ctrlKey)
      return !s.current.allowPinchZoom;
    var g = ye(f), _ = n.current, y = "deltaX" in f ? f.deltaX : _[0] - g[0], b = "deltaY" in f ? f.deltaY : _[1] - g[1], T, O = f.target, w = Math.abs(y) > Math.abs(b) ? "h" : "v";
    if ("touches" in f && w === "h" && O.type === "range")
      return !1;
    var x = window.getSelection(), z = x && x.anchorNode, j = z ? z === O || z.contains(O) : !1;
    if (j)
      return !1;
    var K = Tt(w, O);
    if (!K)
      return !0;
    if (K ? T = w : (T = w === "v" ? "h" : "v", K = Tt(w, O)), !K)
      return !1;
    if (!r.current && "changedTouches" in f && (y || b) && (r.current = T), !T)
      return !0;
    var me = r.current || T;
    return ba(me, m, f, me === "h" ? y : b);
  }, []), u = R(function(f) {
    var m = f;
    if (!(!ne.length || ne[ne.length - 1] !== a)) {
      var g = "deltaY" in m ? Pt(m) : ye(m), _ = t.current.filter(function(T) {
        return T.name === m.type && (T.target === m.target || m.target === T.shadowParent) && _a(T.delta, g);
      })[0];
      if (_ && _.should) {
        m.cancelable && m.preventDefault();
        return;
      }
      if (!_) {
        var y = (s.current.shards || []).map(xt).filter(Boolean).filter(function(T) {
          return T.contains(m.target);
        }), b = y.length > 0 ? i(m, y[0]) : !s.current.noIsolation;
        b && m.cancelable && m.preventDefault();
      }
    }
  }, []), l = R(function(f, m, g, _) {
    var y = { name: f, delta: m, target: g, should: _, shadowParent: wa(g) };
    t.current.push(y), setTimeout(function() {
      t.current = t.current.filter(function(b) {
        return b !== y;
      });
    }, 1);
  }, []), d = R(function(f) {
    n.current = ye(f), r.current = void 0;
  }, []), p = R(function(f) {
    l(f.type, Pt(f), f.target, i(f, e.lockRef.current));
  }, []), v = R(function(f) {
    l(f.type, ye(f), f.target, i(f, e.lockRef.current));
  }, []);
  S(function() {
    return ne.push(a), e.setCallbacks({
      onScrollCapture: p,
      onWheelCapture: p,
      onTouchMoveCapture: v
    }), document.addEventListener("wheel", u, te), document.addEventListener("touchmove", u, te), document.addEventListener("touchstart", d, te), function() {
      ne = ne.filter(function(f) {
        return f !== a;
      }), document.removeEventListener("wheel", u, te), document.removeEventListener("touchmove", u, te), document.removeEventListener("touchstart", d, te);
    };
  }, []);
  var h = e.removeScrollBar, C = e.inert;
  return D(
    F,
    null,
    C ? D(a, { styles: Ca(o) }) : null,
    h ? D(fa, { noRelative: e.noRelative, gapMode: e.gapMode }) : null
  );
}
function wa(e) {
  for (var t = null; e !== null; )
    e instanceof ShadowRoot && (t = e.host, e = e.host), e = e.parentNode;
  return t;
}
const Na = Jo(Nn, Sa);
var Dn = N(function(e, t) {
  return D(xe, U({}, e, { ref: t, sideCar: Na }));
});
Dn.classNames = xe.classNames;
var Ia = function(e) {
  if (typeof document > "u")
    return null;
  var t = Array.isArray(e) ? e[0] : e;
  return t.ownerDocument.body;
}, re = /* @__PURE__ */ new WeakMap(), be = /* @__PURE__ */ new WeakMap(), _e = {}, $e = 0, On = function(e) {
  return e && (e.host || On(e.parentNode));
}, Ta = function(e, t) {
  return t.map(function(n) {
    if (e.contains(n))
      return n;
    var r = On(n);
    return r && e.contains(r) ? r : (console.error("aria-hidden", n, "in not contained inside", e, ". Doing nothing"), null);
  }).filter(function(n) {
    return !!n;
  });
}, Pa = function(e, t, n, r) {
  var o = Ta(t, Array.isArray(e) ? e : [e]);
  _e[n] || (_e[n] = /* @__PURE__ */ new WeakMap());
  var a = _e[n], s = [], i = /* @__PURE__ */ new Set(), u = new Set(o), l = function(p) {
    !p || i.has(p) || (i.add(p), l(p.parentNode));
  };
  o.forEach(l);
  var d = function(p) {
    !p || u.has(p) || Array.prototype.forEach.call(p.children, function(v) {
      if (i.has(v))
        d(v);
      else
        try {
          var h = v.getAttribute(r), C = h !== null && h !== "false", f = (re.get(v) || 0) + 1, m = (a.get(v) || 0) + 1;
          re.set(v, f), a.set(v, m), s.push(v), f === 1 && C && be.set(v, !0), m === 1 && v.setAttribute(n, "true"), C || v.setAttribute(r, "true");
        } catch (g) {
          console.error("aria-hidden: cannot operate on ", v, g);
        }
    });
  };
  return d(t), i.clear(), $e++, function() {
    s.forEach(function(p) {
      var v = re.get(p) - 1, h = a.get(p) - 1;
      re.set(p, v), a.set(p, h), v || (be.has(p) || p.removeAttribute(r), be.delete(p)), h || p.removeAttribute(n);
    }), $e--, $e || (re = /* @__PURE__ */ new WeakMap(), re = /* @__PURE__ */ new WeakMap(), be = /* @__PURE__ */ new WeakMap(), _e = {});
  };
}, xa = function(e, t, n) {
  n === void 0 && (n = "data-aria-hidden");
  var r = Array.from(Array.isArray(e) ? e : [e]), o = Ia(e);
  return o ? (r.push.apply(r, Array.from(o.querySelectorAll("[aria-live], script"))), Pa(r, o, n, "aria-hidden")) : function() {
    return null;
  };
}, De = "Dialog", [Rn] = fe(De), [Da, W] = Rn(De), An = (e) => {
  const {
    __scopeDialog: t,
    children: n,
    open: r,
    defaultOpen: o,
    onOpenChange: a,
    modal: s = !0
  } = e, i = E(null), u = E(null), [l, d] = Te({
    prop: r,
    defaultProp: o ?? !1,
    onChange: a,
    caller: De
  });
  return /* @__PURE__ */ c(
    Da,
    {
      scope: t,
      triggerRef: i,
      contentRef: u,
      contentId: ue(),
      titleId: ue(),
      descriptionId: ue(),
      open: l,
      onOpenChange: d,
      onOpenToggle: R(() => d((p) => !p), [d]),
      modal: s,
      children: n
    }
  );
};
An.displayName = De;
var Mn = "DialogTrigger", kn = N(
  (e, t) => {
    const { __scopeDialog: n, ...r } = e, o = W(Mn, n), a = L(t, o.triggerRef);
    return /* @__PURE__ */ c(
      M.button,
      {
        type: "button",
        "aria-haspopup": "dialog",
        "aria-expanded": o.open,
        "aria-controls": o.contentId,
        "data-state": at(o.open),
        ...r,
        ref: a,
        onClick: A(e.onClick, o.onOpenToggle)
      }
    );
  }
);
kn.displayName = Mn;
var rt = "DialogPortal", [Oa, Fn] = Rn(rt, {
  forceMount: void 0
}), Ln = (e) => {
  const { __scopeDialog: t, forceMount: n, children: r, container: o } = e, a = W(rt, t);
  return /* @__PURE__ */ c(Oa, { scope: t, forceMount: n, children: $.map(r, (s) => /* @__PURE__ */ c(ve, { present: n || a.open, children: /* @__PURE__ */ c(En, { asChild: !0, container: o, children: s }) })) });
};
Ln.displayName = rt;
var Ne = "DialogOverlay", Wn = N(
  (e, t) => {
    const n = Fn(Ne, e.__scopeDialog), { forceMount: r = n.forceMount, ...o } = e, a = W(Ne, e.__scopeDialog);
    return a.modal ? /* @__PURE__ */ c(ve, { present: r || a.open, children: /* @__PURE__ */ c(Aa, { ...o, ref: t }) }) : null;
  }
);
Wn.displayName = Ne;
var Ra = /* @__PURE__ */ we("DialogOverlay.RemoveScroll"), Aa = N(
  (e, t) => {
    const { __scopeDialog: n, ...r } = e, o = W(Ne, n);
    return (
      // Make sure `Content` is scrollable even when it doesn't live inside `RemoveScroll`
      // ie. when `Overlay` and `Content` are siblings
      /* @__PURE__ */ c(Dn, { as: Ra, allowPinchZoom: !0, shards: [o.contentRef], children: /* @__PURE__ */ c(
        M.div,
        {
          "data-state": at(o.open),
          ...r,
          ref: t,
          style: { pointerEvents: "auto", ...r.style }
        }
      ) })
    );
  }
), J = "DialogContent", Un = N(
  (e, t) => {
    const n = Fn(J, e.__scopeDialog), { forceMount: r = n.forceMount, ...o } = e, a = W(J, e.__scopeDialog);
    return /* @__PURE__ */ c(ve, { present: r || a.open, children: a.modal ? /* @__PURE__ */ c(Ma, { ...o, ref: t }) : /* @__PURE__ */ c(ka, { ...o, ref: t }) });
  }
);
Un.displayName = J;
var Ma = N(
  (e, t) => {
    const n = W(J, e.__scopeDialog), r = E(null), o = L(t, n.contentRef, r);
    return S(() => {
      const a = r.current;
      if (a) return xa(a);
    }, []), /* @__PURE__ */ c(
      $n,
      {
        ...e,
        ref: o,
        trapFocus: n.open,
        disableOutsidePointerEvents: !0,
        onCloseAutoFocus: A(e.onCloseAutoFocus, (a) => {
          var s;
          a.preventDefault(), (s = n.triggerRef.current) == null || s.focus();
        }),
        onPointerDownOutside: A(e.onPointerDownOutside, (a) => {
          const s = a.detail.originalEvent, i = s.button === 0 && s.ctrlKey === !0;
          (s.button === 2 || i) && a.preventDefault();
        }),
        onFocusOutside: A(
          e.onFocusOutside,
          (a) => a.preventDefault()
        )
      }
    );
  }
), ka = N(
  (e, t) => {
    const n = W(J, e.__scopeDialog), r = E(!1), o = E(!1);
    return /* @__PURE__ */ c(
      $n,
      {
        ...e,
        ref: t,
        trapFocus: !1,
        disableOutsidePointerEvents: !1,
        onCloseAutoFocus: (a) => {
          var s, i;
          (s = e.onCloseAutoFocus) == null || s.call(e, a), a.defaultPrevented || (r.current || (i = n.triggerRef.current) == null || i.focus(), a.preventDefault()), r.current = !1, o.current = !1;
        },
        onInteractOutside: (a) => {
          var u, l;
          (u = e.onInteractOutside) == null || u.call(e, a), a.defaultPrevented || (r.current = !0, a.detail.originalEvent.type === "pointerdown" && (o.current = !0));
          const s = a.target;
          ((l = n.triggerRef.current) == null ? void 0 : l.contains(s)) && a.preventDefault(), a.detail.originalEvent.type === "focusin" && o.current && a.preventDefault();
        }
      }
    );
  }
), $n = N(
  (e, t) => {
    const { __scopeDialog: n, trapFocus: r, onOpenAutoFocus: o, onCloseAutoFocus: a, ...s } = e, i = W(J, n), u = E(null), l = L(t, u);
    return Go(), /* @__PURE__ */ c(F, { children: [
      /* @__PURE__ */ c(
        _n,
        {
          asChild: !0,
          loop: !0,
          trapped: r,
          onMountAutoFocus: o,
          onUnmountAutoFocus: a,
          children: /* @__PURE__ */ c(
            yn,
            {
              role: "dialog",
              id: i.contentId,
              "aria-describedby": i.descriptionId,
              "aria-labelledby": i.titleId,
              "data-state": at(i.open),
              ...s,
              ref: l,
              onDismiss: () => i.onOpenChange(!1)
            }
          )
        }
      ),
      /* @__PURE__ */ c(F, { children: [
        /* @__PURE__ */ c(La, { titleId: i.titleId }),
        /* @__PURE__ */ c(Ua, { contentRef: u, descriptionId: i.descriptionId })
      ] })
    ] });
  }
), ot = "DialogTitle", Bn = N(
  (e, t) => {
    const { __scopeDialog: n, ...r } = e, o = W(ot, n);
    return /* @__PURE__ */ c(M.h2, { id: o.titleId, ...r, ref: t });
  }
);
Bn.displayName = ot;
var Vn = "DialogDescription", Gn = N(
  (e, t) => {
    const { __scopeDialog: n, ...r } = e, o = W(Vn, n);
    return /* @__PURE__ */ c(M.p, { id: o.descriptionId, ...r, ref: t });
  }
);
Gn.displayName = Vn;
var zn = "DialogClose", Fa = N(
  (e, t) => {
    const { __scopeDialog: n, ...r } = e, o = W(zn, n);
    return /* @__PURE__ */ c(
      M.button,
      {
        type: "button",
        ...r,
        ref: t,
        onClick: A(e.onClick, () => o.onOpenChange(!1))
      }
    );
  }
);
Fa.displayName = zn;
function at(e) {
  return e ? "open" : "closed";
}
var jn = "DialogTitleWarning", [ki, Kn] = jr(jn, {
  contentName: J,
  titleName: ot,
  docsSlug: "dialog"
}), La = ({ titleId: e }) => {
  const t = Kn(jn), n = `\`${t.contentName}\` requires a \`${t.titleName}\` for the component to be accessible for screen reader users.

If you want to hide the \`${t.titleName}\`, you can wrap it with our VisuallyHidden component.

For more information, see https://radix-ui.com/primitives/docs/components/${t.docsSlug}`;
  return S(() => {
    e && (document.getElementById(e) || console.error(n));
  }, [n, e]), null;
}, Wa = "DialogDescriptionWarning", Ua = ({ contentRef: e, descriptionId: t }) => {
  const r = `Warning: Missing \`Description\` or \`aria-describedby={undefined}\` for {${Kn(Wa).contentName}}.`;
  return S(() => {
    var a;
    const o = (a = e.current) == null ? void 0 : a.getAttribute("aria-describedby");
    t && o && (document.getElementById(t) || console.warn(r));
  }, [r, e, t]), null;
}, $a = An, Ba = kn, Va = Ln, Ga = Wn, za = Un, ja = Bn, Ka = Gn;
function Ha(e) {
  const t = E({ value: e, previous: e });
  return B(() => (t.current.value !== e && (t.current.previous = t.current.value, t.current.value = e), t.current.previous), [e]);
}
function Ya(e) {
  const [t, n] = P(void 0);
  return ie(() => {
    if (e) {
      n({ width: e.offsetWidth, height: e.offsetHeight });
      const r = new ResizeObserver((o) => {
        if (!Array.isArray(o) || !o.length)
          return;
        const a = o[0];
        let s, i;
        if ("borderBoxSize" in a) {
          const u = a.borderBoxSize, l = Array.isArray(u) ? u[0] : u;
          s = l.inlineSize, i = l.blockSize;
        } else
          s = e.offsetWidth, i = e.offsetHeight;
        n({ width: s, height: i });
      });
      return r.observe(e, { box: "border-box" }), () => r.unobserve(e);
    } else
      n(void 0);
  }, [e]), t;
}
var Oe = "Switch", [qa] = fe(Oe), [Xa, Za] = qa(Oe), Hn = N(
  (e, t) => {
    const {
      __scopeSwitch: n,
      name: r,
      checked: o,
      defaultChecked: a,
      required: s,
      disabled: i,
      value: u = "on",
      onCheckedChange: l,
      form: d,
      ...p
    } = e, [v, h] = P(null), C = L(t, (y) => h(y)), f = E(!1), m = v ? d || !!v.closest("form") : !0, [g, _] = Te({
      prop: o,
      defaultProp: a ?? !1,
      onChange: l,
      caller: Oe
    });
    return /* @__PURE__ */ c(Xa, { scope: n, checked: g, disabled: i, children: [
      /* @__PURE__ */ c(
        M.button,
        {
          type: "button",
          role: "switch",
          "aria-checked": g,
          "aria-required": s,
          "data-state": Zn(g),
          "data-disabled": i ? "" : void 0,
          disabled: i,
          value: u,
          ...p,
          ref: C,
          onClick: A(e.onClick, (y) => {
            _((b) => !b), m && (f.current = y.isPropagationStopped(), f.current || y.stopPropagation());
          })
        }
      ),
      m && /* @__PURE__ */ c(
        Xn,
        {
          control: v,
          bubbles: !f.current,
          name: r,
          value: u,
          checked: g,
          required: s,
          disabled: i,
          form: d,
          style: { transform: "translateX(-100%)" }
        }
      )
    ] });
  }
);
Hn.displayName = Oe;
var Yn = "SwitchThumb", qn = N(
  (e, t) => {
    const { __scopeSwitch: n, ...r } = e, o = Za(Yn, n);
    return /* @__PURE__ */ c(
      M.span,
      {
        "data-state": Zn(o.checked),
        "data-disabled": o.disabled ? "" : void 0,
        ...r,
        ref: t
      }
    );
  }
);
qn.displayName = Yn;
var Qa = "SwitchBubbleInput", Xn = N(
  ({
    __scopeSwitch: e,
    control: t,
    checked: n,
    bubbles: r = !0,
    ...o
  }, a) => {
    const s = E(null), i = L(s, a), u = Ha(n), l = Ya(t);
    return S(() => {
      const d = s.current;
      if (!d) return;
      const p = window.HTMLInputElement.prototype, h = Object.getOwnPropertyDescriptor(
        p,
        "checked"
      ).set;
      if (u !== n && h) {
        const C = new Event("click", { bubbles: r });
        h.call(d, n), d.dispatchEvent(C);
      }
    }, [u, n, r]), /* @__PURE__ */ c(
      "input",
      {
        type: "checkbox",
        "aria-hidden": !0,
        defaultChecked: n,
        ...o,
        tabIndex: -1,
        ref: i,
        style: {
          ...o.style,
          ...l,
          position: "absolute",
          pointerEvents: "none",
          opacity: 0,
          margin: 0
        }
      }
    );
  }
);
Xn.displayName = Qa;
function Zn(e) {
  return e ? "checked" : "unchecked";
}
var Ja = Hn, ei = qn;
function ti() {
  const [e, t] = P(!1), [n, r] = P(!1);
  return /* @__PURE__ */ c("div", { class: "p-4", children: [
    /* @__PURE__ */ c("h2", { class: "text-lg font-bold mb-2", children: "shadcn/ui compatibility demo" }),
    /* @__PURE__ */ c(No, { defaultValue: "tab1", children: [
      /* @__PURE__ */ c(Io, { "aria-label": "tabs", children: [
        /* @__PURE__ */ c(ht, { value: "tab1", children: "Tab 1" }),
        /* @__PURE__ */ c(ht, { value: "tab2", children: "Tab 2" })
      ] }),
      /* @__PURE__ */ c(gt, { value: "tab1", children: /* @__PURE__ */ c("p", { children: "Content for tab 1" }) }),
      /* @__PURE__ */ c(gt, { value: "tab2", children: /* @__PURE__ */ c("p", { children: "Content for tab 2" }) })
    ] }),
    /* @__PURE__ */ c("div", { class: "mt-4", children: /* @__PURE__ */ c($a, { open: e, onOpenChange: t, children: [
      /* @__PURE__ */ c(Ba, { asChild: !0, children: /* @__PURE__ */ c("button", { class: "px-3 py-1 bg-blue-600 text-white rounded", children: "Open Dialog" }) }),
      /* @__PURE__ */ c(Va, { children: [
        /* @__PURE__ */ c(Ga, { class: "fixed inset-0 bg-black/40" }),
        /* @__PURE__ */ c(za, { class: "fixed left-1/2 top-1/3 -translate-x-1/2 bg-white p-4 rounded shadow", children: [
          /* @__PURE__ */ c(ja, { children: "Dialog Title" }),
          /* @__PURE__ */ c(Ka, { children: "Simple dialog content for testing." }),
          /* @__PURE__ */ c("div", { class: "mt-2", children: /* @__PURE__ */ c("button", { onClick: () => t(!1), class: "px-2 py-1 bg-gray-200 rounded", children: "Close" }) })
        ] })
      ] })
    ] }) }),
    /* @__PURE__ */ c("div", { class: "mt-4 flex items-center gap-3", children: /* @__PURE__ */ c("label", { class: "flex items-center gap-2", children: [
      /* @__PURE__ */ c(Ja, { checked: n, onCheckedChange: (o) => r(o), children: /* @__PURE__ */ c(ei, { class: "inline-block w-4 h-4 bg-white rounded-full" }) }),
      /* @__PURE__ */ c("span", { children: n ? "On" : "Off" })
    ] }) })
  ] });
}
const ni = (e) => {
  const [t, n] = P(e ?? null), [r, o] = P(!1), [a, s] = P(null);
  return S(() => {
    const i = window;
    !t && i.dashboardData && n(i.dashboardData);
    const l = setInterval(async () => {
      var d, p, v, h;
      try {
        const C = await fetch("/api/dashboard/metrics");
        if (!C.ok) throw new Error("Failed to fetch metrics");
        const f = await C.json(), m = {
          lastUpdated: f.lastUpdated,
          documentCount: ((d = f.paperless_data) == null ? void 0 : d.documentCount) || 0,
          processedCount: ((p = f.paperless_data) == null ? void 0 : p.processedDocumentCount) || 0,
          tokenDistribution: ((v = f.paperless_data) == null ? void 0 : v.tokenDistribution) || [],
          documentTypes: ((h = f.paperless_data) == null ? void 0 : h.documentTypes) || [],
          processingStatus: f.processingStatus
        };
        n(m), s(null);
      } catch (C) {
        console.error("Failed to poll dashboard metrics:", C), s("Failed to update dashboard data");
      }
    }, 5e3);
    return () => clearInterval(l);
  }, []), { metrics: t, loading: r, error: a };
}, ri = ({ metrics: e }) => {
  var d, p;
  if (!e) return null;
  const { processingStatus: t, processedCount: n, documentCount: r } = e, o = (t == null ? void 0 : t.isProcessing) || !1, a = (t == null ? void 0 : t.processedToday) || 0, s = Math.max(0, r - n), u = Math.min(100, Math.round(n / (r || 1) * 100)), l = (v) => v ? new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Never";
  return /* @__PURE__ */ c("div", { className: "material-card col-span-2", children: [
    /* @__PURE__ */ c("div", { className: "flex items-center justify-between mb-4", children: [
      /* @__PURE__ */ c("h3", { className: "card-title mb-0", children: "Task Runner Status" }),
      /* @__PURE__ */ c("span", { className: "text-sm text-gray-500", children: [
        "Last updated: ",
        new Date(e.lastUpdated).toLocaleTimeString()
      ] })
    ] }),
    /* @__PURE__ */ c("div", { className: "bg-white rounded-xl border border-gray-100 p-6 mb-4", children: o ? /* @__PURE__ */ c("div", { className: "flex items-center gap-4", children: [
      /* @__PURE__ */ c("div", { className: "relative", children: [
        /* @__PURE__ */ c("div", { className: "w-12 h-12 rounded-full border-4 border-blue-100 border-t-blue-500 animate-spin" }),
        /* @__PURE__ */ c("div", { className: "absolute inset-0 flex items-center justify-center", children: /* @__PURE__ */ c("i", { className: "fas fa-file text-blue-500 text-sm" }) })
      ] }),
      /* @__PURE__ */ c("div", { className: "flex-1", children: [
        /* @__PURE__ */ c("div", { className: "flex items-center gap-2 mb-1", children: [
          /* @__PURE__ */ c("span", { className: "font-medium", children: "Processing Document" }),
          ((d = t == null ? void 0 : t.currentlyProcessing) == null ? void 0 : d.documentId) && /* @__PURE__ */ c("span", { className: "text-sm bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full", children: [
            "#",
            t.currentlyProcessing.documentId
          ] })
        ] }),
        /* @__PURE__ */ c("div", { className: "text-sm text-gray-600 truncate max-w-md", children: ((p = t == null ? void 0 : t.currentlyProcessing) == null ? void 0 : p.title) || "Unknown Document" })
      ] })
    ] }) : /* @__PURE__ */ c("div", { className: "flex items-center gap-4", children: [
      /* @__PURE__ */ c("div", { className: "w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center", children: /* @__PURE__ */ c("i", { className: "fas fa-check text-gray-400" }) }),
      /* @__PURE__ */ c("div", { children: [
        /* @__PURE__ */ c("div", { className: "font-medium", children: "System Idle" }),
        /* @__PURE__ */ c("div", { className: "text-sm text-gray-600", children: "Waiting for new documents" })
      ] })
    ] }) }),
    /* @__PURE__ */ c("div", { className: "mb-4", children: [
      /* @__PURE__ */ c("div", { className: "flex justify-between text-sm mb-1", children: [
        /* @__PURE__ */ c("span", { className: "text-gray-600", children: "Total Progress" }),
        /* @__PURE__ */ c("span", { className: "font-medium", children: [
          u,
          "% (",
          n,
          " / ",
          r,
          ")"
        ] })
      ] }),
      /* @__PURE__ */ c("div", { className: "w-full bg-gray-100 rounded-full h-2.5", children: /* @__PURE__ */ c("div", { className: "progress-bar-fill bg-blue-500 h-2.5 rounded-full", style: { "--progress-width": `${u}%` } }) })
    ] }),
    /* @__PURE__ */ c("div", { className: "grid grid-cols-3 gap-4", children: [
      /* @__PURE__ */ c("div", { className: "bg-white rounded-xl border border-gray-100 p-4", children: [
        /* @__PURE__ */ c("div", { className: "text-sm text-gray-600 mb-1", children: "Processed Today" }),
        /* @__PURE__ */ c("div", { className: "flex items-end gap-2", children: [
          /* @__PURE__ */ c("span", { className: "text-2xl font-bold", children: a }),
          /* @__PURE__ */ c("span", { className: "text-sm text-gray-500 mb-1", children: "docs" })
        ] })
      ] }),
      /* @__PURE__ */ c("div", { className: "bg-white rounded-xl border border-gray-100 p-4", children: [
        /* @__PURE__ */ c("div", { className: "text-sm text-gray-600 mb-1", children: "Pending" }),
        /* @__PURE__ */ c("div", { className: "flex items-end gap-2", children: [
          /* @__PURE__ */ c("span", { className: "text-2xl font-bold", children: s }),
          /* @__PURE__ */ c("span", { className: "text-sm text-gray-500 mb-1", children: "docs" })
        ] })
      ] }),
      /* @__PURE__ */ c("div", { className: "bg-white rounded-xl border border-gray-100 p-4", children: [
        /* @__PURE__ */ c("div", { className: "text-sm text-gray-600 mb-1", children: "Last Processed" }),
        /* @__PURE__ */ c("div", { className: "text-sm font-medium pt-2", children: t != null && t.lastProcessed ? l(t.lastProcessed.processed_at) : "No recent data" })
      ] })
    ] })
  ] });
}, Dt = ({ id: e, type: t, data: n, options: r }) => {
  const o = E(null), a = E(null);
  return S(() => {
    if (!o.current) return;
    const s = o.current.getContext("2d");
    if (s)
      return a.current && a.current.destroy(), typeof window.Chart < "u" && (a.current = new window.Chart(s, {
        type: t,
        data: n,
        options: {
          responsive: !0,
          maintainAspectRatio: !1,
          ...r
        }
      })), () => {
        a.current && (a.current.destroy(), a.current = null);
      };
  }, [JSON.stringify(n)]), /* @__PURE__ */ c("div", { className: "chart-container dynamic-height-chart relative", style: { "--chart-height": "300px" }, children: [
    /* @__PURE__ */ c("canvas", { ref: o, id: e }),
    (!n || !n.datasets || n.datasets[0].data.length === 0 || n.datasets[0].data.every((s) => s === 0)) && /* @__PURE__ */ c("div", { className: "absolute inset-0 flex items-center justify-center bg-gray-50/50 rounded-lg", children: /* @__PURE__ */ c("span", { className: "text-sm text-gray-500", children: "No data available" }) })
  ] });
};
function oi({ initialData: e }) {
  const { metrics: t } = ni(e);
  if (!t)
    return /* @__PURE__ */ c("div", { className: "p-4 text-center text-gray-500", children: "Loading dashboard metrics..." });
  const n = t.tokenDistribution.map((p) => p.range), r = t.tokenDistribution.map((p) => p.count), o = {
    labels: n,
    datasets: [{
      label: "Documents",
      data: r,
      backgroundColor: "#3b82f6",
      // blue-500
      borderRadius: 4
    }]
  }, a = {
    plugins: {
      legend: { display: !1 },
      tooltip: {
        mode: "index",
        intersect: !1
      }
    },
    scales: {
      y: { beginAtZero: !0, grid: { display: !0, drawBorder: !1 } },
      x: { grid: { display: !1 } }
    }
  }, s = t.documentTypes.map((p) => p.type), i = t.documentTypes.map((p) => p.count), l = {
    labels: s,
    datasets: [{
      data: i,
      backgroundColor: [
        "#3b82f6",
        "#8b5cf6",
        "#ec4899",
        "#f43f5e",
        "#f97316",
        "#eab308",
        "#22c55e",
        "#14b8a6",
        "#06b6d4",
        "#6366f1"
      ].slice(0, i.length),
      borderWidth: 0,
      spacing: 2
    }]
  };
  return /* @__PURE__ */ c(F, { children: /* @__PURE__ */ c("div", { className: "card-grid mt-6", children: [
    /* @__PURE__ */ c(ri, { metrics: t }),
    /* @__PURE__ */ c("div", { className: "material-card", children: [
      /* @__PURE__ */ c("h3", { className: "card-title", children: "Token Usage Distribution" }),
      /* @__PURE__ */ c(
        Dt,
        {
          id: "tokenDistributionChart",
          type: "bar",
          data: o,
          options: a
        }
      )
    ] }),
    /* @__PURE__ */ c("div", { className: "material-card", children: [
      /* @__PURE__ */ c("h3", { className: "card-title", children: "Document Type Distribution" }),
      /* @__PURE__ */ c(
        Dt,
        {
          id: "documentTypesChart",
          type: "doughnut",
          data: l,
          options: {
            cutout: "60%",
            plugins: {
              legend: { position: "right", labels: { boxWidth: 12, usePointStyle: !0 } }
            }
          }
        }
      )
    ] })
  ] }) });
}
const it = {};
function I(e, t) {
  it[e] = t;
}
I("visual-annotation-island", rr);
I("feedback-controls-island", or);
I("manual-editor-island", ar);
I("history-tabs-island", sr);
I("overlay-viewer-island", cr);
I("visual-overlays-island", lr);
I("playground-island", ur);
I("shadcn-compat", ti);
I("overview-dashboard-island", dr);
I("settings-sidebar-island", fr);
I("connection-settings-island", pr);
I("ai-provider-island", vr);
I("expert-models-island", mr);
I("restart-banner-island", hr);
I("developer-settings-island", gr);
I("presets-manager-island", yr);
I("export-panel-island", br);
I("view-mode-toggle-island", _r);
I("tags-manager-island", Cr);
I("ai-analysis-island", Er);
I("chat-workspace-island", Sr);
I("history-manager-island", wr);
I("manual-workspace-island", Nr);
I("document-content-island", Ir);
I("smart-metadata-island", ir);
I("unified-workspace-island", Tr);
I("dashboard-charts-island", oi);
I("document-context-bar-island", Pr);
I("context-sidebar-island", xr);
I("resizable-layout-island", Dr);
function ai(e) {
  const t = e.getAttribute("data-props") || "{}";
  try {
    return JSON.parse(t);
  } catch (n) {
    return console.warn("island-runtime: failed to parse props", n), null;
  }
}
function Be(e = document) {
  typeof window < "u" && (window.__islandRuntimeMounted = !0), e.querySelectorAll("[data-island]").forEach((n) => {
    const r = n.getAttribute("data-island");
    if (!r) return;
    const o = it[r];
    if (!o) {
      console.warn(`island-runtime: no component for '${r}'`);
      return;
    }
    const a = ai(n);
    if (a === null) return;
    de(D(o, a), n);
    const s = n;
    s.dataset && (s.dataset.mounted = "true");
    const i = s.querySelector('[data-testid$="-root"]');
    i && !i.getAttribute("data-hydrated") && i.setAttribute("data-hydrated", "true");
  });
}
if (typeof window < "u") {
  const e = window;
  e.mountIslands = Be, e.islandRuntime = {
    mountIslands: Be,
    registerIsland: I,
    _registry: it
  };
  const t = () => {
    e.__islandRuntimeMounted || document.querySelector("[data-island]") && Be(document);
  };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", t) : setTimeout(t, 0);
}
export {
  Be as mountIslands,
  I as registerIsland
};
