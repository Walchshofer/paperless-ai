import { H as j, k as L, d as P, A as S, h as Ie, T as B, _ as J, F as ze, g as He, y as w, P as je, x as Y, q as R, a as X, b as Ot, Q as Z, c as O, K as Qn, G as le, J as Jn, l as M, e as er, u as f } from "./hooks.module-Bbo057yU.mjs";
import tr from "./visual-annotation.island.js";
import nr from "./feedback-controls.island.js";
import rr from "./manual-editor.island.js";
import or from "./history-tabs.island.js";
import ar from "./overlay-viewer.island.js";
import ir from "./playground.island.js";
import cr from "./overview-dashboard.island.js";
import sr from "./settings-sidebar.island.js";
import ur from "./connection-settings.island.js";
import lr from "./ai-provider.island.js";
import dr from "./expert-models.island.js";
import fr from "./restart-banner.island.js";
import vr from "./developer-settings.island.js";
import pr from "./presets-manager.island.js";
function At(e, t) {
  for (var n in t) e[n] = t[n];
  return e;
}
function Ue(e, t) {
  for (var n in e) if (n !== "__source" && !(n in t)) return !0;
  for (var r in t) if (r !== "__source" && e[r] !== t[r]) return !0;
  return !1;
}
function Ye(e, t) {
  var n = t(), r = P({ t: { __: n, u: t } }), o = r[0].t, a = r[1];
  return J(function() {
    o.__ = n, o.u = t, Re(o) && a({ t: o });
  }, [e, n, t]), w(function() {
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
function qe(e) {
  e();
}
function Xe(e) {
  return e;
}
function Ze() {
  return [!1, qe];
}
var Qe = J;
function Se(e, t) {
  this.props = e, this.context = t;
}
function Rt(e, t) {
  function n(o) {
    var a = this.props.ref, c = a == o.ref;
    return !c && a && (a.call ? a(null) : a.current = null), t ? !t(this.props, o) || !c : Ue(this.props, o);
  }
  function r(o) {
    return this.shouldComponentUpdate = n, O(e, o);
  }
  return r.displayName = "Memo(" + (e.displayName || e.name) + ")", r.prototype.isReactComponent = !0, r.__f = !0, r.type = e, r;
}
(Se.prototype = new X()).isPureReactComponent = !0, Se.prototype.shouldComponentUpdate = function(e, t) {
  return Ue(this.props, e) || Ue(this.state, t);
};
var it = M.__b;
M.__b = function(e) {
  e.type && e.type.__f && e.ref && (e.props.ref = e.ref, e.ref = null), it && it(e);
};
var mr = typeof Symbol < "u" && Symbol.for && Symbol.for("react.forward_ref") || 3911;
function I(e) {
  function t(n) {
    var r = At({}, n);
    return delete r.ref, e(r, n.ref || null);
  }
  return t.$$typeof = mr, t.render = e, t.prototype.isReactComponent = t.__f = !0, t.displayName = "ForwardRef(" + (e.displayName || e.name) + ")", t;
}
var ct = function(e, t) {
  return e == null ? null : j(j(e).map(t));
}, $ = { map: ct, forEach: ct, count: function(e) {
  return e ? j(e).length : 0;
}, only: function(e) {
  var t = j(e);
  if (t.length !== 1) throw "Children.only";
  return t[0];
}, toArray: j }, hr = M.__e;
M.__e = function(e, t, n, r) {
  if (e.then) {
    for (var o, a = t; a = a.__; ) if ((o = a.__c) && o.__c) return t.__e == null && (t.__e = n.__e, t.__k = n.__k), o.__c(e, t);
  }
  hr(e, t, n, r);
};
var st = M.unmount;
function Dt(e, t, n) {
  return e && (e.__c && e.__c.__H && (e.__c.__H.__.forEach(function(r) {
    typeof r.__c == "function" && r.__c();
  }), e.__c.__H = null), (e = At({}, e)).__c != null && (e.__c.__P === n && (e.__c.__P = t), e.__c.__e = !0, e.__c = null), e.__k = e.__k && e.__k.map(function(r) {
    return Dt(r, t, n);
  })), e;
}
function xt(e, t, n) {
  return e && n && (e.__v = null, e.__k = e.__k && e.__k.map(function(r) {
    return xt(r, t, n);
  }), e.__c && e.__c.__P === t && (e.__e && n.appendChild(e.__e), e.__c.__e = !0, e.__c.__P = n)), e;
}
function se() {
  this.__u = 0, this.o = null, this.__b = null;
}
function Mt(e) {
  var t = e.__.__c;
  return t && t.__a && t.__a(e);
}
function Ft(e) {
  var t, n, r, o = null;
  function a(c) {
    if (t || (t = e()).then(function(i) {
      i && (o = i.default || i), r = !0;
    }, function(i) {
      n = i, r = !0;
    }), n) throw n;
    if (!r) throw t;
    return o ? O(o, c) : null;
  }
  return a.displayName = "Lazy", a.__f = !0, a;
}
function re() {
  this.i = null, this.l = null;
}
M.unmount = function(e) {
  var t = e.__c;
  t && t.__R && t.__R(), t && 32 & e.__u && (e.type = null), st && st(e);
}, (se.prototype = new X()).__c = function(e, t) {
  var n = t.__c, r = this;
  r.o == null && (r.o = []), r.o.push(n);
  var o = Mt(r.__v), a = !1, c = function() {
    a || (a = !0, n.__R = null, o ? o(i) : i());
  };
  n.__R = c;
  var i = function() {
    if (!--r.__u) {
      if (r.state.__a) {
        var u = r.state.__a;
        r.__v.__k[0] = xt(u, u.__c.__P, u.__c.__O);
      }
      var s;
      for (r.setState({ __a: r.__b = null }); s = r.o.pop(); ) s.forceUpdate();
    }
  };
  r.__u++ || 32 & t.__u || r.setState({ __a: r.__b = r.__v.__k[0] }), e.then(c, c);
}, se.prototype.componentWillUnmount = function() {
  this.o = [];
}, se.prototype.render = function(e, t) {
  if (this.__b) {
    if (this.__v.__k) {
      var n = document.createElement("div"), r = this.__v.__k[0].__c;
      this.__v.__k[0] = Dt(this.__b, n, r.__O = r.__P);
    }
    this.__b = null;
  }
  var o = t.__a && O(L, null, e.fallback);
  return o && (o.__u &= -33), [O(L, null, t.__a ? null : e.children), o];
};
var ut = function(e, t, n) {
  if (++n[1] === n[0] && e.l.delete(t), e.props.revealOrder && (e.props.revealOrder[0] !== "t" || !e.l.size)) for (n = e.i; n; ) {
    for (; n.length > 3; ) n.pop()();
    if (n[1] < n[0]) break;
    e.i = n = n[2];
  }
};
function gr(e) {
  return this.getChildContext = function() {
    return e.context;
  }, e.children;
}
function _r(e) {
  var t = this, n = e.h;
  if (t.componentWillUnmount = function() {
    le(null, t.v), t.v = null, t.h = null;
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
  le(O(gr, { context: t.context }, e.__v), t.v);
}
function Lt(e, t) {
  var n = O(_r, { __v: e, h: t });
  return n.containerInfo = t, n;
}
(re.prototype = new X()).__a = function(e) {
  var t = this, n = Mt(t.__v), r = t.l.get(e);
  return r[0]++, function(o) {
    var a = function() {
      t.props.revealOrder ? (r.push(o), ut(t, e, r)) : o();
    };
    n ? n(a) : a();
  };
}, re.prototype.render = function(e) {
  this.i = null, this.l = /* @__PURE__ */ new Map();
  var t = j(e.children);
  e.revealOrder && e.revealOrder[0] === "b" && t.reverse();
  for (var n = t.length; n--; ) this.l.set(t[n], this.i = [1, 0, this.i]);
  return e.children;
}, re.prototype.componentDidUpdate = re.prototype.componentDidMount = function() {
  var e = this;
  this.l.forEach(function(t, n) {
    ut(e, n, t);
  });
};
var kt = typeof Symbol < "u" && Symbol.for && Symbol.for("react.element") || 60103, yr = /^(?:accent|alignment|arabic|baseline|cap|clip(?!PathU)|color|dominant|fill|flood|font|glyph(?!R)|horiz|image(!S)|letter|lighting|marker(?!H|W|U)|overline|paint|pointer|shape|stop|strikethrough|stroke|text(?!L)|transform|underline|unicode|units|v|vector|vert|word|writing|x(?!C))[A-Z]/, br = /^on(Ani|Tra|Tou|BeforeInp|Compo)/, Er = /[A-Z0-9]/g, Sr = typeof document < "u", Cr = function(e) {
  return (typeof Symbol < "u" && typeof Symbol() == "symbol" ? /fil|che|rad/ : /fil|che|ra/).test(e);
};
function Wt(e, t, n) {
  return t.__k == null && (t.textContent = ""), le(e, t), typeof n == "function" && n(), e ? e.__c : null;
}
function $t(e, t, n) {
  return Jn(e, t), typeof n == "function" && n(), e ? e.__c : null;
}
X.prototype.isReactComponent = {}, ["componentWillMount", "componentWillReceiveProps", "componentWillUpdate"].forEach(function(e) {
  Object.defineProperty(X.prototype, e, { configurable: !0, get: function() {
    return this["UNSAFE_" + e];
  }, set: function(t) {
    Object.defineProperty(this, e, { configurable: !0, writable: !0, value: t });
  } });
});
var lt = M.event;
function wr() {
}
function Ir() {
  return this.cancelBubble;
}
function Nr() {
  return this.defaultPrevented;
}
M.event = function(e) {
  return lt && (e = lt(e)), e.persist = wr, e.isPropagationStopped = Ir, e.isDefaultPrevented = Nr, e.nativeEvent = e;
};
var Je, Tr = { enumerable: !1, configurable: !0, get: function() {
  return this.class;
} }, dt = M.vnode;
M.vnode = function(e) {
  typeof e.type == "string" && function(t) {
    var n = t.props, r = t.type, o = {}, a = r.indexOf("-") === -1;
    for (var c in n) {
      var i = n[c];
      if (!(c === "value" && "defaultValue" in n && i == null || Sr && c === "children" && r === "noscript" || c === "class" || c === "className")) {
        var u = c.toLowerCase();
        c === "defaultValue" && "value" in n && n.value == null ? c = "value" : c === "download" && i === !0 ? i = "" : u === "translate" && i === "no" ? i = !1 : u[0] === "o" && u[1] === "n" ? u === "ondoubleclick" ? c = "ondblclick" : u !== "onchange" || r !== "input" && r !== "textarea" || Cr(n.type) ? u === "onfocus" ? c = "onfocusin" : u === "onblur" ? c = "onfocusout" : br.test(c) && (c = u) : u = c = "oninput" : a && yr.test(c) ? c = c.replace(Er, "-$&").toLowerCase() : i === null && (i = void 0), u === "oninput" && o[c = u] && (c = "oninputCapture"), o[c] = i;
      }
    }
    r == "select" && o.multiple && Array.isArray(o.value) && (o.value = j(n.children).forEach(function(s) {
      s.props.selected = o.value.indexOf(s.props.value) != -1;
    })), r == "select" && o.defaultValue != null && (o.value = j(n.children).forEach(function(s) {
      s.props.selected = o.multiple ? o.defaultValue.indexOf(s.props.value) != -1 : o.defaultValue == s.props.value;
    })), n.class && !n.className ? (o.class = n.class, Object.defineProperty(o, "className", Tr)) : (n.className && !n.class || n.class && n.className) && (o.class = o.className = n.className), t.props = o;
  }(e), e.$$typeof = kt, dt && dt(e);
};
var ft = M.__r;
M.__r = function(e) {
  ft && ft(e), Je = e.__c;
};
var vt = M.diffed;
M.diffed = function(e) {
  vt && vt(e);
  var t = e.props, n = e.__e;
  n != null && e.type === "textarea" && "value" in t && t.value !== n.value && (n.value = t.value == null ? "" : t.value), Je = null;
};
var Bt = { ReactCurrentDispatcher: { current: { readContext: function(e) {
  return Je.__n[e.__c].props.value;
}, useCallback: R, useContext: Y, useDebugValue: je, useDeferredValue: Xe, useEffect: w, useId: He, useImperativeHandle: ze, useInsertionEffect: Qe, useLayoutEffect: J, useMemo: B, useReducer: Ie, useRef: S, useState: P, useSyncExternalStore: Ye, useTransition: Ze } } }, Pr = "18.3.1";
function Ut(e) {
  return O.bind(null, e);
}
function V(e) {
  return !!e && e.$$typeof === kt;
}
function Vt(e) {
  return V(e) && e.type === L;
}
function Gt(e) {
  return !!e && !!e.displayName && (typeof e.displayName == "string" || e.displayName instanceof String) && e.displayName.startsWith("Memo(");
}
function ce(e) {
  return V(e) ? Qn.apply(null, arguments) : e;
}
function Kt(e) {
  return !!e.__k && (le(null, e), !0);
}
function zt(e) {
  return e && (e.base || e.nodeType === 1 && e) || null;
}
var Ht = function(e, t) {
  return e(t);
}, et = function(e, t) {
  return e(t);
}, jt = L, Yt = V, U = { useState: P, useId: He, useReducer: Ie, useEffect: w, useLayoutEffect: J, useInsertionEffect: Qe, useTransition: Ze, useDeferredValue: Xe, useSyncExternalStore: Ye, startTransition: qe, useRef: S, useImperativeHandle: ze, useMemo: B, useCallback: R, useContext: Y, useDebugValue: je, version: "18.3.1", Children: $, render: Wt, hydrate: $t, unmountComponentAtNode: Kt, createPortal: Lt, createElement: O, createContext: Z, createFactory: Ut, cloneElement: ce, createRef: Ot, Fragment: L, isValidElement: V, isElement: Yt, isFragment: Vt, isMemo: Gt, findDOMNode: zt, Component: X, PureComponent: Se, memo: Rt, forwardRef: I, flushSync: et, unstable_batchedUpdates: Ht, StrictMode: jt, Suspense: se, SuspenseList: re, lazy: Ft, __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: Bt };
const qt = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  Children: $,
  Component: X,
  Fragment: L,
  PureComponent: Se,
  StrictMode: jt,
  Suspense: se,
  SuspenseList: re,
  __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: Bt,
  cloneElement: ce,
  createContext: Z,
  createElement: O,
  createFactory: Ut,
  createPortal: Lt,
  createRef: Ot,
  default: U,
  findDOMNode: zt,
  flushSync: et,
  forwardRef: I,
  hydrate: $t,
  isElement: Yt,
  isFragment: Vt,
  isMemo: Gt,
  isValidElement: V,
  lazy: Ft,
  memo: Rt,
  render: Wt,
  startTransition: qe,
  unmountComponentAtNode: Kt,
  unstable_batchedUpdates: Ht,
  useCallback: R,
  useContext: Y,
  useDebugValue: je,
  useDeferredValue: Xe,
  useEffect: w,
  useErrorBoundary: er,
  useId: He,
  useImperativeHandle: ze,
  useInsertionEffect: Qe,
  useLayoutEffect: J,
  useMemo: B,
  useReducer: Ie,
  useRef: S,
  useState: P,
  useSyncExternalStore: Ye,
  useTransition: Ze,
  version: Pr
}, Symbol.toStringTag, { value: "Module" }));
function D(e, t, { checkForDefaultPrevented: n = !0 } = {}) {
  return function(o) {
    if (e == null || e(o), n === !1 || !o.defaultPrevented)
      return t == null ? void 0 : t(o);
  };
}
function Or(e, t) {
  const n = Z(t), r = (a) => {
    const { children: c, ...i } = a, u = B(() => i, Object.values(i));
    return /* @__PURE__ */ f(n.Provider, { value: u, children: c });
  };
  r.displayName = e + "Provider";
  function o(a) {
    const c = Y(n);
    if (c) return c;
    if (t !== void 0) return t;
    throw new Error(`\`${a}\` must be used within \`${e}\``);
  }
  return [r, o];
}
function de(e, t = []) {
  let n = [];
  function r(a, c) {
    const i = Z(c), u = n.length;
    n = [...n, c];
    const s = (v) => {
      var h;
      const { scope: m, children: g, ...E } = v, d = ((h = m == null ? void 0 : m[e]) == null ? void 0 : h[u]) || i, p = B(() => E, Object.values(E));
      return /* @__PURE__ */ f(d.Provider, { value: p, children: g });
    };
    s.displayName = a + "Provider";
    function l(v, m) {
      var d;
      const g = ((d = m == null ? void 0 : m[e]) == null ? void 0 : d[u]) || i, E = Y(g);
      if (E) return E;
      if (c !== void 0) return c;
      throw new Error(`\`${v}\` must be used within \`${a}\``);
    }
    return [s, l];
  }
  const o = () => {
    const a = n.map((c) => Z(c));
    return function(i) {
      const u = (i == null ? void 0 : i[e]) || a;
      return B(
        () => ({ [`__scope${e}`]: { ...i, [e]: u } }),
        [i, u]
      );
    };
  };
  return o.scopeName = e, [r, Ar(o, ...t)];
}
function Ar(...e) {
  const t = e[0];
  if (e.length === 1) return t;
  const n = () => {
    const r = e.map((o) => ({
      useScope: o(),
      scopeName: o.scopeName
    }));
    return function(a) {
      const c = r.reduce((i, { useScope: u, scopeName: s }) => {
        const v = u(a)[`__scope${s}`];
        return { ...i, ...v };
      }, {});
      return B(() => ({ [`__scope${t.scopeName}`]: c }), [c]);
    };
  };
  return n.scopeName = t.scopeName, n;
}
function pt(e, t) {
  if (typeof e == "function")
    return e(t);
  e != null && (e.current = t);
}
function Xt(...e) {
  return (t) => {
    let n = !1;
    const r = e.map((o) => {
      const a = pt(o, t);
      return !n && typeof a == "function" && (n = !0), a;
    });
    if (n)
      return () => {
        for (let o = 0; o < r.length; o++) {
          const a = r[o];
          typeof a == "function" ? a() : pt(e[o], null);
        }
      };
  };
}
function F(...e) {
  return R(Xt(...e), e);
}
// @__NO_SIDE_EFFECTS__
function Ce(e) {
  const t = /* @__PURE__ */ Rr(e), n = I((r, o) => {
    const { children: a, ...c } = r, i = $.toArray(a), u = i.find(xr);
    if (u) {
      const s = u.props.children, l = i.map((v) => v === u ? $.count(s) > 1 ? $.only(null) : V(s) ? s.props.children : null : v);
      return /* @__PURE__ */ f(t, { ...c, ref: o, children: V(s) ? ce(s, void 0, l) : null });
    }
    return /* @__PURE__ */ f(t, { ...c, ref: o, children: a });
  });
  return n.displayName = `${e}.Slot`, n;
}
// @__NO_SIDE_EFFECTS__
function Rr(e) {
  const t = I((n, r) => {
    const { children: o, ...a } = n;
    if (V(o)) {
      const c = Fr(o), i = Mr(a, o.props);
      return o.type !== L && (i.ref = r ? Xt(r, c) : c), ce(o, i);
    }
    return $.count(o) > 1 ? $.only(null) : null;
  });
  return t.displayName = `${e}.SlotClone`, t;
}
var Dr = Symbol("radix.slottable");
function xr(e) {
  return V(e) && typeof e.type == "function" && "__radixId" in e.type && e.type.__radixId === Dr;
}
function Mr(e, t) {
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
function Fr(e) {
  var r, o;
  let t = (r = Object.getOwnPropertyDescriptor(e.props, "ref")) == null ? void 0 : r.get, n = t && "isReactWarning" in t && t.isReactWarning;
  return n ? e.ref : (t = (o = Object.getOwnPropertyDescriptor(e, "ref")) == null ? void 0 : o.get, n = t && "isReactWarning" in t && t.isReactWarning, n ? e.props.ref : e.props.ref || e.ref);
}
function Lr(e) {
  const t = e + "CollectionProvider", [n, r] = de(t), [o, a] = n(
    t,
    { collectionRef: { current: null }, itemMap: /* @__PURE__ */ new Map() }
  ), c = (d) => {
    const { scope: p, children: h } = d, b = U.useRef(null), _ = U.useRef(/* @__PURE__ */ new Map()).current;
    return /* @__PURE__ */ f(o, { scope: p, itemMap: _, collectionRef: b, children: h });
  };
  c.displayName = t;
  const i = e + "CollectionSlot", u = /* @__PURE__ */ Ce(i), s = U.forwardRef(
    (d, p) => {
      const { scope: h, children: b } = d, _ = a(i, h), y = F(p, _.collectionRef);
      return /* @__PURE__ */ f(u, { ref: y, children: b });
    }
  );
  s.displayName = i;
  const l = e + "CollectionItemSlot", v = "data-radix-collection-item", m = /* @__PURE__ */ Ce(l), g = U.forwardRef(
    (d, p) => {
      const { scope: h, children: b, ..._ } = d, y = U.useRef(null), N = F(p, y), A = a(l, h);
      return U.useEffect(() => (A.itemMap.set(y, { ref: y, ..._ }), () => void A.itemMap.delete(y))), /* @__PURE__ */ f(m, { [v]: "", ref: N, children: b });
    }
  );
  g.displayName = l;
  function E(d) {
    const p = a(e + "CollectionConsumer", d);
    return U.useCallback(() => {
      const b = p.collectionRef.current;
      if (!b) return [];
      const _ = Array.from(b.querySelectorAll(`[${v}]`));
      return Array.from(p.itemMap.values()).sort(
        (A, C) => _.indexOf(A.ref.current) - _.indexOf(C.ref.current)
      );
    }, [p.collectionRef, p.itemMap]);
  }
  return [
    { Provider: c, Slot: s, ItemSlot: g },
    E,
    r
  ];
}
var ae = globalThis != null && globalThis.document ? J : () => {
}, kr = qt[" useId ".trim().toString()] || (() => {
}), Wr = 0;
function ue(e) {
  const [t, n] = P(kr());
  return ae(() => {
    n((r) => r ?? String(Wr++));
  }, [e]), e || (t ? `radix-${t}` : "");
}
var $r = [
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
], x = $r.reduce((e, t) => {
  const n = /* @__PURE__ */ Ce(`Primitive.${t}`), r = I((o, a) => {
    const { asChild: c, ...i } = o, u = c ? n : t;
    return typeof window < "u" && (window[Symbol.for("radix-ui")] = !0), /* @__PURE__ */ f(u, { ...i, ref: a });
  });
  return r.displayName = `Primitive.${t}`, { ...e, [t]: r };
}, {});
function Br(e, t) {
  e && et(() => e.dispatchEvent(t));
}
function ie(e) {
  const t = S(e);
  return w(() => {
    t.current = e;
  }), B(() => (...n) => {
    var r;
    return (r = t.current) == null ? void 0 : r.call(t, ...n);
  }, []);
}
var Ur = qt[" useInsertionEffect ".trim().toString()] || ae;
function Ne({
  prop: e,
  defaultProp: t,
  onChange: n = () => {
  },
  caller: r
}) {
  const [o, a, c] = Vr({
    defaultProp: t,
    onChange: n
  }), i = e !== void 0, u = i ? e : o;
  {
    const l = S(e !== void 0);
    w(() => {
      const v = l.current;
      v !== i && console.warn(
        `${r} is changing from ${v ? "controlled" : "uncontrolled"} to ${i ? "controlled" : "uncontrolled"}. Components should not switch from controlled to uncontrolled (or vice versa). Decide between using a controlled or uncontrolled value for the lifetime of the component.`
      ), l.current = i;
    }, [i, r]);
  }
  const s = R(
    (l) => {
      var v;
      if (i) {
        const m = Gr(l) ? l(e) : l;
        m !== e && ((v = c.current) == null || v.call(c, m));
      } else
        a(l);
    },
    [i, e, a, c]
  );
  return [u, s];
}
function Vr({
  defaultProp: e,
  onChange: t
}) {
  const [n, r] = P(e), o = S(n), a = S(t);
  return Ur(() => {
    a.current = t;
  }, [t]), w(() => {
    var c;
    o.current !== n && ((c = a.current) == null || c.call(a, n), o.current = n);
  }, [n, o]), [n, r, a];
}
function Gr(e) {
  return typeof e == "function";
}
var Kr = Z(void 0);
function Zt(e) {
  const t = Y(Kr);
  return e || t || "ltr";
}
var De = "rovingFocusGroup.onEntryFocus", zr = { bubbles: !1, cancelable: !0 }, fe = "RovingFocusGroup", [Ve, Qt, Hr] = Lr(fe), [jr, Jt] = de(
  fe,
  [Hr]
), [Yr, qr] = jr(fe), en = I(
  (e, t) => /* @__PURE__ */ f(Ve.Provider, { scope: e.__scopeRovingFocusGroup, children: /* @__PURE__ */ f(Ve.Slot, { scope: e.__scopeRovingFocusGroup, children: /* @__PURE__ */ f(Xr, { ...e, ref: t }) }) })
);
en.displayName = fe;
var Xr = I((e, t) => {
  const {
    __scopeRovingFocusGroup: n,
    orientation: r,
    loop: o = !1,
    dir: a,
    currentTabStopId: c,
    defaultCurrentTabStopId: i,
    onCurrentTabStopIdChange: u,
    onEntryFocus: s,
    preventScrollOnEntryFocus: l = !1,
    ...v
  } = e, m = S(null), g = F(t, m), E = Zt(a), [d, p] = Ne({
    prop: c,
    defaultProp: i ?? null,
    onChange: u,
    caller: fe
  }), [h, b] = P(!1), _ = ie(s), y = Qt(n), N = S(!1), [A, C] = P(0);
  return w(() => {
    const T = m.current;
    if (T)
      return T.addEventListener(De, _), () => T.removeEventListener(De, _);
  }, [_]), /* @__PURE__ */ f(
    Yr,
    {
      scope: n,
      orientation: r,
      dir: E,
      loop: o,
      currentTabStopId: d,
      onItemFocus: R(
        (T) => p(T),
        [p]
      ),
      onItemShiftTab: R(() => b(!0), []),
      onFocusableItemAdd: R(
        () => C((T) => T + 1),
        []
      ),
      onFocusableItemRemove: R(
        () => C((T) => T - 1),
        []
      ),
      children: /* @__PURE__ */ f(
        x.div,
        {
          tabIndex: h || A === 0 ? -1 : 0,
          "data-orientation": r,
          ...v,
          ref: g,
          style: { outline: "none", ...e.style },
          onMouseDown: D(e.onMouseDown, () => {
            N.current = !0;
          }),
          onFocus: D(e.onFocus, (T) => {
            const G = !N.current;
            if (T.target === T.currentTarget && G && !h) {
              const K = new CustomEvent(De, zr);
              if (T.currentTarget.dispatchEvent(K), !K.defaultPrevented) {
                const z = y().filter((q) => q.focusable), pe = z.find((q) => q.active), Xn = z.find((q) => q.id === d), Zn = [pe, Xn, ...z].filter(
                  Boolean
                ).map((q) => q.ref.current);
                rn(Zn, l);
              }
            }
            N.current = !1;
          }),
          onBlur: D(e.onBlur, () => b(!1))
        }
      )
    }
  );
}), tn = "RovingFocusGroupItem", nn = I(
  (e, t) => {
    const {
      __scopeRovingFocusGroup: n,
      focusable: r = !0,
      active: o = !1,
      tabStopId: a,
      children: c,
      ...i
    } = e, u = ue(), s = a || u, l = qr(tn, n), v = l.currentTabStopId === s, m = Qt(n), { onFocusableItemAdd: g, onFocusableItemRemove: E, currentTabStopId: d } = l;
    return w(() => {
      if (r)
        return g(), () => E();
    }, [r, g, E]), /* @__PURE__ */ f(
      Ve.ItemSlot,
      {
        scope: n,
        id: s,
        focusable: r,
        active: o,
        children: /* @__PURE__ */ f(
          x.span,
          {
            tabIndex: v ? 0 : -1,
            "data-orientation": l.orientation,
            ...i,
            ref: t,
            onMouseDown: D(e.onMouseDown, (p) => {
              r ? l.onItemFocus(s) : p.preventDefault();
            }),
            onFocus: D(e.onFocus, () => l.onItemFocus(s)),
            onKeyDown: D(e.onKeyDown, (p) => {
              if (p.key === "Tab" && p.shiftKey) {
                l.onItemShiftTab();
                return;
              }
              if (p.target !== p.currentTarget) return;
              const h = Jr(p, l.orientation, l.dir);
              if (h !== void 0) {
                if (p.metaKey || p.ctrlKey || p.altKey || p.shiftKey) return;
                p.preventDefault();
                let _ = m().filter((y) => y.focusable).map((y) => y.ref.current);
                if (h === "last") _.reverse();
                else if (h === "prev" || h === "next") {
                  h === "prev" && _.reverse();
                  const y = _.indexOf(p.currentTarget);
                  _ = l.loop ? eo(_, y + 1) : _.slice(y + 1);
                }
                setTimeout(() => rn(_));
              }
            }),
            children: typeof c == "function" ? c({ isCurrentTabStop: v, hasTabStop: d != null }) : c
          }
        )
      }
    );
  }
);
nn.displayName = tn;
var Zr = {
  ArrowLeft: "prev",
  ArrowUp: "prev",
  ArrowRight: "next",
  ArrowDown: "next",
  PageUp: "first",
  Home: "first",
  PageDown: "last",
  End: "last"
};
function Qr(e, t) {
  return t !== "rtl" ? e : e === "ArrowLeft" ? "ArrowRight" : e === "ArrowRight" ? "ArrowLeft" : e;
}
function Jr(e, t, n) {
  const r = Qr(e.key, n);
  if (!(t === "vertical" && ["ArrowLeft", "ArrowRight"].includes(r)) && !(t === "horizontal" && ["ArrowUp", "ArrowDown"].includes(r)))
    return Zr[r];
}
function rn(e, t = !1) {
  const n = document.activeElement;
  for (const r of e)
    if (r === n || (r.focus({ preventScroll: t }), document.activeElement !== n)) return;
}
function eo(e, t) {
  return e.map((n, r) => e[(t + r) % e.length]);
}
var to = en, no = nn;
function ro(e, t) {
  return Ie((n, r) => t[n][r] ?? n, e);
}
var ve = (e) => {
  const { present: t, children: n } = e, r = oo(t), o = typeof n == "function" ? n({ present: r.isPresent }) : $.only(n), a = F(r.ref, ao(o));
  return typeof n == "function" || r.isPresent ? ce(o, { ref: a }) : null;
};
ve.displayName = "Presence";
function oo(e) {
  const [t, n] = P(), r = S(null), o = S(e), a = S("none"), c = e ? "mounted" : "unmounted", [i, u] = ro(c, {
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
  return w(() => {
    const s = me(r.current);
    a.current = i === "mounted" ? s : "none";
  }, [i]), ae(() => {
    const s = r.current, l = o.current;
    if (l !== e) {
      const m = a.current, g = me(s);
      e ? u("MOUNT") : g === "none" || (s == null ? void 0 : s.display) === "none" ? u("UNMOUNT") : u(l && m !== g ? "ANIMATION_OUT" : "UNMOUNT"), o.current = e;
    }
  }, [e, u]), ae(() => {
    if (t) {
      let s;
      const l = t.ownerDocument.defaultView ?? window, v = (g) => {
        const d = me(r.current).includes(CSS.escape(g.animationName));
        if (g.target === t && d && (u("ANIMATION_END"), !o.current)) {
          const p = t.style.animationFillMode;
          t.style.animationFillMode = "forwards", s = l.setTimeout(() => {
            t.style.animationFillMode === "forwards" && (t.style.animationFillMode = p);
          });
        }
      }, m = (g) => {
        g.target === t && (a.current = me(r.current));
      };
      return t.addEventListener("animationstart", m), t.addEventListener("animationcancel", v), t.addEventListener("animationend", v), () => {
        l.clearTimeout(s), t.removeEventListener("animationstart", m), t.removeEventListener("animationcancel", v), t.removeEventListener("animationend", v);
      };
    } else
      u("ANIMATION_END");
  }, [t, u]), {
    isPresent: ["mounted", "unmountSuspended"].includes(i),
    ref: R((s) => {
      r.current = s ? getComputedStyle(s) : null, n(s);
    }, [])
  };
}
function me(e) {
  return (e == null ? void 0 : e.animationName) || "none";
}
function ao(e) {
  var r, o;
  let t = (r = Object.getOwnPropertyDescriptor(e.props, "ref")) == null ? void 0 : r.get, n = t && "isReactWarning" in t && t.isReactWarning;
  return n ? e.ref : (t = (o = Object.getOwnPropertyDescriptor(e, "ref")) == null ? void 0 : o.get, n = t && "isReactWarning" in t && t.isReactWarning, n ? e.props.ref : e.props.ref || e.ref);
}
var Te = "Tabs", [io] = de(Te, [
  Jt
]), on = Jt(), [co, tt] = io(Te), an = I(
  (e, t) => {
    const {
      __scopeTabs: n,
      value: r,
      onValueChange: o,
      defaultValue: a,
      orientation: c = "horizontal",
      dir: i,
      activationMode: u = "automatic",
      ...s
    } = e, l = Zt(i), [v, m] = Ne({
      prop: r,
      onChange: o,
      defaultProp: a ?? "",
      caller: Te
    });
    return /* @__PURE__ */ f(
      co,
      {
        scope: n,
        baseId: ue(),
        value: v,
        onValueChange: m,
        orientation: c,
        dir: l,
        activationMode: u,
        children: /* @__PURE__ */ f(
          x.div,
          {
            dir: l,
            "data-orientation": c,
            ...s,
            ref: t
          }
        )
      }
    );
  }
);
an.displayName = Te;
var cn = "TabsList", sn = I(
  (e, t) => {
    const { __scopeTabs: n, loop: r = !0, ...o } = e, a = tt(cn, n), c = on(n);
    return /* @__PURE__ */ f(
      to,
      {
        asChild: !0,
        ...c,
        orientation: a.orientation,
        dir: a.dir,
        loop: r,
        children: /* @__PURE__ */ f(
          x.div,
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
sn.displayName = cn;
var un = "TabsTrigger", ln = I(
  (e, t) => {
    const { __scopeTabs: n, value: r, disabled: o = !1, ...a } = e, c = tt(un, n), i = on(n), u = vn(c.baseId, r), s = pn(c.baseId, r), l = r === c.value;
    return /* @__PURE__ */ f(
      no,
      {
        asChild: !0,
        ...i,
        focusable: !o,
        active: l,
        children: /* @__PURE__ */ f(
          x.button,
          {
            type: "button",
            role: "tab",
            "aria-selected": l,
            "aria-controls": s,
            "data-state": l ? "active" : "inactive",
            "data-disabled": o ? "" : void 0,
            disabled: o,
            id: u,
            ...a,
            ref: t,
            onMouseDown: D(e.onMouseDown, (v) => {
              !o && v.button === 0 && v.ctrlKey === !1 ? c.onValueChange(r) : v.preventDefault();
            }),
            onKeyDown: D(e.onKeyDown, (v) => {
              [" ", "Enter"].includes(v.key) && c.onValueChange(r);
            }),
            onFocus: D(e.onFocus, () => {
              const v = c.activationMode !== "manual";
              !l && !o && v && c.onValueChange(r);
            })
          }
        )
      }
    );
  }
);
ln.displayName = un;
var dn = "TabsContent", fn = I(
  (e, t) => {
    const { __scopeTabs: n, value: r, forceMount: o, children: a, ...c } = e, i = tt(dn, n), u = vn(i.baseId, r), s = pn(i.baseId, r), l = r === i.value, v = S(l);
    return w(() => {
      const m = requestAnimationFrame(() => v.current = !1);
      return () => cancelAnimationFrame(m);
    }, []), /* @__PURE__ */ f(ve, { present: o || l, children: ({ present: m }) => /* @__PURE__ */ f(
      x.div,
      {
        "data-state": l ? "active" : "inactive",
        "data-orientation": i.orientation,
        role: "tabpanel",
        "aria-labelledby": u,
        hidden: !m,
        id: s,
        tabIndex: 0,
        ...c,
        ref: t,
        style: {
          ...e.style,
          animationDuration: v.current ? "0s" : void 0
        },
        children: m && a
      }
    ) });
  }
);
fn.displayName = dn;
function vn(e, t) {
  return `${e}-trigger-${t}`;
}
function pn(e, t) {
  return `${e}-content-${t}`;
}
var so = an, uo = sn, mt = ln, ht = fn;
function lo(e, t = globalThis == null ? void 0 : globalThis.document) {
  const n = ie(e);
  w(() => {
    const r = (o) => {
      o.key === "Escape" && n(o);
    };
    return t.addEventListener("keydown", r, { capture: !0 }), () => t.removeEventListener("keydown", r, { capture: !0 });
  }, [n, t]);
}
var fo = "DismissableLayer", Ge = "dismissableLayer.update", vo = "dismissableLayer.pointerDownOutside", po = "dismissableLayer.focusOutside", gt, mn = Z({
  layers: /* @__PURE__ */ new Set(),
  layersWithOutsidePointerEventsDisabled: /* @__PURE__ */ new Set(),
  branches: /* @__PURE__ */ new Set()
}), hn = I(
  (e, t) => {
    const {
      disableOutsidePointerEvents: n = !1,
      onEscapeKeyDown: r,
      onPointerDownOutside: o,
      onFocusOutside: a,
      onInteractOutside: c,
      onDismiss: i,
      ...u
    } = e, s = Y(mn), [l, v] = P(null), m = (l == null ? void 0 : l.ownerDocument) ?? (globalThis == null ? void 0 : globalThis.document), [, g] = P({}), E = F(t, (C) => v(C)), d = Array.from(s.layers), [p] = [...s.layersWithOutsidePointerEventsDisabled].slice(-1), h = d.indexOf(p), b = l ? d.indexOf(l) : -1, _ = s.layersWithOutsidePointerEventsDisabled.size > 0, y = b >= h, N = go((C) => {
      const T = C.target, G = [...s.branches].some((K) => K.contains(T));
      !y || G || (o == null || o(C), c == null || c(C), C.defaultPrevented || i == null || i());
    }, m), A = _o((C) => {
      const T = C.target;
      [...s.branches].some((K) => K.contains(T)) || (a == null || a(C), c == null || c(C), C.defaultPrevented || i == null || i());
    }, m);
    return lo((C) => {
      b === s.layers.size - 1 && (r == null || r(C), !C.defaultPrevented && i && (C.preventDefault(), i()));
    }, m), w(() => {
      if (l)
        return n && (s.layersWithOutsidePointerEventsDisabled.size === 0 && (gt = m.body.style.pointerEvents, m.body.style.pointerEvents = "none"), s.layersWithOutsidePointerEventsDisabled.add(l)), s.layers.add(l), _t(), () => {
          n && s.layersWithOutsidePointerEventsDisabled.size === 1 && (m.body.style.pointerEvents = gt);
        };
    }, [l, m, n, s]), w(() => () => {
      l && (s.layers.delete(l), s.layersWithOutsidePointerEventsDisabled.delete(l), _t());
    }, [l, s]), w(() => {
      const C = () => g({});
      return document.addEventListener(Ge, C), () => document.removeEventListener(Ge, C);
    }, []), /* @__PURE__ */ f(
      x.div,
      {
        ...u,
        ref: E,
        style: {
          pointerEvents: _ ? y ? "auto" : "none" : void 0,
          ...e.style
        },
        onFocusCapture: D(e.onFocusCapture, A.onFocusCapture),
        onBlurCapture: D(e.onBlurCapture, A.onBlurCapture),
        onPointerDownCapture: D(
          e.onPointerDownCapture,
          N.onPointerDownCapture
        )
      }
    );
  }
);
hn.displayName = fo;
var mo = "DismissableLayerBranch", ho = I((e, t) => {
  const n = Y(mn), r = S(null), o = F(t, r);
  return w(() => {
    const a = r.current;
    if (a)
      return n.branches.add(a), () => {
        n.branches.delete(a);
      };
  }, [n.branches]), /* @__PURE__ */ f(x.div, { ...e, ref: o });
});
ho.displayName = mo;
function go(e, t = globalThis == null ? void 0 : globalThis.document) {
  const n = ie(e), r = S(!1), o = S(() => {
  });
  return w(() => {
    const a = (i) => {
      if (i.target && !r.current) {
        let u = function() {
          gn(
            vo,
            n,
            s,
            { discrete: !0 }
          );
        };
        const s = { originalEvent: i };
        i.pointerType === "touch" ? (t.removeEventListener("click", o.current), o.current = u, t.addEventListener("click", o.current, { once: !0 })) : u();
      } else
        t.removeEventListener("click", o.current);
      r.current = !1;
    }, c = window.setTimeout(() => {
      t.addEventListener("pointerdown", a);
    }, 0);
    return () => {
      window.clearTimeout(c), t.removeEventListener("pointerdown", a), t.removeEventListener("click", o.current);
    };
  }, [t, n]), {
    // ensures we check React component tree (not just DOM tree)
    onPointerDownCapture: () => r.current = !0
  };
}
function _o(e, t = globalThis == null ? void 0 : globalThis.document) {
  const n = ie(e), r = S(!1);
  return w(() => {
    const o = (a) => {
      a.target && !r.current && gn(po, n, { originalEvent: a }, {
        discrete: !1
      });
    };
    return t.addEventListener("focusin", o), () => t.removeEventListener("focusin", o);
  }, [t, n]), {
    onFocusCapture: () => r.current = !0,
    onBlurCapture: () => r.current = !1
  };
}
function _t() {
  const e = new CustomEvent(Ge);
  document.dispatchEvent(e);
}
function gn(e, t, n, { discrete: r }) {
  const o = n.originalEvent.target, a = new CustomEvent(e, { bubbles: !1, cancelable: !0, detail: n });
  t && o.addEventListener(e, t, { once: !0 }), r ? Br(o, a) : o.dispatchEvent(a);
}
var xe = "focusScope.autoFocusOnMount", Me = "focusScope.autoFocusOnUnmount", yt = { bubbles: !1, cancelable: !0 }, yo = "FocusScope", _n = I((e, t) => {
  const {
    loop: n = !1,
    trapped: r = !1,
    onMountAutoFocus: o,
    onUnmountAutoFocus: a,
    ...c
  } = e, [i, u] = P(null), s = ie(o), l = ie(a), v = S(null), m = F(t, (d) => u(d)), g = S({
    paused: !1,
    pause() {
      this.paused = !0;
    },
    resume() {
      this.paused = !1;
    }
  }).current;
  w(() => {
    if (r) {
      let d = function(_) {
        if (g.paused || !i) return;
        const y = _.target;
        i.contains(y) ? v.current = y : H(v.current, { select: !0 });
      }, p = function(_) {
        if (g.paused || !i) return;
        const y = _.relatedTarget;
        y !== null && (i.contains(y) || H(v.current, { select: !0 }));
      }, h = function(_) {
        if (document.activeElement === document.body)
          for (const N of _)
            N.removedNodes.length > 0 && H(i);
      };
      document.addEventListener("focusin", d), document.addEventListener("focusout", p);
      const b = new MutationObserver(h);
      return i && b.observe(i, { childList: !0, subtree: !0 }), () => {
        document.removeEventListener("focusin", d), document.removeEventListener("focusout", p), b.disconnect();
      };
    }
  }, [r, i, g.paused]), w(() => {
    if (i) {
      Et.add(g);
      const d = document.activeElement;
      if (!i.contains(d)) {
        const h = new CustomEvent(xe, yt);
        i.addEventListener(xe, s), i.dispatchEvent(h), h.defaultPrevented || (bo(Io(yn(i)), { select: !0 }), document.activeElement === d && H(i));
      }
      return () => {
        i.removeEventListener(xe, s), setTimeout(() => {
          const h = new CustomEvent(Me, yt);
          i.addEventListener(Me, l), i.dispatchEvent(h), h.defaultPrevented || H(d ?? document.body, { select: !0 }), i.removeEventListener(Me, l), Et.remove(g);
        }, 0);
      };
    }
  }, [i, s, l, g]);
  const E = R(
    (d) => {
      if (!n && !r || g.paused) return;
      const p = d.key === "Tab" && !d.altKey && !d.ctrlKey && !d.metaKey, h = document.activeElement;
      if (p && h) {
        const b = d.currentTarget, [_, y] = Eo(b);
        _ && y ? !d.shiftKey && h === y ? (d.preventDefault(), n && H(_, { select: !0 })) : d.shiftKey && h === _ && (d.preventDefault(), n && H(y, { select: !0 })) : h === b && d.preventDefault();
      }
    },
    [n, r, g.paused]
  );
  return /* @__PURE__ */ f(x.div, { tabIndex: -1, ...c, ref: m, onKeyDown: E });
});
_n.displayName = yo;
function bo(e, { select: t = !1 } = {}) {
  const n = document.activeElement;
  for (const r of e)
    if (H(r, { select: t }), document.activeElement !== n) return;
}
function Eo(e) {
  const t = yn(e), n = bt(t, e), r = bt(t.reverse(), e);
  return [n, r];
}
function yn(e) {
  const t = [], n = document.createTreeWalker(e, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (r) => {
      const o = r.tagName === "INPUT" && r.type === "hidden";
      return r.disabled || r.hidden || o ? NodeFilter.FILTER_SKIP : r.tabIndex >= 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    }
  });
  for (; n.nextNode(); ) t.push(n.currentNode);
  return t;
}
function bt(e, t) {
  for (const n of e)
    if (!So(n, { upTo: t })) return n;
}
function So(e, { upTo: t }) {
  if (getComputedStyle(e).visibility === "hidden") return !0;
  for (; e; ) {
    if (t !== void 0 && e === t) return !1;
    if (getComputedStyle(e).display === "none") return !0;
    e = e.parentElement;
  }
  return !1;
}
function Co(e) {
  return e instanceof HTMLInputElement && "select" in e;
}
function H(e, { select: t = !1 } = {}) {
  if (e && e.focus) {
    const n = document.activeElement;
    e.focus({ preventScroll: !0 }), e !== n && Co(e) && t && e.select();
  }
}
var Et = wo();
function wo() {
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
function Io(e) {
  return e.filter((t) => t.tagName !== "A");
}
var No = "Portal", bn = I((e, t) => {
  var i;
  const { container: n, ...r } = e, [o, a] = P(!1);
  ae(() => a(!0), []);
  const c = n || o && ((i = globalThis == null ? void 0 : globalThis.document) == null ? void 0 : i.body);
  return c ? U.createPortal(/* @__PURE__ */ f(x.div, { ...r, ref: t }), c) : null;
});
bn.displayName = No;
var Fe = 0;
function To() {
  w(() => {
    const e = document.querySelectorAll("[data-radix-focus-guard]");
    return document.body.insertAdjacentElement("afterbegin", e[0] ?? Ct()), document.body.insertAdjacentElement("beforeend", e[1] ?? Ct()), Fe++, () => {
      Fe === 1 && document.querySelectorAll("[data-radix-focus-guard]").forEach((t) => t.remove()), Fe--;
    };
  }, []);
}
function Ct() {
  const e = document.createElement("span");
  return e.setAttribute("data-radix-focus-guard", ""), e.tabIndex = 0, e.style.outline = "none", e.style.opacity = "0", e.style.position = "fixed", e.style.pointerEvents = "none", e;
}
var W = function() {
  return W = Object.assign || function(t) {
    for (var n, r = 1, o = arguments.length; r < o; r++) {
      n = arguments[r];
      for (var a in n) Object.prototype.hasOwnProperty.call(n, a) && (t[a] = n[a]);
    }
    return t;
  }, W.apply(this, arguments);
};
function En(e, t) {
  var n = {};
  for (var r in e) Object.prototype.hasOwnProperty.call(e, r) && t.indexOf(r) < 0 && (n[r] = e[r]);
  if (e != null && typeof Object.getOwnPropertySymbols == "function")
    for (var o = 0, r = Object.getOwnPropertySymbols(e); o < r.length; o++)
      t.indexOf(r[o]) < 0 && Object.prototype.propertyIsEnumerable.call(e, r[o]) && (n[r[o]] = e[r[o]]);
  return n;
}
function Po(e, t, n) {
  if (n || arguments.length === 2) for (var r = 0, o = t.length, a; r < o; r++)
    (a || !(r in t)) && (a || (a = Array.prototype.slice.call(t, 0, r)), a[r] = t[r]);
  return e.concat(a || Array.prototype.slice.call(t));
}
var be = "right-scroll-bar-position", Ee = "width-before-scroll-bar", Oo = "with-scroll-bars-hidden", Ao = "--removed-body-scroll-bar-size";
function Le(e, t) {
  return typeof e == "function" ? e(t) : e && (e.current = t), e;
}
function Ro(e, t) {
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
var Do = typeof window < "u" ? J : w, wt = /* @__PURE__ */ new WeakMap();
function xo(e, t) {
  var n = Ro(null, function(r) {
    return e.forEach(function(o) {
      return Le(o, r);
    });
  });
  return Do(function() {
    var r = wt.get(n);
    if (r) {
      var o = new Set(r), a = new Set(e), c = n.current;
      o.forEach(function(i) {
        a.has(i) || Le(i, null);
      }), a.forEach(function(i) {
        o.has(i) || Le(i, c);
      });
    }
    wt.set(n, e);
  }, [e]), n;
}
function Mo(e) {
  return e;
}
function Fo(e, t) {
  t === void 0 && (t = Mo);
  var n = [], r = !1, o = {
    read: function() {
      if (r)
        throw new Error("Sidecar: could not `read` from an `assigned` medium. `read` could be used only with `useMedium`.");
      return n.length ? n[n.length - 1] : e;
    },
    useMedium: function(a) {
      var c = t(a, r);
      return n.push(c), function() {
        n = n.filter(function(i) {
          return i !== c;
        });
      };
    },
    assignSyncMedium: function(a) {
      for (r = !0; n.length; ) {
        var c = n;
        n = [], c.forEach(a);
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
      var c = [];
      if (n.length) {
        var i = n;
        n = [], i.forEach(a), c = n;
      }
      var u = function() {
        var l = c;
        c = [], l.forEach(a);
      }, s = function() {
        return Promise.resolve().then(u);
      };
      s(), n = {
        push: function(l) {
          c.push(l), s();
        },
        filter: function(l) {
          return c = c.filter(l), n;
        }
      };
    }
  };
  return o;
}
function Lo(e) {
  e === void 0 && (e = {});
  var t = Fo(null);
  return t.options = W({ async: !0, ssr: !1 }, e), t;
}
var Sn = function(e) {
  var t = e.sideCar, n = En(e, ["sideCar"]);
  if (!t)
    throw new Error("Sidecar: please provide `sideCar` property to import the right car");
  var r = t.read();
  if (!r)
    throw new Error("Sidecar medium not found");
  return O(r, W({}, n));
};
Sn.isSideCarExport = !0;
function ko(e, t) {
  return e.useMedium(t), Sn;
}
var Cn = Lo(), ke = function() {
}, Pe = I(function(e, t) {
  var n = S(null), r = P({
    onScrollCapture: ke,
    onWheelCapture: ke,
    onTouchMoveCapture: ke
  }), o = r[0], a = r[1], c = e.forwardProps, i = e.children, u = e.className, s = e.removeScrollBar, l = e.enabled, v = e.shards, m = e.sideCar, g = e.noRelative, E = e.noIsolation, d = e.inert, p = e.allowPinchZoom, h = e.as, b = h === void 0 ? "div" : h, _ = e.gapMode, y = En(e, ["forwardProps", "children", "className", "removeScrollBar", "enabled", "shards", "sideCar", "noRelative", "noIsolation", "inert", "allowPinchZoom", "as", "gapMode"]), N = m, A = xo([n, t]), C = W(W({}, y), o);
  return O(
    L,
    null,
    l && O(N, { sideCar: Cn, removeScrollBar: s, shards: v, noRelative: g, noIsolation: E, inert: d, setCallbacks: a, allowPinchZoom: !!p, lockRef: n, gapMode: _ }),
    c ? ce($.only(i), W(W({}, C), { ref: A })) : O(b, W({}, C, { className: u, ref: A }), i)
  );
});
Pe.defaultProps = {
  enabled: !0,
  removeScrollBar: !0,
  inert: !1
};
Pe.classNames = {
  fullWidth: Ee,
  zeroRight: be
};
var Wo = function() {
  if (typeof __webpack_nonce__ < "u")
    return __webpack_nonce__;
};
function $o() {
  if (!document)
    return null;
  var e = document.createElement("style");
  e.type = "text/css";
  var t = Wo();
  return t && e.setAttribute("nonce", t), e;
}
function Bo(e, t) {
  e.styleSheet ? e.styleSheet.cssText = t : e.appendChild(document.createTextNode(t));
}
function Uo(e) {
  var t = document.head || document.getElementsByTagName("head")[0];
  t.appendChild(e);
}
var Vo = function() {
  var e = 0, t = null;
  return {
    add: function(n) {
      e == 0 && (t = $o()) && (Bo(t, n), Uo(t)), e++;
    },
    remove: function() {
      e--, !e && t && (t.parentNode && t.parentNode.removeChild(t), t = null);
    }
  };
}, Go = function() {
  var e = Vo();
  return function(t, n) {
    w(function() {
      return e.add(t), function() {
        e.remove();
      };
    }, [t && n]);
  };
}, wn = function() {
  var e = Go(), t = function(n) {
    var r = n.styles, o = n.dynamic;
    return e(r, o), null;
  };
  return t;
}, Ko = {
  left: 0,
  top: 0,
  right: 0,
  gap: 0
}, We = function(e) {
  return parseInt(e || "", 10) || 0;
}, zo = function(e) {
  var t = window.getComputedStyle(document.body), n = t[e === "padding" ? "paddingLeft" : "marginLeft"], r = t[e === "padding" ? "paddingTop" : "marginTop"], o = t[e === "padding" ? "paddingRight" : "marginRight"];
  return [We(n), We(r), We(o)];
}, Ho = function(e) {
  if (e === void 0 && (e = "margin"), typeof window > "u")
    return Ko;
  var t = zo(e), n = document.documentElement.clientWidth, r = window.innerWidth;
  return {
    left: t[0],
    top: t[1],
    right: t[2],
    gap: Math.max(0, r - n + t[2] - t[0])
  };
}, jo = wn(), oe = "data-scroll-locked", Yo = function(e, t, n, r) {
  var o = e.left, a = e.top, c = e.right, i = e.gap;
  return n === void 0 && (n = "margin"), `
  .`.concat(Oo, ` {
   overflow: hidden `).concat(r, `;
   padding-right: `).concat(i, "px ").concat(r, `;
  }
  body[`).concat(oe, `] {
    overflow: hidden `).concat(r, `;
    overscroll-behavior: contain;
    `).concat([
    t && "position: relative ".concat(r, ";"),
    n === "margin" && `
    padding-left: `.concat(o, `px;
    padding-top: `).concat(a, `px;
    padding-right: `).concat(c, `px;
    margin-left:0;
    margin-top:0;
    margin-right: `).concat(i, "px ").concat(r, `;
    `),
    n === "padding" && "padding-right: ".concat(i, "px ").concat(r, ";")
  ].filter(Boolean).join(""), `
  }
  
  .`).concat(be, ` {
    right: `).concat(i, "px ").concat(r, `;
  }
  
  .`).concat(Ee, ` {
    margin-right: `).concat(i, "px ").concat(r, `;
  }
  
  .`).concat(be, " .").concat(be, ` {
    right: 0 `).concat(r, `;
  }
  
  .`).concat(Ee, " .").concat(Ee, ` {
    margin-right: 0 `).concat(r, `;
  }
  
  body[`).concat(oe, `] {
    `).concat(Ao, ": ").concat(i, `px;
  }
`);
}, It = function() {
  var e = parseInt(document.body.getAttribute(oe) || "0", 10);
  return isFinite(e) ? e : 0;
}, qo = function() {
  w(function() {
    return document.body.setAttribute(oe, (It() + 1).toString()), function() {
      var e = It() - 1;
      e <= 0 ? document.body.removeAttribute(oe) : document.body.setAttribute(oe, e.toString());
    };
  }, []);
}, Xo = function(e) {
  var t = e.noRelative, n = e.noImportant, r = e.gapMode, o = r === void 0 ? "margin" : r;
  qo();
  var a = B(function() {
    return Ho(o);
  }, [o]);
  return O(jo, { styles: Yo(a, !t, o, n ? "" : "!important") });
}, Ke = !1;
if (typeof window < "u")
  try {
    var he = Object.defineProperty({}, "passive", {
      get: function() {
        return Ke = !0, !0;
      }
    });
    window.addEventListener("test", he, he), window.removeEventListener("test", he, he);
  } catch {
    Ke = !1;
  }
var ee = Ke ? { passive: !1 } : !1, Zo = function(e) {
  return e.tagName === "TEXTAREA";
}, In = function(e, t) {
  if (!(e instanceof Element))
    return !1;
  var n = window.getComputedStyle(e);
  return (
    // not-not-scrollable
    n[t] !== "hidden" && // contains scroll inside self
    !(n.overflowY === n.overflowX && !Zo(e) && n[t] === "visible")
  );
}, Qo = function(e) {
  return In(e, "overflowY");
}, Jo = function(e) {
  return In(e, "overflowX");
}, Nt = function(e, t) {
  var n = t.ownerDocument, r = t;
  do {
    typeof ShadowRoot < "u" && r instanceof ShadowRoot && (r = r.host);
    var o = Nn(e, r);
    if (o) {
      var a = Tn(e, r), c = a[1], i = a[2];
      if (c > i)
        return !0;
    }
    r = r.parentNode;
  } while (r && r !== n.body);
  return !1;
}, ea = function(e) {
  var t = e.scrollTop, n = e.scrollHeight, r = e.clientHeight;
  return [
    t,
    n,
    r
  ];
}, ta = function(e) {
  var t = e.scrollLeft, n = e.scrollWidth, r = e.clientWidth;
  return [
    t,
    n,
    r
  ];
}, Nn = function(e, t) {
  return e === "v" ? Qo(t) : Jo(t);
}, Tn = function(e, t) {
  return e === "v" ? ea(t) : ta(t);
}, na = function(e, t) {
  return e === "h" && t === "rtl" ? -1 : 1;
}, ra = function(e, t, n, r, o) {
  var a = na(e, window.getComputedStyle(t).direction), c = a * r, i = n.target, u = t.contains(i), s = !1, l = c > 0, v = 0, m = 0;
  do {
    if (!i)
      break;
    var g = Tn(e, i), E = g[0], d = g[1], p = g[2], h = d - p - a * E;
    (E || h) && Nn(e, i) && (v += h, m += E);
    var b = i.parentNode;
    i = b && b.nodeType === Node.DOCUMENT_FRAGMENT_NODE ? b.host : b;
  } while (
    // portaled content
    !u && i !== document.body || // self content
    u && (t.contains(i) || t === i)
  );
  return (l && Math.abs(v) < 1 || !l && Math.abs(m) < 1) && (s = !0), s;
}, ge = function(e) {
  return "changedTouches" in e ? [e.changedTouches[0].clientX, e.changedTouches[0].clientY] : [0, 0];
}, Tt = function(e) {
  return [e.deltaX, e.deltaY];
}, Pt = function(e) {
  return e && "current" in e ? e.current : e;
}, oa = function(e, t) {
  return e[0] === t[0] && e[1] === t[1];
}, aa = function(e) {
  return `
  .block-interactivity-`.concat(e, ` {pointer-events: none;}
  .allow-interactivity-`).concat(e, ` {pointer-events: all;}
`);
}, ia = 0, te = [];
function ca(e) {
  var t = S([]), n = S([0, 0]), r = S(), o = P(ia++)[0], a = P(wn)[0], c = S(e);
  w(function() {
    c.current = e;
  }, [e]), w(function() {
    if (e.inert) {
      document.body.classList.add("block-interactivity-".concat(o));
      var d = Po([e.lockRef.current], (e.shards || []).map(Pt), !0).filter(Boolean);
      return d.forEach(function(p) {
        return p.classList.add("allow-interactivity-".concat(o));
      }), function() {
        document.body.classList.remove("block-interactivity-".concat(o)), d.forEach(function(p) {
          return p.classList.remove("allow-interactivity-".concat(o));
        });
      };
    }
  }, [e.inert, e.lockRef.current, e.shards]);
  var i = R(function(d, p) {
    if ("touches" in d && d.touches.length === 2 || d.type === "wheel" && d.ctrlKey)
      return !c.current.allowPinchZoom;
    var h = ge(d), b = n.current, _ = "deltaX" in d ? d.deltaX : b[0] - h[0], y = "deltaY" in d ? d.deltaY : b[1] - h[1], N, A = d.target, C = Math.abs(_) > Math.abs(y) ? "h" : "v";
    if ("touches" in d && C === "h" && A.type === "range")
      return !1;
    var T = window.getSelection(), G = T && T.anchorNode, K = G ? G === A || G.contains(A) : !1;
    if (K)
      return !1;
    var z = Nt(C, A);
    if (!z)
      return !0;
    if (z ? N = C : (N = C === "v" ? "h" : "v", z = Nt(C, A)), !z)
      return !1;
    if (!r.current && "changedTouches" in d && (_ || y) && (r.current = N), !N)
      return !0;
    var pe = r.current || N;
    return ra(pe, p, d, pe === "h" ? _ : y);
  }, []), u = R(function(d) {
    var p = d;
    if (!(!te.length || te[te.length - 1] !== a)) {
      var h = "deltaY" in p ? Tt(p) : ge(p), b = t.current.filter(function(N) {
        return N.name === p.type && (N.target === p.target || p.target === N.shadowParent) && oa(N.delta, h);
      })[0];
      if (b && b.should) {
        p.cancelable && p.preventDefault();
        return;
      }
      if (!b) {
        var _ = (c.current.shards || []).map(Pt).filter(Boolean).filter(function(N) {
          return N.contains(p.target);
        }), y = _.length > 0 ? i(p, _[0]) : !c.current.noIsolation;
        y && p.cancelable && p.preventDefault();
      }
    }
  }, []), s = R(function(d, p, h, b) {
    var _ = { name: d, delta: p, target: h, should: b, shadowParent: sa(h) };
    t.current.push(_), setTimeout(function() {
      t.current = t.current.filter(function(y) {
        return y !== _;
      });
    }, 1);
  }, []), l = R(function(d) {
    n.current = ge(d), r.current = void 0;
  }, []), v = R(function(d) {
    s(d.type, Tt(d), d.target, i(d, e.lockRef.current));
  }, []), m = R(function(d) {
    s(d.type, ge(d), d.target, i(d, e.lockRef.current));
  }, []);
  w(function() {
    return te.push(a), e.setCallbacks({
      onScrollCapture: v,
      onWheelCapture: v,
      onTouchMoveCapture: m
    }), document.addEventListener("wheel", u, ee), document.addEventListener("touchmove", u, ee), document.addEventListener("touchstart", l, ee), function() {
      te = te.filter(function(d) {
        return d !== a;
      }), document.removeEventListener("wheel", u, ee), document.removeEventListener("touchmove", u, ee), document.removeEventListener("touchstart", l, ee);
    };
  }, []);
  var g = e.removeScrollBar, E = e.inert;
  return O(
    L,
    null,
    E ? O(a, { styles: aa(o) }) : null,
    g ? O(Xo, { noRelative: e.noRelative, gapMode: e.gapMode }) : null
  );
}
function sa(e) {
  for (var t = null; e !== null; )
    e instanceof ShadowRoot && (t = e.host, e = e.host), e = e.parentNode;
  return t;
}
const ua = ko(Cn, ca);
var Pn = I(function(e, t) {
  return O(Pe, W({}, e, { ref: t, sideCar: ua }));
});
Pn.classNames = Pe.classNames;
var la = function(e) {
  if (typeof document > "u")
    return null;
  var t = Array.isArray(e) ? e[0] : e;
  return t.ownerDocument.body;
}, ne = /* @__PURE__ */ new WeakMap(), _e = /* @__PURE__ */ new WeakMap(), ye = {}, $e = 0, On = function(e) {
  return e && (e.host || On(e.parentNode));
}, da = function(e, t) {
  return t.map(function(n) {
    if (e.contains(n))
      return n;
    var r = On(n);
    return r && e.contains(r) ? r : (console.error("aria-hidden", n, "in not contained inside", e, ". Doing nothing"), null);
  }).filter(function(n) {
    return !!n;
  });
}, fa = function(e, t, n, r) {
  var o = da(t, Array.isArray(e) ? e : [e]);
  ye[n] || (ye[n] = /* @__PURE__ */ new WeakMap());
  var a = ye[n], c = [], i = /* @__PURE__ */ new Set(), u = new Set(o), s = function(v) {
    !v || i.has(v) || (i.add(v), s(v.parentNode));
  };
  o.forEach(s);
  var l = function(v) {
    !v || u.has(v) || Array.prototype.forEach.call(v.children, function(m) {
      if (i.has(m))
        l(m);
      else
        try {
          var g = m.getAttribute(r), E = g !== null && g !== "false", d = (ne.get(m) || 0) + 1, p = (a.get(m) || 0) + 1;
          ne.set(m, d), a.set(m, p), c.push(m), d === 1 && E && _e.set(m, !0), p === 1 && m.setAttribute(n, "true"), E || m.setAttribute(r, "true");
        } catch (h) {
          console.error("aria-hidden: cannot operate on ", m, h);
        }
    });
  };
  return l(t), i.clear(), $e++, function() {
    c.forEach(function(v) {
      var m = ne.get(v) - 1, g = a.get(v) - 1;
      ne.set(v, m), a.set(v, g), m || (_e.has(v) || v.removeAttribute(r), _e.delete(v)), g || v.removeAttribute(n);
    }), $e--, $e || (ne = /* @__PURE__ */ new WeakMap(), ne = /* @__PURE__ */ new WeakMap(), _e = /* @__PURE__ */ new WeakMap(), ye = {});
  };
}, va = function(e, t, n) {
  n === void 0 && (n = "data-aria-hidden");
  var r = Array.from(Array.isArray(e) ? e : [e]), o = la(e);
  return o ? (r.push.apply(r, Array.from(o.querySelectorAll("[aria-live], script"))), fa(r, o, n, "aria-hidden")) : function() {
    return null;
  };
}, Oe = "Dialog", [An] = de(Oe), [pa, k] = An(Oe), Rn = (e) => {
  const {
    __scopeDialog: t,
    children: n,
    open: r,
    defaultOpen: o,
    onOpenChange: a,
    modal: c = !0
  } = e, i = S(null), u = S(null), [s, l] = Ne({
    prop: r,
    defaultProp: o ?? !1,
    onChange: a,
    caller: Oe
  });
  return /* @__PURE__ */ f(
    pa,
    {
      scope: t,
      triggerRef: i,
      contentRef: u,
      contentId: ue(),
      titleId: ue(),
      descriptionId: ue(),
      open: s,
      onOpenChange: l,
      onOpenToggle: R(() => l((v) => !v), [l]),
      modal: c,
      children: n
    }
  );
};
Rn.displayName = Oe;
var Dn = "DialogTrigger", xn = I(
  (e, t) => {
    const { __scopeDialog: n, ...r } = e, o = k(Dn, n), a = F(t, o.triggerRef);
    return /* @__PURE__ */ f(
      x.button,
      {
        type: "button",
        "aria-haspopup": "dialog",
        "aria-expanded": o.open,
        "aria-controls": o.contentId,
        "data-state": ot(o.open),
        ...r,
        ref: a,
        onClick: D(e.onClick, o.onOpenToggle)
      }
    );
  }
);
xn.displayName = Dn;
var nt = "DialogPortal", [ma, Mn] = An(nt, {
  forceMount: void 0
}), Fn = (e) => {
  const { __scopeDialog: t, forceMount: n, children: r, container: o } = e, a = k(nt, t);
  return /* @__PURE__ */ f(ma, { scope: t, forceMount: n, children: $.map(r, (c) => /* @__PURE__ */ f(ve, { present: n || a.open, children: /* @__PURE__ */ f(bn, { asChild: !0, container: o, children: c }) })) });
};
Fn.displayName = nt;
var we = "DialogOverlay", Ln = I(
  (e, t) => {
    const n = Mn(we, e.__scopeDialog), { forceMount: r = n.forceMount, ...o } = e, a = k(we, e.__scopeDialog);
    return a.modal ? /* @__PURE__ */ f(ve, { present: r || a.open, children: /* @__PURE__ */ f(ga, { ...o, ref: t }) }) : null;
  }
);
Ln.displayName = we;
var ha = /* @__PURE__ */ Ce("DialogOverlay.RemoveScroll"), ga = I(
  (e, t) => {
    const { __scopeDialog: n, ...r } = e, o = k(we, n);
    return (
      // Make sure `Content` is scrollable even when it doesn't live inside `RemoveScroll`
      // ie. when `Overlay` and `Content` are siblings
      /* @__PURE__ */ f(Pn, { as: ha, allowPinchZoom: !0, shards: [o.contentRef], children: /* @__PURE__ */ f(
        x.div,
        {
          "data-state": ot(o.open),
          ...r,
          ref: t,
          style: { pointerEvents: "auto", ...r.style }
        }
      ) })
    );
  }
), Q = "DialogContent", kn = I(
  (e, t) => {
    const n = Mn(Q, e.__scopeDialog), { forceMount: r = n.forceMount, ...o } = e, a = k(Q, e.__scopeDialog);
    return /* @__PURE__ */ f(ve, { present: r || a.open, children: a.modal ? /* @__PURE__ */ f(_a, { ...o, ref: t }) : /* @__PURE__ */ f(ya, { ...o, ref: t }) });
  }
);
kn.displayName = Q;
var _a = I(
  (e, t) => {
    const n = k(Q, e.__scopeDialog), r = S(null), o = F(t, n.contentRef, r);
    return w(() => {
      const a = r.current;
      if (a) return va(a);
    }, []), /* @__PURE__ */ f(
      Wn,
      {
        ...e,
        ref: o,
        trapFocus: n.open,
        disableOutsidePointerEvents: !0,
        onCloseAutoFocus: D(e.onCloseAutoFocus, (a) => {
          var c;
          a.preventDefault(), (c = n.triggerRef.current) == null || c.focus();
        }),
        onPointerDownOutside: D(e.onPointerDownOutside, (a) => {
          const c = a.detail.originalEvent, i = c.button === 0 && c.ctrlKey === !0;
          (c.button === 2 || i) && a.preventDefault();
        }),
        onFocusOutside: D(
          e.onFocusOutside,
          (a) => a.preventDefault()
        )
      }
    );
  }
), ya = I(
  (e, t) => {
    const n = k(Q, e.__scopeDialog), r = S(!1), o = S(!1);
    return /* @__PURE__ */ f(
      Wn,
      {
        ...e,
        ref: t,
        trapFocus: !1,
        disableOutsidePointerEvents: !1,
        onCloseAutoFocus: (a) => {
          var c, i;
          (c = e.onCloseAutoFocus) == null || c.call(e, a), a.defaultPrevented || (r.current || (i = n.triggerRef.current) == null || i.focus(), a.preventDefault()), r.current = !1, o.current = !1;
        },
        onInteractOutside: (a) => {
          var u, s;
          (u = e.onInteractOutside) == null || u.call(e, a), a.defaultPrevented || (r.current = !0, a.detail.originalEvent.type === "pointerdown" && (o.current = !0));
          const c = a.target;
          ((s = n.triggerRef.current) == null ? void 0 : s.contains(c)) && a.preventDefault(), a.detail.originalEvent.type === "focusin" && o.current && a.preventDefault();
        }
      }
    );
  }
), Wn = I(
  (e, t) => {
    const { __scopeDialog: n, trapFocus: r, onOpenAutoFocus: o, onCloseAutoFocus: a, ...c } = e, i = k(Q, n), u = S(null), s = F(t, u);
    return To(), /* @__PURE__ */ f(L, { children: [
      /* @__PURE__ */ f(
        _n,
        {
          asChild: !0,
          loop: !0,
          trapped: r,
          onMountAutoFocus: o,
          onUnmountAutoFocus: a,
          children: /* @__PURE__ */ f(
            hn,
            {
              role: "dialog",
              id: i.contentId,
              "aria-describedby": i.descriptionId,
              "aria-labelledby": i.titleId,
              "data-state": ot(i.open),
              ...c,
              ref: s,
              onDismiss: () => i.onOpenChange(!1)
            }
          )
        }
      ),
      /* @__PURE__ */ f(L, { children: [
        /* @__PURE__ */ f(Ea, { titleId: i.titleId }),
        /* @__PURE__ */ f(Ca, { contentRef: u, descriptionId: i.descriptionId })
      ] })
    ] });
  }
), rt = "DialogTitle", $n = I(
  (e, t) => {
    const { __scopeDialog: n, ...r } = e, o = k(rt, n);
    return /* @__PURE__ */ f(x.h2, { id: o.titleId, ...r, ref: t });
  }
);
$n.displayName = rt;
var Bn = "DialogDescription", Un = I(
  (e, t) => {
    const { __scopeDialog: n, ...r } = e, o = k(Bn, n);
    return /* @__PURE__ */ f(x.p, { id: o.descriptionId, ...r, ref: t });
  }
);
Un.displayName = Bn;
var Vn = "DialogClose", ba = I(
  (e, t) => {
    const { __scopeDialog: n, ...r } = e, o = k(Vn, n);
    return /* @__PURE__ */ f(
      x.button,
      {
        type: "button",
        ...r,
        ref: t,
        onClick: D(e.onClick, () => o.onOpenChange(!1))
      }
    );
  }
);
ba.displayName = Vn;
function ot(e) {
  return e ? "open" : "closed";
}
var Gn = "DialogTitleWarning", [oi, Kn] = Or(Gn, {
  contentName: Q,
  titleName: rt,
  docsSlug: "dialog"
}), Ea = ({ titleId: e }) => {
  const t = Kn(Gn), n = `\`${t.contentName}\` requires a \`${t.titleName}\` for the component to be accessible for screen reader users.

If you want to hide the \`${t.titleName}\`, you can wrap it with our VisuallyHidden component.

For more information, see https://radix-ui.com/primitives/docs/components/${t.docsSlug}`;
  return w(() => {
    e && (document.getElementById(e) || console.error(n));
  }, [n, e]), null;
}, Sa = "DialogDescriptionWarning", Ca = ({ contentRef: e, descriptionId: t }) => {
  const r = `Warning: Missing \`Description\` or \`aria-describedby={undefined}\` for {${Kn(Sa).contentName}}.`;
  return w(() => {
    var a;
    const o = (a = e.current) == null ? void 0 : a.getAttribute("aria-describedby");
    t && o && (document.getElementById(t) || console.warn(r));
  }, [r, e, t]), null;
}, wa = Rn, Ia = xn, Na = Fn, Ta = Ln, Pa = kn, Oa = $n, Aa = Un;
function Ra(e) {
  const t = S({ value: e, previous: e });
  return B(() => (t.current.value !== e && (t.current.previous = t.current.value, t.current.value = e), t.current.previous), [e]);
}
function Da(e) {
  const [t, n] = P(void 0);
  return ae(() => {
    if (e) {
      n({ width: e.offsetWidth, height: e.offsetHeight });
      const r = new ResizeObserver((o) => {
        if (!Array.isArray(o) || !o.length)
          return;
        const a = o[0];
        let c, i;
        if ("borderBoxSize" in a) {
          const u = a.borderBoxSize, s = Array.isArray(u) ? u[0] : u;
          c = s.inlineSize, i = s.blockSize;
        } else
          c = e.offsetWidth, i = e.offsetHeight;
        n({ width: c, height: i });
      });
      return r.observe(e, { box: "border-box" }), () => r.unobserve(e);
    } else
      n(void 0);
  }, [e]), t;
}
var Ae = "Switch", [xa] = de(Ae), [Ma, Fa] = xa(Ae), zn = I(
  (e, t) => {
    const {
      __scopeSwitch: n,
      name: r,
      checked: o,
      defaultChecked: a,
      required: c,
      disabled: i,
      value: u = "on",
      onCheckedChange: s,
      form: l,
      ...v
    } = e, [m, g] = P(null), E = F(t, (_) => g(_)), d = S(!1), p = m ? l || !!m.closest("form") : !0, [h, b] = Ne({
      prop: o,
      defaultProp: a ?? !1,
      onChange: s,
      caller: Ae
    });
    return /* @__PURE__ */ f(Ma, { scope: n, checked: h, disabled: i, children: [
      /* @__PURE__ */ f(
        x.button,
        {
          type: "button",
          role: "switch",
          "aria-checked": h,
          "aria-required": c,
          "data-state": qn(h),
          "data-disabled": i ? "" : void 0,
          disabled: i,
          value: u,
          ...v,
          ref: E,
          onClick: D(e.onClick, (_) => {
            b((y) => !y), p && (d.current = _.isPropagationStopped(), d.current || _.stopPropagation());
          })
        }
      ),
      p && /* @__PURE__ */ f(
        Yn,
        {
          control: m,
          bubbles: !d.current,
          name: r,
          value: u,
          checked: h,
          required: c,
          disabled: i,
          form: l,
          style: { transform: "translateX(-100%)" }
        }
      )
    ] });
  }
);
zn.displayName = Ae;
var Hn = "SwitchThumb", jn = I(
  (e, t) => {
    const { __scopeSwitch: n, ...r } = e, o = Fa(Hn, n);
    return /* @__PURE__ */ f(
      x.span,
      {
        "data-state": qn(o.checked),
        "data-disabled": o.disabled ? "" : void 0,
        ...r,
        ref: t
      }
    );
  }
);
jn.displayName = Hn;
var La = "SwitchBubbleInput", Yn = I(
  ({
    __scopeSwitch: e,
    control: t,
    checked: n,
    bubbles: r = !0,
    ...o
  }, a) => {
    const c = S(null), i = F(c, a), u = Ra(n), s = Da(t);
    return w(() => {
      const l = c.current;
      if (!l) return;
      const v = window.HTMLInputElement.prototype, g = Object.getOwnPropertyDescriptor(
        v,
        "checked"
      ).set;
      if (u !== n && g) {
        const E = new Event("click", { bubbles: r });
        g.call(l, n), l.dispatchEvent(E);
      }
    }, [u, n, r]), /* @__PURE__ */ f(
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
          ...s,
          position: "absolute",
          pointerEvents: "none",
          opacity: 0,
          margin: 0
        }
      }
    );
  }
);
Yn.displayName = La;
function qn(e) {
  return e ? "checked" : "unchecked";
}
var ka = zn, Wa = jn;
function $a() {
  const [e, t] = P(!1), [n, r] = P(!1);
  return /* @__PURE__ */ f("div", { class: "p-4", children: [
    /* @__PURE__ */ f("h2", { class: "text-lg font-bold mb-2", children: "shadcn/ui compatibility demo" }),
    /* @__PURE__ */ f(so, { defaultValue: "tab1", children: [
      /* @__PURE__ */ f(uo, { "aria-label": "tabs", children: [
        /* @__PURE__ */ f(mt, { value: "tab1", children: "Tab 1" }),
        /* @__PURE__ */ f(mt, { value: "tab2", children: "Tab 2" })
      ] }),
      /* @__PURE__ */ f(ht, { value: "tab1", children: /* @__PURE__ */ f("p", { children: "Content for tab 1" }) }),
      /* @__PURE__ */ f(ht, { value: "tab2", children: /* @__PURE__ */ f("p", { children: "Content for tab 2" }) })
    ] }),
    /* @__PURE__ */ f("div", { class: "mt-4", children: /* @__PURE__ */ f(wa, { open: e, onOpenChange: t, children: [
      /* @__PURE__ */ f(Ia, { asChild: !0, children: /* @__PURE__ */ f("button", { class: "px-3 py-1 bg-blue-600 text-white rounded", children: "Open Dialog" }) }),
      /* @__PURE__ */ f(Na, { children: [
        /* @__PURE__ */ f(Ta, { class: "fixed inset-0 bg-black/40" }),
        /* @__PURE__ */ f(Pa, { class: "fixed left-1/2 top-1/3 -translate-x-1/2 bg-white p-4 rounded shadow", children: [
          /* @__PURE__ */ f(Oa, { children: "Dialog Title" }),
          /* @__PURE__ */ f(Aa, { children: "Simple dialog content for testing." }),
          /* @__PURE__ */ f("div", { class: "mt-2", children: /* @__PURE__ */ f("button", { onClick: () => t(!1), class: "px-2 py-1 bg-gray-200 rounded", children: "Close" }) })
        ] })
      ] })
    ] }) }),
    /* @__PURE__ */ f("div", { class: "mt-4 flex items-center gap-3", children: /* @__PURE__ */ f("label", { class: "flex items-center gap-2", children: [
      /* @__PURE__ */ f(ka, { checked: n, onCheckedChange: (o) => r(o), children: /* @__PURE__ */ f(Wa, { class: "inline-block w-4 h-4 bg-white rounded-full" }) }),
      /* @__PURE__ */ f("span", { children: n ? "On" : "Off" })
    ] }) })
  ] });
}
const at = {
  "visual-annotation-island": tr,
  "feedback-controls-island": nr,
  "manual-editor-island": rr,
  "history-tabs-island": or,
  "overlay-viewer-island": ar,
  "playground-island": ir,
  "shadcn-compat": $a,
  "overview-dashboard-island": cr,
  "settings-sidebar-island": sr,
  "connection-settings-island": ur,
  "ai-provider-island": lr,
  "expert-models-island": dr,
  "restart-banner-island": fr,
  "developer-settings-island": vr,
  "presets-manager-island": pr
};
function Ba(e) {
  const t = e.getAttribute("data-props") || "{}";
  try {
    return JSON.parse(t);
  } catch (n) {
    return console.warn("island-runtime: failed to parse props", n), null;
  }
}
function Ua(e, t) {
  at[e] = t;
}
function Be(e = document) {
  typeof window < "u" && (window.__islandRuntimeMounted = !0), e.querySelectorAll("[data-island]").forEach((n) => {
    const r = n.getAttribute("data-island");
    if (!r) return;
    const o = at[r];
    if (!o) {
      console.warn(`island-runtime: no component for '${r}'`);
      return;
    }
    const a = Ba(n);
    if (a === null) return;
    le(O(o, a), n);
    const c = n;
    c.dataset && (c.dataset.mounted = "true");
    const i = c.querySelector('[data-testid$="-root"]');
    i && !i.getAttribute("data-hydrated") && i.setAttribute("data-hydrated", "true");
  });
}
if (typeof window < "u") {
  window.mountIslands = Be, window.islandRuntime = {
    mountIslands: Be,
    registerIsland: Ua,
    _registry: at
  };
  const e = () => {
    window.__islandRuntimeMounted || document.querySelector("[data-island]") && Be(document);
  };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", e) : setTimeout(e, 0);
}
export {
  Be as mountIslands,
  Ua as registerIsland
};
