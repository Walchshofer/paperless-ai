var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/islands/FeedbackControlsIsland.module.css
var require_FeedbackControlsIsland = __commonJS({
  "src/islands/FeedbackControlsIsland.module.css"(exports, module) {
    module.exports = {
      root: "FeedbackControlsIsland_root",
      button: "FeedbackControlsIsland_button",
      buttonPressed: "FeedbackControlsIsland_buttonPressed"
    };
  }
});

// src/islands/overlay-utils.js
var require_overlay_utils = __commonJS({
  "src/islands/overlay-utils.js"(exports, module) {
    "use strict";
    function computeUnscaledFromRaw2(rawX, rawY, tx, ty, s3) {
      return {
        x: (rawX - tx) / s3,
        y: (rawY - ty) / s3
      };
    }
    function clampTranslate(tx, ty, s3, containerW, containerH, imageNatW, imageNatH, objectFit = "contain") {
      let contentW = containerW;
      let contentH = containerH;
      if (imageNatW && imageNatH) {
        if (objectFit === "contain") {
          const scaleBase = Math.min(containerW / imageNatW, containerH / imageNatH) || 1;
          contentW = imageNatW * scaleBase * s3;
          contentH = imageNatH * scaleBase * s3;
        } else if (objectFit === "cover") {
          const scaleBase = Math.max(containerW / imageNatW, containerH / imageNatH) || 1;
          contentW = imageNatW * scaleBase * s3;
          contentH = imageNatH * scaleBase * s3;
        }
      } else {
        contentW = containerW * s3;
        contentH = containerH * s3;
      }
      let minX, maxX, minY, maxY;
      if (contentW <= containerW) {
        const centerX = (containerW - contentW) / 2;
        minX = maxX = centerX;
      } else {
        minX = containerW - contentW;
        maxX = 0;
      }
      if (contentH <= containerH) {
        const centerY = (containerH - contentH) / 2;
        minY = maxY = centerY;
      } else {
        minY = containerH - contentH;
        maxY = 0;
      }
      const cx = Math.min(maxX, Math.max(minX, tx));
      const cy = Math.min(maxY, Math.max(minY, ty));
      return { x: cx, y: cy, contentW, contentH };
    }
    module.exports = { computeUnscaledFromRaw: computeUnscaledFromRaw2, clampTranslate };
  }
});

// node_modules/preact/dist/preact.module.js
var n;
var l;
var u;
var t;
var i;
var o;
var r;
var e;
var f;
var c;
var s;
var a;
var h;
var p = {};
var v = [];
var y = /acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i;
var d = Array.isArray;
function w(n2, l3) {
  for (var u4 in l3) n2[u4] = l3[u4];
  return n2;
}
function g(n2) {
  n2 && n2.parentNode && n2.parentNode.removeChild(n2);
}
function _(l3, u4, t3) {
  var i4, o3, r3, e3 = {};
  for (r3 in u4) "key" == r3 ? i4 = u4[r3] : "ref" == r3 ? o3 = u4[r3] : e3[r3] = u4[r3];
  if (arguments.length > 2 && (e3.children = arguments.length > 3 ? n.call(arguments, 2) : t3), "function" == typeof l3 && null != l3.defaultProps) for (r3 in l3.defaultProps) void 0 === e3[r3] && (e3[r3] = l3.defaultProps[r3]);
  return m(l3, e3, i4, o3, null);
}
function m(n2, t3, i4, o3, r3) {
  var e3 = { type: n2, props: t3, key: i4, ref: o3, __k: null, __: null, __b: 0, __e: null, __c: null, constructor: void 0, __v: null == r3 ? ++u : r3, __i: -1, __u: 0 };
  return null == r3 && null != l.vnode && l.vnode(e3), e3;
}
function b() {
  return { current: null };
}
function k(n2) {
  return n2.children;
}
function x(n2, l3) {
  this.props = n2, this.context = l3;
}
function S(n2, l3) {
  if (null == l3) return n2.__ ? S(n2.__, n2.__i + 1) : null;
  for (var u4; l3 < n2.__k.length; l3++) if (null != (u4 = n2.__k[l3]) && null != u4.__e) return u4.__e;
  return "function" == typeof n2.type ? S(n2) : null;
}
function C(n2) {
  var l3, u4;
  if (null != (n2 = n2.__) && null != n2.__c) {
    for (n2.__e = n2.__c.base = null, l3 = 0; l3 < n2.__k.length; l3++) if (null != (u4 = n2.__k[l3]) && null != u4.__e) {
      n2.__e = n2.__c.base = u4.__e;
      break;
    }
    return C(n2);
  }
}
function M(n2) {
  (!n2.__d && (n2.__d = true) && i.push(n2) && !$.__r++ || o != l.debounceRendering) && ((o = l.debounceRendering) || r)($);
}
function $() {
  for (var n2, u4, t3, o3, r3, f4, c3, s3 = 1; i.length; ) i.length > s3 && i.sort(e), n2 = i.shift(), s3 = i.length, n2.__d && (t3 = void 0, o3 = void 0, r3 = (o3 = (u4 = n2).__v).__e, f4 = [], c3 = [], u4.__P && ((t3 = w({}, o3)).__v = o3.__v + 1, l.vnode && l.vnode(t3), O(u4.__P, t3, o3, u4.__n, u4.__P.namespaceURI, 32 & o3.__u ? [r3] : null, f4, null == r3 ? S(o3) : r3, !!(32 & o3.__u), c3), t3.__v = o3.__v, t3.__.__k[t3.__i] = t3, N(f4, t3, c3), o3.__e = o3.__ = null, t3.__e != r3 && C(t3)));
  $.__r = 0;
}
function I(n2, l3, u4, t3, i4, o3, r3, e3, f4, c3, s3) {
  var a3, h3, y3, d3, w4, g4, _3, m3 = t3 && t3.__k || v, b3 = l3.length;
  for (f4 = P(u4, l3, m3, f4, b3), a3 = 0; a3 < b3; a3++) null != (y3 = u4.__k[a3]) && (h3 = -1 == y3.__i ? p : m3[y3.__i] || p, y3.__i = a3, g4 = O(n2, y3, h3, i4, o3, r3, e3, f4, c3, s3), d3 = y3.__e, y3.ref && h3.ref != y3.ref && (h3.ref && B(h3.ref, null, y3), s3.push(y3.ref, y3.__c || d3, y3)), null == w4 && null != d3 && (w4 = d3), (_3 = !!(4 & y3.__u)) || h3.__k === y3.__k ? f4 = A(y3, f4, n2, _3) : "function" == typeof y3.type && void 0 !== g4 ? f4 = g4 : d3 && (f4 = d3.nextSibling), y3.__u &= -7);
  return u4.__e = w4, f4;
}
function P(n2, l3, u4, t3, i4) {
  var o3, r3, e3, f4, c3, s3 = u4.length, a3 = s3, h3 = 0;
  for (n2.__k = new Array(i4), o3 = 0; o3 < i4; o3++) null != (r3 = l3[o3]) && "boolean" != typeof r3 && "function" != typeof r3 ? ("string" == typeof r3 || "number" == typeof r3 || "bigint" == typeof r3 || r3.constructor == String ? r3 = n2.__k[o3] = m(null, r3, null, null, null) : d(r3) ? r3 = n2.__k[o3] = m(k, { children: r3 }, null, null, null) : void 0 === r3.constructor && r3.__b > 0 ? r3 = n2.__k[o3] = m(r3.type, r3.props, r3.key, r3.ref ? r3.ref : null, r3.__v) : n2.__k[o3] = r3, f4 = o3 + h3, r3.__ = n2, r3.__b = n2.__b + 1, e3 = null, -1 != (c3 = r3.__i = L(r3, u4, f4, a3)) && (a3--, (e3 = u4[c3]) && (e3.__u |= 2)), null == e3 || null == e3.__v ? (-1 == c3 && (i4 > s3 ? h3-- : i4 < s3 && h3++), "function" != typeof r3.type && (r3.__u |= 4)) : c3 != f4 && (c3 == f4 - 1 ? h3-- : c3 == f4 + 1 ? h3++ : (c3 > f4 ? h3-- : h3++, r3.__u |= 4))) : n2.__k[o3] = null;
  if (a3) for (o3 = 0; o3 < s3; o3++) null != (e3 = u4[o3]) && 0 == (2 & e3.__u) && (e3.__e == t3 && (t3 = S(e3)), D(e3, e3));
  return t3;
}
function A(n2, l3, u4, t3) {
  var i4, o3;
  if ("function" == typeof n2.type) {
    for (i4 = n2.__k, o3 = 0; i4 && o3 < i4.length; o3++) i4[o3] && (i4[o3].__ = n2, l3 = A(i4[o3], l3, u4, t3));
    return l3;
  }
  n2.__e != l3 && (t3 && (l3 && n2.type && !l3.parentNode && (l3 = S(n2)), u4.insertBefore(n2.__e, l3 || null)), l3 = n2.__e);
  do {
    l3 = l3 && l3.nextSibling;
  } while (null != l3 && 8 == l3.nodeType);
  return l3;
}
function H(n2, l3) {
  return l3 = l3 || [], null == n2 || "boolean" == typeof n2 || (d(n2) ? n2.some(function(n3) {
    H(n3, l3);
  }) : l3.push(n2)), l3;
}
function L(n2, l3, u4, t3) {
  var i4, o3, r3, e3 = n2.key, f4 = n2.type, c3 = l3[u4], s3 = null != c3 && 0 == (2 & c3.__u);
  if (null === c3 && null == e3 || s3 && e3 == c3.key && f4 == c3.type) return u4;
  if (t3 > (s3 ? 1 : 0)) {
    for (i4 = u4 - 1, o3 = u4 + 1; i4 >= 0 || o3 < l3.length; ) if (null != (c3 = l3[r3 = i4 >= 0 ? i4-- : o3++]) && 0 == (2 & c3.__u) && e3 == c3.key && f4 == c3.type) return r3;
  }
  return -1;
}
function T(n2, l3, u4) {
  "-" == l3[0] ? n2.setProperty(l3, null == u4 ? "" : u4) : n2[l3] = null == u4 ? "" : "number" != typeof u4 || y.test(l3) ? u4 : u4 + "px";
}
function j(n2, l3, u4, t3, i4) {
  var o3, r3;
  n: if ("style" == l3) if ("string" == typeof u4) n2.style.cssText = u4;
  else {
    if ("string" == typeof t3 && (n2.style.cssText = t3 = ""), t3) for (l3 in t3) u4 && l3 in u4 || T(n2.style, l3, "");
    if (u4) for (l3 in u4) t3 && u4[l3] == t3[l3] || T(n2.style, l3, u4[l3]);
  }
  else if ("o" == l3[0] && "n" == l3[1]) o3 = l3 != (l3 = l3.replace(f, "$1")), r3 = l3.toLowerCase(), l3 = r3 in n2 || "onFocusOut" == l3 || "onFocusIn" == l3 ? r3.slice(2) : l3.slice(2), n2.l || (n2.l = {}), n2.l[l3 + o3] = u4, u4 ? t3 ? u4.u = t3.u : (u4.u = c, n2.addEventListener(l3, o3 ? a : s, o3)) : n2.removeEventListener(l3, o3 ? a : s, o3);
  else {
    if ("http://www.w3.org/2000/svg" == i4) l3 = l3.replace(/xlink(H|:h)/, "h").replace(/sName$/, "s");
    else if ("width" != l3 && "height" != l3 && "href" != l3 && "list" != l3 && "form" != l3 && "tabIndex" != l3 && "download" != l3 && "rowSpan" != l3 && "colSpan" != l3 && "role" != l3 && "popover" != l3 && l3 in n2) try {
      n2[l3] = null == u4 ? "" : u4;
      break n;
    } catch (n3) {
    }
    "function" == typeof u4 || (null == u4 || false === u4 && "-" != l3[4] ? n2.removeAttribute(l3) : n2.setAttribute(l3, "popover" == l3 && 1 == u4 ? "" : u4));
  }
}
function F(n2) {
  return function(u4) {
    if (this.l) {
      var t3 = this.l[u4.type + n2];
      if (null == u4.t) u4.t = c++;
      else if (u4.t < t3.u) return;
      return t3(l.event ? l.event(u4) : u4);
    }
  };
}
function O(n2, u4, t3, i4, o3, r3, e3, f4, c3, s3) {
  var a3, h3, p3, v3, y3, _3, m3, b3, S2, C4, M3, $3, P4, A4, H3, L3, T4, j4 = u4.type;
  if (void 0 !== u4.constructor) return null;
  128 & t3.__u && (c3 = !!(32 & t3.__u), r3 = [f4 = u4.__e = t3.__e]), (a3 = l.__b) && a3(u4);
  n: if ("function" == typeof j4) try {
    if (b3 = u4.props, S2 = "prototype" in j4 && j4.prototype.render, C4 = (a3 = j4.contextType) && i4[a3.__c], M3 = a3 ? C4 ? C4.props.value : a3.__ : i4, t3.__c ? m3 = (h3 = u4.__c = t3.__c).__ = h3.__E : (S2 ? u4.__c = h3 = new j4(b3, M3) : (u4.__c = h3 = new x(b3, M3), h3.constructor = j4, h3.render = E), C4 && C4.sub(h3), h3.state || (h3.state = {}), h3.__n = i4, p3 = h3.__d = true, h3.__h = [], h3._sb = []), S2 && null == h3.__s && (h3.__s = h3.state), S2 && null != j4.getDerivedStateFromProps && (h3.__s == h3.state && (h3.__s = w({}, h3.__s)), w(h3.__s, j4.getDerivedStateFromProps(b3, h3.__s))), v3 = h3.props, y3 = h3.state, h3.__v = u4, p3) S2 && null == j4.getDerivedStateFromProps && null != h3.componentWillMount && h3.componentWillMount(), S2 && null != h3.componentDidMount && h3.__h.push(h3.componentDidMount);
    else {
      if (S2 && null == j4.getDerivedStateFromProps && b3 !== v3 && null != h3.componentWillReceiveProps && h3.componentWillReceiveProps(b3, M3), u4.__v == t3.__v || !h3.__e && null != h3.shouldComponentUpdate && false === h3.shouldComponentUpdate(b3, h3.__s, M3)) {
        for (u4.__v != t3.__v && (h3.props = b3, h3.state = h3.__s, h3.__d = false), u4.__e = t3.__e, u4.__k = t3.__k, u4.__k.some(function(n3) {
          n3 && (n3.__ = u4);
        }), $3 = 0; $3 < h3._sb.length; $3++) h3.__h.push(h3._sb[$3]);
        h3._sb = [], h3.__h.length && e3.push(h3);
        break n;
      }
      null != h3.componentWillUpdate && h3.componentWillUpdate(b3, h3.__s, M3), S2 && null != h3.componentDidUpdate && h3.__h.push(function() {
        h3.componentDidUpdate(v3, y3, _3);
      });
    }
    if (h3.context = M3, h3.props = b3, h3.__P = n2, h3.__e = false, P4 = l.__r, A4 = 0, S2) {
      for (h3.state = h3.__s, h3.__d = false, P4 && P4(u4), a3 = h3.render(h3.props, h3.state, h3.context), H3 = 0; H3 < h3._sb.length; H3++) h3.__h.push(h3._sb[H3]);
      h3._sb = [];
    } else do {
      h3.__d = false, P4 && P4(u4), a3 = h3.render(h3.props, h3.state, h3.context), h3.state = h3.__s;
    } while (h3.__d && ++A4 < 25);
    h3.state = h3.__s, null != h3.getChildContext && (i4 = w(w({}, i4), h3.getChildContext())), S2 && !p3 && null != h3.getSnapshotBeforeUpdate && (_3 = h3.getSnapshotBeforeUpdate(v3, y3)), L3 = a3, null != a3 && a3.type === k && null == a3.key && (L3 = V(a3.props.children)), f4 = I(n2, d(L3) ? L3 : [L3], u4, t3, i4, o3, r3, e3, f4, c3, s3), h3.base = u4.__e, u4.__u &= -161, h3.__h.length && e3.push(h3), m3 && (h3.__E = h3.__ = null);
  } catch (n3) {
    if (u4.__v = null, c3 || null != r3) if (n3.then) {
      for (u4.__u |= c3 ? 160 : 128; f4 && 8 == f4.nodeType && f4.nextSibling; ) f4 = f4.nextSibling;
      r3[r3.indexOf(f4)] = null, u4.__e = f4;
    } else {
      for (T4 = r3.length; T4--; ) g(r3[T4]);
      z(u4);
    }
    else u4.__e = t3.__e, u4.__k = t3.__k, n3.then || z(u4);
    l.__e(n3, u4, t3);
  }
  else null == r3 && u4.__v == t3.__v ? (u4.__k = t3.__k, u4.__e = t3.__e) : f4 = u4.__e = q(t3.__e, u4, t3, i4, o3, r3, e3, c3, s3);
  return (a3 = l.diffed) && a3(u4), 128 & u4.__u ? void 0 : f4;
}
function z(n2) {
  n2 && n2.__c && (n2.__c.__e = true), n2 && n2.__k && n2.__k.forEach(z);
}
function N(n2, u4, t3) {
  for (var i4 = 0; i4 < t3.length; i4++) B(t3[i4], t3[++i4], t3[++i4]);
  l.__c && l.__c(u4, n2), n2.some(function(u5) {
    try {
      n2 = u5.__h, u5.__h = [], n2.some(function(n3) {
        n3.call(u5);
      });
    } catch (n3) {
      l.__e(n3, u5.__v);
    }
  });
}
function V(n2) {
  return "object" != typeof n2 || null == n2 || n2.__b && n2.__b > 0 ? n2 : d(n2) ? n2.map(V) : w({}, n2);
}
function q(u4, t3, i4, o3, r3, e3, f4, c3, s3) {
  var a3, h3, v3, y3, w4, _3, m3, b3 = i4.props || p, k4 = t3.props, x4 = t3.type;
  if ("svg" == x4 ? r3 = "http://www.w3.org/2000/svg" : "math" == x4 ? r3 = "http://www.w3.org/1998/Math/MathML" : r3 || (r3 = "http://www.w3.org/1999/xhtml"), null != e3) {
    for (a3 = 0; a3 < e3.length; a3++) if ((w4 = e3[a3]) && "setAttribute" in w4 == !!x4 && (x4 ? w4.localName == x4 : 3 == w4.nodeType)) {
      u4 = w4, e3[a3] = null;
      break;
    }
  }
  if (null == u4) {
    if (null == x4) return document.createTextNode(k4);
    u4 = document.createElementNS(r3, x4, k4.is && k4), c3 && (l.__m && l.__m(t3, e3), c3 = false), e3 = null;
  }
  if (null == x4) b3 === k4 || c3 && u4.data == k4 || (u4.data = k4);
  else {
    if (e3 = e3 && n.call(u4.childNodes), !c3 && null != e3) for (b3 = {}, a3 = 0; a3 < u4.attributes.length; a3++) b3[(w4 = u4.attributes[a3]).name] = w4.value;
    for (a3 in b3) if (w4 = b3[a3], "children" == a3) ;
    else if ("dangerouslySetInnerHTML" == a3) v3 = w4;
    else if (!(a3 in k4)) {
      if ("value" == a3 && "defaultValue" in k4 || "checked" == a3 && "defaultChecked" in k4) continue;
      j(u4, a3, null, w4, r3);
    }
    for (a3 in k4) w4 = k4[a3], "children" == a3 ? y3 = w4 : "dangerouslySetInnerHTML" == a3 ? h3 = w4 : "value" == a3 ? _3 = w4 : "checked" == a3 ? m3 = w4 : c3 && "function" != typeof w4 || b3[a3] === w4 || j(u4, a3, w4, b3[a3], r3);
    if (h3) c3 || v3 && (h3.__html == v3.__html || h3.__html == u4.innerHTML) || (u4.innerHTML = h3.__html), t3.__k = [];
    else if (v3 && (u4.innerHTML = ""), I("template" == t3.type ? u4.content : u4, d(y3) ? y3 : [y3], t3, i4, o3, "foreignObject" == x4 ? "http://www.w3.org/1999/xhtml" : r3, e3, f4, e3 ? e3[0] : i4.__k && S(i4, 0), c3, s3), null != e3) for (a3 = e3.length; a3--; ) g(e3[a3]);
    c3 || (a3 = "value", "progress" == x4 && null == _3 ? u4.removeAttribute("value") : null != _3 && (_3 !== u4[a3] || "progress" == x4 && !_3 || "option" == x4 && _3 != b3[a3]) && j(u4, a3, _3, b3[a3], r3), a3 = "checked", null != m3 && m3 != u4[a3] && j(u4, a3, m3, b3[a3], r3));
  }
  return u4;
}
function B(n2, u4, t3) {
  try {
    if ("function" == typeof n2) {
      var i4 = "function" == typeof n2.__u;
      i4 && n2.__u(), i4 && null == u4 || (n2.__u = n2(u4));
    } else n2.current = u4;
  } catch (n3) {
    l.__e(n3, t3);
  }
}
function D(n2, u4, t3) {
  var i4, o3;
  if (l.unmount && l.unmount(n2), (i4 = n2.ref) && (i4.current && i4.current != n2.__e || B(i4, null, u4)), null != (i4 = n2.__c)) {
    if (i4.componentWillUnmount) try {
      i4.componentWillUnmount();
    } catch (n3) {
      l.__e(n3, u4);
    }
    i4.base = i4.__P = null;
  }
  if (i4 = n2.__k) for (o3 = 0; o3 < i4.length; o3++) i4[o3] && D(i4[o3], u4, t3 || "function" != typeof n2.type);
  t3 || g(n2.__e), n2.__c = n2.__ = n2.__e = void 0;
}
function E(n2, l3, u4) {
  return this.constructor(n2, u4);
}
function G(u4, t3, i4) {
  var o3, r3, e3, f4;
  t3 == document && (t3 = document.documentElement), l.__ && l.__(u4, t3), r3 = (o3 = "function" == typeof i4) ? null : i4 && i4.__k || t3.__k, e3 = [], f4 = [], O(t3, u4 = (!o3 && i4 || t3).__k = _(k, null, [u4]), r3 || p, p, t3.namespaceURI, !o3 && i4 ? [i4] : r3 ? null : t3.firstChild ? n.call(t3.childNodes) : null, e3, !o3 && i4 ? i4 : r3 ? r3.__e : t3.firstChild, o3, f4), N(e3, u4, f4);
}
function J(n2, l3) {
  G(n2, l3, J);
}
function K(l3, u4, t3) {
  var i4, o3, r3, e3, f4 = w({}, l3.props);
  for (r3 in l3.type && l3.type.defaultProps && (e3 = l3.type.defaultProps), u4) "key" == r3 ? i4 = u4[r3] : "ref" == r3 ? o3 = u4[r3] : f4[r3] = void 0 === u4[r3] && null != e3 ? e3[r3] : u4[r3];
  return arguments.length > 2 && (f4.children = arguments.length > 3 ? n.call(arguments, 2) : t3), m(l3.type, f4, i4 || l3.key, o3 || l3.ref, null);
}
function Q(n2) {
  function l3(n3) {
    var u4, t3;
    return this.getChildContext || (u4 = /* @__PURE__ */ new Set(), (t3 = {})[l3.__c] = this, this.getChildContext = function() {
      return t3;
    }, this.componentWillUnmount = function() {
      u4 = null;
    }, this.shouldComponentUpdate = function(n4) {
      this.props.value != n4.value && u4.forEach(function(n5) {
        n5.__e = true, M(n5);
      });
    }, this.sub = function(n4) {
      u4.add(n4);
      var l4 = n4.componentWillUnmount;
      n4.componentWillUnmount = function() {
        u4 && u4.delete(n4), l4 && l4.call(n4);
      };
    }), n3.children;
  }
  return l3.__c = "__cC" + h++, l3.__ = n2, l3.Provider = l3.__l = (l3.Consumer = function(n3, l4) {
    return n3.children(l4);
  }).contextType = l3, l3;
}
n = v.slice, l = { __e: function(n2, l3, u4, t3) {
  for (var i4, o3, r3; l3 = l3.__; ) if ((i4 = l3.__c) && !i4.__) try {
    if ((o3 = i4.constructor) && null != o3.getDerivedStateFromError && (i4.setState(o3.getDerivedStateFromError(n2)), r3 = i4.__d), null != i4.componentDidCatch && (i4.componentDidCatch(n2, t3 || {}), r3 = i4.__d), r3) return i4.__E = i4;
  } catch (l4) {
    n2 = l4;
  }
  throw n2;
} }, u = 0, t = function(n2) {
  return null != n2 && void 0 === n2.constructor;
}, x.prototype.setState = function(n2, l3) {
  var u4;
  u4 = null != this.__s && this.__s != this.state ? this.__s : this.__s = w({}, this.state), "function" == typeof n2 && (n2 = n2(w({}, u4), this.props)), n2 && w(u4, n2), null != n2 && this.__v && (l3 && this._sb.push(l3), M(this));
}, x.prototype.forceUpdate = function(n2) {
  this.__v && (this.__e = true, n2 && this.__h.push(n2), M(this));
}, x.prototype.render = k, i = [], r = "function" == typeof Promise ? Promise.prototype.then.bind(Promise.resolve()) : setTimeout, e = function(n2, l3) {
  return n2.__v.__b - l3.__v.__b;
}, $.__r = 0, f = /(PointerCapture)$|Capture$/i, c = 0, s = F(false), a = F(true), h = 0;

// node_modules/preact/hooks/dist/hooks.module.js
var t2;
var r2;
var u2;
var i2;
var o2 = 0;
var f2 = [];
var c2 = l;
var e2 = c2.__b;
var a2 = c2.__r;
var v2 = c2.diffed;
var l2 = c2.__c;
var m2 = c2.unmount;
var s2 = c2.__;
function p2(n2, t3) {
  c2.__h && c2.__h(r2, n2, o2 || t3), o2 = 0;
  var u4 = r2.__H || (r2.__H = { __: [], __h: [] });
  return n2 >= u4.__.length && u4.__.push({}), u4.__[n2];
}
function d2(n2) {
  return o2 = 1, h2(D2, n2);
}
function h2(n2, u4, i4) {
  var o3 = p2(t2++, 2);
  if (o3.t = n2, !o3.__c && (o3.__ = [i4 ? i4(u4) : D2(void 0, u4), function(n3) {
    var t3 = o3.__N ? o3.__N[0] : o3.__[0], r3 = o3.t(t3, n3);
    t3 !== r3 && (o3.__N = [r3, o3.__[1]], o3.__c.setState({}));
  }], o3.__c = r2, !r2.__f)) {
    var f4 = function(n3, t3, r3) {
      if (!o3.__c.__H) return true;
      var u5 = o3.__c.__H.__.filter(function(n4) {
        return !!n4.__c;
      });
      if (u5.every(function(n4) {
        return !n4.__N;
      })) return !c3 || c3.call(this, n3, t3, r3);
      var i5 = o3.__c.props !== n3;
      return u5.forEach(function(n4) {
        if (n4.__N) {
          var t4 = n4.__[0];
          n4.__ = n4.__N, n4.__N = void 0, t4 !== n4.__[0] && (i5 = true);
        }
      }), c3 && c3.call(this, n3, t3, r3) || i5;
    };
    r2.__f = true;
    var c3 = r2.shouldComponentUpdate, e3 = r2.componentWillUpdate;
    r2.componentWillUpdate = function(n3, t3, r3) {
      if (this.__e) {
        var u5 = c3;
        c3 = void 0, f4(n3, t3, r3), c3 = u5;
      }
      e3 && e3.call(this, n3, t3, r3);
    }, r2.shouldComponentUpdate = f4;
  }
  return o3.__N || o3.__;
}
function y2(n2, u4) {
  var i4 = p2(t2++, 3);
  !c2.__s && C2(i4.__H, u4) && (i4.__ = n2, i4.u = u4, r2.__H.__h.push(i4));
}
function _2(n2, u4) {
  var i4 = p2(t2++, 4);
  !c2.__s && C2(i4.__H, u4) && (i4.__ = n2, i4.u = u4, r2.__h.push(i4));
}
function A2(n2) {
  return o2 = 5, T2(function() {
    return { current: n2 };
  }, []);
}
function F2(n2, t3, r3) {
  o2 = 6, _2(function() {
    if ("function" == typeof n2) {
      var r4 = n2(t3());
      return function() {
        n2(null), r4 && "function" == typeof r4 && r4();
      };
    }
    if (n2) return n2.current = t3(), function() {
      return n2.current = null;
    };
  }, null == r3 ? r3 : r3.concat(n2));
}
function T2(n2, r3) {
  var u4 = p2(t2++, 7);
  return C2(u4.__H, r3) && (u4.__ = n2(), u4.__H = r3, u4.__h = n2), u4.__;
}
function q2(n2, t3) {
  return o2 = 8, T2(function() {
    return n2;
  }, t3);
}
function x2(n2) {
  var u4 = r2.context[n2.__c], i4 = p2(t2++, 9);
  return i4.c = n2, u4 ? (null == i4.__ && (i4.__ = true, u4.sub(r2)), u4.props.value) : n2.__;
}
function P2(n2, t3) {
  c2.useDebugValue && c2.useDebugValue(t3 ? t3(n2) : n2);
}
function b2(n2) {
  var u4 = p2(t2++, 10), i4 = d2();
  return u4.__ = n2, r2.componentDidCatch || (r2.componentDidCatch = function(n3, t3) {
    u4.__ && u4.__(n3, t3), i4[1](n3);
  }), [i4[0], function() {
    i4[1](void 0);
  }];
}
function g2() {
  var n2 = p2(t2++, 11);
  if (!n2.__) {
    for (var u4 = r2.__v; null !== u4 && !u4.__m && null !== u4.__; ) u4 = u4.__;
    var i4 = u4.__m || (u4.__m = [0, 0]);
    n2.__ = "P" + i4[0] + "-" + i4[1]++;
  }
  return n2.__;
}
function j2() {
  for (var n2; n2 = f2.shift(); ) if (n2.__P && n2.__H) try {
    n2.__H.__h.forEach(z2), n2.__H.__h.forEach(B2), n2.__H.__h = [];
  } catch (t3) {
    n2.__H.__h = [], c2.__e(t3, n2.__v);
  }
}
c2.__b = function(n2) {
  r2 = null, e2 && e2(n2);
}, c2.__ = function(n2, t3) {
  n2 && t3.__k && t3.__k.__m && (n2.__m = t3.__k.__m), s2 && s2(n2, t3);
}, c2.__r = function(n2) {
  a2 && a2(n2), t2 = 0;
  var i4 = (r2 = n2.__c).__H;
  i4 && (u2 === r2 ? (i4.__h = [], r2.__h = [], i4.__.forEach(function(n3) {
    n3.__N && (n3.__ = n3.__N), n3.u = n3.__N = void 0;
  })) : (i4.__h.forEach(z2), i4.__h.forEach(B2), i4.__h = [], t2 = 0)), u2 = r2;
}, c2.diffed = function(n2) {
  v2 && v2(n2);
  var t3 = n2.__c;
  t3 && t3.__H && (t3.__H.__h.length && (1 !== f2.push(t3) && i2 === c2.requestAnimationFrame || ((i2 = c2.requestAnimationFrame) || w2)(j2)), t3.__H.__.forEach(function(n3) {
    n3.u && (n3.__H = n3.u), n3.u = void 0;
  })), u2 = r2 = null;
}, c2.__c = function(n2, t3) {
  t3.some(function(n3) {
    try {
      n3.__h.forEach(z2), n3.__h = n3.__h.filter(function(n4) {
        return !n4.__ || B2(n4);
      });
    } catch (r3) {
      t3.some(function(n4) {
        n4.__h && (n4.__h = []);
      }), t3 = [], c2.__e(r3, n3.__v);
    }
  }), l2 && l2(n2, t3);
}, c2.unmount = function(n2) {
  m2 && m2(n2);
  var t3, r3 = n2.__c;
  r3 && r3.__H && (r3.__H.__.forEach(function(n3) {
    try {
      z2(n3);
    } catch (n4) {
      t3 = n4;
    }
  }), r3.__H = void 0, t3 && c2.__e(t3, r3.__v));
};
var k2 = "function" == typeof requestAnimationFrame;
function w2(n2) {
  var t3, r3 = function() {
    clearTimeout(u4), k2 && cancelAnimationFrame(t3), setTimeout(n2);
  }, u4 = setTimeout(r3, 35);
  k2 && (t3 = requestAnimationFrame(r3));
}
function z2(n2) {
  var t3 = r2, u4 = n2.__c;
  "function" == typeof u4 && (n2.__c = void 0, u4()), r2 = t3;
}
function B2(n2) {
  var t3 = r2;
  n2.__c = n2.__(), r2 = t3;
}
function C2(n2, t3) {
  return !n2 || n2.length !== t3.length || t3.some(function(t4, r3) {
    return t4 !== n2[r3];
  });
}
function D2(n2, t3) {
  return "function" == typeof t3 ? t3(n2) : t3;
}

// node_modules/preact/jsx-runtime/dist/jsxRuntime.module.js
var f3 = 0;
var i3 = Array.isArray;
function u3(e3, t3, n2, o3, i4, u4) {
  t3 || (t3 = {});
  var a3, c3, p3 = t3;
  if ("ref" in p3) for (c3 in p3 = {}, t3) "ref" == c3 ? a3 = t3[c3] : p3[c3] = t3[c3];
  var l3 = { type: e3, props: p3, key: n2, ref: a3, __k: null, __: null, __b: 0, __e: null, __c: null, constructor: void 0, __v: --f3, __i: -1, __u: 0, __source: i4, __self: u4 };
  if ("function" == typeof e3 && (a3 = e3.defaultProps)) for (c3 in a3) void 0 === p3[c3] && (p3[c3] = a3[c3]);
  return l.vnode && l.vnode(l3), l3;
}

// src/islands/VisualAnnotationIsland.tsx
var INITIAL_BACKOFF_MS = 100;
var MAX_BACKOFF_MS = 5e3;
var HANDSHAKE_TIMEOUT_MS = 5e3;
var MAX_RETRIES = 10;
function VisualAnnotationIsland(props) {
  const [status, setStatus] = d2("idle");
  const [annotations, setAnnotations] = d2([]);
  const [isDrawing, setIsDrawing] = d2(false);
  const [liveRect, setLiveRect] = d2(null);
  const [retryCount, setRetryCount] = d2(0);
  const [errorMessage, setErrorMessage] = d2("");
  const [retryNonce, setRetryNonce] = d2(0);
  y2(() => {
    if (props.annotations && Array.isArray(props.annotations)) {
      try {
        const mapped = props.annotations.map((a3) => ({
          id: a3.id,
          label: a3.label || "",
          note: a3.note || "",
          x: Number(a3.bbox?.x ?? a3.x ?? 0),
          y: Number(a3.bbox?.y ?? a3.y ?? 0),
          width: Number(a3.bbox?.width ?? a3.width ?? 0),
          height: Number(a3.bbox?.height ?? a3.height ?? 0),
          confirmed: true,
          context: a3.context || void 0
        }));
        console.debug && console.debug("VisualAnnotationIsland init annotations", mapped);
        setAnnotations(mapped);
      } catch (err) {
      }
    }
  }, [props.annotations]);
  y2(() => {
    let aborted = false;
    async function loadSaved() {
      if (!props.documentId) return;
      try {
        const pageQuery = props.page !== void 0 && props.page !== null ? `?page=${props.page}` : "";
        const resp = await fetch(`/manual/annotations/${props.documentId}${pageQuery}`, { headers: { "X-Request-Id": `load-annotations-${Date.now()}` } });
        if (aborted) return;
        if (resp.status === 401) {
          console.warn("Annotations: authentication required to load annotations");
          return;
        }
        if (!resp.ok) throw new Error(`Failed to load annotations: ${resp.status}`);
        const json = await resp.json();
        const anns = Array.isArray(json.annotations) ? json.annotations : [];
        const mapped = anns.map((a3) => ({
          id: a3.id,
          label: a3.label || "",
          note: a3.note || "",
          x: Number(a3.bbox?.x ?? a3.x ?? 0),
          y: Number(a3.bbox?.y ?? a3.y ?? 0),
          width: Number(a3.bbox?.width ?? a3.width ?? 0),
          height: Number(a3.bbox?.height ?? a3.height ?? 0),
          confirmed: true,
          context: a3.context || void 0
        }));
        setAnnotations(mapped);
      } catch (err) {
        const msg = err && typeof err === "object" && "message" in err ? err.message : String(err);
        console.error("Failed to load annotations:", msg);
      }
    }
    loadSaved();
    return () => {
      aborted = true;
    };
  }, [props.documentId, props.page]);
  y2(() => {
    const handler = (e3) => {
      const anns = e3?.detail?.annotations;
      if (!Array.isArray(anns)) return;
      const mapped = anns.map((a3) => ({
        id: a3.id,
        label: a3.label || "",
        note: a3.note || "",
        x: Number(a3.bbox?.x ?? a3.x ?? 0),
        y: Number(a3.bbox?.y ?? a3.y ?? 0),
        width: Number(a3.bbox?.width ?? a3.width ?? 0),
        height: Number(a3.bbox?.height ?? a3.height ?? 0),
        confirmed: true,
        context: a3.context || void 0
      }));
      setAnnotations(mapped);
    };
    document.addEventListener("annotations:loaded", handler);
    return () => document.removeEventListener("annotations:loaded", handler);
  }, []);
  const canvasRef = A2(null);
  const startRef = A2(null);
  const mountedRef = A2(true);
  const drawToggleRef = A2(null);
  const liveRectElRef = A2(null);
  const getBackoffDelay = q2((attempt) => {
    const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
    return Math.min(delay, MAX_BACKOFF_MS);
  }, []);
  const checkSidecar = q2(async (retryAttemptRef) => {
    if (!mountedRef.current) return;
    setStatus("checking");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HANDSHAKE_TIMEOUT_MS);
    try {
      const res = await fetch("/api/visual-rag/health", {
        signal: controller.signal,
        headers: { "X-Request-Id": `handshake-${Date.now()}` }
      });
      clearTimeout(timeoutId);
      if (!mountedRef.current) return;
      if (res.status === 503) {
        setStatus("preparing");
        retryAttemptRef.current++;
        setRetryCount(retryAttemptRef.current);
        if (retryAttemptRef.current < MAX_RETRIES) {
          const delay = getBackoffDelay(retryAttemptRef.current);
          setTimeout(() => mountedRef.current && checkSidecar(retryAttemptRef), delay);
        } else {
          setStatus("error");
          setErrorMessage("GPU warmup timed out after maximum retries");
        }
        return;
      }
      if (res.ok) {
        setStatus("ready");
        setRetryCount(0);
        setErrorMessage("");
      } else {
        setStatus("error");
        setErrorMessage(`Sidecar returned status ${res.status}`);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      if (!mountedRef.current) return;
      retryAttemptRef.current++;
      setRetryCount(retryAttemptRef.current);
      if (retryAttemptRef.current < MAX_RETRIES) {
        setStatus("preparing");
        const delay = getBackoffDelay(retryAttemptRef.current);
        setTimeout(() => mountedRef.current && checkSidecar(retryAttemptRef), delay);
      } else {
        setStatus("error");
        const name = err && typeof err === "object" && "name" in err ? err.name : void 0;
        const message = err && typeof err === "object" && "message" in err ? err.message : String(err);
        setErrorMessage(name === "AbortError" ? "Connection timeout" : message);
      }
    }
  }, [getBackoffDelay]);
  y2(() => {
    mountedRef.current = true;
    const retryAttemptRef = { current: 0 };
    checkSidecar(retryAttemptRef);
    return () => {
      mountedRef.current = false;
    };
  }, [checkSidecar, retryNonce]);
  y2(() => {
    if (drawToggleRef.current) {
      drawToggleRef.current.setAttribute("aria-pressed", isDrawing ? "true" : "false");
    }
  }, [isDrawing]);
  const getLocalCoords = (evt) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top,
      w: rect.width,
      h: rect.height
    };
  };
  const handleMouseDown = (e3) => {
    if (!isDrawing || status !== "ready") return;
    e3.preventDefault();
    const { x: x4, y: y3 } = getLocalCoords(e3);
    startRef.current = { x: x4, y: y3 };
    setLiveRect({ x: x4, y: y3, w: 0, h: 0 });
  };
  const handleMouseMove = (e3) => {
    if (!isDrawing || !startRef.current || !liveRect) return;
    const { x: x4, y: y3 } = getLocalCoords(e3);
    const left = Math.min(startRef.current.x, x4);
    const top = Math.min(startRef.current.y, y3);
    const width = Math.abs(x4 - startRef.current.x);
    const height = Math.abs(y3 - startRef.current.y);
    setLiveRect({ x: left, y: top, w: width, h: height });
  };
  const handleMouseUp = (e3) => {
    if (!isDrawing || !startRef.current || !liveRect) return;
    const { x: x4, y: y3, w: cw, h: ch } = getLocalCoords(e3);
    const left = Math.min(startRef.current.x, x4);
    const top = Math.min(startRef.current.y, y3);
    const width = Math.abs(x4 - startRef.current.x);
    const height = Math.abs(y3 - startRef.current.y);
    const nx = left / cw;
    const ny = top / ch;
    const nw = width / cw;
    const nh = height / ch;
    setAnnotations((prev) => [...prev, { label: "", note: "", x: nx, y: ny, width: nw, height: nh }]);
    setLiveRect(null);
    startRef.current = null;
  };
  y2(() => {
    const el = liveRectElRef.current;
    if (!el || !liveRect) return;
    el.style.setProperty("--vai-x", `${liveRect.x}px`);
    el.style.setProperty("--vai-y", `${liveRect.y}px`);
    el.style.setProperty("--vai-w", `${liveRect.w}px`);
    el.style.setProperty("--vai-h", `${liveRect.h}px`);
  }, [liveRect]);
  const handleConfirm = async (index) => {
    const ann = annotations[index];
    try {
      const bbox = [ann.y, ann.x, ann.y + ann.height, ann.x + ann.width];
      await fetch("/api/visual-rag/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": `annotation-confirm-${Date.now()}`
        },
        body: JSON.stringify({
          documentId: props.documentId ? Number(props.documentId) : null,
          events: [{
            event_type: "annotation",
            field_name: ann.label || "visual_annotation",
            corrected_value: {
              label: ann.label,
              text: ann.note || "",
              bbox,
              confidence: 1
              // User confirmed, so full confidence
            },
            context: {
              request_id: `annotation-confirm-${Date.now()}`,
              page: props.page ?? 0,
              bbox,
              label: ann.label,
              note: ann.note,
              correspondentId: ann.context?.correspondentId ?? null,
              tagIds: ann.context?.tagIds ?? [],
              documentTypeId: ann.context?.documentTypeId ?? null
            }
          }]
        })
      });
      const newAnns = [...annotations];
      newAnns[index].confirmed = true;
      setAnnotations(newAnns);
      document.dispatchEvent(new CustomEvent("feedback:confirmed", {
        detail: {
          ...ann,
          documentId: props.documentId,
          page: props.page,
          bbox
        }
      }));
    } catch (e3) {
      console.error("Failed to confirm match", e3);
    }
  };
  const [isSaving, setIsSaving] = d2(false);
  const [saveError, setSaveError] = d2("");
  const [needsAuth, setNeedsAuth] = d2(false);
  const handleSave = async () => {
    setIsSaving(true);
    setSaveError("");
    const payload = {
      documentId: props.documentId || null,
      page: props.page || null,
      annotations: annotations.map((a3) => ({ bbox: { x: a3.x, y: a3.y, width: a3.width, height: a3.height }, label: a3.label, note: a3.note }))
    };
    try {
      const resp = await fetch("/manual/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Request-Id": `save-annotations-${Date.now()}` },
        body: JSON.stringify(payload)
      });
      if (resp.status === 401) {
        setSaveError("Authentication required to save annotations");
        setNeedsAuth(true);
        setIsSaving(false);
        return;
      }
      if (!resp.ok) throw new Error(`Save failed (${resp.status})`);
      const json = await resp.json();
      const created = Array.isArray(json.created) ? json.created : [];
      const findMatch = (local, c3) => {
        const cb = c3.bbox || c3;
        const cx = Number(cb.x ?? (Array.isArray(cb) ? cb[1] : 0));
        const cy = Number(cb.y ?? (Array.isArray(cb) ? cb[0] : 0));
        const cwidth = Number(cb.width ?? (Array.isArray(cb) ? cb[3] - cb[1] : 0));
        const cheight = Number(cb.height ?? (Array.isArray(cb) ? cb[2] - cb[0] : 0));
        return Math.abs(local.x - cx) < 1e-3 && Math.abs(local.y - cy) < 1e-3 && Math.abs(local.width - cwidth) < 1e-3 && Math.abs(local.height - cheight) < 1e-3;
      };
      const newAnns = annotations.map((local) => {
        const found = created.find((c3) => findMatch(local, c3));
        if (found) {
          return {
            id: found.id,
            label: local.label,
            note: local.note,
            x: Number(found.bbox?.x ?? local.x),
            y: Number(found.bbox?.y ?? local.y),
            width: Number(found.bbox?.width ?? local.width),
            height: Number(found.bbox?.height ?? local.height),
            confirmed: true,
            context: found.context || local.context
          };
        }
        return local;
      });
      setAnnotations(newAnns);
      document.dispatchEvent(new CustomEvent("payload:ready", { detail: payload }));
    } catch (err) {
      const msg = err && typeof err === "object" && "message" in err ? err.message : String(err);
      console.error("Failed to save annotations:", msg);
      setSaveError(msg || "Failed to save annotations");
    } finally {
      setIsSaving(false);
    }
  };
  const handleRetry = q2(() => {
    setStatus("idle");
    setRetryCount(0);
    setErrorMessage("");
    mountedRef.current = true;
    setRetryNonce((n2) => n2 + 1);
  }, []);
  return /* @__PURE__ */ u3("div", { "data-testid": "visual-annotation-island-root", "data-hydrated": "true", children: [
    (status === "preparing" || status === "checking") && /* @__PURE__ */ u3(
      "div",
      {
        className: "vai-fullpage-modal",
        "data-testid": "gpu-preparing-modal",
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": "gpu-modal-title",
        children: /* @__PURE__ */ u3("div", { className: "vai-modal-content", children: [
          /* @__PURE__ */ u3("div", { className: "vai-modal-spinner" }),
          /* @__PURE__ */ u3("h2", { id: "gpu-modal-title", className: "vai-modal-title", children: "GPU Preparing (Warmup)" }),
          /* @__PURE__ */ u3("p", { className: "vai-modal-text", children: "The visual analysis system is initializing..." }),
          retryCount > 0 && /* @__PURE__ */ u3("p", { className: "vai-modal-retry", "data-testid": "retry-count", children: [
            "Retry attempt ",
            retryCount,
            "/",
            MAX_RETRIES
          ] })
        ] })
      }
    ),
    status === "error" && /* @__PURE__ */ u3(
      "div",
      {
        className: "vai-error-modal",
        "data-testid": "gpu-error-modal",
        role: "alertdialog",
        "aria-labelledby": "error-modal-title",
        children: /* @__PURE__ */ u3("div", { className: "vai-modal-content vai-error-content", children: [
          /* @__PURE__ */ u3("div", { className: "vai-error-icon", children: "\u26A0\uFE0F" }),
          /* @__PURE__ */ u3("h2", { id: "error-modal-title", className: "vai-modal-title", children: "Visual Analysis Unavailable" }),
          /* @__PURE__ */ u3("p", { className: "vai-modal-text", children: errorMessage || "Could not connect to the visual analysis service." }),
          /* @__PURE__ */ u3(
            "button",
            {
              className: "vai-retry-btn",
              onClick: handleRetry,
              "data-testid": "retry-button",
              children: "Retry Connection"
            }
          )
        ] })
      }
    ),
    /* @__PURE__ */ u3("div", { className: "vai-controls", children: [
      /* @__PURE__ */ u3(
        "button",
        {
          ref: drawToggleRef,
          "data-testid": "draw-toggle",
          onClick: () => setIsDrawing(!isDrawing),
          "aria-pressed": "false",
          disabled: status !== "ready",
          className: `vai-btn ${isDrawing ? "vai-btn-active" : ""}`,
          children: isDrawing ? "Drawing: ON" : "Draw Mode"
        }
      ),
      /* @__PURE__ */ u3(
        "button",
        {
          "data-testid": "save-annotations",
          onClick: handleSave,
          className: "vai-btn vai-btn-primary",
          disabled: status !== "ready" || annotations.length === 0 || isSaving,
          children: isSaving ? "Saving..." : "Save Annotations"
        }
      ),
      saveError && /* @__PURE__ */ u3("div", { className: "flex items-center gap-2 ml-2", children: [
        /* @__PURE__ */ u3("div", { "data-testid": "annotation-save-error", className: "vai-save-error text-red-600", role: "alert", children: saveError }),
        needsAuth && /* @__PURE__ */ u3(
          "button",
          {
            "data-testid": "annotation-login-btn",
            className: "vai-btn",
            onClick: () => {
              try {
                document.dispatchEvent(new CustomEvent("auth:required", { detail: { redirect: window && window.location && window.location.pathname ? window.location.pathname : null } }));
              } catch (e3) {
                try {
                  if (window && window.location) window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
                } catch (e4) {
                }
              }
            },
            children: "Login to Save"
          }
        )
      ] }),
      /* @__PURE__ */ u3("div", { "data-testid": "annotation-status", className: "vai-status", "aria-live": "polite", children: [
        annotations.length,
        " annotation",
        annotations.length !== 1 ? "s" : ""
      ] }),
      status === "ready" && /* @__PURE__ */ u3("span", { className: "vai-ready-badge", "data-testid": "gpu-ready-badge", children: "\u2713 Ready" })
    ] }),
    /* @__PURE__ */ u3(
      "div",
      {
        ref: canvasRef,
        "data-testid": "annotation-canvas",
        className: `vai-canvas ${isDrawing ? "vai-cursor-draw" : "vai-cursor-default"} ${status !== "ready" ? "vai-canvas-disabled" : ""}`,
        onMouseDown: handleMouseDown,
        onMouseMove: handleMouseMove,
        onMouseUp: handleMouseUp,
        "aria-label": "Annotation canvas",
        role: "application",
        children: [
          annotations.map((ann, i4) => /* @__PURE__ */ u3(
            "div",
            {
              ref: (el) => {
                if (el) {
                  el.style.setProperty("--vai-x", `${ann.x * 100}%`);
                  el.style.setProperty("--vai-y", `${ann.y * 100}%`);
                  el.style.setProperty("--vai-w", `${ann.width * 100}%`);
                  el.style.setProperty("--vai-h", `${ann.height * 100}%`);
                }
              },
              className: `vai-annotation-box ${ann.confirmed ? "vai-box-confirmed" : "vai-box-default"}`,
              "data-testid": `annotation-box-${i4}`
            },
            i4
          )),
          liveRect && /* @__PURE__ */ u3(
            "div",
            {
              ref: liveRectElRef,
              className: "vai-annotation-box vai-box-live",
              "data-testid": "live-rect"
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ u3("div", { "data-testid": "annotations-list", className: "vai-list", role: "list", children: annotations.map((ann, i4) => /* @__PURE__ */ u3(
      "div",
      {
        "data-testid": "annotation-item",
        className: "vai-item",
        role: "listitem",
        children: [
          /* @__PURE__ */ u3(
            "input",
            {
              "data-testid": `annotation-label-${i4}`,
              placeholder: "Label",
              value: ann.label,
              onInput: async (e3) => {
                const newAnns = [...annotations];
                const val = e3.target.value;
                newAnns[i4].label = val;
                setAnnotations(newAnns);
                try {
                  if (newAnns[i4].id) {
                    await fetch(`/manual/annotations/${newAnns[i4].id}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ label: val })
                    });
                  }
                } catch (err) {
                  console.error("Failed to update annotation label", err);
                }
              },
              className: "vai-input",
              "aria-label": `Label for annotation ${i4 + 1}`
            }
          ),
          /* @__PURE__ */ u3(
            "input",
            {
              "data-testid": `annotation-note-${i4}`,
              placeholder: "Note (optional)",
              value: ann.note,
              onInput: (e3) => {
                const newAnns = [...annotations];
                newAnns[i4].note = e3.target.value;
                setAnnotations(newAnns);
              },
              className: "vai-input",
              "aria-label": `Note for annotation ${i4 + 1}`
            }
          ),
          /* @__PURE__ */ u3(
            "button",
            {
              onClick: () => handleConfirm(i4),
              disabled: ann.confirmed,
              className: `vai-btn ${ann.confirmed ? "vai-btn-confirmed" : "vai-btn-confirm"}`,
              "data-testid": `confirm-btn-${i4}`,
              children: ann.confirmed ? "\u2713 Confirmed" : "Confirm Match"
            }
          ),
          /* @__PURE__ */ u3(
            "button",
            {
              onClick: async () => {
                const annToRemove = annotations[i4];
                if (annToRemove && annToRemove.id) {
                  try {
                    const resp = await fetch(`/manual/annotations/${annToRemove.id}`, { method: "DELETE" });
                    if (!resp.ok) throw new Error("delete failed");
                    setAnnotations(annotations.filter((_3, idx) => idx !== i4));
                  } catch (err) {
                    console.error("Failed to delete annotation", err);
                    setAnnotations(annotations.filter((_3, idx) => idx !== i4));
                  }
                } else {
                  setAnnotations(annotations.filter((_3, idx) => idx !== i4));
                }
              },
              className: "vai-btn vai-btn-danger",
              "data-testid": `remove-btn-${i4}`,
              "aria-label": `Remove annotation ${i4 + 1}`,
              children: "Remove"
            }
          )
        ]
      },
      i4
    )) }),
    /* @__PURE__ */ u3("style", { children: `
        /* Full-page blocking modal */
        .vai-fullpage-modal {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          backdrop-filter: blur(4px);
        }
        .vai-error-modal {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
        }
        .vai-modal-content {
          background: white;
          border-radius: 12px;
          padding: 32px 48px;
          text-align: center;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          max-width: 400px;
        }
        .vai-error-content {
          border: 2px solid #e74c3c;
        }
        .vai-modal-spinner {
          width: 48px;
          height: 48px;
          border: 4px solid #e0e0e0;
          border-top-color: #3498db;
          border-radius: 50%;
          animation: vai-spin 1s linear infinite;
          margin: 0 auto 16px;
        }
        .vai-modal-title {
          font-size: 1.25rem;
          font-weight: 600;
          margin: 0 0 8px;
          color: #333;
        }
        .vai-modal-text {
          color: #666;
          margin: 0 0 8px;
          font-size: 0.9rem;
        }
        .vai-modal-retry {
          color: #e67e22;
          font-size: 0.85rem;
          margin: 8px 0 0;
        }
        .vai-error-icon {
          font-size: 48px;
          margin-bottom: 12px;
        }
        .vai-retry-btn {
          background: #3498db;
          color: white;
          border: none;
          padding: 10px 24px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.95rem;
          margin-top: 16px;
          transition: background 0.2s;
        }
        .vai-retry-btn:hover {
          background: #2980b9;
        }

        /* Controls */
        .vai-controls {
          display: flex;
          gap: 8px;
          align-items: center;
          margin-bottom: 8px;
          flex-wrap: wrap;
        }
        .vai-btn {
          padding: 6px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          background: #fff;
          cursor: pointer;
          font-size: 0.9rem;
          transition: all 0.2s;
        }
        .vai-btn:hover:not(:disabled) {
          background: #f5f5f5;
        }
        .vai-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .vai-btn-active {
          background: #dc3545;
          color: white;
          border-color: #dc3545;
        }
        .vai-btn-primary {
          background: #3498db;
          color: white;
          border-color: #3498db;
        }
        .vai-btn-primary:hover:not(:disabled) {
          background: #2980b9;
        }
        .vai-btn-confirm {
          background: #27ae60;
          color: white;
          border-color: #27ae60;
        }
        .vai-btn-confirmed {
          background: #95a5a6;
          color: white;
          border-color: #95a5a6;
        }
        .vai-btn-danger {
          background: #e74c3c;
          color: white;
          border-color: #e74c3c;
        }
        .vai-btn-danger:hover:not(:disabled) {
          background: #c0392b;
        }
        .vai-status {
          margin-left: 8px;
          color: #666;
          font-size: 0.9rem;
        }
        .vai-ready-badge {
          background: #27ae60;
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 0.8rem;
          font-weight: 500;
        }

        /* Canvas */
        .vai-canvas {
          position: relative;
          border: 2px solid #ddd;
          min-height: 240px;
          height: 100%;
          touch-action: none;
          background: #fafafa;
          border-radius: 4px;
          overflow: hidden;
        }
        .vai-canvas-disabled {
          pointer-events: none;
          opacity: 0.7;
        }
        .vai-cursor-draw {
          cursor: crosshair;
        }
        .vai-cursor-default {
          cursor: default;
        }

        /* Annotation boxes */
        .vai-annotation-box {
          position: absolute;
          box-sizing: border-box;
          pointer-events: none;
          left: var(--vai-x);
          top: var(--vai-y);
          width: var(--vai-w);
          height: var(--vai-h);
        }
        .vai-box-default {
          border: 2px solid rgba(220, 20, 60, 0.9);
          background: rgba(220, 20, 60, 0.1);
        }
        .vai-box-confirmed {
          border: 2px solid #27ae60;
          background: rgba(39, 174, 96, 0.1);
        }
        .vai-box-live {
          border: 2px dashed rgba(220, 20, 60, 0.7);
          background: rgba(220, 20, 60, 0.05);
        }

        /* Annotation list */
        .vai-list {
          margin-top: 12px;
        }
        .vai-item {
          display: flex;
          gap: 8px;
          align-items: center;
          margin-bottom: 8px;
          padding: 8px;
          background: #f9f9f9;
          border-radius: 4px;
          flex-wrap: wrap;
        }
        .vai-input {
          padding: 6px 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 0.9rem;
          min-width: 120px;
        }
        .vai-input:focus {
          outline: none;
          border-color: #3498db;
        }

        @keyframes vai-spin {
          to { transform: rotate(360deg); }
        }
      ` })
  ] });
}

// src/islands/FeedbackControlsIsland.tsx
var styles = {};
try {
  styles = require_FeedbackControlsIsland();
} catch (e3) {
}
function dispatchEventSafe(name, detail) {
  if (typeof document === "undefined") return;
  if (typeof document.dispatchEvent !== "function") return;
  document.dispatchEvent(new CustomEvent(name, { detail }));
}
function FeedbackControlsIsland(props) {
  const available = props.availableComponents || ["tags", "correspondent", "document_type"];
  const [stateMap, setStateMap] = d2({});
  const [isSyncing, setIsSyncing] = d2(false);
  const refs = A2({});
  y2(() => {
    if (props.components && Array.isArray(props.components)) {
      const initial = {};
      for (const c3 of props.components) {
        initial[c3.component] = c3.feedback_type === "thumbs_up" ? "up" : "down";
      }
      setStateMap(initial);
    }
  }, [props.components]);
  y2(() => {
    available.forEach((c3) => {
      const s3 = stateMap[c3] || null;
      const r3 = refs.current[c3];
      if (r3 && r3.up) r3.up.setAttribute("aria-pressed", s3 === "up" ? "true" : "false");
      if (r3 && r3.down) r3.down.setAttribute("aria-pressed", s3 === "down" ? "true" : "false");
    });
  }, [stateMap, available]);
  const emitFeedback = q2(async (component, feedback_type) => {
    const detail = { component, feedback_type };
    if (props.documentId != null) detail.documentId = props.documentId;
    dispatchEventSafe("feedback:updated", detail);
    if (feedback_type === "thumbs_up") {
      dispatchEventSafe("feedback:confirmed", {
        component,
        documentId: props.documentId || null
      });
    }
    if (props.documentId != null) {
      setIsSyncing(true);
      try {
        await fetch("/api/visual-rag/feedback", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": `fci-${Date.now()}`
          },
          body: JSON.stringify({
            documentId: props.documentId,
            events: [{
              event_type: feedback_type === "thumbs_up" ? "verification" : "correction",
              field_name: component,
              context: { feedback_type }
            }]
          })
        });
      } catch (err) {
        console.warn("Feedback sync failed:", err);
      } finally {
        setIsSyncing(false);
      }
    }
  }, [props.documentId]);
  const handleUp = q2((component) => {
    const newState = stateMap[component] === "up" ? null : "up";
    setStateMap((prev) => ({ ...prev, [component]: newState }));
    if (newState === "up") {
      emitFeedback(component, "thumbs_up");
    }
  }, [stateMap, emitFeedback]);
  const handleDown = q2((component) => {
    const newState = stateMap[component] === "down" ? null : "down";
    setStateMap((prev) => ({ ...prev, [component]: newState }));
    if (newState === "down") {
      emitFeedback(component, "thumbs_down");
    }
  }, [stateMap, emitFeedback]);
  const getDisplayName = (component) => {
    const names = {
      tags: "Tags",
      correspondent: "Correspondent",
      document_type: "Document Type",
      content: "Content",
      title: "Title"
    };
    return names[component] || component.replace(/_/g, " ").replace(/\b\w/g, (l3) => l3.toUpperCase());
  };
  return /* @__PURE__ */ u3(
    "div",
    {
      "data-testid": "feedback-controls-island-root",
      "data-hydrated": "true",
      role: "group",
      "aria-label": "Feedback Controls",
      className: `fci-root ${styles.root ?? ""}`,
      children: [
        isSyncing && /* @__PURE__ */ u3("div", { className: "fci-sync-indicator", "data-testid": "sync-indicator", "aria-live": "polite", children: "Syncing..." }),
        /* @__PURE__ */ u3("div", { className: "fci-grid", children: available.map((c3) => /* @__PURE__ */ u3("div", { className: "fci-item", children: [
          /* @__PURE__ */ u3("span", { className: "fci-label", children: getDisplayName(c3) }),
          /* @__PURE__ */ u3("div", { className: "fci-buttons", children: [
            /* @__PURE__ */ u3(
              "button",
              {
                type: "button",
                "data-testid": `thumbs-up-${c3}`,
                ref: (el) => {
                  refs.current[c3] = Object.assign(refs.current[c3] || {}, { up: el });
                },
                className: `fci-btn fci-btn-up ${stateMap[c3] === "up" ? "fci-btn-active" : ""} ${styles.button ?? ""}`,
                onClick: () => handleUp(c3),
                title: `${getDisplayName(c3)} is correct`,
                children: "\u{1F44D}"
              }
            ),
            /* @__PURE__ */ u3(
              "button",
              {
                type: "button",
                "data-testid": `thumbs-down-${c3}`,
                ref: (el) => {
                  refs.current[c3] = Object.assign(refs.current[c3] || {}, { down: el });
                },
                className: `fci-btn fci-btn-down ${stateMap[c3] === "down" ? "fci-btn-active" : ""} ${styles.button ?? ""}`,
                onClick: () => handleDown(c3),
                title: `${getDisplayName(c3)} needs correction`,
                children: "\u{1F44E}"
              }
            )
          ] })
        ] }, c3)) }),
        /* @__PURE__ */ u3("style", { children: `
        .fci-root {
          font-family: system-ui, -apple-system, sans-serif;
          position: relative;
        }
        .fci-sync-indicator {
          position: absolute;
          top: -8px;
          right: 0;
          background: #fff3cd;
          color: #856404;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 0.75rem;
          animation: fci-pulse 1s ease infinite;
        }
        .fci-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }
        .fci-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: #f8f9fa;
          border-radius: 6px;
          border: 1px solid #e9ecef;
        }
        .fci-label {
          font-size: 0.85rem;
          font-weight: 500;
          color: #495057;
          min-width: 80px;
        }
        .fci-buttons {
          display: flex;
          gap: 4px;
        }
        .fci-btn {
          padding: 6px 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          background: #fff;
          cursor: pointer;
          font-size: 1rem;
          transition: all 0.2s;
          line-height: 1;
        }
        .fci-btn:hover {
          background: #f5f5f5;
          transform: scale(1.05);
        }
        .fci-btn-active {
          transform: scale(1.1);
        }
        .fci-btn-up.fci-btn-active {
          background: #d4edda;
          border-color: #28a745;
        }
        .fci-btn-down.fci-btn-active {
          background: #f8d7da;
          border-color: #dc3545;
        }
        @keyframes fci-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      ` })
      ]
    }
  );
}

// node_modules/zod/v3/external.js
var external_exports = {};
__export(external_exports, {
  BRAND: () => BRAND,
  DIRTY: () => DIRTY,
  EMPTY_PATH: () => EMPTY_PATH,
  INVALID: () => INVALID,
  NEVER: () => NEVER,
  OK: () => OK,
  ParseStatus: () => ParseStatus,
  Schema: () => ZodType,
  ZodAny: () => ZodAny,
  ZodArray: () => ZodArray,
  ZodBigInt: () => ZodBigInt,
  ZodBoolean: () => ZodBoolean,
  ZodBranded: () => ZodBranded,
  ZodCatch: () => ZodCatch,
  ZodDate: () => ZodDate,
  ZodDefault: () => ZodDefault,
  ZodDiscriminatedUnion: () => ZodDiscriminatedUnion,
  ZodEffects: () => ZodEffects,
  ZodEnum: () => ZodEnum,
  ZodError: () => ZodError,
  ZodFirstPartyTypeKind: () => ZodFirstPartyTypeKind,
  ZodFunction: () => ZodFunction,
  ZodIntersection: () => ZodIntersection,
  ZodIssueCode: () => ZodIssueCode,
  ZodLazy: () => ZodLazy,
  ZodLiteral: () => ZodLiteral,
  ZodMap: () => ZodMap,
  ZodNaN: () => ZodNaN,
  ZodNativeEnum: () => ZodNativeEnum,
  ZodNever: () => ZodNever,
  ZodNull: () => ZodNull,
  ZodNullable: () => ZodNullable,
  ZodNumber: () => ZodNumber,
  ZodObject: () => ZodObject,
  ZodOptional: () => ZodOptional,
  ZodParsedType: () => ZodParsedType,
  ZodPipeline: () => ZodPipeline,
  ZodPromise: () => ZodPromise,
  ZodReadonly: () => ZodReadonly,
  ZodRecord: () => ZodRecord,
  ZodSchema: () => ZodType,
  ZodSet: () => ZodSet,
  ZodString: () => ZodString,
  ZodSymbol: () => ZodSymbol,
  ZodTransformer: () => ZodEffects,
  ZodTuple: () => ZodTuple,
  ZodType: () => ZodType,
  ZodUndefined: () => ZodUndefined,
  ZodUnion: () => ZodUnion,
  ZodUnknown: () => ZodUnknown,
  ZodVoid: () => ZodVoid,
  addIssueToContext: () => addIssueToContext,
  any: () => anyType,
  array: () => arrayType,
  bigint: () => bigIntType,
  boolean: () => booleanType,
  coerce: () => coerce,
  custom: () => custom,
  date: () => dateType,
  datetimeRegex: () => datetimeRegex,
  defaultErrorMap: () => en_default,
  discriminatedUnion: () => discriminatedUnionType,
  effect: () => effectsType,
  enum: () => enumType,
  function: () => functionType,
  getErrorMap: () => getErrorMap,
  getParsedType: () => getParsedType,
  instanceof: () => instanceOfType,
  intersection: () => intersectionType,
  isAborted: () => isAborted,
  isAsync: () => isAsync,
  isDirty: () => isDirty,
  isValid: () => isValid,
  late: () => late,
  lazy: () => lazyType,
  literal: () => literalType,
  makeIssue: () => makeIssue,
  map: () => mapType,
  nan: () => nanType,
  nativeEnum: () => nativeEnumType,
  never: () => neverType,
  null: () => nullType,
  nullable: () => nullableType,
  number: () => numberType,
  object: () => objectType,
  objectUtil: () => objectUtil,
  oboolean: () => oboolean,
  onumber: () => onumber,
  optional: () => optionalType,
  ostring: () => ostring,
  pipeline: () => pipelineType,
  preprocess: () => preprocessType,
  promise: () => promiseType,
  quotelessJson: () => quotelessJson,
  record: () => recordType,
  set: () => setType,
  setErrorMap: () => setErrorMap,
  strictObject: () => strictObjectType,
  string: () => stringType,
  symbol: () => symbolType,
  transformer: () => effectsType,
  tuple: () => tupleType,
  undefined: () => undefinedType,
  union: () => unionType,
  unknown: () => unknownType,
  util: () => util,
  void: () => voidType
});

// node_modules/zod/v3/helpers/util.js
var util;
(function(util2) {
  util2.assertEqual = (_3) => {
  };
  function assertIs(_arg) {
  }
  util2.assertIs = assertIs;
  function assertNever(_x) {
    throw new Error();
  }
  util2.assertNever = assertNever;
  util2.arrayToEnum = (items) => {
    const obj = {};
    for (const item of items) {
      obj[item] = item;
    }
    return obj;
  };
  util2.getValidEnumValues = (obj) => {
    const validKeys = util2.objectKeys(obj).filter((k4) => typeof obj[obj[k4]] !== "number");
    const filtered = {};
    for (const k4 of validKeys) {
      filtered[k4] = obj[k4];
    }
    return util2.objectValues(filtered);
  };
  util2.objectValues = (obj) => {
    return util2.objectKeys(obj).map(function(e3) {
      return obj[e3];
    });
  };
  util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
    const keys = [];
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        keys.push(key);
      }
    }
    return keys;
  };
  util2.find = (arr, checker) => {
    for (const item of arr) {
      if (checker(item))
        return item;
    }
    return void 0;
  };
  util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
  function joinValues(array, separator = " | ") {
    return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
  }
  util2.joinValues = joinValues;
  util2.jsonStringifyReplacer = (_3, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  };
})(util || (util = {}));
var objectUtil;
(function(objectUtil2) {
  objectUtil2.mergeShapes = (first, second) => {
    return {
      ...first,
      ...second
      // second overwrites first
    };
  };
})(objectUtil || (objectUtil = {}));
var ZodParsedType = util.arrayToEnum([
  "string",
  "nan",
  "number",
  "integer",
  "float",
  "boolean",
  "date",
  "bigint",
  "symbol",
  "function",
  "undefined",
  "null",
  "array",
  "object",
  "unknown",
  "promise",
  "void",
  "never",
  "map",
  "set"
]);
var getParsedType = (data) => {
  const t3 = typeof data;
  switch (t3) {
    case "undefined":
      return ZodParsedType.undefined;
    case "string":
      return ZodParsedType.string;
    case "number":
      return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
    case "boolean":
      return ZodParsedType.boolean;
    case "function":
      return ZodParsedType.function;
    case "bigint":
      return ZodParsedType.bigint;
    case "symbol":
      return ZodParsedType.symbol;
    case "object":
      if (Array.isArray(data)) {
        return ZodParsedType.array;
      }
      if (data === null) {
        return ZodParsedType.null;
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return ZodParsedType.promise;
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return ZodParsedType.map;
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return ZodParsedType.set;
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return ZodParsedType.date;
      }
      return ZodParsedType.object;
    default:
      return ZodParsedType.unknown;
  }
};

// node_modules/zod/v3/ZodError.js
var ZodIssueCode = util.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite"
]);
var quotelessJson = (obj) => {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/"([^"]+)":/g, "$1:");
};
var ZodError = class _ZodError extends Error {
  get errors() {
    return this.issues;
  }
  constructor(issues) {
    super();
    this.issues = [];
    this.addIssue = (sub) => {
      this.issues = [...this.issues, sub];
    };
    this.addIssues = (subs = []) => {
      this.issues = [...this.issues, ...subs];
    };
    const actualProto = new.target.prototype;
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
    this.name = "ZodError";
    this.issues = issues;
  }
  format(_mapper) {
    const mapper = _mapper || function(issue) {
      return issue.message;
    };
    const fieldErrors = { _errors: [] };
    const processError = (error) => {
      for (const issue of error.issues) {
        if (issue.code === "invalid_union") {
          issue.unionErrors.map(processError);
        } else if (issue.code === "invalid_return_type") {
          processError(issue.returnTypeError);
        } else if (issue.code === "invalid_arguments") {
          processError(issue.argumentsError);
        } else if (issue.path.length === 0) {
          fieldErrors._errors.push(mapper(issue));
        } else {
          let curr = fieldErrors;
          let i4 = 0;
          while (i4 < issue.path.length) {
            const el = issue.path[i4];
            const terminal = i4 === issue.path.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue));
            }
            curr = curr[el];
            i4++;
          }
        }
      }
    };
    processError(this);
    return fieldErrors;
  }
  static assert(value) {
    if (!(value instanceof _ZodError)) {
      throw new Error(`Not a ZodError: ${value}`);
    }
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(mapper = (issue) => issue.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub of this.issues) {
      if (sub.path.length > 0) {
        const firstEl = sub.path[0];
        fieldErrors[firstEl] = fieldErrors[firstEl] || [];
        fieldErrors[firstEl].push(mapper(sub));
      } else {
        formErrors.push(mapper(sub));
      }
    }
    return { formErrors, fieldErrors };
  }
  get formErrors() {
    return this.flatten();
  }
};
ZodError.create = (issues) => {
  const error = new ZodError(issues);
  return error;
};

// node_modules/zod/v3/locales/en.js
var errorMap = (issue, _ctx) => {
  let message;
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === ZodParsedType.undefined) {
        message = "Required";
      } else {
        message = `Expected ${issue.expected}, received ${issue.received}`;
      }
      break;
    case ZodIssueCode.invalid_literal:
      message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode.unrecognized_keys:
      message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
      break;
    case ZodIssueCode.invalid_union:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_union_discriminator:
      message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
      break;
    case ZodIssueCode.invalid_enum_value:
      message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
      break;
    case ZodIssueCode.invalid_arguments:
      message = `Invalid function arguments`;
      break;
    case ZodIssueCode.invalid_return_type:
      message = `Invalid function return type`;
      break;
    case ZodIssueCode.invalid_date:
      message = `Invalid date`;
      break;
    case ZodIssueCode.invalid_string:
      if (typeof issue.validation === "object") {
        if ("includes" in issue.validation) {
          message = `Invalid input: must include "${issue.validation.includes}"`;
          if (typeof issue.validation.position === "number") {
            message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
          }
        } else if ("startsWith" in issue.validation) {
          message = `Invalid input: must start with "${issue.validation.startsWith}"`;
        } else if ("endsWith" in issue.validation) {
          message = `Invalid input: must end with "${issue.validation.endsWith}"`;
        } else {
          util.assertNever(issue.validation);
        }
      } else if (issue.validation !== "regex") {
        message = `Invalid ${issue.validation}`;
      } else {
        message = "Invalid";
      }
      break;
    case ZodIssueCode.too_small:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "bigint")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.too_big:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "bigint")
        message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.custom:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_intersection_types:
      message = `Intersection results could not be merged`;
      break;
    case ZodIssueCode.not_multiple_of:
      message = `Number must be a multiple of ${issue.multipleOf}`;
      break;
    case ZodIssueCode.not_finite:
      message = "Number must be finite";
      break;
    default:
      message = _ctx.defaultError;
      util.assertNever(issue);
  }
  return { message };
};
var en_default = errorMap;

// node_modules/zod/v3/errors.js
var overrideErrorMap = en_default;
function setErrorMap(map) {
  overrideErrorMap = map;
}
function getErrorMap() {
  return overrideErrorMap;
}

// node_modules/zod/v3/helpers/parseUtil.js
var makeIssue = (params) => {
  const { data, path, errorMaps, issueData } = params;
  const fullPath = [...path, ...issueData.path || []];
  const fullIssue = {
    ...issueData,
    path: fullPath
  };
  if (issueData.message !== void 0) {
    return {
      ...issueData,
      path: fullPath,
      message: issueData.message
    };
  }
  let errorMessage = "";
  const maps = errorMaps.filter((m3) => !!m3).slice().reverse();
  for (const map of maps) {
    errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
  }
  return {
    ...issueData,
    path: fullPath,
    message: errorMessage
  };
};
var EMPTY_PATH = [];
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      // contextual error map is first priority
      ctx.schemaErrorMap,
      // then schema-bound map if available
      overrideMap,
      // then global override map
      overrideMap === en_default ? void 0 : en_default
      // then global default map
    ].filter((x4) => !!x4)
  });
  ctx.common.issues.push(issue);
}
var ParseStatus = class _ParseStatus {
  constructor() {
    this.value = "valid";
  }
  dirty() {
    if (this.value === "valid")
      this.value = "dirty";
  }
  abort() {
    if (this.value !== "aborted")
      this.value = "aborted";
  }
  static mergeArray(status, results) {
    const arrayValue = [];
    for (const s3 of results) {
      if (s3.status === "aborted")
        return INVALID;
      if (s3.status === "dirty")
        status.dirty();
      arrayValue.push(s3.value);
    }
    return { status: status.value, value: arrayValue };
  }
  static async mergeObjectAsync(status, pairs) {
    const syncPairs = [];
    for (const pair of pairs) {
      const key = await pair.key;
      const value = await pair.value;
      syncPairs.push({
        key,
        value
      });
    }
    return _ParseStatus.mergeObjectSync(status, syncPairs);
  }
  static mergeObjectSync(status, pairs) {
    const finalObject = {};
    for (const pair of pairs) {
      const { key, value } = pair;
      if (key.status === "aborted")
        return INVALID;
      if (value.status === "aborted")
        return INVALID;
      if (key.status === "dirty")
        status.dirty();
      if (value.status === "dirty")
        status.dirty();
      if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
        finalObject[key.value] = value.value;
      }
    }
    return { status: status.value, value: finalObject };
  }
};
var INVALID = Object.freeze({
  status: "aborted"
});
var DIRTY = (value) => ({ status: "dirty", value });
var OK = (value) => ({ status: "valid", value });
var isAborted = (x4) => x4.status === "aborted";
var isDirty = (x4) => x4.status === "dirty";
var isValid = (x4) => x4.status === "valid";
var isAsync = (x4) => typeof Promise !== "undefined" && x4 instanceof Promise;

// node_modules/zod/v3/helpers/errorUtil.js
var errorUtil;
(function(errorUtil2) {
  errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
  errorUtil2.toString = (message) => typeof message === "string" ? message : message?.message;
})(errorUtil || (errorUtil = {}));

// node_modules/zod/v3/types.js
var ParseInputLazyPath = class {
  constructor(parent, value, path, key) {
    this._cachedPath = [];
    this.parent = parent;
    this.data = value;
    this._path = path;
    this._key = key;
  }
  get path() {
    if (!this._cachedPath.length) {
      if (Array.isArray(this._key)) {
        this._cachedPath.push(...this._path, ...this._key);
      } else {
        this._cachedPath.push(...this._path, this._key);
      }
    }
    return this._cachedPath;
  }
};
var handleResult = (ctx, result) => {
  if (isValid(result)) {
    return { success: true, data: result.value };
  } else {
    if (!ctx.common.issues.length) {
      throw new Error("Validation failed but no issues detected.");
    }
    return {
      success: false,
      get error() {
        if (this._error)
          return this._error;
        const error = new ZodError(ctx.common.issues);
        this._error = error;
        return this._error;
      }
    };
  }
};
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap2)
    return { errorMap: errorMap2, description };
  const customMap = (iss, ctx) => {
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message ?? ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: message ?? required_error ?? ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: message ?? invalid_type_error ?? ctx.defaultError };
  };
  return { errorMap: customMap, description };
}
var ZodType = class {
  get description() {
    return this._def.description;
  }
  _getType(input) {
    return getParsedType(input.data);
  }
  _getOrReturnCtx(input, ctx) {
    return ctx || {
      common: input.parent.common,
      data: input.data,
      parsedType: getParsedType(input.data),
      schemaErrorMap: this._def.errorMap,
      path: input.path,
      parent: input.parent
    };
  }
  _processInputParams(input) {
    return {
      status: new ParseStatus(),
      ctx: {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      }
    };
  }
  _parseSync(input) {
    const result = this._parse(input);
    if (isAsync(result)) {
      throw new Error("Synchronous parse encountered promise.");
    }
    return result;
  }
  _parseAsync(input) {
    const result = this._parse(input);
    return Promise.resolve(result);
  }
  parse(data, params) {
    const result = this.safeParse(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  safeParse(data, params) {
    const ctx = {
      common: {
        issues: [],
        async: params?.async ?? false,
        contextualErrorMap: params?.errorMap
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const result = this._parseSync({ data, path: ctx.path, parent: ctx });
    return handleResult(ctx, result);
  }
  "~validate"(data) {
    const ctx = {
      common: {
        issues: [],
        async: !!this["~standard"].async
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    if (!this["~standard"].async) {
      try {
        const result = this._parseSync({ data, path: [], parent: ctx });
        return isValid(result) ? {
          value: result.value
        } : {
          issues: ctx.common.issues
        };
      } catch (err) {
        if (err?.message?.toLowerCase()?.includes("encountered")) {
          this["~standard"].async = true;
        }
        ctx.common = {
          issues: [],
          async: true
        };
      }
    }
    return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
      value: result.value
    } : {
      issues: ctx.common.issues
    });
  }
  async parseAsync(data, params) {
    const result = await this.safeParseAsync(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  async safeParseAsync(data, params) {
    const ctx = {
      common: {
        issues: [],
        contextualErrorMap: params?.errorMap,
        async: true
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
    const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
    return handleResult(ctx, result);
  }
  refine(check, message) {
    const getIssueProperties = (val) => {
      if (typeof message === "string" || typeof message === "undefined") {
        return { message };
      } else if (typeof message === "function") {
        return message(val);
      } else {
        return message;
      }
    };
    return this._refinement((val, ctx) => {
      const result = check(val);
      const setError = () => ctx.addIssue({
        code: ZodIssueCode.custom,
        ...getIssueProperties(val)
      });
      if (typeof Promise !== "undefined" && result instanceof Promise) {
        return result.then((data) => {
          if (!data) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      if (!result) {
        setError();
        return false;
      } else {
        return true;
      }
    });
  }
  refinement(check, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check(val)) {
        ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
        return false;
      } else {
        return true;
      }
    });
  }
  _refinement(refinement) {
    return new ZodEffects({
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "refinement", refinement }
    });
  }
  superRefine(refinement) {
    return this._refinement(refinement);
  }
  constructor(def) {
    this.spa = this.safeParseAsync;
    this._def = def;
    this.parse = this.parse.bind(this);
    this.safeParse = this.safeParse.bind(this);
    this.parseAsync = this.parseAsync.bind(this);
    this.safeParseAsync = this.safeParseAsync.bind(this);
    this.spa = this.spa.bind(this);
    this.refine = this.refine.bind(this);
    this.refinement = this.refinement.bind(this);
    this.superRefine = this.superRefine.bind(this);
    this.optional = this.optional.bind(this);
    this.nullable = this.nullable.bind(this);
    this.nullish = this.nullish.bind(this);
    this.array = this.array.bind(this);
    this.promise = this.promise.bind(this);
    this.or = this.or.bind(this);
    this.and = this.and.bind(this);
    this.transform = this.transform.bind(this);
    this.brand = this.brand.bind(this);
    this.default = this.default.bind(this);
    this.catch = this.catch.bind(this);
    this.describe = this.describe.bind(this);
    this.pipe = this.pipe.bind(this);
    this.readonly = this.readonly.bind(this);
    this.isNullable = this.isNullable.bind(this);
    this.isOptional = this.isOptional.bind(this);
    this["~standard"] = {
      version: 1,
      vendor: "zod",
      validate: (data) => this["~validate"](data)
    };
  }
  optional() {
    return ZodOptional.create(this, this._def);
  }
  nullable() {
    return ZodNullable.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return ZodArray.create(this);
  }
  promise() {
    return ZodPromise.create(this, this._def);
  }
  or(option) {
    return ZodUnion.create([this, option], this._def);
  }
  and(incoming) {
    return ZodIntersection.create(this, incoming, this._def);
  }
  transform(transform) {
    return new ZodEffects({
      ...processCreateParams(this._def),
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "transform", transform }
    });
  }
  default(def) {
    const defaultValueFunc = typeof def === "function" ? def : () => def;
    return new ZodDefault({
      ...processCreateParams(this._def),
      innerType: this,
      defaultValue: defaultValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodDefault
    });
  }
  brand() {
    return new ZodBranded({
      typeName: ZodFirstPartyTypeKind.ZodBranded,
      type: this,
      ...processCreateParams(this._def)
    });
  }
  catch(def) {
    const catchValueFunc = typeof def === "function" ? def : () => def;
    return new ZodCatch({
      ...processCreateParams(this._def),
      innerType: this,
      catchValue: catchValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodCatch
    });
  }
  describe(description) {
    const This = this.constructor;
    return new This({
      ...this._def,
      description
    });
  }
  pipe(target) {
    return ZodPipeline.create(this, target);
  }
  readonly() {
    return ZodReadonly.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
};
var cuidRegex = /^c[^\s-]{8,}$/i;
var cuid2Regex = /^[0-9a-z]+$/;
var ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
var uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
var nanoidRegex = /^[a-z0-9_-]{21}$/i;
var jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
var durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
var emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
var _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
var emojiRegex;
var ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
var ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
var ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
var base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
var dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
var dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(args) {
  let secondsRegexSource = `[0-5]\\d`;
  if (args.precision) {
    secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
  }
  const secondsQuantifier = args.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
function isValidJWT(jwt, alg) {
  if (!jwtRegex.test(jwt))
    return false;
  try {
    const [header] = jwt.split(".");
    if (!header)
      return false;
    const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
    const decoded = JSON.parse(atob(base64));
    if (typeof decoded !== "object" || decoded === null)
      return false;
    if ("typ" in decoded && decoded?.typ !== "JWT")
      return false;
    if (!decoded.alg)
      return false;
    if (alg && decoded.alg !== alg)
      return false;
    return true;
  } catch {
    return false;
  }
}
function isValidCidr(ip, version) {
  if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
    return true;
  }
  return false;
}
var ZodString = class _ZodString extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = String(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.string) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.string,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.length < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.length > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "length") {
        const tooBig = input.data.length > check.value;
        const tooSmall = input.data.length < check.value;
        if (tooBig || tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          if (tooBig) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          } else if (tooSmall) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          }
          status.dirty();
        }
      } else if (check.kind === "email") {
        if (!emailRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "email",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "emoji") {
        if (!emojiRegex) {
          emojiRegex = new RegExp(_emojiRegex, "u");
        }
        if (!emojiRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "emoji",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "uuid") {
        if (!uuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "uuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "nanoid") {
        if (!nanoidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "nanoid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid") {
        if (!cuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid2") {
        if (!cuid2Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid2",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ulid") {
        if (!ulidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ulid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "url") {
        try {
          new URL(input.data);
        } catch {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "regex") {
        check.regex.lastIndex = 0;
        const testResult = check.regex.test(input.data);
        if (!testResult) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "regex",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "trim") {
        input.data = input.data.trim();
      } else if (check.kind === "includes") {
        if (!input.data.includes(check.value, check.position)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { includes: check.value, position: check.position },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "toLowerCase") {
        input.data = input.data.toLowerCase();
      } else if (check.kind === "toUpperCase") {
        input.data = input.data.toUpperCase();
      } else if (check.kind === "startsWith") {
        if (!input.data.startsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { startsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "endsWith") {
        if (!input.data.endsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { endsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "datetime") {
        const regex = datetimeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "datetime",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "date") {
        const regex = dateRegex;
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "date",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "time") {
        const regex = timeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "time",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "duration") {
        if (!durationRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "duration",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ip") {
        if (!isValidIP(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ip",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "jwt") {
        if (!isValidJWT(input.data, check.alg)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "jwt",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cidr") {
        if (!isValidCidr(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cidr",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64") {
        if (!base64Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64url") {
        if (!base64urlRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _regex(regex, validation, message) {
    return this.refinement((data) => regex.test(data), {
      validation,
      code: ZodIssueCode.invalid_string,
      ...errorUtil.errToObj(message)
    });
  }
  _addCheck(check) {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  email(message) {
    return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
  }
  url(message) {
    return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
  }
  emoji(message) {
    return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
  }
  uuid(message) {
    return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
  }
  nanoid(message) {
    return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
  }
  cuid(message) {
    return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
  }
  cuid2(message) {
    return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
  }
  ulid(message) {
    return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
  }
  base64(message) {
    return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
  }
  base64url(message) {
    return this._addCheck({
      kind: "base64url",
      ...errorUtil.errToObj(message)
    });
  }
  jwt(options) {
    return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
  }
  ip(options) {
    return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
  }
  cidr(options) {
    return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
  }
  datetime(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "datetime",
        precision: null,
        offset: false,
        local: false,
        message: options
      });
    }
    return this._addCheck({
      kind: "datetime",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      offset: options?.offset ?? false,
      local: options?.local ?? false,
      ...errorUtil.errToObj(options?.message)
    });
  }
  date(message) {
    return this._addCheck({ kind: "date", message });
  }
  time(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "time",
        precision: null,
        message: options
      });
    }
    return this._addCheck({
      kind: "time",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      ...errorUtil.errToObj(options?.message)
    });
  }
  duration(message) {
    return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
  }
  regex(regex, message) {
    return this._addCheck({
      kind: "regex",
      regex,
      ...errorUtil.errToObj(message)
    });
  }
  includes(value, options) {
    return this._addCheck({
      kind: "includes",
      value,
      position: options?.position,
      ...errorUtil.errToObj(options?.message)
    });
  }
  startsWith(value, message) {
    return this._addCheck({
      kind: "startsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  endsWith(value, message) {
    return this._addCheck({
      kind: "endsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  min(minLength, message) {
    return this._addCheck({
      kind: "min",
      value: minLength,
      ...errorUtil.errToObj(message)
    });
  }
  max(maxLength, message) {
    return this._addCheck({
      kind: "max",
      value: maxLength,
      ...errorUtil.errToObj(message)
    });
  }
  length(len, message) {
    return this._addCheck({
      kind: "length",
      value: len,
      ...errorUtil.errToObj(message)
    });
  }
  /**
   * Equivalent to `.min(1)`
   */
  nonempty(message) {
    return this.min(1, errorUtil.errToObj(message));
  }
  trim() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toUpperCase" }]
    });
  }
  get isDatetime() {
    return !!this._def.checks.find((ch) => ch.kind === "datetime");
  }
  get isDate() {
    return !!this._def.checks.find((ch) => ch.kind === "date");
  }
  get isTime() {
    return !!this._def.checks.find((ch) => ch.kind === "time");
  }
  get isDuration() {
    return !!this._def.checks.find((ch) => ch.kind === "duration");
  }
  get isEmail() {
    return !!this._def.checks.find((ch) => ch.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((ch) => ch.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((ch) => ch.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((ch) => ch.kind === "uuid");
  }
  get isNANOID() {
    return !!this._def.checks.find((ch) => ch.kind === "nanoid");
  }
  get isCUID() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((ch) => ch.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((ch) => ch.kind === "ip");
  }
  get isCIDR() {
    return !!this._def.checks.find((ch) => ch.kind === "cidr");
  }
  get isBase64() {
    return !!this._def.checks.find((ch) => ch.kind === "base64");
  }
  get isBase64url() {
    return !!this._def.checks.find((ch) => ch.kind === "base64url");
  }
  get minLength() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxLength() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodString.create = (params) => {
  return new ZodString({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodString,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / 10 ** decCount;
}
var ZodNumber = class _ZodNumber extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
    this.step = this.multipleOf;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = Number(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.number) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.number,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "int") {
        if (!util.isInteger(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: "integer",
            received: "float",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (floatSafeRemainder(input.data, check.value) !== 0) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "finite") {
        if (!Number.isFinite(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_finite,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodNumber({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodNumber({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  int(message) {
    return this._addCheck({
      kind: "int",
      message: errorUtil.toString(message)
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  finite(message) {
    return this._addCheck({
      kind: "finite",
      message: errorUtil.toString(message)
    });
  }
  safe(message) {
    return this._addCheck({
      kind: "min",
      inclusive: true,
      value: Number.MIN_SAFE_INTEGER,
      message: errorUtil.toString(message)
    })._addCheck({
      kind: "max",
      inclusive: true,
      value: Number.MAX_SAFE_INTEGER,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
  get isInt() {
    return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
  }
  get isFinite() {
    let max = null;
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
        return true;
      } else if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      } else if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return Number.isFinite(min) && Number.isFinite(max);
  }
};
ZodNumber.create = (params) => {
  return new ZodNumber({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodNumber,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodBigInt = class _ZodBigInt extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
  }
  _parse(input) {
    if (this._def.coerce) {
      try {
        input.data = BigInt(input.data);
      } catch {
        return this._getInvalidInput(input);
      }
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.bigint) {
      return this._getInvalidInput(input);
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            type: "bigint",
            minimum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            type: "bigint",
            maximum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (input.data % check.value !== BigInt(0)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _getInvalidInput(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.bigint,
      received: ctx.parsedType
    });
    return INVALID;
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodBigInt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodBigInt({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodBigInt.create = (params) => {
  return new ZodBigInt({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodBigInt,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
var ZodBoolean = class extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = Boolean(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.boolean) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.boolean,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodBoolean.create = (params) => {
  return new ZodBoolean({
    typeName: ZodFirstPartyTypeKind.ZodBoolean,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodDate = class _ZodDate extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = new Date(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.date) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.date,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    if (Number.isNaN(input.data.getTime())) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_date
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.getTime() < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            message: check.message,
            inclusive: true,
            exact: false,
            minimum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.getTime() > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            message: check.message,
            inclusive: true,
            exact: false,
            maximum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return {
      status: status.value,
      value: new Date(input.data.getTime())
    };
  }
  _addCheck(check) {
    return new _ZodDate({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  min(minDate, message) {
    return this._addCheck({
      kind: "min",
      value: minDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  max(maxDate, message) {
    return this._addCheck({
      kind: "max",
      value: maxDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  get minDate() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min != null ? new Date(min) : null;
  }
  get maxDate() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max != null ? new Date(max) : null;
  }
};
ZodDate.create = (params) => {
  return new ZodDate({
    checks: [],
    coerce: params?.coerce || false,
    typeName: ZodFirstPartyTypeKind.ZodDate,
    ...processCreateParams(params)
  });
};
var ZodSymbol = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.symbol) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.symbol,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodSymbol.create = (params) => {
  return new ZodSymbol({
    typeName: ZodFirstPartyTypeKind.ZodSymbol,
    ...processCreateParams(params)
  });
};
var ZodUndefined = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.undefined,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodUndefined.create = (params) => {
  return new ZodUndefined({
    typeName: ZodFirstPartyTypeKind.ZodUndefined,
    ...processCreateParams(params)
  });
};
var ZodNull = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.null) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.null,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodNull.create = (params) => {
  return new ZodNull({
    typeName: ZodFirstPartyTypeKind.ZodNull,
    ...processCreateParams(params)
  });
};
var ZodAny = class extends ZodType {
  constructor() {
    super(...arguments);
    this._any = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodAny.create = (params) => {
  return new ZodAny({
    typeName: ZodFirstPartyTypeKind.ZodAny,
    ...processCreateParams(params)
  });
};
var ZodUnknown = class extends ZodType {
  constructor() {
    super(...arguments);
    this._unknown = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodUnknown.create = (params) => {
  return new ZodUnknown({
    typeName: ZodFirstPartyTypeKind.ZodUnknown,
    ...processCreateParams(params)
  });
};
var ZodNever = class extends ZodType {
  _parse(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.never,
      received: ctx.parsedType
    });
    return INVALID;
  }
};
ZodNever.create = (params) => {
  return new ZodNever({
    typeName: ZodFirstPartyTypeKind.ZodNever,
    ...processCreateParams(params)
  });
};
var ZodVoid = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.void,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodVoid.create = (params) => {
  return new ZodVoid({
    typeName: ZodFirstPartyTypeKind.ZodVoid,
    ...processCreateParams(params)
  });
};
var ZodArray = class _ZodArray extends ZodType {
  _parse(input) {
    const { ctx, status } = this._processInputParams(input);
    const def = this._def;
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (def.exactLength !== null) {
      const tooBig = ctx.data.length > def.exactLength.value;
      const tooSmall = ctx.data.length < def.exactLength.value;
      if (tooBig || tooSmall) {
        addIssueToContext(ctx, {
          code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
          minimum: tooSmall ? def.exactLength.value : void 0,
          maximum: tooBig ? def.exactLength.value : void 0,
          type: "array",
          inclusive: true,
          exact: true,
          message: def.exactLength.message
        });
        status.dirty();
      }
    }
    if (def.minLength !== null) {
      if (ctx.data.length < def.minLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.minLength.message
        });
        status.dirty();
      }
    }
    if (def.maxLength !== null) {
      if (ctx.data.length > def.maxLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.maxLength.message
        });
        status.dirty();
      }
    }
    if (ctx.common.async) {
      return Promise.all([...ctx.data].map((item, i4) => {
        return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i4));
      })).then((result2) => {
        return ParseStatus.mergeArray(status, result2);
      });
    }
    const result = [...ctx.data].map((item, i4) => {
      return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i4));
    });
    return ParseStatus.mergeArray(status, result);
  }
  get element() {
    return this._def.type;
  }
  min(minLength, message) {
    return new _ZodArray({
      ...this._def,
      minLength: { value: minLength, message: errorUtil.toString(message) }
    });
  }
  max(maxLength, message) {
    return new _ZodArray({
      ...this._def,
      maxLength: { value: maxLength, message: errorUtil.toString(message) }
    });
  }
  length(len, message) {
    return new _ZodArray({
      ...this._def,
      exactLength: { value: len, message: errorUtil.toString(message) }
    });
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodArray.create = (schema, params) => {
  return new ZodArray({
    type: schema,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind.ZodArray,
    ...processCreateParams(params)
  });
};
function deepPartialify(schema) {
  if (schema instanceof ZodObject) {
    const newShape = {};
    for (const key in schema.shape) {
      const fieldSchema = schema.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema._def,
      shape: () => newShape
    });
  } else if (schema instanceof ZodArray) {
    return new ZodArray({
      ...schema._def,
      type: deepPartialify(schema.element)
    });
  } else if (schema instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodTuple) {
    return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
  } else {
    return schema;
  }
}
var ZodObject = class _ZodObject extends ZodType {
  constructor() {
    super(...arguments);
    this._cached = null;
    this.nonstrict = this.passthrough;
    this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const shape = this._def.shape();
    const keys = util.objectKeys(shape);
    this._cached = { shape, keys };
    return this._cached;
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.object) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const { status, ctx } = this._processInputParams(input);
    const { shape, keys: shapeKeys } = this._getCached();
    const extraKeys = [];
    if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.push(key);
        }
      }
    }
    const pairs = [];
    for (const key of shapeKeys) {
      const keyValidator = shape[key];
      const value = ctx.data[key];
      pairs.push({
        key: { status: "valid", value: key },
        value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (this._def.catchall instanceof ZodNever) {
      const unknownKeys = this._def.unknownKeys;
      if (unknownKeys === "passthrough") {
        for (const key of extraKeys) {
          pairs.push({
            key: { status: "valid", value: key },
            value: { status: "valid", value: ctx.data[key] }
          });
        }
      } else if (unknownKeys === "strict") {
        if (extraKeys.length > 0) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.unrecognized_keys,
            keys: extraKeys
          });
          status.dirty();
        }
      } else if (unknownKeys === "strip") {
      } else {
        throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
      }
    } else {
      const catchall = this._def.catchall;
      for (const key of extraKeys) {
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: catchall._parse(
            new ParseInputLazyPath(ctx, value, ctx.path, key)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: key in ctx.data
        });
      }
    }
    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        const syncPairs = [];
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key,
            value,
            alwaysSet: pair.alwaysSet
          });
        }
        return syncPairs;
      }).then((syncPairs) => {
        return ParseStatus.mergeObjectSync(status, syncPairs);
      });
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get shape() {
    return this._def.shape();
  }
  strict(message) {
    errorUtil.errToObj;
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strict",
      ...message !== void 0 ? {
        errorMap: (issue, ctx) => {
          const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
          if (issue.code === "unrecognized_keys")
            return {
              message: errorUtil.errToObj(message).message ?? defaultError
            };
          return {
            message: defaultError
          };
        }
      } : {}
    });
  }
  strip() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "passthrough"
    });
  }
  // const AugmentFactory =
  //   <Def extends ZodObjectDef>(def: Def) =>
  //   <Augmentation extends ZodRawShape>(
  //     augmentation: Augmentation
  //   ): ZodObject<
  //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
  //     Def["unknownKeys"],
  //     Def["catchall"]
  //   > => {
  //     return new ZodObject({
  //       ...def,
  //       shape: () => ({
  //         ...def.shape(),
  //         ...augmentation,
  //       }),
  //     }) as any;
  //   };
  extend(augmentation) {
    return new _ZodObject({
      ...this._def,
      shape: () => ({
        ...this._def.shape(),
        ...augmentation
      })
    });
  }
  /**
   * Prior to zod@1.0.12 there was a bug in the
   * inferred type of merged objects. Please
   * upgrade if you are experiencing issues.
   */
  merge(merging) {
    const merged = new _ZodObject({
      unknownKeys: merging._def.unknownKeys,
      catchall: merging._def.catchall,
      shape: () => ({
        ...this._def.shape(),
        ...merging._def.shape()
      }),
      typeName: ZodFirstPartyTypeKind.ZodObject
    });
    return merged;
  }
  // merge<
  //   Incoming extends AnyZodObject,
  //   Augmentation extends Incoming["shape"],
  //   NewOutput extends {
  //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
  //       ? Augmentation[k]["_output"]
  //       : k extends keyof Output
  //       ? Output[k]
  //       : never;
  //   },
  //   NewInput extends {
  //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
  //       ? Augmentation[k]["_input"]
  //       : k extends keyof Input
  //       ? Input[k]
  //       : never;
  //   }
  // >(
  //   merging: Incoming
  // ): ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"],
  //   NewOutput,
  //   NewInput
  // > {
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  setKey(key, schema) {
    return this.augment({ [key]: schema });
  }
  // merge<Incoming extends AnyZodObject>(
  //   merging: Incoming
  // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
  // ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"]
  // > {
  //   // const mergedShape = objectUtil.mergeShapes(
  //   //   this._def.shape(),
  //   //   merging._def.shape()
  //   // );
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  catchall(index) {
    return new _ZodObject({
      ...this._def,
      catchall: index
    });
  }
  pick(mask) {
    const shape = {};
    for (const key of util.objectKeys(mask)) {
      if (mask[key] && this.shape[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  omit(mask) {
    const shape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (!mask[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  /**
   * @deprecated
   */
  deepPartial() {
    return deepPartialify(this);
  }
  partial(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      const fieldSchema = this.shape[key];
      if (mask && !mask[key]) {
        newShape[key] = fieldSchema;
      } else {
        newShape[key] = fieldSchema.optional();
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  required(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (mask && !mask[key]) {
        newShape[key] = this.shape[key];
      } else {
        const fieldSchema = this.shape[key];
        let newField = fieldSchema;
        while (newField instanceof ZodOptional) {
          newField = newField._def.innerType;
        }
        newShape[key] = newField;
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  keyof() {
    return createZodEnum(util.objectKeys(this.shape));
  }
};
ZodObject.create = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.strictCreate = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strict",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.lazycreate = (shape, params) => {
  return new ZodObject({
    shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
var ZodUnion = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const options = this._def.options;
    function handleResults(results) {
      for (const result of results) {
        if (result.result.status === "valid") {
          return result.result;
        }
      }
      for (const result of results) {
        if (result.result.status === "dirty") {
          ctx.common.issues.push(...result.ctx.common.issues);
          return result.result;
        }
      }
      const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return Promise.all(options.map(async (option) => {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          }),
          ctx: childCtx
        };
      })).then(handleResults);
    } else {
      let dirty = void 0;
      const issues = [];
      for (const option of options) {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        const result = option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: childCtx
        });
        if (result.status === "valid") {
          return result;
        } else if (result.status === "dirty" && !dirty) {
          dirty = { result, ctx: childCtx };
        }
        if (childCtx.common.issues.length) {
          issues.push(childCtx.common.issues);
        }
      }
      if (dirty) {
        ctx.common.issues.push(...dirty.ctx.common.issues);
        return dirty.result;
      }
      const unionErrors = issues.map((issues2) => new ZodError(issues2));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
  }
  get options() {
    return this._def.options;
  }
};
ZodUnion.create = (types, params) => {
  return new ZodUnion({
    options: types,
    typeName: ZodFirstPartyTypeKind.ZodUnion,
    ...processCreateParams(params)
  });
};
var getDiscriminator = (type) => {
  if (type instanceof ZodLazy) {
    return getDiscriminator(type.schema);
  } else if (type instanceof ZodEffects) {
    return getDiscriminator(type.innerType());
  } else if (type instanceof ZodLiteral) {
    return [type.value];
  } else if (type instanceof ZodEnum) {
    return type.options;
  } else if (type instanceof ZodNativeEnum) {
    return util.objectValues(type.enum);
  } else if (type instanceof ZodDefault) {
    return getDiscriminator(type._def.innerType);
  } else if (type instanceof ZodUndefined) {
    return [void 0];
  } else if (type instanceof ZodNull) {
    return [null];
  } else if (type instanceof ZodOptional) {
    return [void 0, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodNullable) {
    return [null, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodBranded) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodReadonly) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodCatch) {
    return getDiscriminator(type._def.innerType);
  } else {
    return [];
  }
};
var ZodDiscriminatedUnion = class _ZodDiscriminatedUnion extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const discriminator = this.discriminator;
    const discriminatorValue = ctx.data[discriminator];
    const option = this.optionsMap.get(discriminatorValue);
    if (!option) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union_discriminator,
        options: Array.from(this.optionsMap.keys()),
        path: [discriminator]
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return option._parseAsync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    } else {
      return option._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    }
  }
  get discriminator() {
    return this._def.discriminator;
  }
  get options() {
    return this._def.options;
  }
  get optionsMap() {
    return this._def.optionsMap;
  }
  /**
   * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
   * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
   * have a different value for each object in the union.
   * @param discriminator the name of the discriminator property
   * @param types an array of object schemas
   * @param params
   */
  static create(discriminator, options, params) {
    const optionsMap = /* @__PURE__ */ new Map();
    for (const type of options) {
      const discriminatorValues = getDiscriminator(type.shape[discriminator]);
      if (!discriminatorValues.length) {
        throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
      }
      for (const value of discriminatorValues) {
        if (optionsMap.has(value)) {
          throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
        }
        optionsMap.set(value, type);
      }
    }
    return new _ZodDiscriminatedUnion({
      typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
      discriminator,
      options,
      optionsMap,
      ...processCreateParams(params)
    });
  }
};
function mergeValues(a3, b3) {
  const aType = getParsedType(a3);
  const bType = getParsedType(b3);
  if (a3 === b3) {
    return { valid: true, data: a3 };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b3);
    const sharedKeys = util.objectKeys(a3).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a3, ...b3 };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a3[key], b3[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a3.length !== b3.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0; index < a3.length; index++) {
      const itemA = a3[index];
      const itemB = b3[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a3 === +b3) {
    return { valid: true, data: a3 };
  } else {
    return { valid: false };
  }
}
var ZodIntersection = class extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const handleParsed = (parsedLeft, parsedRight) => {
      if (isAborted(parsedLeft) || isAborted(parsedRight)) {
        return INVALID;
      }
      const merged = mergeValues(parsedLeft.value, parsedRight.value);
      if (!merged.valid) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_intersection_types
        });
        return INVALID;
      }
      if (isDirty(parsedLeft) || isDirty(parsedRight)) {
        status.dirty();
      }
      return { status: status.value, value: merged.data };
    };
    if (ctx.common.async) {
      return Promise.all([
        this._def.left._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }),
        this._def.right._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        })
      ]).then(([left, right]) => handleParsed(left, right));
    } else {
      return handleParsed(this._def.left._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }), this._def.right._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }));
    }
  }
};
ZodIntersection.create = (left, right, params) => {
  return new ZodIntersection({
    left,
    right,
    typeName: ZodFirstPartyTypeKind.ZodIntersection,
    ...processCreateParams(params)
  });
};
var ZodTuple = class _ZodTuple extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (ctx.data.length < this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_small,
        minimum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      return INVALID;
    }
    const rest = this._def.rest;
    if (!rest && ctx.data.length > this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_big,
        maximum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      status.dirty();
    }
    const items = [...ctx.data].map((item, itemIndex) => {
      const schema = this._def.items[itemIndex] || this._def.rest;
      if (!schema)
        return null;
      return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
    }).filter((x4) => !!x4);
    if (ctx.common.async) {
      return Promise.all(items).then((results) => {
        return ParseStatus.mergeArray(status, results);
      });
    } else {
      return ParseStatus.mergeArray(status, items);
    }
  }
  get items() {
    return this._def.items;
  }
  rest(rest) {
    return new _ZodTuple({
      ...this._def,
      rest
    });
  }
};
ZodTuple.create = (schemas, params) => {
  if (!Array.isArray(schemas)) {
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  }
  return new ZodTuple({
    items: schemas,
    typeName: ZodFirstPartyTypeKind.ZodTuple,
    rest: null,
    ...processCreateParams(params)
  });
};
var ZodRecord = class _ZodRecord extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const pairs = [];
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    for (const key in ctx.data) {
      pairs.push({
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
        value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (ctx.common.async) {
      return ParseStatus.mergeObjectAsync(status, pairs);
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get element() {
    return this._def.valueType;
  }
  static create(first, second, third) {
    if (second instanceof ZodType) {
      return new _ZodRecord({
        keyType: first,
        valueType: second,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(third)
      });
    }
    return new _ZodRecord({
      keyType: ZodString.create(),
      valueType: first,
      typeName: ZodFirstPartyTypeKind.ZodRecord,
      ...processCreateParams(second)
    });
  }
};
var ZodMap = class extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.map) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.map,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    const pairs = [...ctx.data.entries()].map(([key, value], index) => {
      return {
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
        value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
      };
    });
    if (ctx.common.async) {
      const finalMap = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      });
    } else {
      const finalMap = /* @__PURE__ */ new Map();
      for (const pair of pairs) {
        const key = pair.key;
        const value = pair.value;
        if (key.status === "aborted" || value.status === "aborted") {
          return INVALID;
        }
        if (key.status === "dirty" || value.status === "dirty") {
          status.dirty();
        }
        finalMap.set(key.value, value.value);
      }
      return { status: status.value, value: finalMap };
    }
  }
};
ZodMap.create = (keyType, valueType, params) => {
  return new ZodMap({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind.ZodMap,
    ...processCreateParams(params)
  });
};
var ZodSet = class _ZodSet extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.set) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.set,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const def = this._def;
    if (def.minSize !== null) {
      if (ctx.data.size < def.minSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.minSize.message
        });
        status.dirty();
      }
    }
    if (def.maxSize !== null) {
      if (ctx.data.size > def.maxSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.maxSize.message
        });
        status.dirty();
      }
    }
    const valueType = this._def.valueType;
    function finalizeSet(elements2) {
      const parsedSet = /* @__PURE__ */ new Set();
      for (const element of elements2) {
        if (element.status === "aborted")
          return INVALID;
        if (element.status === "dirty")
          status.dirty();
        parsedSet.add(element.value);
      }
      return { status: status.value, value: parsedSet };
    }
    const elements = [...ctx.data.values()].map((item, i4) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i4)));
    if (ctx.common.async) {
      return Promise.all(elements).then((elements2) => finalizeSet(elements2));
    } else {
      return finalizeSet(elements);
    }
  }
  min(minSize, message) {
    return new _ZodSet({
      ...this._def,
      minSize: { value: minSize, message: errorUtil.toString(message) }
    });
  }
  max(maxSize, message) {
    return new _ZodSet({
      ...this._def,
      maxSize: { value: maxSize, message: errorUtil.toString(message) }
    });
  }
  size(size, message) {
    return this.min(size, message).max(size, message);
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodSet.create = (valueType, params) => {
  return new ZodSet({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind.ZodSet,
    ...processCreateParams(params)
  });
};
var ZodFunction = class _ZodFunction extends ZodType {
  constructor() {
    super(...arguments);
    this.validate = this.implement;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.function) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.function,
        received: ctx.parsedType
      });
      return INVALID;
    }
    function makeArgsIssue(args, error) {
      return makeIssue({
        data: args,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x4) => !!x4),
        issueData: {
          code: ZodIssueCode.invalid_arguments,
          argumentsError: error
        }
      });
    }
    function makeReturnsIssue(returns, error) {
      return makeIssue({
        data: returns,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x4) => !!x4),
        issueData: {
          code: ZodIssueCode.invalid_return_type,
          returnTypeError: error
        }
      });
    }
    const params = { errorMap: ctx.common.contextualErrorMap };
    const fn2 = ctx.data;
    if (this._def.returns instanceof ZodPromise) {
      const me = this;
      return OK(async function(...args) {
        const error = new ZodError([]);
        const parsedArgs = await me._def.args.parseAsync(args, params).catch((e3) => {
          error.addIssue(makeArgsIssue(args, e3));
          throw error;
        });
        const result = await Reflect.apply(fn2, this, parsedArgs);
        const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e3) => {
          error.addIssue(makeReturnsIssue(result, e3));
          throw error;
        });
        return parsedReturns;
      });
    } else {
      const me = this;
      return OK(function(...args) {
        const parsedArgs = me._def.args.safeParse(args, params);
        if (!parsedArgs.success) {
          throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
        }
        const result = Reflect.apply(fn2, this, parsedArgs.data);
        const parsedReturns = me._def.returns.safeParse(result, params);
        if (!parsedReturns.success) {
          throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
        }
        return parsedReturns.data;
      });
    }
  }
  parameters() {
    return this._def.args;
  }
  returnType() {
    return this._def.returns;
  }
  args(...items) {
    return new _ZodFunction({
      ...this._def,
      args: ZodTuple.create(items).rest(ZodUnknown.create())
    });
  }
  returns(returnType) {
    return new _ZodFunction({
      ...this._def,
      returns: returnType
    });
  }
  implement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  strictImplement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  static create(args, returns, params) {
    return new _ZodFunction({
      args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
      returns: returns || ZodUnknown.create(),
      typeName: ZodFirstPartyTypeKind.ZodFunction,
      ...processCreateParams(params)
    });
  }
};
var ZodLazy = class extends ZodType {
  get schema() {
    return this._def.getter();
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const lazySchema = this._def.getter();
    return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
  }
};
ZodLazy.create = (getter, params) => {
  return new ZodLazy({
    getter,
    typeName: ZodFirstPartyTypeKind.ZodLazy,
    ...processCreateParams(params)
  });
};
var ZodLiteral = class extends ZodType {
  _parse(input) {
    if (input.data !== this._def.value) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_literal,
        expected: this._def.value
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
  get value() {
    return this._def.value;
  }
};
ZodLiteral.create = (value, params) => {
  return new ZodLiteral({
    value,
    typeName: ZodFirstPartyTypeKind.ZodLiteral,
    ...processCreateParams(params)
  });
};
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}
var ZodEnum = class _ZodEnum extends ZodType {
  _parse(input) {
    if (typeof input.data !== "string") {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(this._def.values);
    }
    if (!this._cache.has(input.data)) {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Values() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  extract(values, newDef = this._def) {
    return _ZodEnum.create(values, {
      ...this._def,
      ...newDef
    });
  }
  exclude(values, newDef = this._def) {
    return _ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
      ...this._def,
      ...newDef
    });
  }
};
ZodEnum.create = createZodEnum;
var ZodNativeEnum = class extends ZodType {
  _parse(input) {
    const nativeEnumValues = util.getValidEnumValues(this._def.values);
    const ctx = this._getOrReturnCtx(input);
    if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(util.getValidEnumValues(this._def.values));
    }
    if (!this._cache.has(input.data)) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get enum() {
    return this._def.values;
  }
};
ZodNativeEnum.create = (values, params) => {
  return new ZodNativeEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
    ...processCreateParams(params)
  });
};
var ZodPromise = class extends ZodType {
  unwrap() {
    return this._def.type;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.promise,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
    return OK(promisified.then((data) => {
      return this._def.type.parseAsync(data, {
        path: ctx.path,
        errorMap: ctx.common.contextualErrorMap
      });
    }));
  }
};
ZodPromise.create = (schema, params) => {
  return new ZodPromise({
    type: schema,
    typeName: ZodFirstPartyTypeKind.ZodPromise,
    ...processCreateParams(params)
  });
};
var ZodEffects = class extends ZodType {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const effect = this._def.effect || null;
    const checkCtx = {
      addIssue: (arg) => {
        addIssueToContext(ctx, arg);
        if (arg.fatal) {
          status.abort();
        } else {
          status.dirty();
        }
      },
      get path() {
        return ctx.path;
      }
    };
    checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
    if (effect.type === "preprocess") {
      const processed = effect.transform(ctx.data, checkCtx);
      if (ctx.common.async) {
        return Promise.resolve(processed).then(async (processed2) => {
          if (status.value === "aborted")
            return INVALID;
          const result = await this._def.schema._parseAsync({
            data: processed2,
            path: ctx.path,
            parent: ctx
          });
          if (result.status === "aborted")
            return INVALID;
          if (result.status === "dirty")
            return DIRTY(result.value);
          if (status.value === "dirty")
            return DIRTY(result.value);
          return result;
        });
      } else {
        if (status.value === "aborted")
          return INVALID;
        const result = this._def.schema._parseSync({
          data: processed,
          path: ctx.path,
          parent: ctx
        });
        if (result.status === "aborted")
          return INVALID;
        if (result.status === "dirty")
          return DIRTY(result.value);
        if (status.value === "dirty")
          return DIRTY(result.value);
        return result;
      }
    }
    if (effect.type === "refinement") {
      const executeRefinement = (acc) => {
        const result = effect.refinement(acc, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(result);
        }
        if (result instanceof Promise) {
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        }
        return acc;
      };
      if (ctx.common.async === false) {
        const inner = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inner.status === "aborted")
          return INVALID;
        if (inner.status === "dirty")
          status.dirty();
        executeRefinement(inner.value);
        return { status: status.value, value: inner.value };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          return executeRefinement(inner.value).then(() => {
            return { status: status.value, value: inner.value };
          });
        });
      }
    }
    if (effect.type === "transform") {
      if (ctx.common.async === false) {
        const base = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (!isValid(base))
          return INVALID;
        const result = effect.transform(base.value, checkCtx);
        if (result instanceof Promise) {
          throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
        }
        return { status: status.value, value: result };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
          if (!isValid(base))
            return INVALID;
          return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
            status: status.value,
            value: result
          }));
        });
      }
    }
    util.assertNever(effect);
  }
};
ZodEffects.create = (schema, effect, params) => {
  return new ZodEffects({
    schema,
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    effect,
    ...processCreateParams(params)
  });
};
ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
  return new ZodEffects({
    schema,
    effect: { type: "preprocess", transform: preprocess },
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    ...processCreateParams(params)
  });
};
var ZodOptional = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.undefined) {
      return OK(void 0);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodOptional.create = (type, params) => {
  return new ZodOptional({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodOptional,
    ...processCreateParams(params)
  });
};
var ZodNullable = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.null) {
      return OK(null);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodNullable.create = (type, params) => {
  return new ZodNullable({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodNullable,
    ...processCreateParams(params)
  });
};
var ZodDefault = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    let data = ctx.data;
    if (ctx.parsedType === ZodParsedType.undefined) {
      data = this._def.defaultValue();
    }
    return this._def.innerType._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
};
ZodDefault.create = (type, params) => {
  return new ZodDefault({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodDefault,
    defaultValue: typeof params.default === "function" ? params.default : () => params.default,
    ...processCreateParams(params)
  });
};
var ZodCatch = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const newCtx = {
      ...ctx,
      common: {
        ...ctx.common,
        issues: []
      }
    };
    const result = this._def.innerType._parse({
      data: newCtx.data,
      path: newCtx.path,
      parent: {
        ...newCtx
      }
    });
    if (isAsync(result)) {
      return result.then((result2) => {
        return {
          status: "valid",
          value: result2.status === "valid" ? result2.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      });
    } else {
      return {
        status: "valid",
        value: result.status === "valid" ? result.value : this._def.catchValue({
          get error() {
            return new ZodError(newCtx.common.issues);
          },
          input: newCtx.data
        })
      };
    }
  }
  removeCatch() {
    return this._def.innerType;
  }
};
ZodCatch.create = (type, params) => {
  return new ZodCatch({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodCatch,
    catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
    ...processCreateParams(params)
  });
};
var ZodNaN = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.nan) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.nan,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
};
ZodNaN.create = (params) => {
  return new ZodNaN({
    typeName: ZodFirstPartyTypeKind.ZodNaN,
    ...processCreateParams(params)
  });
};
var BRAND = Symbol("zod_brand");
var ZodBranded = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const data = ctx.data;
    return this._def.type._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  unwrap() {
    return this._def.type;
  }
};
var ZodPipeline = class _ZodPipeline extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.common.async) {
      const handleAsync = async () => {
        const inResult = await this._def.in._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return DIRTY(inResult.value);
        } else {
          return this._def.out._parseAsync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      };
      return handleAsync();
    } else {
      const inResult = this._def.in._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
      if (inResult.status === "aborted")
        return INVALID;
      if (inResult.status === "dirty") {
        status.dirty();
        return {
          status: "dirty",
          value: inResult.value
        };
      } else {
        return this._def.out._parseSync({
          data: inResult.value,
          path: ctx.path,
          parent: ctx
        });
      }
    }
  }
  static create(a3, b3) {
    return new _ZodPipeline({
      in: a3,
      out: b3,
      typeName: ZodFirstPartyTypeKind.ZodPipeline
    });
  }
};
var ZodReadonly = class extends ZodType {
  _parse(input) {
    const result = this._def.innerType._parse(input);
    const freeze = (data) => {
      if (isValid(data)) {
        data.value = Object.freeze(data.value);
      }
      return data;
    };
    return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodReadonly.create = (type, params) => {
  return new ZodReadonly({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodReadonly,
    ...processCreateParams(params)
  });
};
function cleanParams(params, data) {
  const p3 = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
  const p22 = typeof p3 === "string" ? { message: p3 } : p3;
  return p22;
}
function custom(check, _params = {}, fatal) {
  if (check)
    return ZodAny.create().superRefine((data, ctx) => {
      const r3 = check(data);
      if (r3 instanceof Promise) {
        return r3.then((r4) => {
          if (!r4) {
            const params = cleanParams(_params, data);
            const _fatal = params.fatal ?? fatal ?? true;
            ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
          }
        });
      }
      if (!r3) {
        const params = cleanParams(_params, data);
        const _fatal = params.fatal ?? fatal ?? true;
        ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
      }
      return;
    });
  return ZodAny.create();
}
var late = {
  object: ZodObject.lazycreate
};
var ZodFirstPartyTypeKind;
(function(ZodFirstPartyTypeKind2) {
  ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
  ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
  ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
  ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
  ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
  ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
  ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
  ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
  ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
  ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
  ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
  ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
  ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
  ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
  ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
  ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
  ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
  ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
  ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
  ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
  ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
  ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
  ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
  ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
  ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
  ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
  ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
  ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
  ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
  ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
  ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
  ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
  ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
  ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
  ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
  ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
var instanceOfType = (cls, params = {
  message: `Input not instance of ${cls.name}`
}) => custom((data) => data instanceof cls, params);
var stringType = ZodString.create;
var numberType = ZodNumber.create;
var nanType = ZodNaN.create;
var bigIntType = ZodBigInt.create;
var booleanType = ZodBoolean.create;
var dateType = ZodDate.create;
var symbolType = ZodSymbol.create;
var undefinedType = ZodUndefined.create;
var nullType = ZodNull.create;
var anyType = ZodAny.create;
var unknownType = ZodUnknown.create;
var neverType = ZodNever.create;
var voidType = ZodVoid.create;
var arrayType = ZodArray.create;
var objectType = ZodObject.create;
var strictObjectType = ZodObject.strictCreate;
var unionType = ZodUnion.create;
var discriminatedUnionType = ZodDiscriminatedUnion.create;
var intersectionType = ZodIntersection.create;
var tupleType = ZodTuple.create;
var recordType = ZodRecord.create;
var mapType = ZodMap.create;
var setType = ZodSet.create;
var functionType = ZodFunction.create;
var lazyType = ZodLazy.create;
var literalType = ZodLiteral.create;
var enumType = ZodEnum.create;
var nativeEnumType = ZodNativeEnum.create;
var promiseType = ZodPromise.create;
var effectsType = ZodEffects.create;
var optionalType = ZodOptional.create;
var nullableType = ZodNullable.create;
var preprocessType = ZodEffects.createWithPreprocess;
var pipelineType = ZodPipeline.create;
var ostring = () => stringType().optional();
var onumber = () => numberType().optional();
var oboolean = () => booleanType().optional();
var coerce = {
  string: (arg) => ZodString.create({ ...arg, coerce: true }),
  number: (arg) => ZodNumber.create({ ...arg, coerce: true }),
  boolean: (arg) => ZodBoolean.create({
    ...arg,
    coerce: true
  }),
  bigint: (arg) => ZodBigInt.create({ ...arg, coerce: true }),
  date: (arg) => ZodDate.create({ ...arg, coerce: true })
};
var NEVER = INVALID;

// src/ui/contracts/VisualOverlays.contract.ts
var BoundingBoxNormalizedSchema = external_exports.object({
  x: external_exports.number().min(0).max(1),
  y: external_exports.number().min(0).max(1),
  width: external_exports.number().min(0).max(1),
  height: external_exports.number().min(0).max(1)
});
var ImageSchema = external_exports.object({
  id: external_exports.string(),
  originalSrc: external_exports.string().url().optional(),
  width: external_exports.number().int().positive().optional(),
  height: external_exports.number().int().positive().optional(),
  thumbnailSrc: external_exports.string().optional()
});
var OverlaySchema = external_exports.object({
  id: external_exports.string(),
  bbox: BoundingBoxNormalizedSchema,
  label: external_exports.string().optional(),
  score: external_exports.number().optional(),
  metadata: external_exports.record(external_exports.any()).optional()
});
var ImagesSchema = external_exports.array(ImageSchema);
var OverlaysByImageSchema = external_exports.record(external_exports.array(OverlaySchema));

// src/ui/contracts/ManualEditor.contract.ts
var FieldSchema = external_exports.object({
  name: external_exports.string(),
  value: external_exports.union([external_exports.string(), external_exports.number(), external_exports.boolean(), external_exports.null()])
});
var MetadataSchema = external_exports.object({
  title: external_exports.string().optional(),
  correspondent: external_exports.string().optional(),
  documentType: external_exports.string().optional()
  // Additional fields can be added dynamically
}).passthrough();
var ManualEditorSchema = external_exports.object({
  documentId: external_exports.number().int().nullable(),
  // Current page (0-indexed) for multi-page documents
  page: external_exports.number().int().nonnegative().optional(),
  // Metadata for the document (title, correspondent, documentType, etc.)
  metadata: MetadataSchema.optional(),
  // Raw document content text
  content: external_exports.string().optional(),
  // Custom field key-value pairs
  fields: external_exports.array(FieldSchema).optional(),
  // Initial active tab
  activeTab: external_exports.enum(["metadata", "content", "fields", "ai-debug"]).optional(),
  // GPU state passed from parent
  gpuState: external_exports.enum(["idle", "checking", "preparing", "ready", "error"]).optional(),
  // Visual overlays payloads (optional)
  images: ImagesSchema.optional(),
  overlaysByImage: OverlaysByImageSchema.optional()
});
var PayloadReadyEventSchema = external_exports.object({
  type: external_exports.literal("payload:ready"),
  documentId: external_exports.number().int().nullable().optional(),
  metadata: MetadataSchema.optional(),
  content: external_exports.string().optional(),
  fields: external_exports.array(FieldSchema).optional(),
  timestamp: external_exports.number().optional()
});
var SyncFailedEventSchema = external_exports.object({
  type: external_exports.literal("sync:failed"),
  documentId: external_exports.number().int().nullable().optional(),
  error: external_exports.string(),
  timestamp: external_exports.number().optional()
});

// src/islands/ManualEditorIsland.tsx
function dispatchEventSafe2(name, detail) {
  if (typeof document === "undefined") return;
  if (typeof document.dispatchEvent !== "function") return;
  document.dispatchEvent(new CustomEvent(name, { detail }));
}
function ManualEditorIsland(props) {
  const validated = ManualEditorSchema.parse(props);
  const [active, setActive] = d2("metadata");
  const [gpuState, setGpuState] = d2("idle");
  const [syncState, setSyncState] = d2("idle");
  const [syncError, setSyncError] = d2("");
  const [documentId, setDocumentId] = d2(props.documentId || null);
  const normalizeFields = (contractFields) => {
    if (!contractFields || contractFields.length === 0) {
      return [{ name: "", value: "" }];
    }
    return contractFields.map((f4) => ({
      name: f4.name || "",
      value: f4.value != null ? String(f4.value) : ""
    }));
  };
  const [title, setTitle] = d2(props.metadata?.title || "");
  const [correspondent, setCorrespondent] = d2(props.metadata?.correspondent || "");
  const [documentType, setDocumentType] = d2(props.metadata?.documentType || "");
  const [content, setContent] = d2(props.content || "");
  const [fields, setFields] = d2(normalizeFields(props.fields));
  const [initialValues] = d2({
    title: props.metadata?.title || "",
    correspondent: props.metadata?.correspondent || "",
    documentType: props.metadata?.documentType || "",
    content: props.content || "",
    fields: normalizeFields(props.fields)
  });
  const [aiResponse, setAiResponse] = d2(null);
  const [aiLoading, setAiLoading] = d2(false);
  const tabsRef = A2(null);
  const tabRefs = A2({});
  const syncBadgeTimeoutRef = A2(null);
  y2(() => {
    let mounted = true;
    const checkGpu = async () => {
      setGpuState("checking");
      try {
        const res = await fetch("/api/visual-rag/health", { signal: AbortSignal.timeout(5e3) });
        if (!mounted) return;
        if (res.status === 503) {
          setGpuState("preparing");
        } else if (res.ok) {
          setGpuState("ready");
        } else {
          setGpuState("error");
        }
      } catch {
        if (mounted) setGpuState("error");
      }
    };
    checkGpu();
    return () => {
      mounted = false;
    };
  }, []);
  y2(() => {
    setDocumentId(props.documentId ?? null);
  }, [props.documentId]);
  y2(() => {
    const onMetadataUpdated = (e3) => {
      const meta = e3?.detail || {};
      try {
        window.__manual_island_last_meta = meta;
      } catch (err) {
      }
      if (meta.title !== void 0) setTitle(meta.title || "");
      if (meta.content !== void 0) setContent(meta.content || "");
      if (meta.correspondent !== void 0) {
        setCorrespondent(meta.correspondent || "");
      }
      if (meta.documentType !== void 0) {
        setDocumentType(meta.documentType || "");
      }
    };
    window.addEventListener("manual:metadata-updated", onMetadataUpdated);
    return () => window.removeEventListener("manual:metadata-updated", onMetadataUpdated);
  }, []);
  y2(() => {
    const onFieldsUpdated = (e3) => {
      const f4 = e3?.detail?.fields || [];
      try {
        window.__manual_island_last_fields = f4;
      } catch (err) {
      }
      const normalized = f4 && f4.length > 0 ? f4.map((it) => ({ name: it.label || it.name || "", value: it.value != null ? String(it.value) : "" })) : [];
      setFields(normalized);
    };
    window.addEventListener("manual:fields-updated", onFieldsUpdated);
    return () => window.removeEventListener("manual:fields-updated", onFieldsUpdated);
  }, []);
  y2(() => {
    const onDocumentSelected = (e3) => {
      const detail = e3?.detail || {};
      if (detail.documentId !== void 0) {
        setDocumentId(detail.documentId ?? null);
      }
    };
    window.addEventListener("document:selected", onDocumentSelected);
    return () => window.removeEventListener("document:selected", onDocumentSelected);
  }, []);
  y2(() => {
    if (syncState === "synced") {
      syncBadgeTimeoutRef.current = window.setTimeout(() => {
        setSyncState("idle");
      }, 5e3);
    }
    return () => {
      if (syncBadgeTimeoutRef.current) {
        window.clearTimeout(syncBadgeTimeoutRef.current);
      }
    };
  }, [syncState]);
  y2(() => {
    try {
      window.__manual_island_mounted = true;
    } catch (e3) {
    }
  }, []);
  y2(() => {
    ["metadata", "content", "fields", "ai-debug"].forEach((tab) => {
      const ref = tabRefs.current[tab];
      if (ref) {
        ref.setAttribute("aria-selected", active === tab ? "true" : "false");
      }
    });
  }, [active]);
  const onKeyDown = q2((e3) => {
    const order = ["metadata", "content", "fields", "ai-debug"];
    const idx = order.indexOf(active);
    let nextTab = null;
    if (e3.key === "ArrowLeft") nextTab = order[(idx + order.length - 1) % order.length];
    if (e3.key === "ArrowRight") nextTab = order[(idx + 1) % order.length];
    if (nextTab) {
      e3.preventDefault();
      setActive(nextTab);
      setTimeout(() => {
        const btn = tabsRef.current?.querySelectorAll('[role="tab"]')[order.indexOf(nextTab)];
        btn?.focus();
      }, 0);
    }
  }, [active]);
  const addField = q2(() => {
    setFields((prev) => [...prev, { name: "", value: "" }]);
  }, []);
  const removeField = q2((index) => {
    setFields((prev) => prev.filter((_3, i4) => i4 !== index));
  }, []);
  const updateField = q2((index, key, val) => {
    setFields((prev) => {
      const newFields = [...prev];
      newFields[index] = { ...newFields[index], [key]: val };
      return newFields;
    });
  }, []);
  const handleSave = q2(async () => {
    setSyncState("syncing");
    setSyncError("");
    const requestId = `mei-${Date.now()}`;
    const page = props.page ?? 0;
    const custom_fields = fields.filter((f4) => f4.name.trim() !== "").map((f4) => ({ name: f4.name.trim(), value: f4.value }));
    const document_updates = {
      title,
      correspondent,
      documentType,
      content,
      custom_fields
    };
    const feedback_events = [];
    if (title !== initialValues.title) {
      feedback_events.push({
        event_type: "correction",
        field_name: "title",
        original_value: initialValues.title,
        corrected_value: title,
        context: { page, request_id: requestId }
      });
    }
    if (correspondent !== initialValues.correspondent) {
      feedback_events.push({
        event_type: "correction",
        field_name: "correspondent",
        original_value: initialValues.correspondent,
        corrected_value: correspondent,
        context: { page, request_id: requestId }
      });
    }
    if (documentType !== initialValues.documentType) {
      feedback_events.push({
        event_type: "correction",
        field_name: "documentType",
        original_value: initialValues.documentType,
        corrected_value: documentType,
        context: { page, request_id: requestId }
      });
    }
    if (content !== initialValues.content) {
      feedback_events.push({
        event_type: "correction",
        field_name: "content",
        original_value: initialValues.content.substring(0, 500),
        // Truncate for payload size
        corrected_value: content.substring(0, 500),
        context: { page, request_id: requestId }
      });
    }
    const initialFieldMap = new Map(initialValues.fields.map((f4) => [f4.name, f4.value]));
    for (const field of custom_fields) {
      const originalValue = initialFieldMap.get(field.name) || "";
      if (field.value !== originalValue) {
        feedback_events.push({
          event_type: "correction",
          field_name: `custom_field:${field.name}`,
          original_value: String(originalValue || ""),
          corrected_value: String(field.value),
          context: { page, request_id: requestId }
        });
      }
    }
    const payload = {
      documentId: documentId ?? null,
      document_updates,
      feedback_events,
      transactional: true
    };
    const metadata = {
      title,
      correspondent,
      documentType
    };
    const eventDetail = {
      type: "payload:ready",
      documentId: documentId ?? null,
      page,
      metadata,
      content,
      fields: custom_fields,
      timestamp: Date.now()
    };
    dispatchEventSafe2("payload:ready", eventDetail);
    try {
      const res = await fetch("/manual/updateDocument", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": requestId
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const result = await res.json().catch(() => ({}));
        setSyncState("synced");
        dispatchEventSafe2("sync:success", { documentId, ...result });
      } else {
        const errorData = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
        throw new Error(errorData.message || `Sync failed with status ${res.status}`);
      }
    } catch (err) {
      setSyncState("error");
      setSyncError(err.message || "Sync failed");
      dispatchEventSafe2("sync:failed", { documentId, error: err.message });
    }
  }, [documentId, props.page, title, correspondent, documentType, content, fields, initialValues]);
  const runAiAnalysis = q2(async () => {
    if (gpuState !== "ready") return;
    setAiLoading(true);
    setAiResponse(null);
    try {
      const res = await fetch("/manual/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.substring(0, 5e4),
          id: documentId
        })
      });
      const data = await res.json();
      setAiResponse(data);
    } catch (err) {
      setAiResponse({ error: err.message });
    } finally {
      setAiLoading(false);
    }
  }, [gpuState, content, documentId]);
  return /* @__PURE__ */ u3("div", { "data-testid": "manual-editor-island-root", "data-hydrated": "true", className: "mei-root", children: [
    syncState !== "idle" && /* @__PURE__ */ u3(
      "div",
      {
        className: `mei-sync-badge mei-sync-${syncState}`,
        "data-testid": "sync-badge",
        role: "status",
        "aria-live": "polite",
        children: [
          syncState === "syncing" && "\u23F3 Syncing...",
          syncState === "synced" && "\u2713 Synced",
          syncState === "error" && `\u26A0\uFE0F ${syncError || "Sync failed"}`
        ]
      }
    ),
    /* @__PURE__ */ u3(
      "div",
      {
        role: "tablist",
        "aria-label": "Manual Editor Tabs",
        onKeyDown,
        ref: tabsRef,
        className: "mei-tablist",
        children: [
          /* @__PURE__ */ u3(
            "button",
            {
              id: "tab-metadata-btn",
              type: "button",
              role: "tab",
              tabIndex: active === "metadata" ? 0 : -1,
              "aria-controls": "panel-metadata",
              "data-testid": "tab-metadata",
              ref: (el) => {
                tabRefs.current["metadata"] = el;
              },
              onClick: () => setActive("metadata"),
              className: `mei-tab ${active === "metadata" ? "mei-tab-active" : ""}`,
              children: "Metadata"
            }
          ),
          /* @__PURE__ */ u3(
            "button",
            {
              id: "tab-content-btn",
              type: "button",
              role: "tab",
              tabIndex: active === "content" ? 0 : -1,
              "aria-controls": "panel-content",
              "data-testid": "tab-content",
              ref: (el) => {
                tabRefs.current["content"] = el;
              },
              onClick: () => setActive("content"),
              className: `mei-tab ${active === "content" ? "mei-tab-active" : ""}`,
              children: "Content"
            }
          ),
          /* @__PURE__ */ u3(
            "button",
            {
              id: "tab-fields-btn",
              type: "button",
              role: "tab",
              tabIndex: active === "fields" ? 0 : -1,
              "aria-controls": "panel-fields",
              "data-testid": "tab-fields",
              ref: (el) => {
                tabRefs.current["fields"] = el;
              },
              onClick: () => setActive("fields"),
              className: `mei-tab ${active === "fields" ? "mei-tab-active" : ""}`,
              children: "Fields"
            }
          ),
          /* @__PURE__ */ u3(
            "button",
            {
              id: "tab-ai-debug-btn",
              type: "button",
              role: "tab",
              tabIndex: active === "ai-debug" ? 0 : -1,
              "aria-controls": "panel-ai-debug",
              "data-testid": "tab-ai-debug",
              ref: (el) => {
                tabRefs.current["ai-debug"] = el;
              },
              onClick: () => setActive("ai-debug"),
              className: `mei-tab ${active === "ai-debug" ? "mei-tab-active" : ""}`,
              children: [
                "AI Debug",
                gpuState === "preparing" && /* @__PURE__ */ u3("span", { className: "mei-gpu-badge", children: "\u23F3" }),
                gpuState === "ready" && /* @__PURE__ */ u3("span", { className: "mei-gpu-badge mei-gpu-ready", children: "\u2713" }),
                gpuState === "error" && /* @__PURE__ */ u3("span", { className: "mei-gpu-badge mei-gpu-error", children: "\u26A0\uFE0F" })
              ]
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ u3("div", { className: "mei-panels", children: [
      /* @__PURE__ */ u3(
        "div",
        {
          id: "panel-metadata",
          role: "tabpanel",
          "aria-labelledby": "tab-metadata-btn",
          "data-panel": "metadata",
          className: `mei-panel ${active === "metadata" ? "" : "mei-panel-hidden"}`,
          "data-testid": "panel-metadata",
          children: [
            /* @__PURE__ */ u3("div", { className: "mei-field-group", children: [
              /* @__PURE__ */ u3("label", { htmlFor: "mei-title", className: "mei-label", children: "Title" }),
              /* @__PURE__ */ u3(
                "input",
                {
                  id: "mei-title",
                  "data-testid": "manual-title-input",
                  type: "text",
                  value: title,
                  onInput: (e3) => setTitle(e3.target.value),
                  className: "mei-input"
                }
              )
            ] }),
            /* @__PURE__ */ u3("div", { className: "mei-field-group", children: [
              /* @__PURE__ */ u3("label", { htmlFor: "mei-correspondent", className: "mei-label", children: "Correspondent" }),
              /* @__PURE__ */ u3(
                "input",
                {
                  id: "mei-correspondent",
                  "data-testid": "manual-correspondent-input",
                  type: "text",
                  value: correspondent,
                  onInput: (e3) => setCorrespondent(e3.target.value),
                  className: "mei-input"
                }
              )
            ] }),
            /* @__PURE__ */ u3("div", { className: "mei-field-group", children: [
              /* @__PURE__ */ u3("label", { htmlFor: "mei-doctype", className: "mei-label", children: "Document Type" }),
              /* @__PURE__ */ u3(
                "input",
                {
                  id: "mei-doctype",
                  "data-testid": "manual-doctype-input",
                  type: "text",
                  value: documentType,
                  onInput: (e3) => setDocumentType(e3.target.value),
                  className: "mei-input"
                }
              )
            ] })
          ]
        }
      ),
      /* @__PURE__ */ u3(
        "div",
        {
          id: "panel-content",
          role: "tabpanel",
          "aria-labelledby": "tab-content-btn",
          "data-panel": "content",
          className: `mei-panel ${active === "content" ? "" : "mei-panel-hidden"}`,
          "data-testid": "panel-content",
          children: [
            /* @__PURE__ */ u3("label", { htmlFor: "mei-content", className: "mei-label", children: "Document Content" }),
            /* @__PURE__ */ u3(
              "textarea",
              {
                id: "mei-content",
                "data-testid": "manual-content-input",
                rows: 10,
                value: content,
                onInput: (e3) => setContent(e3.target.value),
                className: "mei-textarea"
              }
            )
          ]
        }
      ),
      /* @__PURE__ */ u3(
        "div",
        {
          id: "panel-fields",
          role: "tabpanel",
          "aria-labelledby": "tab-fields-btn",
          "data-panel": "fields",
          className: `mei-panel ${active === "fields" ? "" : "mei-panel-hidden"}`,
          "data-testid": "panel-fields",
          children: [
            /* @__PURE__ */ u3("div", { className: "mei-fields-header", children: [
              /* @__PURE__ */ u3("span", { className: "mei-label", children: "Custom Fields" }),
              /* @__PURE__ */ u3(
                "button",
                {
                  type: "button",
                  onClick: addField,
                  className: "mei-btn mei-btn-add",
                  "data-testid": "add-field-btn",
                  children: "+ Add Field"
                }
              )
            ] }),
            fields.map((field, i4) => /* @__PURE__ */ u3("div", { className: "mei-field-row", children: [
              /* @__PURE__ */ u3(
                "input",
                {
                  "data-testid": `field-name-${i4}`,
                  placeholder: "Field name",
                  value: field.name,
                  onInput: (e3) => updateField(i4, "name", e3.target.value),
                  className: "mei-input mei-field-name"
                }
              ),
              /* @__PURE__ */ u3(
                "input",
                {
                  "data-testid": `field-value-${i4}`,
                  placeholder: "Field value",
                  value: field.value,
                  onInput: (e3) => updateField(i4, "value", e3.target.value),
                  className: "mei-input mei-field-value"
                }
              ),
              /* @__PURE__ */ u3(
                "button",
                {
                  type: "button",
                  onClick: () => removeField(i4),
                  className: "mei-btn mei-btn-remove",
                  "data-testid": `remove-field-${i4}`,
                  "aria-label": `Remove field ${i4 + 1}`,
                  children: "\xD7"
                }
              )
            ] }, i4))
          ]
        }
      ),
      /* @__PURE__ */ u3(
        "div",
        {
          id: "panel-ai-debug",
          role: "tabpanel",
          "aria-labelledby": "tab-ai-debug-btn",
          "data-panel": "ai-debug",
          className: `mei-panel ${active === "ai-debug" ? "" : "mei-panel-hidden"}`,
          "data-testid": "panel-ai-debug",
          children: [
            gpuState === "preparing" && /* @__PURE__ */ u3("div", { className: "mei-gpu-preparing", "data-testid": "gpu-preparing-status", children: [
              /* @__PURE__ */ u3("div", { className: "mei-spinner" }),
              /* @__PURE__ */ u3("p", { children: "GPU Preparing (Warmup)..." }),
              /* @__PURE__ */ u3("p", { className: "mei-gpu-hint", children: "Visual analysis features will be available shortly." })
            ] }),
            gpuState === "error" && /* @__PURE__ */ u3("div", { className: "mei-gpu-error-box", "data-testid": "gpu-error-status", children: [
              /* @__PURE__ */ u3("p", { children: "\u26A0\uFE0F Visual Analysis Unavailable" }),
              /* @__PURE__ */ u3("p", { className: "mei-gpu-hint", children: "The GPU sidecar is not responding." })
            ] }),
            gpuState === "ready" && /* @__PURE__ */ u3("div", { className: "mei-ai-debug-content", children: [
              /* @__PURE__ */ u3(
                "button",
                {
                  type: "button",
                  onClick: runAiAnalysis,
                  disabled: aiLoading || !content || !content.trim(),
                  className: "mei-btn mei-btn-primary",
                  "data-testid": "run-ai-analysis-btn",
                  children: aiLoading ? "Analyzing..." : "Run AI Analysis"
                }
              ),
              !content || !content.trim() ? /* @__PURE__ */ u3("p", { className: "mei-gpu-hint", "data-testid": "ai-no-content-hint", children: 'No document content available. Switch to the "Content" tab or paste text into the document content field before running analysis.' }) : null,
              aiResponse && /* @__PURE__ */ u3("div", { className: "mei-ai-response", "data-testid": "ai-response", children: [
                /* @__PURE__ */ u3("h4", { children: "AI Response" }),
                /* @__PURE__ */ u3("pre", { className: "mei-ai-json", children: JSON.stringify(aiResponse, null, 2) })
              ] })
            ] }),
            gpuState === "checking" && /* @__PURE__ */ u3("div", { className: "mei-gpu-checking", children: [
              /* @__PURE__ */ u3("div", { className: "mei-spinner" }),
              /* @__PURE__ */ u3("p", { children: "Checking GPU status..." })
            ] })
          ]
        }
      )
    ] }),
    /* @__PURE__ */ u3("div", { className: "mei-actions", children: /* @__PURE__ */ u3(
      "button",
      {
        "data-testid": "manual-save-btn",
        type: "button",
        onClick: handleSave,
        className: "mei-btn mei-btn-save",
        disabled: syncState === "syncing",
        children: syncState === "syncing" ? "Saving..." : "Save"
      }
    ) }),
    /* @__PURE__ */ u3("style", { children: `
        .mei-root {
          font-family: system-ui, -apple-system, sans-serif;
          position: relative;
        }
        .mei-sync-badge {
          position: absolute;
          top: -8px;
          right: 0;
          padding: 4px 12px;
          border-radius: 4px;
          font-size: 0.8rem;
          font-weight: 500;
          animation: mei-fade-in 0.3s ease;
        }
        .mei-sync-syncing { background: #fff3cd; color: #856404; }
        .mei-sync-synced { background: #d4edda; color: #155724; }
        .mei-sync-error { background: #f8d7da; color: #721c24; }

        .mei-tablist {
          display: flex;
          gap: 4px;
          margin-bottom: 16px;
          border-bottom: 2px solid #e0e0e0;
          padding-bottom: 8px;
        }
        .mei-tab {
          padding: 8px 16px;
          border: none;
          background: transparent;
          cursor: pointer;
          font-size: 0.9rem;
          border-radius: 4px 4px 0 0;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .mei-tab:hover { background: #f5f5f5; }
        .mei-tab-active {
          background: #3498db;
          color: white;
        }
        .mei-gpu-badge {
          font-size: 0.75rem;
        }
        .mei-gpu-ready { color: #27ae60; }
        .mei-gpu-error { color: #e74c3c; }

        .mei-panels { min-height: 200px; }
        .mei-panel { padding: 16px 0; }
        .mei-panel-hidden { display: none; }

        .mei-field-group { margin-bottom: 16px; }
        .mei-label {
          display: block;
          font-weight: 500;
          margin-bottom: 4px;
          color: #333;
          font-size: 0.9rem;
        }
        .mei-input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 0.9rem;
          box-sizing: border-box;
        }
        .mei-input:focus {
          outline: none;
          border-color: #3498db;
        }
        .mei-textarea {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 0.9rem;
          resize: vertical;
          font-family: monospace;
          box-sizing: border-box;
        }
        .mei-textarea:focus {
          outline: none;
          border-color: #3498db;
        }

        .mei-fields-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .mei-field-row {
          display: flex;
          gap: 8px;
          margin-bottom: 8px;
        }
        .mei-field-name { flex: 1; }
        .mei-field-value { flex: 2; }

        .mei-btn {
          padding: 8px 16px;
          border: 1px solid #ddd;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9rem;
          transition: all 0.2s;
        }
        .mei-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .mei-btn-add {
          background: #f8f9fa;
        }
        .mei-btn-add:hover { background: #e9ecef; }
        .mei-btn-remove {
          background: #e74c3c;
          color: white;
          border-color: #e74c3c;
          padding: 8px 12px;
        }
        .mei-btn-remove:hover { background: #c0392b; }
        .mei-btn-primary {
          background: #3498db;
          color: white;
          border-color: #3498db;
        }
        .mei-btn-primary:hover:not(:disabled) { background: #2980b9; }
        .mei-btn-save {
          background: #27ae60;
          color: white;
          border-color: #27ae60;
          min-width: 100px;
        }
        .mei-btn-save:hover:not(:disabled) { background: #219a52; }

        .mei-actions {
          margin-top: 16px;
          display: flex;
          justify-content: flex-end;
        }

        /* AI Debug Panel */
        .mei-gpu-preparing,
        .mei-gpu-checking,
        .mei-gpu-error-box {
          text-align: center;
          padding: 32px;
          color: #666;
        }
        .mei-gpu-error-box {
          background: #fff3f3;
          border: 1px solid #e74c3c;
          border-radius: 8px;
          color: #c0392b;
        }
        .mei-gpu-hint {
          font-size: 0.85rem;
          color: #888;
          margin-top: 8px;
        }
        .mei-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid #e0e0e0;
          border-top-color: #3498db;
          border-radius: 50%;
          animation: mei-spin 1s linear infinite;
          margin: 0 auto 12px;
        }
        .mei-ai-debug-content { padding: 8px 0; }
        .mei-ai-response {
          margin-top: 16px;
          padding: 12px;
          background: #f5f5f5;
          border-radius: 4px;
        }
        .mei-ai-response h4 {
          margin: 0 0 8px;
          font-size: 0.9rem;
        }
        .mei-ai-json {
          background: #2d2d2d;
          color: #f8f8f2;
          padding: 12px;
          border-radius: 4px;
          overflow-x: auto;
          font-size: 0.8rem;
          max-height: 300px;
          overflow-y: auto;
        }

        @keyframes mei-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes mei-fade-in {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      ` })
  ] });
}

// src/ui/contracts/SmartMetadata.contract.ts
var SmartFieldSchema = external_exports.object({
  id: external_exports.union([external_exports.string(), external_exports.number()]),
  label: external_exports.string().optional(),
  value: external_exports.any().optional(),
  overlayId: external_exports.string().nullable().optional(),
  pageNumber: external_exports.number().nullable().optional()
});
var SmartMetadataSchema = external_exports.object({
  documentId: external_exports.number().int().nullable().optional(),
  metadata: external_exports.object({
    title: external_exports.string().optional(),
    correspondent: external_exports.string().optional()
  }).passthrough().optional(),
  customFields: external_exports.array(SmartFieldSchema).optional()
});

// src/islands/SmartMetadataIsland.tsx
function dispatchEventSafe3(name, detail) {
  try {
    if (typeof document !== "undefined" && typeof document.dispatchEvent === "function") {
      document.dispatchEvent(new CustomEvent(name, { detail }));
    }
  } catch (e3) {
  }
  try {
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      window.dispatchEvent(new CustomEvent(name, { detail }));
    }
  } catch (e3) {
  }
}
function SmartMetadataIsland(props) {
  const initial = props || {};
  const fields = Array.isArray(initial.customFields) ? initial.customFields : [];
  const [localMetadata, setLocalMetadata] = d2(() => ({
    title: initial.metadata?.title || "",
    correspondent: initial.metadata?.correspondent || ""
  }));
  const [localFields, setLocalFields] = d2(() => fields.map((f4) => ({ ...f4 })));
  const [validationError, setValidationError] = d2(null);
  y2(() => {
    try {
      window.__smart_metadata_mounted = true;
    } catch (e3) {
    }
  }, []);
  const onLocate = (fieldId) => {
    dispatchEventSafe3("metadata:locate-field", { fieldId });
  };
  const onFeedback = (fieldId, vote) => {
    dispatchEventSafe3("feedback:vote", { fieldId, vote });
  };
  const markDirty = () => {
    try {
      window.__smart_metadata_dirty = true;
    } catch (e3) {
    }
    dispatchEventSafe3("workspace:dirty", { documentId: props.documentId ?? null });
  };
  const validateAndMarkDirty = (meta, fields2) => {
    const payload = { documentId: props.documentId ?? null, metadata: meta, customFields: fields2 };
    const res = SmartMetadataSchema.safeParse(payload);
    if (!res.success) {
      const msg = res.error?.issues?.[0]?.message || "Validation failed";
      setValidationError(msg);
      return false;
    }
    setValidationError(null);
    markDirty();
    return true;
  };
  const onMetaChange = (key, val) => {
    const next = { ...localMetadata, [key]: val };
    setLocalMetadata(next);
    validateAndMarkDirty(next, localFields);
  };
  const onFieldValueChange = (idx, val) => {
    const nextFields = localFields.map((f4, i4) => i4 === idx ? { ...f4, value: val } : f4);
    setLocalFields(nextFields);
    validateAndMarkDirty(localMetadata, nextFields);
  };
  return /* @__PURE__ */ u3("div", { "data-testid": "smart-metadata-root", className: "flex flex-col gap-3", children: [
    /* @__PURE__ */ u3("div", { className: "flex flex-col gap-2", children: [
      /* @__PURE__ */ u3("label", { htmlFor: "smart-title-input", className: "text-xs text-[#666]", children: "Title" }),
      /* @__PURE__ */ u3(
        "input",
        {
          id: "smart-title-input",
          title: "Document title",
          placeholder: "Enter document title",
          "data-testid": "smart-title-input",
          className: "w-full border border-[#e5e0d8] rounded-md px-3 py-2 text-sm",
          value: localMetadata.title,
          onInput: (e3) => onMetaChange("title", e3.target.value)
        }
      )
    ] }),
    /* @__PURE__ */ u3("div", { className: "flex flex-col gap-2", children: [
      /* @__PURE__ */ u3("label", { htmlFor: "smart-correspondent-input", className: "text-xs text-[#666]", children: "Correspondent" }),
      /* @__PURE__ */ u3(
        "input",
        {
          id: "smart-correspondent-input",
          title: "Correspondent name",
          placeholder: "Enter correspondent name",
          "data-testid": "smart-correspondent-input",
          className: "w-full border border-[#e5e0d8] rounded-md px-3 py-2 text-sm",
          value: localMetadata.correspondent,
          onInput: (e3) => onMetaChange("correspondent", e3.target.value)
        }
      )
    ] }),
    /* @__PURE__ */ u3("div", { className: "mt-2", children: [
      /* @__PURE__ */ u3("div", { className: "text-sm font-medium mb-2", children: "Custom Fields" }),
      localFields.length === 0 && /* @__PURE__ */ u3("div", { "data-testid": "no-custom-fields", className: "text-xs text-[#888]", children: "No custom fields" }),
      localFields.map((f4, idx) => /* @__PURE__ */ u3("div", { className: "flex items-center gap-2 mb-2 border border-[#f2efe9] rounded-md p-2", "data-testid": `custom-field-${f4.id}`, children: [
        /* @__PURE__ */ u3("div", { className: "flex-1", children: [
          /* @__PURE__ */ u3("div", { className: "text-xs text-[#444] font-medium", children: f4.label || `Field ${idx + 1}` }),
          /* @__PURE__ */ u3(
            "input",
            {
              id: `custom-field-value-${f4.id}`,
              title: `Value for ${f4.label || `field ${idx + 1}`}`,
              placeholder: "Enter value",
              "data-testid": `custom-field-value-${f4.id}`,
              className: "w-full border border-[#eae6df] rounded px-2 py-1 text-sm",
              value: f4.value ?? "",
              onInput: (e3) => onFieldValueChange(idx, e3.target.value)
            }
          )
        ] }),
        /* @__PURE__ */ u3("div", { className: "flex flex-col gap-1 items-end", children: [
          /* @__PURE__ */ u3(
            "button",
            {
              "data-testid": `locate-btn-${f4.id}`,
              className: "px-2 py-1 text-xs rounded bg-[#f6efe8] border border-[#e5e0d8]",
              title: "Locate field on document",
              onClick: () => onLocate(f4.id),
              children: [
                /* @__PURE__ */ u3("i", { className: "fas fa-crosshairs mr-1" }),
                "Locate"
              ]
            }
          ),
          /* @__PURE__ */ u3("div", { className: "flex gap-1", children: [
            /* @__PURE__ */ u3(
              "button",
              {
                "data-testid": `feedback-up-${f4.id}`,
                className: "px-2 py-1 rounded bg-white border border-[#eae6df] text-sm",
                onClick: () => onFeedback(f4.id, "up"),
                title: "Thumbs up",
                children: /* @__PURE__ */ u3("i", { className: "fas fa-thumbs-up" })
              }
            ),
            /* @__PURE__ */ u3(
              "button",
              {
                "data-testid": `feedback-down-${f4.id}`,
                className: "px-2 py-1 rounded bg-white border border-[#eae6df] text-sm",
                onClick: () => onFeedback(f4.id, "down"),
                title: "Thumbs down",
                children: /* @__PURE__ */ u3("i", { className: "fas fa-thumbs-down" })
              }
            )
          ] })
        ] })
      ] }, String(f4.id)))
    ] })
  ] });
}

// src/ui/contracts/HistoryTabs.contract.ts
var TagSchema = external_exports.object({
  id: external_exports.number().int(),
  name: external_exports.string()
});
var MetadataSchema2 = external_exports.object({
  correspondent: external_exports.string().optional(),
  correspondentId: external_exports.number().int().optional(),
  tags: external_exports.array(TagSchema).optional(),
  documentType: external_exports.string().optional(),
  created: external_exports.string().optional(),
  modified: external_exports.string().optional()
});
var SimilarResultSchema = external_exports.object({
  docId: external_exports.number().int(),
  pageNum: external_exports.number().int().optional(),
  score: external_exports.number().min(0).max(1),
  thumbnailUrl: external_exports.string().url().optional()
});
var ActiveFiltersSchema = external_exports.object({
  correspondentId: external_exports.number().int().optional(),
  tagIds: external_exports.array(external_exports.number().int()).optional()
});
var HistoryTabsSchema = external_exports.object({
  documentId: external_exports.number().int().nullable(),
  content: external_exports.string().optional(),
  metadata: MetadataSchema2.optional()
});
var SearchResponseSchema = external_exports.object({
  success: external_exports.boolean(),
  results: external_exports.array(SimilarResultSchema),
  collectionUsed: external_exports.enum(["visual_pages", "visual_overlays"]),
  scoreType: external_exports.string().default("maxsim"),
  executionTimeMs: external_exports.number().optional(),
  maxsimScoreMean: external_exports.number().optional()
});

// src/islands/HistoryTabsIsland.tsx
function HistoryTabsIsland(props) {
  const validated = HistoryTabsSchema.parse(props);
  const { documentId, content, metadata } = validated;
  const [activeTab, setActiveTab] = d2("text");
  const [isSearching, setIsSearching] = d2(false);
  const [isInitializing, setIsInitializing] = d2(false);
  const [initStage, setInitStage] = d2("");
  const [similarResults, setSimilarResults] = d2([]);
  const [searchError, setSearchError] = d2(null);
  const [activeFilters, setActiveFilters] = d2({});
  const handleKeyDown = q2((e3) => {
    const tabs = ["text", "metadata", "similar"];
    const currentIndex = tabs.indexOf(activeTab);
    if (e3.key === "ArrowRight") {
      const nextIndex = (currentIndex + 1) % tabs.length;
      const next = tabs[nextIndex];
      setActiveTab(next);
      setTimeout(() => document.getElementById(`tab-${next}`)?.focus(), 0);
    } else if (e3.key === "ArrowLeft") {
      const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      const prev = tabs[prevIndex];
      setActiveTab(prev);
      setTimeout(() => document.getElementById(`tab-${prev}`)?.focus(), 0);
    }
  }, [activeTab]);
  y2(() => {
    const tabs = ["text", "metadata", "similar"];
    tabs.forEach((t3) => {
      const tabEl = document.getElementById(`tab-${t3}`);
      const panelEl = document.getElementById(`panel-${t3}`);
      if (tabEl) {
        tabEl.setAttribute("aria-selected", activeTab === t3 ? "true" : "false");
      }
      if (panelEl) {
        if (activeTab === t3) {
          panelEl.removeAttribute("aria-hidden");
        } else {
          panelEl.setAttribute("aria-hidden", "true");
        }
      }
    });
  }, [activeTab]);
  y2(() => {
    const handleVisualSearchRequest = async (event) => {
      const { imageBase64, collection = "visual_pages" } = event.detail || {};
      if (imageBase64 && documentId) {
        await performVisualSearch(imageBase64, collection);
      }
    };
    window.addEventListener(
      "visual-search-requested",
      handleVisualSearchRequest
    );
    return () => {
      window.removeEventListener(
        "visual-search-requested",
        handleVisualSearchRequest
      );
    };
  }, [documentId, activeFilters]);
  const performVisualSearch = async (imageBase64, collection = "visual_pages") => {
    setActiveTab("similar");
    setIsSearching(true);
    setSearchError(null);
    setIsInitializing(false);
    try {
      const filters = {};
      if (activeFilters.correspondentId) {
        filters.correspondent_id = activeFilters.correspondentId;
      }
      if (activeFilters.tagIds && activeFilters.tagIds.length > 0) {
        filters.tag_ids = activeFilters.tagIds;
      }
      const response = await fetch("/api/visual-rag/search/visual", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": `history-${documentId}-${Date.now()}`
        },
        body: JSON.stringify({
          image: imageBase64,
          collection,
          k: 5,
          filters: Object.keys(filters).length > 0 ? filters : void 0
        })
      });
      if (response.status === 503) {
        const data2 = await response.json();
        if (data2.type === "SIDECAR_INITIALIZING") {
          setIsInitializing(true);
          setInitStage(data2.detail || "GPU Initializing...");
          return;
        }
        throw new Error(data2.error || "Service unavailable");
      }
      if (!response.ok) {
        const data2 = await response.json();
        throw new Error(data2.error || "Search failed");
      }
      const data = await response.json();
      const results = (data.results || []).map(
        (r3) => ({
          docId: r3.docId,
          pageNum: r3.pageNum,
          score: r3.score,
          thumbnailUrl: r3.thumbnailUrl
        })
      );
      setSimilarResults(results);
      setActiveTab("similar");
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setIsSearching(false);
    }
  };
  const handleFilterByCorrespondent = (correspondentId) => {
    setActiveFilters((prev) => ({
      ...prev,
      correspondentId
    }));
  };
  const handleFilterByTag = (tagId) => {
    setActiveFilters((prev) => ({
      ...prev,
      tagIds: [...prev.tagIds || [], tagId].filter(
        (id, idx, arr) => arr.indexOf(id) === idx
      )
    }));
  };
  const removeFilter = (type, id) => {
    if (type === "correspondent") {
      setActiveFilters((prev) => {
        const { correspondentId, ...rest } = prev;
        return rest;
      });
    } else if (type === "tag" && id !== void 0) {
      setActiveFilters((prev) => ({
        ...prev,
        tagIds: (prev.tagIds || []).filter((t3) => t3 !== id)
      }));
    }
  };
  const clearAllFilters = () => {
    setActiveFilters({});
  };
  const FilterBadge = ({
    label,
    onRemove
  }) => /* @__PURE__ */ u3("span", { className: "inline-flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full mr-1 mb-1", children: [
    label,
    /* @__PURE__ */ u3(
      "button",
      {
        onClick: onRemove,
        className: "ml-1 text-blue-600 hover:text-blue-800",
        "aria-label": `Remove filter: ${label}`,
        children: /* @__PURE__ */ u3("i", { className: "fas fa-times" })
      }
    )
  ] });
  return /* @__PURE__ */ u3("div", { "data-testid": "history-tabs-root", "data-hydrated": "true", className: "h-full flex flex-col", children: [
    /* @__PURE__ */ u3(
      "div",
      {
        role: "tablist",
        "aria-label": "Document tabs",
        "aria-orientation": "horizontal",
        className: "flex border-b border-gray-200",
        children: [
          /* @__PURE__ */ u3(
            "button",
            {
              type: "button",
              id: `tab-text`,
              role: "tab",
              "aria-selected": "true",
              "aria-controls": `panel-text`,
              tabIndex: activeTab === "text" ? 0 : -1,
              "data-testid": `tab-text`,
              onClick: () => setActiveTab("text"),
              onKeyDown: handleKeyDown,
              className: `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "text" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-600 hover:text-gray-900"}`,
              children: [
                /* @__PURE__ */ u3("i", { className: "fas fa-file-alt mr-1" }),
                "Text"
              ]
            }
          ),
          /* @__PURE__ */ u3(
            "button",
            {
              type: "button",
              id: `tab-metadata`,
              role: "tab",
              "aria-selected": "false",
              "aria-controls": `panel-metadata`,
              tabIndex: activeTab === "metadata" ? 0 : -1,
              "data-testid": `tab-metadata`,
              onClick: () => setActiveTab("metadata"),
              onKeyDown: handleKeyDown,
              className: `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "metadata" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-600 hover:text-gray-900"}`,
              children: [
                /* @__PURE__ */ u3("i", { className: "fas fa-tags mr-1" }),
                "Metadata"
              ]
            }
          ),
          /* @__PURE__ */ u3(
            "button",
            {
              type: "button",
              id: `tab-similar`,
              role: "tab",
              "aria-selected": "false",
              "aria-controls": `panel-similar`,
              tabIndex: activeTab === "similar" ? 0 : -1,
              "data-testid": `tab-similar`,
              onClick: () => setActiveTab("similar"),
              onKeyDown: handleKeyDown,
              className: `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "similar" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-600 hover:text-gray-900"}`,
              children: [
                /* @__PURE__ */ u3("i", { className: "fas fa-search mr-1" }),
                "Similar"
              ]
            }
          )
        ]
      }
    ),
    (activeFilters.correspondentId || activeFilters.tagIds && activeFilters.tagIds.length > 0) && /* @__PURE__ */ u3("div", { className: "p-2 bg-gray-50 border-b flex flex-wrap items-center", children: [
      /* @__PURE__ */ u3("span", { className: "text-xs text-gray-500 mr-2", children: "Active filters:" }),
      activeFilters.correspondentId && /* @__PURE__ */ u3(
        FilterBadge,
        {
          label: `Correspondent: ${metadata?.correspondent || activeFilters.correspondentId}`,
          onRemove: () => removeFilter("correspondent")
        }
      ),
      activeFilters.tagIds?.map((tagId) => {
        const tag = metadata?.tags?.find((t3) => t3.id === tagId);
        return /* @__PURE__ */ u3("span", { children: /* @__PURE__ */ u3(
          FilterBadge,
          {
            label: `Tag: ${tag?.name || tagId}`,
            onRemove: () => removeFilter("tag", tagId)
          }
        ) }, tagId);
      }),
      /* @__PURE__ */ u3(
        "button",
        {
          onClick: clearAllFilters,
          className: "text-xs text-red-600 hover:text-red-800 ml-2",
          children: "Clear all"
        }
      )
    ] }),
    /* @__PURE__ */ u3("div", { className: "flex-1 overflow-auto p-4", children: [
      /* @__PURE__ */ u3(
        "div",
        {
          role: "tabpanel",
          id: "panel-text",
          "aria-labelledby": "tab-text",
          "data-testid": "panel-text",
          "aria-hidden": "false",
          tabIndex: activeTab === "text" ? 0 : -1,
          className: activeTab === "text" ? "" : "hidden",
          children: /* @__PURE__ */ u3("div", { className: "prose prose-sm max-w-none", children: content ? /* @__PURE__ */ u3("pre", { className: "whitespace-pre-wrap text-sm text-gray-700", children: content }) : /* @__PURE__ */ u3("p", { className: "text-gray-500 italic", children: "No text content available" }) })
        }
      ),
      /* @__PURE__ */ u3(
        "div",
        {
          role: "tabpanel",
          id: "panel-metadata",
          "aria-labelledby": "tab-metadata",
          "data-testid": "panel-metadata",
          "aria-hidden": "true",
          tabIndex: activeTab === "metadata" ? 0 : -1,
          className: activeTab === "metadata" ? "" : "hidden",
          children: /* @__PURE__ */ u3("dl", { className: "space-y-3", children: [
            metadata?.correspondent && /* @__PURE__ */ u3("div", { className: "flex items-center justify-between", children: [
              /* @__PURE__ */ u3("dt", { className: "text-sm font-medium text-gray-500", children: "Correspondent" }),
              /* @__PURE__ */ u3("dd", { className: "text-sm text-gray-900 flex items-center", children: [
                metadata.correspondent,
                metadata.correspondentId && /* @__PURE__ */ u3(
                  "button",
                  {
                    onClick: () => handleFilterByCorrespondent(metadata.correspondentId),
                    className: "ml-2 text-xs text-blue-600 hover:text-blue-800",
                    title: "Filter Similar by this correspondent",
                    children: /* @__PURE__ */ u3("i", { className: "fas fa-filter" })
                  }
                )
              ] })
            ] }),
            metadata?.tags && metadata.tags.length > 0 && /* @__PURE__ */ u3("div", { children: [
              /* @__PURE__ */ u3("dt", { className: "text-sm font-medium text-gray-500 mb-1", children: "Tags" }),
              /* @__PURE__ */ u3("dd", { className: "flex flex-wrap gap-1", children: metadata.tags.map((tag) => /* @__PURE__ */ u3(
                "span",
                {
                  className: "inline-flex items-center px-2 py-1 text-xs bg-gray-100 rounded",
                  children: [
                    tag.name,
                    /* @__PURE__ */ u3(
                      "button",
                      {
                        onClick: () => handleFilterByTag(tag.id),
                        className: "ml-1 text-gray-400 hover:text-blue-600",
                        title: "Filter Similar by this tag",
                        children: /* @__PURE__ */ u3("i", { className: "fas fa-filter text-xs" })
                      }
                    )
                  ]
                },
                tag.id
              )) })
            ] }),
            metadata?.documentType && /* @__PURE__ */ u3("div", { className: "flex justify-between", children: [
              /* @__PURE__ */ u3("dt", { className: "text-sm font-medium text-gray-500", children: "Document Type" }),
              /* @__PURE__ */ u3("dd", { className: "text-sm text-gray-900", children: metadata.documentType })
            ] }),
            metadata?.created && /* @__PURE__ */ u3("div", { className: "flex justify-between", children: [
              /* @__PURE__ */ u3("dt", { className: "text-sm font-medium text-gray-500", children: "Created" }),
              /* @__PURE__ */ u3("dd", { className: "text-sm text-gray-900", children: metadata.created })
            ] }),
            metadata?.modified && /* @__PURE__ */ u3("div", { className: "flex justify-between", children: [
              /* @__PURE__ */ u3("dt", { className: "text-sm font-medium text-gray-500", children: "Modified" }),
              /* @__PURE__ */ u3("dd", { className: "text-sm text-gray-900", children: metadata.modified })
            ] })
          ] })
        }
      ),
      /* @__PURE__ */ u3(
        "div",
        {
          role: "tabpanel",
          id: "panel-similar",
          "aria-labelledby": "tab-similar",
          "data-testid": "panel-similar",
          "aria-hidden": "true",
          tabIndex: activeTab === "similar" ? 0 : -1,
          className: activeTab === "similar" ? "" : "hidden",
          children: [
            isInitializing && /* @__PURE__ */ u3(
              "div",
              {
                className: "flex flex-col items-center justify-center py-8",
                "data-testid": "gpu-initializing",
                children: [
                  /* @__PURE__ */ u3("div", { className: "animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4" }),
                  /* @__PURE__ */ u3("p", { className: "text-sm text-gray-600", children: "GPU Initializing..." }),
                  /* @__PURE__ */ u3("p", { className: "text-xs text-gray-400 mt-1", children: initStage }),
                  /* @__PURE__ */ u3("p", { className: "text-xs text-gray-400", children: "RTX 3090 Ti loading ColQwen3-4B-AWQ" })
                ]
              }
            ),
            isSearching && !isInitializing && /* @__PURE__ */ u3(
              "div",
              {
                className: "flex flex-col items-center justify-center py-8",
                "data-testid": "searching",
                children: [
                  /* @__PURE__ */ u3("div", { className: "animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4" }),
                  /* @__PURE__ */ u3("p", { className: "text-sm text-gray-600", children: "Searching..." })
                ]
              }
            ),
            searchError && !isSearching && /* @__PURE__ */ u3(
              "div",
              {
                className: "bg-red-50 border border-red-200 rounded p-4",
                "data-testid": "search-error",
                children: /* @__PURE__ */ u3("p", { className: "text-sm text-red-700", children: [
                  /* @__PURE__ */ u3("i", { className: "fas fa-exclamation-triangle mr-2" }),
                  searchError
                ] })
              }
            ),
            !isSearching && !isInitializing && !searchError && similarResults.length > 0 && /* @__PURE__ */ u3("div", { "data-testid": "similar-results", children: [
              /* @__PURE__ */ u3("p", { className: "text-sm text-gray-500 mb-3", children: [
                "Found ",
                similarResults.length,
                " similar documents"
              ] }),
              /* @__PURE__ */ u3("div", { className: "space-y-3", children: similarResults.map((result, idx) => /* @__PURE__ */ u3(
                "div",
                {
                  className: "flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors",
                  children: [
                    result.thumbnailUrl && /* @__PURE__ */ u3(
                      "img",
                      {
                        src: result.thumbnailUrl,
                        alt: `Document ${result.docId} thumbnail`,
                        className: "w-16 h-20 object-cover rounded mr-3 border"
                      }
                    ),
                    /* @__PURE__ */ u3("div", { className: "flex-1", children: [
                      /* @__PURE__ */ u3(
                        "a",
                        {
                          href: `/history/${result.docId}`,
                          className: "text-blue-600 hover:text-blue-800 font-medium",
                          children: [
                            "Document #",
                            result.docId
                          ]
                        }
                      ),
                      result.pageNum && /* @__PURE__ */ u3("span", { className: "text-xs text-gray-500 ml-2", children: [
                        "Page ",
                        result.pageNum
                      ] }),
                      /* @__PURE__ */ u3("div", { className: "mt-1", children: [
                        /* @__PURE__ */ u3("span", { className: "text-xs text-gray-500", children: "Similarity:" }),
                        /* @__PURE__ */ u3("span", { className: "ml-1 text-sm font-medium text-green-600", children: [
                          (result.score * 100).toFixed(1),
                          "%"
                        ] }),
                        /* @__PURE__ */ u3("div", { className: "w-24 h-1.5 bg-gray-200 rounded-full mt-1", children: (() => {
                          const pct = Math.round(result.score * 100);
                          return /* @__PURE__ */ u3("div", { className: "h-full bg-green-500 rounded-full", style: { width: `${pct}%` } });
                        })() })
                      ] })
                    ] })
                  ]
                },
                `${result.docId}-${idx}`
              )) })
            ] }),
            !isSearching && !isInitializing && !searchError && similarResults.length === 0 && /* @__PURE__ */ u3(
              "div",
              {
                className: "text-center py-8",
                "data-testid": "similar-empty",
                children: [
                  /* @__PURE__ */ u3("i", { className: "fas fa-search text-4xl text-gray-300 mb-4" }),
                  /* @__PURE__ */ u3("p", { className: "text-sm text-gray-500", children: "Select a region in the document viewer to find similar documents" }),
                  /* @__PURE__ */ u3("p", { className: "text-xs text-gray-400 mt-2", children: "Results use MaxSim scoring from ColQwen3-4B-AWQ" })
                ]
              }
            )
          ]
        }
      )
    ] })
  ] });
}

// src/islands/OverlayViewerIsland.module.css
var OverlayViewerIsland_default = {
  legendDot: "OverlayViewerIsland_legendDot",
  documentPane: "OverlayViewerIsland_documentPane",
  viewport: "OverlayViewerIsland_viewport",
  overlayBox: "OverlayViewerIsland_overlayBox",
  overlayLabel: "OverlayViewerIsland_overlayLabel",
  highlightRegion: "OverlayViewerIsland_highlightRegion",
  selectionBoxContainer: "OverlayViewerIsland_selectionBoxContainer",
  resultsPanel: "OverlayViewerIsland_resultsPanel"
};

// src/islands/OverlayViewerIsland.tsx
var import_overlay_utils = __toESM(require_overlay_utils());
var MIN_SELECTION_SIZE = 20;
var MIN_SIZE_FRACTION = 0.01;
function OverlayViewerIsland(props) {
  const {
    documentId: initialDocumentId,
    page: initialPage = 1,
    originalUrl: initialOriginalUrl = null,
    onRegionSelected,
    overlayMode = "none",
    showLegend = false,
    allowSelection = true,
    mode = "visual-search",
    suggestions = []
  } = props;
  const containerRef = A2(null);
  const canvasRef = A2(null);
  const imageRef = A2(null);
  const [docId, setDocId] = d2(initialDocumentId || null);
  const [page, setPage] = d2(initialPage);
  const [originalUrl, setOriginalUrl] = d2(initialOriginalUrl || null);
  const [pageCount, setPageCount] = d2(props?.pageCount ?? null);
  y2(() => {
    const handler = (e3) => {
      const d3 = e3?.detail || {};
      if (d3.documentId !== void 0 && d3.documentId !== null) setDocId(d3.documentId);
      if (d3.page !== void 0 && d3.page !== null) setPage(Number(d3.page));
      if (Object.prototype.hasOwnProperty.call(d3, "originalUrl")) setOriginalUrl(d3.originalUrl || null);
      else if (Object.prototype.hasOwnProperty.call(d3, "original_url")) setOriginalUrl(d3.original_url || null);
      if (Object.prototype.hasOwnProperty.call(d3, "pageCount")) setPageCount(d3.pageCount === null ? null : Number(d3.pageCount));
    };
    window.addEventListener("overlay:document-changed", handler);
    return () => {
      window.removeEventListener("overlay:document-changed", handler);
    };
  }, []);
  y2(() => {
    if (initialDocumentId !== void 0 && initialDocumentId !== null) {
      setDocId(initialDocumentId);
    }
  }, [initialDocumentId]);
  const normalizeOverlayBox = q2((box) => {
    if (!box) return null;
    const x4 = Number(box.x ?? 0);
    const y3 = Number(box.y ?? 0);
    const width = Number(box.width ?? 0);
    const height = Number(box.height ?? 0);
    if (!Number.isFinite(x4) || !Number.isFinite(y3)) return null;
    if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
    const maxVal = Math.max(x4 + width, y3 + height);
    const scale2 = maxVal <= 1 ? 1 : 1e3;
    return {
      left: x4 / scale2 * 100,
      top: y3 / scale2 * 100,
      width: width / scale2 * 100,
      height: height / scale2 * 100
    };
  }, []);
  const [isDrawMode, setIsDrawMode] = d2(false);
  const drawModeRef = A2(false);
  const [isDrawing, setIsDrawing] = d2(false);
  const isDrawingRef = A2(false);
  const pointerActiveRef = A2(false);
  const [boxes, setBoxes] = d2([]);
  const [currentBox, setCurrentBox] = d2(null);
  const currentBoxRef = A2(null);
  const [imageLoaded, setImageLoaded] = d2(false);
  const [imageError, setImageError] = d2(null);
  const [warning, setWarning] = d2(null);
  const [legend, setLegend] = d2([]);
  const [overlayItems, setOverlayItems] = d2([]);
  const [overlayLoading, setOverlayLoading] = d2(false);
  const [overlayError, setOverlayError] = d2(null);
  const [mandatoryOnly, setMandatoryOnly] = d2(false);
  const [overlayDomain, setOverlayDomain] = d2("general");
  const selectionEnabled = allowSelection !== false;
  const viewportRef = A2(null);
  const [scale, setScale] = d2(1);
  const scaleRef = A2(1);
  const [translateX, setTranslateX] = d2(0);
  const [translateY, setTranslateY] = d2(0);
  const translateRef = A2({ x: 0, y: 0 });
  const [panMode, setPanMode] = d2(false);
  const panActiveRef = A2(false);
  const lastPanPointRef = A2(null);
  const drawModeButtonRef = A2(null);
  const panModeButtonRef = A2(null);
  const [showResults, setShowResults] = d2(false);
  const [results, setResults] = d2([]);
  const [resultsLoading, setResultsLoading] = d2(false);
  const [resultsError, setResultsError] = d2(null);
  const [splitPos, setSplitPos] = d2(60);
  const [isResizing, setIsResizing] = d2(false);
  const [highlightedRegion, setHighlightedRegion] = d2(null);
  const MIN_SCALE = 0.5;
  const MAX_SCALE = 3;
  const SCALE_STEP = 0.1;
  const applyScale = q2((next) => {
    const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
    scaleRef.current = clamped;
    setScale(clamped);
  }, []);
  const clampTranslate = q2((tx, ty, s3) => {
    const container = containerRef.current;
    if (!container) return { x: tx, y: ty };
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const img = imageRef.current;
    const natW = img && img.naturalWidth ? img.naturalWidth : null;
    const natH = img && img.naturalHeight ? img.naturalHeight : null;
    try {
      const clamped = (0, import_overlay_utils.clampTranslate)(tx, ty, s3, cw, ch, natW, natH, "contain");
      return { x: clamped.x, y: clamped.y };
    } catch (_e) {
      const minX = Math.min(0, cw - cw * s3);
      const maxX = 0;
      const minY = Math.min(0, ch - ch * s3);
      const maxY = 0;
      const cx = Math.min(maxX, Math.max(minX, tx));
      const cy = Math.min(maxY, Math.max(minY, ty));
      return { x: cx, y: cy };
    }
  }, []);
  const applyTranslate = q2((x4, y3) => {
    const clamped = clampTranslate(x4, y3, scaleRef.current || 1);
    translateRef.current = { x: clamped.x, y: clamped.y };
    setTranslateX(clamped.x);
    setTranslateY(clamped.y);
  }, [clampTranslate]);
  y2(() => {
    const handler = (e3) => {
      const detail = e3?.detail || {};
      const { bbox, page: targetPage } = detail;
      if (targetPage && targetPage !== page) setPage(targetPage);
      if (bbox) {
        setHighlightedRegion({ ...bbox, id: "highlight" });
        const container = containerRef.current;
        if (container) {
          const cw = container.clientWidth;
          const ch = container.clientHeight;
          const w4 = bbox.width;
          const h3 = bbox.height;
          const desiredCoverage = 0.6;
          const scaleX = w4 > 0 ? desiredCoverage / w4 : 1;
          const scaleY = h3 > 0 ? desiredCoverage / h3 : 1;
          const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.min(scaleX, scaleY)));
          const cx = bbox.x + bbox.width / 2;
          const cy = bbox.y + bbox.height / 2;
          const tx = cw / 2 - cx * cw * newScale;
          const ty = ch / 2 - cy * ch * newScale;
          applyScale(newScale);
          applyTranslate(tx, ty);
        }
        setTimeout(() => setHighlightedRegion(null), 5e3);
      }
    };
    window.addEventListener("overlay:highlight-region", handler);
    return () => window.removeEventListener("overlay:highlight-region", handler);
  }, [page, applyScale, applyTranslate]);
  const resetView = q2(() => {
    applyScale(1);
    applyTranslate(0, 0);
  }, [applyScale, applyTranslate]);
  const zoomIn = q2(() => applyScale(scaleRef.current + SCALE_STEP), [applyScale]);
  const zoomOut = q2(() => applyScale(scaleRef.current - SCALE_STEP), [applyScale]);
  const handleWheel = q2((e3) => {
    if (!viewportRef.current || !containerRef.current) return;
    const delta = -e3.deltaY;
    const factor = e3.ctrlKey || e3.metaKey ? 15e-4 : 25e-4;
    const s3 = scaleRef.current || 1;
    const nextS = Math.min(MAX_SCALE, Math.max(MIN_SCALE, s3 * (1 + delta * factor)));
    if (Math.abs(nextS - s3) < 1e-5) return;
    const rect = containerRef.current.getBoundingClientRect();
    const rawX = e3.clientX - rect.left;
    const rawY = e3.clientY - rect.top;
    const sx = nextS / s3;
    const currentTx = translateRef.current.x || 0;
    const currentTy = translateRef.current.y || 0;
    const nextTx = currentTx * sx + rawX * (1 - sx);
    const nextTy = currentTy * sx + rawY * (1 - sx);
    applyScale(nextS);
    applyTranslate(nextTx, nextTy);
    e3.preventDefault();
  }, [applyScale, applyTranslate]);
  const togglePanMode = q2(() => {
    const next = !panMode;
    setPanMode(next);
    if (next) {
      drawModeRef.current = false;
      setIsDrawMode(false);
    }
  }, [panMode]);
  const imageUrl = docId ? originalUrl ? `${originalUrl}${originalUrl.includes("?") ? "&" : "?"}page=${page}` : `/documents/${docId}/download/original/?page=${page}` : null;
  y2(() => {
    if (!imageUrl) return;
    setImageLoaded(false);
    setImageError(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (imageRef.current) {
        imageRef.current.src = img.src;
        try {
          const area = (img.naturalWidth || 0) * (img.naturalHeight || 0);
          if (area > 2e7) {
            setWarning("Large document image detected. Rendering may be slow.");
          }
        } catch (e3) {
        }
      }
      setImageLoaded(true);
    };
    img.onerror = () => setImageError("Failed to load document image");
    img.src = imageUrl;
  }, [imageUrl]);
  y2(() => {
    let cancelled = false;
    const loadOverlays = async () => {
      if (overlayMode !== "document" || !docId) {
        setOverlayItems([]);
        setOverlayError(null);
        setOverlayLoading(false);
        return;
      }
      setOverlayLoading(true);
      setOverlayError(null);
      try {
        const response = await fetch(`/api/visual-rag/overlays/${docId}?page=${page}`);
        if (!response.ok) throw new Error("Failed to load overlays");
        const data = await response.json();
        const overlays = Array.isArray(data.overlays) ? data.overlays : [];
        if (!cancelled) {
          setOverlayItems(overlays);
          const domain = overlays[0]?.domain || "general";
          setOverlayDomain(String(domain).toLowerCase());
        }
      } catch (err) {
        if (!cancelled) {
          setOverlayError(err.message || "Overlay load failed");
          setOverlayItems([]);
        }
      } finally {
        if (!cancelled) setOverlayLoading(false);
      }
    };
    void loadOverlays();
    resetView();
    return () => {
      cancelled = true;
    };
  }, [overlayMode, docId, page, resetView]);
  y2(() => {
    let cancelled = false;
    const loadUserAnnotations = async () => {
      if (!docId) return;
      try {
        const resp = await fetch(`/manual/annotations/${docId}?page=${page}`);
        if (!resp.ok) return;
        const data = await resp.json();
        if (cancelled) return;
        const anns = Array.isArray(data.annotations) ? data.annotations : [];
        document.dispatchEvent(new CustomEvent("annotations:loaded", { detail: { annotations: anns } }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("Failed to load user annotations", msg);
      }
    };
    void loadUserAnnotations();
    const saveListener = async (e3) => {
      const payload = e3?.detail;
      if (!payload || !payload.documentId || !Array.isArray(payload.annotations)) return;
      try {
        const resp = await fetch("/manual/annotations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!resp.ok) {
          const txt = await resp.text();
          console.error("Failed to persist annotations", txt);
          return;
        }
        const result = await resp.json();
        if (cancelled) return;
        const created = Array.isArray(result.created) ? result.created : [];
        document.dispatchEvent(new CustomEvent("annotations:loaded", { detail: { annotations: created } }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("Annotation save failed", msg);
      }
    };
    document.addEventListener("payload:ready", saveListener);
    return () => {
      cancelled = true;
      document.removeEventListener("payload:ready", saveListener);
    };
  }, [docId, page]);
  y2(() => {
    let cancelled = false;
    const loadLegend = async () => {
      if (!showLegend) return;
      try {
        const resp = await fetch(`/api/visual-rag/legend/${overlayDomain}`);
        if (!resp.ok) throw new Error("Legend not available");
        const data = await resp.json();
        if (!cancelled) setLegend(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) setLegend([]);
      }
    };
    void loadLegend();
    return () => {
      cancelled = true;
    };
  }, [overlayDomain, showLegend]);
  y2(() => {
    const handler = async (e3) => {
      const customEvent = e3;
      const { imageBase64, collection } = customEvent?.detail || {};
      setResultsLoading(true);
      setResultsError(null);
      setShowResults(true);
      setResults([]);
      try {
        const response = await fetch("/api/visual-rag/search/visual", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: imageBase64, collection, k: 10 })
        });
        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Search failed: ${response.status} ${text}`);
        }
        const data = await response.json();
        setResults(Array.isArray(data.results) ? data.results : []);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setResultsError(msg || "Visual search failed");
      } finally {
        setResultsLoading(false);
      }
    };
    window.addEventListener("visual-search-requested", handler);
    return () => window.removeEventListener("visual-search-requested", handler);
  }, []);
  const getRelativePosition = q2(
    (e3) => {
      const container = containerRef.current;
      if (!container) return { x: 0, y: 0 };
      const rect = container.getBoundingClientRect();
      let clientX, clientY;
      if ("touches" in e3) {
        const touch = e3.touches[0] || e3.changedTouches[0];
        clientX = touch.clientX;
        clientY = touch.clientY;
      } else {
        clientX = e3.clientX;
        clientY = e3.clientY;
      }
      const tx = translateRef.current.x || 0;
      const ty = translateRef.current.y || 0;
      const s3 = scaleRef.current || 1;
      const rawX = clientX - rect.left;
      const rawY = clientY - rect.top;
      return { x: (rawX - tx) / s3, y: (rawY - ty) / s3 };
    },
    []
  );
  const handleMouseDown = q2(
    (e3) => {
      if (!selectionEnabled || !drawModeRef.current) return;
      e3.preventDefault();
      const pos = getRelativePosition(e3);
      const nextBox = { id: `box-${Date.now()}`, x: pos.x, y: pos.y, width: 0, height: 0 };
      isDrawingRef.current = true;
      currentBoxRef.current = nextBox;
      setIsDrawing(true);
      setCurrentBox(nextBox);
      setWarning(null);
    },
    [getRelativePosition]
  );
  const handleMouseMove = q2(
    (e3) => {
      if (!isDrawingRef.current || !currentBoxRef.current) return;
      e3.preventDefault();
      const pos = getRelativePosition(e3);
      const nextBox = {
        ...currentBoxRef.current,
        width: pos.x - currentBoxRef.current.x,
        height: pos.y - currentBoxRef.current.y
      };
      currentBoxRef.current = nextBox;
      setCurrentBox(nextBox);
    },
    [getRelativePosition]
  );
  const captureRegion = q2(
    async (box, eventName) => {
      const container = containerRef.current;
      const img = imageRef.current;
      if (!container || !img) return;
      if (!imageLoaded && !imageError) {
        return;
      }
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const naturalWidth = img.naturalWidth || container.clientWidth;
        const naturalHeight = img.naturalHeight || container.clientHeight;
        const scaleX = naturalWidth / container.clientWidth;
        const scaleY = naturalHeight / container.clientHeight;
        const srcX = box.x * scaleX;
        const srcY = box.y * scaleY;
        const srcWidth = box.width * scaleX;
        const srcHeight = box.height * scaleY;
        canvas.width = srcWidth;
        canvas.height = srcHeight;
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
          ctx.drawImage(img, srcX, srcY, srcWidth, srcHeight, 0, 0, srcWidth, srcHeight);
        } else {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        const dataUrl = canvas.toDataURL("image/png");
        const base64 = dataUrl.split(",")[1];
        const event = new CustomEvent(eventName, {
          detail: {
            imageBase64: base64,
            collection: "visual_pages",
            documentId: docId,
            page,
            bbox: {
              x: box.x / container.clientWidth,
              y: box.y / container.clientHeight,
              width: box.width / container.clientWidth,
              height: box.height / container.clientHeight
            }
          }
        });
        if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
          window.dispatchEvent(event);
        }
        if (eventName === "visual-search-requested" && onRegionSelected) {
          onRegionSelected(base64, box);
        }
      } catch (err) {
        console.error("Failed to capture region:", err);
        setWarning("Failed to capture selection. Please try again.");
      }
    },
    [docId, page, imageLoaded, imageError, onRegionSelected]
  );
  const handleMouseUp = q2((e3) => {
    if (!isDrawingRef.current || !currentBoxRef.current) return;
    if (e3) {
      const pos = getRelativePosition(e3);
      currentBoxRef.current = {
        ...currentBoxRef.current,
        width: pos.x - currentBoxRef.current.x,
        height: pos.y - currentBoxRef.current.y
      };
      setCurrentBox(currentBoxRef.current);
    }
    const activeBox = currentBoxRef.current;
    isDrawingRef.current = false;
    setIsDrawing(false);
    const container = containerRef.current;
    if (!container) return;
    const normalizedBox = {
      ...activeBox,
      x: activeBox.width < 0 ? activeBox.x + activeBox.width : activeBox.x,
      y: activeBox.height < 0 ? activeBox.y + activeBox.height : activeBox.y,
      width: Math.abs(activeBox.width),
      height: Math.abs(activeBox.height)
    };
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    if (normalizedBox.width < MIN_SELECTION_SIZE || normalizedBox.height < MIN_SELECTION_SIZE) {
      setWarning("Selection too small. Please draw a larger box.");
      currentBoxRef.current = null;
      setCurrentBox(null);
      return;
    }
    const widthFraction = normalizedBox.width / containerWidth;
    const heightFraction = normalizedBox.height / containerHeight;
    if (widthFraction < MIN_SIZE_FRACTION || heightFraction < MIN_SIZE_FRACTION) {
      setWarning("Selection too small to yield meaningful results.");
      currentBoxRef.current = null;
      setCurrentBox(null);
      return;
    }
    setBoxes((prev) => [...prev, normalizedBox]);
    currentBoxRef.current = null;
    setCurrentBox(null);
    if (mode === "draw") {
      captureRegion(normalizedBox, "overlay:draw-complete");
    } else {
      captureRegion(normalizedBox, "visual-search-requested");
    }
  }, [captureRegion, getRelativePosition, mode]);
  const removeBox = q2((boxId) => {
    setBoxes((prev) => prev.filter((b3) => b3.id !== boxId));
  }, []);
  const clearAllBoxes = q2(() => {
    setBoxes([]);
    setWarning(null);
  }, []);
  const toggleDrawMode = q2(() => {
    if (!selectionEnabled) return;
    const next = !drawModeRef.current;
    drawModeRef.current = next;
    setIsDrawMode(next);
    if (!next) {
      isDrawingRef.current = false;
      currentBoxRef.current = null;
      setIsDrawing(false);
      setCurrentBox(null);
    }
  }, []);
  y2(() => {
    drawModeRef.current = isDrawMode;
  }, [isDrawMode]);
  y2(() => {
    if (drawModeButtonRef.current) {
      drawModeButtonRef.current.setAttribute("aria-pressed", isDrawMode ? "true" : "false");
    }
    if (panModeButtonRef.current) {
      panModeButtonRef.current.setAttribute("aria-pressed", panMode ? "true" : "false");
    }
  }, [isDrawMode, panMode]);
  const changePage = q2((delta) => {
    const next = Math.max(1, page + delta);
    if (pageCount && next > pageCount) return;
    setPage(next);
    const ev = new CustomEvent("overlay:document-changed", {
      detail: { documentId: docId, page: next, originalUrl, pageCount }
    });
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      window.dispatchEvent(ev);
    }
  }, [page, pageCount, docId, originalUrl]);
  y2(() => {
    const handleGlobalUp = (event) => {
      if (isDrawingRef.current) handleMouseUp(event);
      if (isResizing) setIsResizing(false);
    };
    const handleGlobalMove = (e3) => {
      if (isResizing) {
        const container = containerRef.current?.parentElement?.parentElement;
        if (container) {
          const rect = container.getBoundingClientRect();
          const percent = (e3.clientX - rect.left) / rect.width * 100;
          setSplitPos(Math.min(80, Math.max(20, percent)));
        }
      }
    };
    window.addEventListener("pointerup", handleGlobalUp);
    window.addEventListener("mouseup", handleGlobalUp);
    window.addEventListener("touchend", handleGlobalUp);
    window.addEventListener("mousemove", handleGlobalMove);
    return () => {
      window.removeEventListener("pointerup", handleGlobalUp);
      window.removeEventListener("mouseup", handleGlobalUp);
      window.removeEventListener("touchend", handleGlobalUp);
      window.removeEventListener("mousemove", handleGlobalMove);
    };
  }, [handleMouseUp, isResizing]);
  y2(() => {
    const node = containerRef.current;
    if (!node) return;
    node.addEventListener("wheel", handleWheel, { passive: false });
    return () => node.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);
  y2(() => {
    const handler = (e3) => {
      if (e3.target) {
        const t3 = e3.target;
        const tag = (t3.tagName || "").toUpperCase();
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t3.isContentEditable) return;
      }
      if (e3.key === "+" || e3.key === "=") {
        zoomIn();
        e3.preventDefault();
      } else if (e3.key === "-") {
        zoomOut();
        e3.preventDefault();
      } else if (e3.key === "0" || e3.key.toLowerCase() === "r") {
        resetView();
        e3.preventDefault();
      } else if (e3.code === "Space") {
        togglePanMode();
        e3.preventDefault();
      } else if (e3.key.startsWith("Arrow") && panMode) {
        const step = 20;
        if (e3.key === "ArrowLeft") applyTranslate(translateRef.current.x + step, translateRef.current.y);
        if (e3.key === "ArrowRight") applyTranslate(translateRef.current.x - step, translateRef.current.y);
        if (e3.key === "ArrowUp") applyTranslate(translateRef.current.x, translateRef.current.y + step);
        if (e3.key === "ArrowDown") applyTranslate(translateRef.current.x, translateRef.current.y - step);
        e3.preventDefault();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [zoomIn, zoomOut, resetView, togglePanMode, panMode, applyTranslate]);
  const handlePointerDown = q2((e3) => {
    if (panMode) {
      panActiveRef.current = true;
      lastPanPointRef.current = { x: e3.clientX, y: e3.clientY };
      if (containerRef.current?.setPointerCapture) containerRef.current.setPointerCapture(e3.pointerId);
      e3.preventDefault();
      return;
    }
    if (!selectionEnabled || !drawModeRef.current) return;
    pointerActiveRef.current = true;
    if (containerRef.current?.setPointerCapture) containerRef.current.setPointerCapture(e3.pointerId);
    handleMouseDown(e3);
  }, [handleMouseDown, panMode]);
  const handlePointerMove = q2((e3) => {
    if (panActiveRef.current && lastPanPointRef.current) {
      const last = lastPanPointRef.current;
      const dx = e3.clientX - last.x;
      const dy = e3.clientY - last.y;
      const nextX = (translateRef.current.x || 0) + dx;
      const nextY = (translateRef.current.y || 0) + dy;
      applyTranslate(nextX, nextY);
      lastPanPointRef.current = { x: e3.clientX, y: e3.clientY };
      e3.preventDefault();
      return;
    }
    handleMouseMove(e3);
  }, [handleMouseMove, applyTranslate]);
  const handlePointerUp = q2((e3) => {
    if (panActiveRef.current) {
      panActiveRef.current = false;
      lastPanPointRef.current = null;
      if (containerRef.current?.releasePointerCapture) containerRef.current.releasePointerCapture(e3.pointerId);
      e3.preventDefault();
      return;
    }
    handleMouseUp(e3);
    pointerActiveRef.current = false;
    if (containerRef.current?.releasePointerCapture) containerRef.current.releasePointerCapture(e3.pointerId);
  }, [handleMouseUp]);
  const handlePointerCancel = q2((e3) => {
    pointerActiveRef.current = false;
    panActiveRef.current = false;
    lastPanPointRef.current = null;
    if (containerRef.current?.releasePointerCapture) containerRef.current.releasePointerCapture(e3.pointerId);
  }, []);
  const handleMouseDownFallback = q2((e3) => {
    if (!pointerActiveRef.current) handleMouseDown(e3);
  }, [handleMouseDown]);
  const handleMouseMoveFallback = q2((e3) => {
    if (!pointerActiveRef.current) handleMouseMove(e3);
  }, [handleMouseMove]);
  const handleMouseUpFallback = q2((e3) => {
    if (!pointerActiveRef.current) handleMouseUp(e3);
  }, [handleMouseUp]);
  const visibleOverlays = T2(() => {
    if (!overlayItems || overlayItems.length === 0) return [];
    if (!mandatoryOnly) return overlayItems;
    return overlayItems.filter((o3) => o3.isMandatory);
  }, [overlayItems, mandatoryOnly]);
  y2(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(220, 20, 60, 0.9)";
    ctx.lineWidth = 2;
    ctx.fillStyle = "rgba(220, 20, 60, 0.1)";
    boxes.forEach((box) => {
      ctx.strokeRect(box.x, box.y, box.width, box.height);
      ctx.fillRect(box.x, box.y, box.width, box.height);
    });
    if (currentBox && isDrawing) {
      ctx.strokeStyle = "rgba(255, 140, 0, 0.9)";
      ctx.fillStyle = "rgba(255, 140, 0, 0.2)";
      ctx.strokeRect(currentBox.x, currentBox.y, currentBox.width, currentBox.height);
      ctx.fillRect(currentBox.x, currentBox.y, currentBox.width, currentBox.height);
    }
  }, [boxes, currentBox, isDrawing]);
  return /* @__PURE__ */ u3(
    "div",
    {
      "data-testid": "overlay-viewer-root",
      "data-hydrated": "true",
      "data-has-boxes": boxes.length,
      "data-has-warning": warning ? "true" : "false",
      "data-original-url": originalUrl || "",
      className: "h-full flex flex-col overflow-hidden",
      children: [
        /* @__PURE__ */ u3("div", { className: "flex flex-wrap items-center gap-2 p-2 border-b border-gray-200 bg-white z-10", children: [
          selectionEnabled && /* @__PURE__ */ u3(
            "button",
            {
              "data-testid": "red-pen-toggle",
              onClick: toggleDrawMode,
              ref: drawModeButtonRef,
              className: `px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${isDrawMode ? "bg-red-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`,
              children: [
                /* @__PURE__ */ u3("i", { className: `fas fa-pen mr-1.5 ${isDrawMode ? "animate-pulse" : ""}` }),
                isDrawMode ? "Drawing Mode" : "Draw Mode"
              ]
            }
          ),
          selectionEnabled && boxes.length > 0 && /* @__PURE__ */ u3(
            "button",
            {
              "data-testid": "clear-boxes",
              onClick: clearAllBoxes,
              className: "px-3 py-1.5 text-sm text-gray-600 hover:text-red-600",
              children: [
                /* @__PURE__ */ u3("i", { className: "fas fa-trash-alt mr-1" }),
                "Clear (",
                boxes.length,
                ")"
              ]
            }
          ),
          overlayMode === "document" && /* @__PURE__ */ u3("div", { className: "flex items-center gap-2 text-xs text-gray-500", children: [
            overlayLoading && /* @__PURE__ */ u3("span", { children: "Loading overlays..." }),
            !overlayLoading && /* @__PURE__ */ u3("span", { "data-testid": "overlay-count", children: [
              "Overlays: ",
              overlayItems.length
            ] }),
            overlayError && /* @__PURE__ */ u3("span", { className: "text-red-600", children: overlayError }),
            overlayItems.length > 0 && /* @__PURE__ */ u3("label", { className: "flex items-center gap-1 ml-2", children: [
              /* @__PURE__ */ u3(
                "input",
                {
                  type: "checkbox",
                  checked: mandatoryOnly,
                  onChange: (e3) => setMandatoryOnly(e3.target.checked)
                }
              ),
              "Mandatory only"
            ] })
          ] }),
          showLegend && legend.length > 0 && /* @__PURE__ */ u3("div", { "data-testid": "overlay-legend", className: "flex flex-wrap items-center gap-2 text-xs text-gray-600", children: legend.map((item) => /* @__PURE__ */ u3("div", { className: "flex items-center gap-1", children: [
            /* @__PURE__ */ u3("span", { className: `${OverlayViewerIsland_default.legendDot} [--dot-color:${item.color}]`, "aria-hidden": "true" }),
            /* @__PURE__ */ u3("span", { children: item.label })
          ] }, item.key)) }),
          /* @__PURE__ */ u3("div", { className: "flex items-center gap-2 px-2", children: [
            /* @__PURE__ */ u3("button", { "aria-label": "Zoom out", "data-testid": "overlay-zoom-out", onClick: zoomOut, className: "px-2 py-1 bg-gray-100 rounded hover:bg-gray-200", children: "-" }),
            /* @__PURE__ */ u3("span", { "data-testid": "overlay-zoom-percentage", className: "text-xs text-gray-500 w-8 text-center", children: [
              Math.round(scale * 100),
              "%"
            ] }),
            /* @__PURE__ */ u3("button", { "aria-label": "Zoom in", "data-testid": "overlay-zoom-in", onClick: zoomIn, className: "px-2 py-1 bg-gray-100 rounded hover:bg-gray-200", children: "+" }),
            /* @__PURE__ */ u3("button", { "aria-label": "Reset zoom", "data-testid": "overlay-zoom-reset", onClick: resetView, className: "px-2 py-1 bg-gray-100 rounded hover:bg-gray-200", children: "Reset" }),
            /* @__PURE__ */ u3("button", { "data-testid": "overlay-pan-toggle", onClick: togglePanMode, ref: panModeButtonRef, className: `px-2 py-1 rounded hover:bg-gray-200 ${panMode ? "bg-gray-300" : "bg-gray-100"}`, children: "Pan" })
          ] }),
          showResults && /* @__PURE__ */ u3("button", { onClick: () => setShowResults(false), className: "px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs ml-2 hover:bg-blue-200", children: [
            /* @__PURE__ */ u3("i", { className: "fas fa-columns mr-1" }),
            " Hide Results"
          ] }),
          !showResults && results.length > 0 && /* @__PURE__ */ u3("button", { onClick: () => setShowResults(true), className: "px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs ml-2 hover:bg-blue-200", children: [
            /* @__PURE__ */ u3("i", { className: "fas fa-columns mr-1" }),
            " Show Results"
          ] }),
          /* @__PURE__ */ u3("div", { className: "ml-auto flex items-center gap-2", children: [
            /* @__PURE__ */ u3(
              "button",
              {
                "data-testid": "overlay-prev-page",
                onClick: () => changePage(-1),
                "aria-label": "Previous page",
                disabled: page <= 1,
                className: "px-2 py-1 bg-gray-100 text-gray-700 rounded border border-gray-300 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed",
                children: /* @__PURE__ */ u3("i", { className: "fas fa-chevron-left" })
              }
            ),
            /* @__PURE__ */ u3("span", { "data-testid": "overlay-page-indicator", className: "text-xs text-gray-500", children: [
              "Page ",
              page,
              pageCount ? ` of ${pageCount}` : ""
            ] }),
            /* @__PURE__ */ u3(
              "button",
              {
                "data-testid": "overlay-next-page",
                onClick: () => changePage(1),
                "aria-label": "Next page",
                disabled: pageCount ? page >= pageCount : false,
                className: "px-2 py-1 bg-gray-100 text-gray-700 rounded border border-gray-300 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed",
                children: /* @__PURE__ */ u3("i", { className: "fas fa-chevron-right" })
              }
            )
          ] })
        ] }),
        warning && /* @__PURE__ */ u3(
          "div",
          {
            className: "mx-2 my-1 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700",
            "data-testid": "selection-warning",
            children: [
              /* @__PURE__ */ u3("i", { className: "fas fa-exclamation-triangle mr-1" }),
              warning
            ]
          }
        ),
        /* @__PURE__ */ u3("div", { className: "flex-1 flex overflow-hidden", children: [
          /* @__PURE__ */ u3(
            "div",
            {
              className: `${OverlayViewerIsland_default.documentPane} ${showResults ? `[--pane-width:${splitPos}%]` : `[--pane-width:100%]`}`,
              children: /* @__PURE__ */ u3(
                "div",
                {
                  ref: containerRef,
                  "data-testid": "overlay-container",
                  className: `relative flex-1 overflow-hidden ${panMode ? panActiveRef.current ? "cursor-grabbing" : "cursor-grab" : isDrawMode ? "cursor-crosshair" : "cursor-default"} ${isDrawMode ? "touch-none" : "touch-auto"}`,
                  onPointerDown: handlePointerDown,
                  onPointerMove: handlePointerMove,
                  onPointerUp: handlePointerUp,
                  onPointerCancel: handlePointerCancel,
                  onPointerLeave: () => {
                    if (isDrawingRef.current) handleMouseUp();
                  },
                  onMouseDown: handleMouseDownFallback,
                  onMouseMove: handleMouseMoveFallback,
                  onMouseUp: handleMouseUpFallback,
                  onMouseLeave: () => {
                    if (pointerActiveRef.current) return;
                    if (isDrawingRef.current) handleMouseUp();
                  },
                  onTouchStart: handleMouseDownFallback,
                  onTouchMove: handleMouseMoveFallback,
                  onTouchEnd: handleMouseUpFallback,
                  children: [
                    /* @__PURE__ */ u3(
                      "div",
                      {
                        ref: viewportRef,
                        "data-testid": "overlay-viewport",
                        className: `${OverlayViewerIsland_default.viewport} [--viewport-transform:translate(${translateX}px, ${translateY}px) scale(${scale})]`,
                        children: [
                          imageUrl && !imageError ? /* @__PURE__ */ u3(
                            "img",
                            {
                              ref: imageRef,
                              alt: `Document ${docId} page ${page}`,
                              className: `w-full h-full object-contain pointer-events-none select-none ${imageLoaded ? "block" : "hidden"}`,
                              "data-testid": "document-image",
                              draggable: false,
                              crossOrigin: "anonymous",
                              onDragStart: (e3) => e3.preventDefault()
                            }
                          ) : null,
                          imageUrl && !imageLoaded && !imageError && /* @__PURE__ */ u3("div", { className: "absolute inset-0 flex items-center justify-center", "data-testid": "overlay-loading", children: /* @__PURE__ */ u3("div", { className: "animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" }) }),
                          imageError && /* @__PURE__ */ u3("div", { className: "absolute inset-0 flex items-center justify-center", "data-testid": "image-error", children: /* @__PURE__ */ u3("div", { className: "text-center text-gray-500", children: [
                            /* @__PURE__ */ u3("i", { className: "fas fa-exclamation-circle text-3xl mb-2" }),
                            /* @__PURE__ */ u3("p", { className: "text-sm", children: imageError })
                          ] }) }),
                          !imageUrl && /* @__PURE__ */ u3("div", { className: "absolute inset-0 flex items-center justify-center", children: /* @__PURE__ */ u3("p", { className: "text-sm text-gray-500", children: "No document selected" }) }),
                          suggestions.map((item, idx) => {
                            const box = normalizeOverlayBox(item.boundingBox);
                            if (!box) return null;
                            return /* @__PURE__ */ u3(
                              "div",
                              {
                                "data-testid": "overlay-ghost-box",
                                "data-label": item.label,
                                className: `${OverlayViewerIsland_default.overlayBox} [--box-left:${box.left}%] [--box-top:${box.top}%] [--box-width:${box.width}%] [--box-height:${box.height}%] border-dashed border-2 border-gray-400 bg-gray-100/20`,
                                title: item.label || "Suggestion",
                                children: item.label && /* @__PURE__ */ u3("span", { className: "absolute -top-5 left-0 text-xs bg-gray-200 text-gray-700 px-1 rounded", children: item.label })
                              },
                              `ghost-${idx}`
                            );
                          }),
                          overlayMode === "document" && visibleOverlays.map((overlay, idx) => {
                            const box = normalizeOverlayBox(overlay.boundingBox);
                            if (!box) return null;
                            const color = overlay.color || "#2563eb";
                            return /* @__PURE__ */ u3(
                              "div",
                              {
                                "data-testid": "overlay-box",
                                className: `${OverlayViewerIsland_default.overlayBox} [--box-left:${box.left}%] [--box-top:${box.top}%] [--box-width:${box.width}%] [--box-height:${box.height}%] [--box-color:${color}] [--box-bg:${color}22]`,
                                children: /* @__PURE__ */ u3("span", { className: `${OverlayViewerIsland_default.overlayLabel} [--box-color:${color}]`, children: overlay.label || "Overlay" })
                              },
                              overlay.id || `${overlay.label}-${idx}`
                            );
                          }),
                          /* @__PURE__ */ u3("canvas", { ref: canvasRef, className: "absolute inset-0 pointer-events-none", "data-testid": "annotation-canvas" }),
                          highlightedRegion && /* @__PURE__ */ u3(
                            "div",
                            {
                              "data-testid": "overlay-highlight-region",
                              className: `${OverlayViewerIsland_default.highlightRegion} animate-pulse [--region-left:${highlightedRegion.x * 100}%] [--region-top:${highlightedRegion.y * 100}%] [--region-width:${highlightedRegion.width * 100}%] [--region-height:${highlightedRegion.height * 100}%]`
                            }
                          )
                        ]
                      }
                    ),
                    boxes.map((box, idx) => /* @__PURE__ */ u3("div", { className: `${OverlayViewerIsland_default.selectionBoxContainer} [--sel-left:${box.x}px] [--sel-top:${box.y - 24}px]`, children: [
                      /* @__PURE__ */ u3("span", { className: "px-1.5 py-0.5 bg-red-600 text-white text-xs rounded", children: [
                        "Region ",
                        idx + 1
                      ] }),
                      /* @__PURE__ */ u3(
                        "button",
                        {
                          onClick: () => removeBox(box.id),
                          className: "w-5 h-5 bg-white border border-gray-300 rounded-l-none border-l-0 text-xs text-gray-600 hover:text-red-600 hover:border-red-300",
                          title: "Remove this selection",
                          children: /* @__PURE__ */ u3("i", { className: "fas fa-times" })
                        }
                      ),
                      /* @__PURE__ */ u3(
                        "button",
                        {
                          onClick: () => captureRegion(box, "export:region-requested"),
                          className: "w-5 h-5 bg-white border border-gray-300 rounded text-xs text-gray-600 hover:text-blue-600 hover:border-blue-300 ml-1",
                          title: "Export this region",
                          children: /* @__PURE__ */ u3("i", { className: "fas fa-download" })
                        }
                      ),
                      /* @__PURE__ */ u3(
                        "button",
                        {
                          onClick: () => {
                            captureRegion(box, "manual:send-to-chat");
                            const onSend = (e3) => {
                              const { imageBase64, bbox, page: page2, documentId } = e3.detail || {};
                              const context = { type: "visual", data: { imageBase64, bbox, page: page2 }, documentId };
                              window.location.href = `/chat?context=${encodeURIComponent(JSON.stringify(context))}`;
                            };
                            window.addEventListener("manual:send-to-chat", onSend, { once: true });
                          },
                          className: "w-5 h-5 bg-white border border-gray-300 rounded-r border-l-0 text-xs text-gray-600 hover:text-green-600 hover:border-green-300",
                          title: "Send to Chat",
                          children: /* @__PURE__ */ u3("i", { className: "fas fa-comment-dots" })
                        }
                      )
                    ] }, box.id)),
                    isDrawMode && boxes.length === 0 && /* @__PURE__ */ u3(
                      "div",
                      {
                        className: "absolute bottom-2 left-2 right-2 p-2 text-center text-xs text-gray-500 bg-blue-50 rounded pointer-events-none",
                        "data-testid": "selection-instructions",
                        children: [
                          /* @__PURE__ */ u3("i", { className: "fas fa-info-circle mr-1" }),
                          "Click and drag to select a region for visual search"
                        ]
                      }
                    )
                  ]
                }
              )
            }
          ),
          showResults && /* @__PURE__ */ u3(
            "div",
            {
              className: "w-1 bg-gray-200 hover:bg-blue-400 cursor-col-resize flex items-center justify-center z-20",
              onMouseDown: () => setIsResizing(true),
              children: /* @__PURE__ */ u3("div", { className: "h-8 w-1 bg-gray-400 rounded-full" })
            }
          ),
          showResults && /* @__PURE__ */ u3(
            "div",
            {
              className: `${OverlayViewerIsland_default.resultsPanel} [--panel-width:${100 - splitPos}%]`,
              "data-testid": "visual-search-results-panel",
              children: [
                /* @__PURE__ */ u3("div", { className: "p-3 border-b border-gray-100 flex justify-between items-center bg-gray-50", children: [
                  /* @__PURE__ */ u3("h3", { className: "text-sm font-semibold text-gray-700", children: "Visual Search Results" }),
                  /* @__PURE__ */ u3("button", { onClick: () => setShowResults(false), className: "text-gray-400 hover:text-gray-600", "aria-label": "Close results", children: /* @__PURE__ */ u3("i", { className: "fas fa-times" }) })
                ] }),
                /* @__PURE__ */ u3("div", { className: "flex-1 overflow-y-auto p-3 space-y-3", children: [
                  resultsLoading && /* @__PURE__ */ u3("div", { className: "flex flex-col items-center justify-center py-8 text-gray-500", children: [
                    /* @__PURE__ */ u3("div", { className: "animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2" }),
                    /* @__PURE__ */ u3("p", { className: "text-xs", children: "Searching visual index..." })
                  ] }),
                  resultsError && /* @__PURE__ */ u3("div", { className: "p-3 bg-red-50 text-red-700 rounded text-sm border border-red-100", children: [
                    /* @__PURE__ */ u3("i", { className: "fas fa-exclamation-circle mr-2" }),
                    resultsError
                  ] }),
                  !resultsLoading && !resultsError && results.length === 0 && /* @__PURE__ */ u3("div", { className: "text-center py-8 text-gray-400 text-sm", children: [
                    /* @__PURE__ */ u3("i", { className: "fas fa-search mb-2 text-2xl opacity-20" }),
                    /* @__PURE__ */ u3("p", { children: "No visually similar pages found." }),
                    /* @__PURE__ */ u3("p", { className: "text-xs mt-1", children: "Try selecting a distinct region." })
                  ] }),
                  results.map((result, idx) => /* @__PURE__ */ u3(
                    "div",
                    {
                      className: "group border border-gray-200 rounded-lg overflow-hidden hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer bg-white",
                      onClick: () => {
                        if (String(result.document_id) === String(docId)) {
                          setPage(Number(result.page));
                          const ev = new CustomEvent("overlay:document-changed", {
                            detail: { documentId: docId, page: Number(result.page), originalUrl, pageCount }
                          });
                          window.dispatchEvent(ev);
                        } else {
                          window.open(`/manual?open=${result.document_id}&page=${result.page}`, "_blank");
                        }
                      },
                      children: [
                        /* @__PURE__ */ u3("div", { className: "relative aspect-[3/4] bg-gray-100 overflow-hidden border-b border-gray-100", children: [
                          result.thumbnail ? /* @__PURE__ */ u3("img", { src: `data:image/jpeg;base64,${result.thumbnail}`, alt: "Result", className: "w-full h-full object-cover" }) : /* @__PURE__ */ u3("div", { className: "w-full h-full flex items-center justify-center text-gray-300", children: /* @__PURE__ */ u3("i", { className: "fas fa-file-image text-3xl" }) }),
                          /* @__PURE__ */ u3("div", { className: "absolute top-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm", children: [
                            "Score: ",
                            (result.score * 100).toFixed(1),
                            "%"
                          ] })
                        ] }),
                        /* @__PURE__ */ u3("div", { className: "p-2", children: [
                          /* @__PURE__ */ u3("div", { className: "font-medium text-xs text-gray-800 truncate", title: result.title || `Document ${result.document_id}`, children: result.title || `Document ${result.document_id}` }),
                          /* @__PURE__ */ u3("div", { className: "flex justify-between items-center mt-1", children: [
                            /* @__PURE__ */ u3("span", { className: "text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded", children: [
                              "Page ",
                              result.page
                            ] }),
                            String(result.document_id) !== String(docId) && /* @__PURE__ */ u3("i", { className: "fas fa-external-link-alt text-[10px] text-gray-400" })
                          ] })
                        ] })
                      ]
                    },
                    idx
                  ))
                ] })
              ]
            }
          )
        ] })
      ]
    }
  );
}

// src/islands/VisualOverlaysIsland.tsx
var overlayCache = /* @__PURE__ */ new Map();
var CACHE_TTL = 1e3 * 60 * 5;
function debounce(fn2, wait = 200) {
  let t3 = null;
  return (...args) => {
    if (t3) clearTimeout(t3);
    t3 = setTimeout(() => fn2(...args), wait);
  };
}
function getVisibleImageIds(entries) {
  const ids = [];
  entries.forEach((e3) => {
    const target = e3.target;
    const id = target?.dataset?.imageId || target?.getAttribute?.("data-image-id") || null;
    if (!id) return;
    if (e3.isIntersecting || e3.intersectionRatio > 0) ids.push(id);
  });
  return ids;
}
async function fetchOverlaysForImage(image, fetchImpl = globalThis.fetch, options = {}) {
  if (!image) return [];
  const cacheKey = image.id || image.originalSrc || image.thumbnailSrc || JSON.stringify(image);
  const now = Date.now();
  const cached = overlayCache.get(cacheKey);
  if (cached && now - cached.ts < CACHE_TTL) return cached.data;
  let url = "";
  let opts = { method: "GET" };
  if (image.id) {
    url = `/api/visual-rag/overlays?imageId=${encodeURIComponent(image.id)}`;
  } else if (image.originalSrc) {
    url = `/api/visual-rag/overlays/search`;
    opts = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageUrl: image.originalSrc }) };
  } else {
    return [];
  }
  if (typeof fetchImpl !== "function") throw Object.assign(new Error("fetch not available"), { code: "no_fetch" });
  const controller = new AbortController();
  opts.signal = controller.signal;
  let timeoutHandle = null;
  const timeoutMs = options.timeoutMs || 1e4;
  const timeoutPromise = new Promise((_3, reject) => {
    timeoutHandle = setTimeout(() => {
      controller.abort();
      reject(Object.assign(new Error("Fetch timeout"), { code: "timeout" }));
    }, timeoutMs);
  });
  try {
    const res = await Promise.race([fetchImpl(url, opts), timeoutPromise]);
    if (!res || !res.ok) {
      const err = new Error("Overlay service error");
      err.code = res && res.status === 503 ? "service_unavailable" : "fetch_error";
      throw err;
    }
    const json = await res.json();
    const overlays = Array.isArray(json) ? json : Array.isArray(json.overlays) ? json.overlays : [];
    overlayCache.set(cacheKey, { ts: now, data: overlays });
    return overlays;
  } catch (err) {
    const fetchErr = err;
    if (!fetchErr.code) fetchErr.code = fetchErr.name === "AbortError" ? "timeout" : "fetch_error";
    throw fetchErr;
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}
function VisualOverlaysIsland(props) {
  const { images = [], overlaysByImage = {} } = props;
  const [mounted, setMounted] = d2(false);
  const [localOverlays, setLocalOverlays] = d2(overlaysByImage || {});
  const [loadingMap, setLoadingMap] = d2({});
  const [errorMap2, setErrorMap2] = d2({});
  const controllersRef = A2(/* @__PURE__ */ new Map());
  const imageRefs = A2(/* @__PURE__ */ new Map());
  const observerRef = A2(null);
  y2(() => {
    setMounted(true);
  }, []);
  y2(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const intersectCb = debounce((entries) => {
      const visibleIds = getVisibleImageIds(entries);
      visibleIds.forEach((id) => {
        const img = images.find((i4) => i4.id === id || i4.originalSrc === id || i4.thumbnailSrc === id);
        if (!img) return;
        const key = img.id || img.originalSrc || "";
        if (overlaysByImage && Array.isArray(overlaysByImage[img.id])) {
          setLocalOverlays((s3) => ({ ...s3, [img.id]: overlaysByImage[img.id] }));
          return;
        }
        const cached = overlayCache.get(key);
        if (cached && Date.now() - cached.ts < CACHE_TTL) {
          setLocalOverlays((s3) => ({ ...s3, [img.id]: cached.data }));
          return;
        }
        (async () => {
          setLoadingMap((m3) => ({ ...m3, [key]: true }));
          setErrorMap2((m3) => ({ ...m3, [key]: null }));
          const controller = new AbortController();
          controllersRef.current.set(key, controller);
          try {
            const overlays = await fetchOverlaysForImage(img, globalThis.fetch, { timeoutMs: 8e3 });
            setLocalOverlays((s3) => ({ ...s3, [img.id]: overlays }));
          } catch (err) {
            const e3 = err;
            const code = e3?.code || "fetch_error";
            const msg = e3?.message || "Failed to fetch overlays";
            setErrorMap2((m3) => ({ ...m3, [key]: `${code}: ${msg}` }));
          } finally {
            setLoadingMap((m3) => ({ ...m3, [key]: false }));
            controllersRef.current.delete(key);
          }
        })();
      });
    }, 150);
    observerRef.current = new IntersectionObserver((entries) => {
      intersectCb(entries);
    }, { root: null, threshold: 0.05 });
    imageRefs.current.forEach((el) => {
      if (el && observerRef.current) observerRef.current.observe(el);
    });
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      controllersRef.current.forEach((c3) => c3.abort());
      controllersRef.current.clear();
    };
  }, [images, overlaysByImage]);
  const attachImageRef = (id) => (el) => {
    if (!el) {
      imageRefs.current.delete(id);
      return;
    }
    el.dataset.imageId = id;
    imageRefs.current.set(id, el);
    if (observerRef.current) observerRef.current.observe(el);
  };
  y2(() => {
    images.forEach((img) => {
      if (overlaysByImage && Array.isArray(overlaysByImage[img.id])) {
        setLocalOverlays((s3) => ({ ...s3, [img.id]: overlaysByImage[img.id] }));
      }
    });
  }, [images, overlaysByImage]);
  return /* @__PURE__ */ u3("div", { "data-testid": "visual-overlays-island-root", "data-hydrated": mounted ? "true" : "false", children: /* @__PURE__ */ u3("div", { className: "visual-overlays-list space-y-6", children: images.map((img) => /* @__PURE__ */ u3("div", { className: "visual-image-item relative", "data-testid": `visual-image-${img.id}`, children: [
    /* @__PURE__ */ u3(
      "img",
      {
        ref: attachImageRef(img.id),
        src: img.originalSrc || img.thumbnailSrc || "",
        alt: `Document ${props.documentId || ""} image ${img.id}`,
        "data-testid": "document-image",
        "data-image-id": img.id,
        className: "w-full h-auto block",
        crossOrigin: "anonymous"
      }
    ),
    /* @__PURE__ */ u3("div", { "data-testid": `overlay-container-${img.id}`, className: "absolute inset-0 pointer-events-none", children: [
      /* @__PURE__ */ u3("svg", { "data-testid": `overlay-svg-${img.id}`, width: "100%", height: "100%", preserveAspectRatio: "none", className: "block", children: (localOverlays[img.id] || []).map((ov, index) => {
        const x4 = (ov.bbox?.x || 0) * 100;
        const y3 = (ov.bbox?.y || 0) * 100;
        const w4 = (ov.bbox?.width || 0) * 100;
        const h3 = (ov.bbox?.height || 0) * 100;
        return /* @__PURE__ */ u3("rect", { "data-testid": `overlay-marker-${ov.id || index}`, x: `${x4}%`, y: `${y3}%`, width: `${w4}%`, height: `${h3}%`, fill: "none", stroke: "rgba(34,197,94,0.9)", "stroke-width": "2" }, ov.id || index);
      }) }),
      loadingMap[img.id] ? /* @__PURE__ */ u3("div", { "data-testid": `overlay-loading-${img.id}`, "aria-hidden": "true", children: "Loading overlays..." }) : null,
      errorMap2[img.id] ? /* @__PURE__ */ u3("div", { "data-testid": `overlay-error-${img.id}`, "aria-hidden": "true", children: errorMap2[img.id] }) : null
    ] })
  ] }, img.id)) }) });
}

// src/ui/contracts/Playground.contract.ts
var CollectionEnum = external_exports.enum(["visual_pages", "visual_overlays"]);
var BoundingBoxSchema = external_exports.object({
  x: external_exports.number().min(0).max(1),
  y: external_exports.number().min(0).max(1),
  width: external_exports.number().min(0).max(1),
  height: external_exports.number().min(0).max(1)
});
var SidecarStateEnum = external_exports.enum([
  "unknown",
  "initializing",
  "ready",
  "error"
]);
var VramInfoSchema = external_exports.object({
  used_mb: external_exports.number().nonnegative().optional(),
  total_mb: external_exports.number().nonnegative().optional(),
  percent: external_exports.number().min(0).max(100).optional()
});
var SidecarStatusSchema = external_exports.object({
  state: SidecarStateEnum,
  model: external_exports.string().optional(),
  vram: VramInfoSchema.optional(),
  lastCheck: external_exports.number().optional(),
  error: external_exports.string().optional()
});
var SearchResultSchema = external_exports.object({
  docId: external_exports.number().int(),
  score: external_exports.number(),
  pageNum: external_exports.number().int().optional(),
  thumbnailUrl: external_exports.string().optional(),
  metadata: external_exports.record(external_exports.any()).optional()
});
var QdrantPayloadSchema = external_exports.object({
  doc_id: external_exports.number().int(),
  correspondent_id: external_exports.number().int().nullable().optional(),
  tag_ids: external_exports.array(external_exports.number().int()).optional(),
  created_date: external_exports.string().optional(),
  modified_date: external_exports.string().optional(),
  page_num: external_exports.number().int().optional(),
  custom_fields: external_exports.record(external_exports.any()).optional()
});
var FilterOptionsSchema = external_exports.object({
  doc_id: external_exports.number().int().optional(),
  tag_ids: external_exports.array(external_exports.number().int()).optional(),
  correspondent_id: external_exports.number().int().optional()
});
var PlaygroundSchema = external_exports.object({
  // Mode: visual-debug (default) or text-debug
  mode: external_exports.enum(["visual-debug", "text-debug"]).default("visual-debug"),
  // Collection selection
  collection: CollectionEnum.default("visual_pages"),
  // Initial sidecar status
  sidecarStatus: SidecarStatusSchema.optional(),
  // GPU state for 503 handling
  gpuState: external_exports.enum([
    "idle",
    "checking",
    "preparing",
    "ready",
    "error"
  ]).default("idle"),
  // Filter options
  filters: FilterOptionsSchema.optional(),
  // Document ID for filtering
  documentId: external_exports.number().int().nullable().optional(),
  // Visual overlays payloads (optional)
  images: ImagesSchema.optional(),
  overlaysByImage: OverlaysByImageSchema.optional()
});
var SearchRequestSchema = external_exports.object({
  image: external_exports.string().min(1),
  // Base64 encoded image
  collection: CollectionEnum,
  filters: FilterOptionsSchema.optional(),
  limit: external_exports.number().int().min(1).max(50).default(5)
});
var SearchResponseSchema2 = external_exports.object({
  results: external_exports.array(SearchResultSchema),
  scoreType: external_exports.string().default("maxsim"),
  collectionUsed: external_exports.string(),
  executionTimeMs: external_exports.number(),
  queryType: external_exports.string().default("image")
});
var PlaygroundSearchTriggerEventSchema = external_exports.object({
  type: external_exports.literal("playground:search-trigger"),
  image: external_exports.string().min(1),
  collection: CollectionEnum,
  filters: FilterOptionsSchema.optional(),
  timestamp: external_exports.number().optional()
});
var PlaygroundResultsReceivedEventSchema = external_exports.object({
  type: external_exports.literal("playground:results-received"),
  results: external_exports.array(SearchResultSchema),
  executionTimeMs: external_exports.number(),
  timestamp: external_exports.number().optional()
});
var PlaygroundSidecarStateChangeEventSchema = external_exports.object({
  type: external_exports.literal("playground:sidecar-state-change"),
  state: SidecarStateEnum,
  error: external_exports.string().optional(),
  timestamp: external_exports.number().optional()
});

// src/islands/PlaygroundIsland.tsx
var API_HEALTH = "/api/visual-rag/health";
var API_SEARCH = "/api/visual-rag/search/visual";
var COLLECTIONS = [
  { value: "visual_pages", label: "visual_pages (320D, Dot)" },
  { value: "visual_overlays", label: "visual_overlays (320D, Cosine)" }
];
var MIN_BOX_SIZE = 20;
function PlaygroundIsland(props) {
  const validated = PlaygroundSchema.parse(props);
  const {
    mode,
    collection: initialCollection,
    gpuState: initialGpuState,
    documentId,
    filters: initialFilters
  } = validated;
  const { onSearch } = props;
  const [collection, setCollection] = d2(initialCollection);
  const [gpuState, setGpuState] = d2(initialGpuState);
  const [sidecarStatus, setSidecarStatus] = d2(validated.sidecarStatus ?? { state: "unknown", model: "ColQwen3-4B-AWQ" });
  const [isDrawMode, setIsDrawMode] = d2(false);
  const [isDrawing, setIsDrawing] = d2(false);
  const [currentBox, setCurrentBox] = d2(null);
  const [boxes, setBoxes] = d2([]);
  const [imageData, setImageData] = d2(null);
  const [imageLoaded, setImageLoaded] = d2(false);
  const [searchResults, setSearchResults] = d2([]);
  const [payloads, setPayloads] = d2([]);
  const [isSearching, setIsSearching] = d2(false);
  const [error, setError] = d2(null);
  const [latency, setLatency] = d2(null);
  const [docIdFilter, setDocIdFilter] = d2("");
  const [showRawJson, setShowRawJson] = d2(false);
  const containerRef = A2(null);
  const canvasRef = A2(null);
  const imageRef = A2(null);
  const fileInputRef = A2(null);
  const drawToggleRef = A2(null);
  y2(() => {
    if (drawToggleRef.current) drawToggleRef.current.setAttribute("aria-pressed", String(isDrawMode));
  }, [isDrawMode]);
  y2(() => {
    const pollHealth = async () => {
      try {
        const res = await fetch(API_HEALTH);
        if (res.status === 503) {
          setSidecarStatus({
            state: "initializing",
            model: "ColQwen3-4B-AWQ",
            error: "GPU Preparing..."
          });
          setGpuState("preparing");
        } else if (res.ok) {
          const data = await res.json();
          setSidecarStatus({
            state: "ready",
            model: data.model || "ColQwen3-4B-AWQ",
            vram: data.vram,
            lastCheck: Date.now()
          });
          setGpuState("ready");
        } else {
          setSidecarStatus({
            state: "error",
            error: `HTTP ${res.status}`
          });
          setGpuState("error");
        }
      } catch {
        setSidecarStatus({
          state: "error",
          error: "Connection failed"
        });
        setGpuState("error");
      }
    };
    pollHealth();
    const interval = setInterval(pollHealth, 5e3);
    return () => clearInterval(interval);
  }, []);
  const getRelativePosition = q2(
    (e3) => {
      const container = containerRef.current;
      if (!container) return { x: 0, y: 0 };
      const rect = container.getBoundingClientRect();
      let clientX, clientY;
      if ("touches" in e3) {
        const touch = e3.touches[0] || e3.changedTouches[0];
        clientX = touch.clientX;
        clientY = touch.clientY;
      } else {
        clientX = e3.clientX;
        clientY = e3.clientY;
      }
      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    },
    []
  );
  const handleMouseDown = q2(
    (e3) => {
      if (!isDrawMode || !imageLoaded) return;
      e3.preventDefault();
      const pos = getRelativePosition(e3);
      setIsDrawing(true);
      setCurrentBox({ x: pos.x, y: pos.y, width: 0, height: 0 });
      setError(null);
    },
    [isDrawMode, imageLoaded, getRelativePosition]
  );
  const handleMouseMove = q2(
    (e3) => {
      if (!isDrawing || !currentBox) return;
      e3.preventDefault();
      const pos = getRelativePosition(e3);
      setCurrentBox((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          width: pos.x - prev.x,
          height: pos.y - prev.y
        };
      });
    },
    [isDrawing, currentBox, getRelativePosition]
  );
  const handleMouseUp = q2(() => {
    if (!isDrawing || !currentBox) return;
    setIsDrawing(false);
    const container = containerRef.current;
    if (!container) return;
    const normalizedBox = {
      x: currentBox.width < 0 ? currentBox.x + currentBox.width : currentBox.x,
      y: currentBox.height < 0 ? currentBox.y + currentBox.height : currentBox.y,
      width: Math.abs(currentBox.width),
      height: Math.abs(currentBox.height)
    };
    if (normalizedBox.width < MIN_BOX_SIZE || normalizedBox.height < MIN_BOX_SIZE) {
      setError("Selection too small. Draw a larger box.");
      setCurrentBox(null);
      return;
    }
    setBoxes((prev) => [...prev, normalizedBox]);
    setCurrentBox(null);
  }, [isDrawing, currentBox]);
  const handleFileUpload = q2(
    (e3) => {
      const target = e3.target;
      const file = target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result;
        setImageData(result);
        setImageLoaded(false);
        setBoxes([]);
        setSearchResults([]);
        setPayloads([]);
        setLatency(null);
      };
      reader.readAsDataURL(file);
    },
    []
  );
  const handleImageLoad = q2(() => {
    setImageLoaded(true);
  }, []);
  y2(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(220, 20, 60, 0.9)";
    ctx.lineWidth = 2;
    ctx.fillStyle = "rgba(220, 20, 60, 0.1)";
    boxes.forEach((box) => {
      ctx.strokeRect(box.x, box.y, box.width, box.height);
      ctx.fillRect(box.x, box.y, box.width, box.height);
    });
    if (currentBox && isDrawing) {
      ctx.strokeStyle = "rgba(255, 140, 0, 0.9)";
      ctx.fillStyle = "rgba(255, 140, 0, 0.2)";
      ctx.strokeRect(
        currentBox.x,
        currentBox.y,
        currentBox.width,
        currentBox.height
      );
      ctx.fillRect(
        currentBox.x,
        currentBox.y,
        currentBox.width,
        currentBox.height
      );
    }
  }, [boxes, currentBox, isDrawing]);
  const triggerSearch = q2(async () => {
    if (!imageData || boxes.length === 0) {
      setError("Upload an image and draw a region first");
      return;
    }
    if (sidecarStatus.state !== "ready") {
      setError("Sidecar not ready. Wait for GPU.");
      return;
    }
    setIsSearching(true);
    setError(null);
    const startTime = Date.now();
    try {
      const box = boxes[boxes.length - 1];
      const container = containerRef.current;
      const img = imageRef.current;
      if (!container || !img) throw new Error("No container/image");
      const captureCanvas = document.createElement("canvas");
      const ctx = captureCanvas.getContext("2d");
      if (!ctx) throw new Error("No canvas context");
      const scaleX = img.naturalWidth / container.clientWidth;
      const scaleY = img.naturalHeight / container.clientHeight;
      const srcX = box.x * scaleX;
      const srcY = box.y * scaleY;
      const srcW = box.width * scaleX;
      const srcH = box.height * scaleY;
      captureCanvas.width = srcW;
      captureCanvas.height = srcH;
      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);
      const dataUrl = captureCanvas.toDataURL("image/png");
      const base64 = dataUrl.split(",")[1];
      const filters = {};
      if (docIdFilter && !isNaN(parseInt(docIdFilter))) {
        filters.doc_id = parseInt(docIdFilter);
      }
      const res = await fetch(API_SEARCH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64,
          collection,
          filters: Object.keys(filters).length > 0 ? filters : void 0,
          limit: 10
        })
      });
      if (res.status === 503) {
        setGpuState("preparing");
        throw new Error("GPU still preparing. Try again.");
      }
      if (!res.ok) {
        throw new Error(`Search failed: HTTP ${res.status}`);
      }
      const raw = await res.json();
      const parsed = SearchResponseSchema2.safeParse(raw);
      if (!parsed.success) throw new Error("Invalid search response");
      const data = parsed.data;
      const elapsed = Date.now() - startTime;
      setSearchResults(data.results || []);
      setLatency(elapsed);
      const extractedPayloads = (data.results || []).map((r3) => ({
        doc_id: r3.docId,
        correspondent_id: r3.metadata?.correspondent_id,
        tag_ids: r3.metadata?.tag_ids,
        created_date: r3.metadata?.created_date,
        page_num: r3.pageNum
      }));
      setPayloads(extractedPayloads);
      window.dispatchEvent(new CustomEvent("playground:results-received", {
        detail: { results: data.results, executionTimeMs: elapsed }
      }));
      if (onSearch) {
        onSearch(base64, collection, filters);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message || "Search failed");
    } finally {
      setIsSearching(false);
    }
  }, [imageData, boxes, collection, docIdFilter, sidecarStatus.state, onSearch]);
  const clearAll = q2(() => {
    setBoxes([]);
    setSearchResults([]);
    setPayloads([]);
    setLatency(null);
    setError(null);
  }, []);
  const copyPayloads = q2(() => {
    const json = JSON.stringify(payloads, null, 2);
    navigator.clipboard.writeText(json);
  }, [payloads]);
  const renderStatusBadge = () => {
    const stateColors = {
      ready: "bg-green-500",
      initializing: "bg-yellow-500",
      error: "bg-red-500",
      unknown: "bg-gray-500"
    };
    const stateLabels = {
      ready: "200 OK",
      initializing: "503 Initializing",
      error: "Error",
      unknown: "Unknown"
    };
    return /* @__PURE__ */ u3(
      "div",
      {
        "data-testid": "sidecar-status",
        className: `flex items-center gap-2 p-2 rounded border-l-4 ${sidecarStatus.state === "ready" ? "bg-green-50 border-green-500" : sidecarStatus.state === "initializing" ? "bg-yellow-50 border-yellow-500" : "bg-red-50 border-red-500"}`,
        children: [
          /* @__PURE__ */ u3(
            "span",
            {
              className: `px-2 py-1 text-xs font-bold text-white rounded ${stateColors[sidecarStatus.state]}`,
              children: stateLabels[sidecarStatus.state]
            }
          ),
          sidecarStatus.vram && /* @__PURE__ */ u3("span", { className: "text-sm text-gray-600", children: [
            "VRAM: ",
            sidecarStatus.vram.used_mb,
            "MB / ",
            sidecarStatus.vram.total_mb,
            "MB"
          ] }),
          /* @__PURE__ */ u3("span", { className: "text-sm text-gray-500", children: [
            "Model: ",
            sidecarStatus.model
          ] })
        ]
      }
    );
  };
  return /* @__PURE__ */ u3(
    "div",
    {
      "data-testid": "playground-island-root",
      className: "h-full flex flex-col bg-white rounded-lg shadow",
      children: [
        /* @__PURE__ */ u3("div", { className: "p-4 border-b", children: [
          /* @__PURE__ */ u3("h1", { className: "text-xl font-bold", children: "Visual RAG Playground" }),
          /* @__PURE__ */ u3("p", { className: "text-sm text-gray-500", children: "Debug and test Qdrant payloads, sidecar state, and visual search" })
        ] }),
        /* @__PURE__ */ u3("div", { className: "p-4 border-b", children: renderStatusBadge() }),
        gpuState === "preparing" && /* @__PURE__ */ u3(
          "div",
          {
            "data-testid": "gpu-preparing-modal",
            className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50",
            children: /* @__PURE__ */ u3("div", { className: "bg-white p-6 rounded-lg shadow-lg text-center", children: [
              /* @__PURE__ */ u3("div", { className: "animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" }),
              /* @__PURE__ */ u3("h2", { className: "text-lg font-bold", children: "GPU Preparing" }),
              /* @__PURE__ */ u3("p", { className: "text-gray-600", children: "ColQwen3-4B-AWQ model is loading on RTX 3090 Ti..." }),
              /* @__PURE__ */ u3("p", { className: "text-sm text-gray-400 mt-2", children: "Expected VRAM: ~3.5GB" })
            ] })
          }
        ),
        /* @__PURE__ */ u3("div", { className: "p-4 bg-gray-50 border-b flex flex-wrap gap-4 items-end", children: [
          /* @__PURE__ */ u3("div", { className: "flex-1 min-w-[200px]", children: [
            /* @__PURE__ */ u3("label", { htmlFor: "collection-select", className: "block text-sm font-medium mb-1", children: "Collection" }),
            /* @__PURE__ */ u3(
              "select",
              {
                id: "collection-select",
                "data-testid": "collection-select",
                value: collection,
                onChange: (e3) => setCollection(e3.target.value),
                className: "w-full p-2 border rounded",
                children: COLLECTIONS.map((c3) => /* @__PURE__ */ u3("option", { value: c3.value, children: c3.label }, c3.value))
              }
            )
          ] }),
          /* @__PURE__ */ u3("div", { className: "flex-1 min-w-[150px]", children: [
            /* @__PURE__ */ u3("label", { htmlFor: "doc-id-filter", className: "block text-sm font-medium mb-1", children: "Filter by Doc ID (optional)" }),
            /* @__PURE__ */ u3(
              "input",
              {
                id: "doc-id-filter",
                title: "Filter by document ID",
                "data-testid": "doc-id-filter",
                type: "text",
                value: docIdFilter,
                onChange: (e3) => setDocIdFilter(e3.target.value),
                placeholder: "e.g., 12345",
                className: "w-full p-2 border rounded"
              }
            )
          ] }),
          /* @__PURE__ */ u3("div", { children: /* @__PURE__ */ u3(
            "button",
            {
              "data-testid": "search-button",
              onClick: triggerSearch,
              disabled: isSearching || !imageLoaded || boxes.length === 0,
              className: `px-4 py-2 font-medium rounded ${isSearching || !imageLoaded || boxes.length === 0 ? "bg-gray-300 cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-700"}`,
              children: isSearching ? "Searching..." : "Search Collection"
            }
          ) })
        ] }),
        /* @__PURE__ */ u3("div", { className: "flex-1 grid grid-cols-2 gap-4 p-4 min-h-0 overflow-hidden", children: [
          /* @__PURE__ */ u3("div", { className: "flex flex-col border rounded overflow-hidden", children: [
            /* @__PURE__ */ u3("div", { className: "flex items-center gap-2 p-2 bg-gray-100 border-b", children: [
              /* @__PURE__ */ u3(
                "button",
                {
                  "data-testid": "upload-button",
                  onClick: () => fileInputRef.current?.click(),
                  className: "px-3 py-1 text-sm bg-white border rounded hover:bg-gray-50",
                  children: [
                    /* @__PURE__ */ u3("i", { className: "fas fa-upload mr-1" }),
                    "Upload Image"
                  ]
                }
              ),
              /* @__PURE__ */ u3(
                "input",
                {
                  ref: fileInputRef,
                  type: "file",
                  accept: "image/*",
                  "aria-label": "Upload image file",
                  onChange: handleFileUpload,
                  className: "hidden"
                }
              ),
              /* @__PURE__ */ u3(
                "button",
                {
                  "data-testid": "draw-toggle",
                  ref: (el) => {
                    drawToggleRef.current = el;
                  },
                  onClick: () => setIsDrawMode(!isDrawMode),
                  className: `px-3 py-1 text-sm rounded ${isDrawMode ? "bg-red-600 text-white" : "bg-white border hover:bg-gray-50"}`,
                  children: [
                    /* @__PURE__ */ u3("i", { className: `fas fa-pen mr-1 ${isDrawMode ? "animate-pulse" : ""}` }),
                    isDrawMode ? "Drawing" : "Draw"
                  ]
                }
              ),
              boxes.length > 0 && /* @__PURE__ */ u3(
                "button",
                {
                  "data-testid": "clear-boxes",
                  onClick: clearAll,
                  className: "px-3 py-1 text-sm text-gray-600 hover:text-red-600",
                  children: [
                    /* @__PURE__ */ u3("i", { className: "fas fa-trash-alt mr-1" }),
                    "Clear"
                  ]
                }
              )
            ] }),
            /* @__PURE__ */ u3(
              "div",
              {
                ref: containerRef,
                className: `relative flex-1 bg-gray-200 overflow-hidden ${isDrawMode ? "cursor-crosshair touch-none" : "cursor-default"}`,
                onMouseDown: handleMouseDown,
                onMouseMove: handleMouseMove,
                onMouseUp: handleMouseUp,
                onMouseLeave: () => isDrawing && handleMouseUp(),
                onTouchStart: handleMouseDown,
                onTouchMove: handleMouseMove,
                onTouchEnd: handleMouseUp,
                children: [
                  imageData ? /* @__PURE__ */ u3(
                    "img",
                    {
                      ref: imageRef,
                      src: imageData,
                      alt: "Uploaded",
                      onLoad: handleImageLoad,
                      className: "w-full h-full object-contain",
                      "data-testid": "uploaded-image"
                    }
                  ) : /* @__PURE__ */ u3("div", { className: "absolute inset-0 flex items-center justify-center text-gray-500", children: /* @__PURE__ */ u3("div", { className: "text-center", children: [
                    /* @__PURE__ */ u3("i", { className: "fas fa-image text-4xl mb-2" }),
                    /* @__PURE__ */ u3("p", { children: "Upload an image to begin" })
                  ] }) }),
                  /* @__PURE__ */ u3(
                    "canvas",
                    {
                      ref: canvasRef,
                      className: "absolute inset-0 pointer-events-none",
                      "data-testid": "annotation-canvas"
                    }
                  )
                ]
              }
            ),
            isDrawMode && imageLoaded && boxes.length === 0 && /* @__PURE__ */ u3("div", { className: "p-2 text-center text-xs text-gray-500 bg-blue-50", children: [
              /* @__PURE__ */ u3("i", { className: "fas fa-info-circle mr-1" }),
              "Click and drag to select a region"
            ] })
          ] }),
          /* @__PURE__ */ u3("div", { className: "flex flex-col gap-4 overflow-hidden", children: [
            error && /* @__PURE__ */ u3(
              "div",
              {
                "data-testid": "error-message",
                className: "p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700",
                children: [
                  /* @__PURE__ */ u3("i", { className: "fas fa-exclamation-circle mr-1" }),
                  error
                ]
              }
            ),
            latency !== null && /* @__PURE__ */ u3("div", { className: "text-sm text-gray-500", children: [
              "Latency: ",
              latency,
              "ms"
            ] }),
            /* @__PURE__ */ u3("div", { className: "flex-1 border rounded overflow-hidden flex flex-col", children: [
              /* @__PURE__ */ u3("div", { className: "p-2 bg-gray-100 border-b font-medium text-sm", children: [
                "Search Results (",
                searchResults.length,
                ")"
              ] }),
              /* @__PURE__ */ u3("div", { className: "flex-1 overflow-auto p-2", "data-testid": "search-results", children: searchResults.length === 0 ? /* @__PURE__ */ u3("p", { className: "text-gray-500 text-sm", children: "No results yet" }) : searchResults.map((r3, i4) => /* @__PURE__ */ u3(
                "div",
                {
                  className: "p-2 border rounded mb-2",
                  "data-testid": `result-${i4}`,
                  children: [
                    /* @__PURE__ */ u3("div", { className: "flex justify-between items-start", children: [
                      /* @__PURE__ */ u3("span", { className: "font-medium", children: [
                        "Doc #",
                        r3.docId
                      ] }),
                      /* @__PURE__ */ u3("span", { className: "px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs", children: r3.score.toFixed(3) })
                    ] }),
                    r3.pageNum && /* @__PURE__ */ u3("div", { className: "text-xs text-gray-500", children: [
                      "Page ",
                      r3.pageNum
                    ] })
                  ]
                },
                i4
              )) })
            ] }),
            /* @__PURE__ */ u3("div", { className: "flex-1 border rounded overflow-hidden flex flex-col", children: [
              /* @__PURE__ */ u3("div", { className: "p-2 bg-gray-100 border-b font-medium text-sm flex justify-between items-center", children: [
                /* @__PURE__ */ u3("span", { children: "Payload Inspector" }),
                /* @__PURE__ */ u3("div", { className: "flex gap-2", children: [
                  /* @__PURE__ */ u3(
                    "button",
                    {
                      "data-testid": "toggle-json",
                      onClick: () => setShowRawJson(!showRawJson),
                      className: "text-xs text-blue-600 hover:underline",
                      children: showRawJson ? "Formatted" : "Raw JSON"
                    }
                  ),
                  /* @__PURE__ */ u3(
                    "button",
                    {
                      "data-testid": "copy-payloads",
                      onClick: copyPayloads,
                      className: "text-xs text-blue-600 hover:underline",
                      children: "Copy"
                    }
                  )
                ] })
              ] }),
              /* @__PURE__ */ u3("div", { className: "flex-1 overflow-auto p-2", "data-testid": "payload-inspector", children: payloads.length === 0 ? /* @__PURE__ */ u3("p", { className: "text-gray-500 text-sm", children: "No payloads to display" }) : showRawJson ? /* @__PURE__ */ u3("pre", { className: "text-xs bg-gray-50 p-2 rounded overflow-auto", children: JSON.stringify(payloads, null, 2) }) : payloads.map((p3, i4) => /* @__PURE__ */ u3(
                "div",
                {
                  className: "p-2 bg-gray-50 rounded mb-2 font-mono text-xs",
                  "data-testid": `payload-${i4}`,
                  children: [
                    /* @__PURE__ */ u3("div", { children: [
                      /* @__PURE__ */ u3("span", { className: "text-red-600", children: "doc_id:" }),
                      " ",
                      /* @__PURE__ */ u3("span", { className: "text-blue-600", children: p3.doc_id })
                    ] }),
                    p3.correspondent_id !== void 0 && /* @__PURE__ */ u3("div", { children: [
                      /* @__PURE__ */ u3("span", { className: "text-red-600", children: "correspondent_id:" }),
                      " ",
                      /* @__PURE__ */ u3("span", { className: "text-blue-600", children: p3.correspondent_id })
                    ] }),
                    p3.tag_ids && /* @__PURE__ */ u3("div", { children: [
                      /* @__PURE__ */ u3("span", { className: "text-red-600", children: "tag_ids:" }),
                      " ",
                      /* @__PURE__ */ u3("span", { className: "text-blue-600", children: [
                        "[",
                        p3.tag_ids.join(", "),
                        "]"
                      ] })
                    ] }),
                    p3.created_date && /* @__PURE__ */ u3("div", { children: [
                      /* @__PURE__ */ u3("span", { className: "text-red-600", children: "created_date:" }),
                      " ",
                      /* @__PURE__ */ u3("span", { className: "text-blue-600", children: [
                        '"',
                        p3.created_date,
                        '"'
                      ] })
                    ] })
                  ]
                },
                i4
              )) })
            ] })
          ] })
        ] })
      ]
    }
  );
}

// node_modules/preact/compat/dist/compat.module.js
var compat_module_exports = {};
__export(compat_module_exports, {
  Children: () => O2,
  Component: () => x,
  Fragment: () => k,
  PureComponent: () => N2,
  StrictMode: () => Cn,
  Suspense: () => P3,
  SuspenseList: () => B3,
  __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: () => hn,
  cloneElement: () => _n,
  createContext: () => Q,
  createElement: () => _,
  createFactory: () => dn,
  createPortal: () => $2,
  createRef: () => b,
  default: () => Rn,
  findDOMNode: () => Sn,
  flushSync: () => En,
  forwardRef: () => D3,
  hydrate: () => tn,
  isElement: () => xn,
  isFragment: () => pn,
  isMemo: () => yn,
  isValidElement: () => mn,
  lazy: () => z3,
  memo: () => M2,
  render: () => nn,
  startTransition: () => R,
  unmountComponentAtNode: () => bn,
  unstable_batchedUpdates: () => gn,
  useCallback: () => q2,
  useContext: () => x2,
  useDebugValue: () => P2,
  useDeferredValue: () => w3,
  useEffect: () => y2,
  useErrorBoundary: () => b2,
  useId: () => g2,
  useImperativeHandle: () => F2,
  useInsertionEffect: () => I2,
  useLayoutEffect: () => _2,
  useMemo: () => T2,
  useReducer: () => h2,
  useRef: () => A2,
  useState: () => d2,
  useSyncExternalStore: () => C3,
  useTransition: () => k3,
  version: () => vn
});
function g3(n2, t3) {
  for (var e3 in t3) n2[e3] = t3[e3];
  return n2;
}
function E2(n2, t3) {
  for (var e3 in n2) if ("__source" !== e3 && !(e3 in t3)) return true;
  for (var r3 in t3) if ("__source" !== r3 && n2[r3] !== t3[r3]) return true;
  return false;
}
function C3(n2, t3) {
  var e3 = t3(), r3 = d2({ t: { __: e3, u: t3 } }), u4 = r3[0].t, o3 = r3[1];
  return _2(function() {
    u4.__ = e3, u4.u = t3, x3(u4) && o3({ t: u4 });
  }, [n2, e3, t3]), y2(function() {
    return x3(u4) && o3({ t: u4 }), n2(function() {
      x3(u4) && o3({ t: u4 });
    });
  }, [n2]), e3;
}
function x3(n2) {
  var t3, e3, r3 = n2.u, u4 = n2.__;
  try {
    var o3 = r3();
    return !((t3 = u4) === (e3 = o3) && (0 !== t3 || 1 / t3 == 1 / e3) || t3 != t3 && e3 != e3);
  } catch (n3) {
    return true;
  }
}
function R(n2) {
  n2();
}
function w3(n2) {
  return n2;
}
function k3() {
  return [false, R];
}
var I2 = _2;
function N2(n2, t3) {
  this.props = n2, this.context = t3;
}
function M2(n2, e3) {
  function r3(n3) {
    var t3 = this.props.ref, r4 = t3 == n3.ref;
    return !r4 && t3 && (t3.call ? t3(null) : t3.current = null), e3 ? !e3(this.props, n3) || !r4 : E2(this.props, n3);
  }
  function u4(e4) {
    return this.shouldComponentUpdate = r3, _(n2, e4);
  }
  return u4.displayName = "Memo(" + (n2.displayName || n2.name) + ")", u4.prototype.isReactComponent = true, u4.__f = true, u4.type = n2, u4;
}
(N2.prototype = new x()).isPureReactComponent = true, N2.prototype.shouldComponentUpdate = function(n2, t3) {
  return E2(this.props, n2) || E2(this.state, t3);
};
var T3 = l.__b;
l.__b = function(n2) {
  n2.type && n2.type.__f && n2.ref && (n2.props.ref = n2.ref, n2.ref = null), T3 && T3(n2);
};
var A3 = "undefined" != typeof Symbol && Symbol.for && Symbol.for("react.forward_ref") || 3911;
function D3(n2) {
  function t3(t4) {
    var e3 = g3({}, t4);
    return delete e3.ref, n2(e3, t4.ref || null);
  }
  return t3.$$typeof = A3, t3.render = n2, t3.prototype.isReactComponent = t3.__f = true, t3.displayName = "ForwardRef(" + (n2.displayName || n2.name) + ")", t3;
}
var L2 = function(n2, t3) {
  return null == n2 ? null : H(H(n2).map(t3));
};
var O2 = { map: L2, forEach: L2, count: function(n2) {
  return n2 ? H(n2).length : 0;
}, only: function(n2) {
  var t3 = H(n2);
  if (1 !== t3.length) throw "Children.only";
  return t3[0];
}, toArray: H };
var F3 = l.__e;
l.__e = function(n2, t3, e3, r3) {
  if (n2.then) {
    for (var u4, o3 = t3; o3 = o3.__; ) if ((u4 = o3.__c) && u4.__c) return null == t3.__e && (t3.__e = e3.__e, t3.__k = e3.__k), u4.__c(n2, t3);
  }
  F3(n2, t3, e3, r3);
};
var U = l.unmount;
function V2(n2, t3, e3) {
  return n2 && (n2.__c && n2.__c.__H && (n2.__c.__H.__.forEach(function(n3) {
    "function" == typeof n3.__c && n3.__c();
  }), n2.__c.__H = null), null != (n2 = g3({}, n2)).__c && (n2.__c.__P === e3 && (n2.__c.__P = t3), n2.__c.__e = true, n2.__c = null), n2.__k = n2.__k && n2.__k.map(function(n3) {
    return V2(n3, t3, e3);
  })), n2;
}
function W(n2, t3, e3) {
  return n2 && e3 && (n2.__v = null, n2.__k = n2.__k && n2.__k.map(function(n3) {
    return W(n3, t3, e3);
  }), n2.__c && n2.__c.__P === t3 && (n2.__e && e3.appendChild(n2.__e), n2.__c.__e = true, n2.__c.__P = e3)), n2;
}
function P3() {
  this.__u = 0, this.o = null, this.__b = null;
}
function j3(n2) {
  var t3 = n2.__.__c;
  return t3 && t3.__a && t3.__a(n2);
}
function z3(n2) {
  var e3, r3, u4, o3 = null;
  function i4(i5) {
    if (e3 || (e3 = n2()).then(function(n3) {
      n3 && (o3 = n3.default || n3), u4 = true;
    }, function(n3) {
      r3 = n3, u4 = true;
    }), r3) throw r3;
    if (!u4) throw e3;
    return o3 ? _(o3, i5) : null;
  }
  return i4.displayName = "Lazy", i4.__f = true, i4;
}
function B3() {
  this.i = null, this.l = null;
}
l.unmount = function(n2) {
  var t3 = n2.__c;
  t3 && t3.__R && t3.__R(), t3 && 32 & n2.__u && (n2.type = null), U && U(n2);
}, (P3.prototype = new x()).__c = function(n2, t3) {
  var e3 = t3.__c, r3 = this;
  null == r3.o && (r3.o = []), r3.o.push(e3);
  var u4 = j3(r3.__v), o3 = false, i4 = function() {
    o3 || (o3 = true, e3.__R = null, u4 ? u4(l3) : l3());
  };
  e3.__R = i4;
  var l3 = function() {
    if (!--r3.__u) {
      if (r3.state.__a) {
        var n3 = r3.state.__a;
        r3.__v.__k[0] = W(n3, n3.__c.__P, n3.__c.__O);
      }
      var t4;
      for (r3.setState({ __a: r3.__b = null }); t4 = r3.o.pop(); ) t4.forceUpdate();
    }
  };
  r3.__u++ || 32 & t3.__u || r3.setState({ __a: r3.__b = r3.__v.__k[0] }), n2.then(i4, i4);
}, P3.prototype.componentWillUnmount = function() {
  this.o = [];
}, P3.prototype.render = function(n2, e3) {
  if (this.__b) {
    if (this.__v.__k) {
      var r3 = document.createElement("div"), o3 = this.__v.__k[0].__c;
      this.__v.__k[0] = V2(this.__b, r3, o3.__O = o3.__P);
    }
    this.__b = null;
  }
  var i4 = e3.__a && _(k, null, n2.fallback);
  return i4 && (i4.__u &= -33), [_(k, null, e3.__a ? null : n2.children), i4];
};
var H2 = function(n2, t3, e3) {
  if (++e3[1] === e3[0] && n2.l.delete(t3), n2.props.revealOrder && ("t" !== n2.props.revealOrder[0] || !n2.l.size)) for (e3 = n2.i; e3; ) {
    for (; e3.length > 3; ) e3.pop()();
    if (e3[1] < e3[0]) break;
    n2.i = e3 = e3[2];
  }
};
function Z(n2) {
  return this.getChildContext = function() {
    return n2.context;
  }, n2.children;
}
function Y(n2) {
  var e3 = this, r3 = n2.h;
  if (e3.componentWillUnmount = function() {
    G(null, e3.v), e3.v = null, e3.h = null;
  }, e3.h && e3.h !== r3 && e3.componentWillUnmount(), !e3.v) {
    for (var u4 = e3.__v; null !== u4 && !u4.__m && null !== u4.__; ) u4 = u4.__;
    e3.h = r3, e3.v = { nodeType: 1, parentNode: r3, childNodes: [], __k: { __m: u4.__m }, contains: function() {
      return true;
    }, insertBefore: function(n3, t3) {
      this.childNodes.push(n3), e3.h.insertBefore(n3, t3);
    }, removeChild: function(n3) {
      this.childNodes.splice(this.childNodes.indexOf(n3) >>> 1, 1), e3.h.removeChild(n3);
    } };
  }
  G(_(Z, { context: e3.context }, n2.__v), e3.v);
}
function $2(n2, e3) {
  var r3 = _(Y, { __v: n2, h: e3 });
  return r3.containerInfo = e3, r3;
}
(B3.prototype = new x()).__a = function(n2) {
  var t3 = this, e3 = j3(t3.__v), r3 = t3.l.get(n2);
  return r3[0]++, function(u4) {
    var o3 = function() {
      t3.props.revealOrder ? (r3.push(u4), H2(t3, n2, r3)) : u4();
    };
    e3 ? e3(o3) : o3();
  };
}, B3.prototype.render = function(n2) {
  this.i = null, this.l = /* @__PURE__ */ new Map();
  var t3 = H(n2.children);
  n2.revealOrder && "b" === n2.revealOrder[0] && t3.reverse();
  for (var e3 = t3.length; e3--; ) this.l.set(t3[e3], this.i = [1, 0, this.i]);
  return n2.children;
}, B3.prototype.componentDidUpdate = B3.prototype.componentDidMount = function() {
  var n2 = this;
  this.l.forEach(function(t3, e3) {
    H2(n2, e3, t3);
  });
};
var q3 = "undefined" != typeof Symbol && Symbol.for && Symbol.for("react.element") || 60103;
var G2 = /^(?:accent|alignment|arabic|baseline|cap|clip(?!PathU)|color|dominant|fill|flood|font|glyph(?!R)|horiz|image(!S)|letter|lighting|marker(?!H|W|U)|overline|paint|pointer|shape|stop|strikethrough|stroke|text(?!L)|transform|underline|unicode|units|v|vector|vert|word|writing|x(?!C))[A-Z]/;
var J2 = /^on(Ani|Tra|Tou|BeforeInp|Compo)/;
var K2 = /[A-Z0-9]/g;
var Q2 = "undefined" != typeof document;
var X = function(n2) {
  return ("undefined" != typeof Symbol && "symbol" == typeof Symbol() ? /fil|che|rad/ : /fil|che|ra/).test(n2);
};
function nn(n2, t3, e3) {
  return null == t3.__k && (t3.textContent = ""), G(n2, t3), "function" == typeof e3 && e3(), n2 ? n2.__c : null;
}
function tn(n2, t3, e3) {
  return J(n2, t3), "function" == typeof e3 && e3(), n2 ? n2.__c : null;
}
x.prototype.isReactComponent = {}, ["componentWillMount", "componentWillReceiveProps", "componentWillUpdate"].forEach(function(t3) {
  Object.defineProperty(x.prototype, t3, { configurable: true, get: function() {
    return this["UNSAFE_" + t3];
  }, set: function(n2) {
    Object.defineProperty(this, t3, { configurable: true, writable: true, value: n2 });
  } });
});
var en = l.event;
function rn() {
}
function un() {
  return this.cancelBubble;
}
function on() {
  return this.defaultPrevented;
}
l.event = function(n2) {
  return en && (n2 = en(n2)), n2.persist = rn, n2.isPropagationStopped = un, n2.isDefaultPrevented = on, n2.nativeEvent = n2;
};
var ln;
var cn = { enumerable: false, configurable: true, get: function() {
  return this.class;
} };
var fn = l.vnode;
l.vnode = function(n2) {
  "string" == typeof n2.type && function(n3) {
    var t3 = n3.props, e3 = n3.type, u4 = {}, o3 = -1 === e3.indexOf("-");
    for (var i4 in t3) {
      var l3 = t3[i4];
      if (!("value" === i4 && "defaultValue" in t3 && null == l3 || Q2 && "children" === i4 && "noscript" === e3 || "class" === i4 || "className" === i4)) {
        var c3 = i4.toLowerCase();
        "defaultValue" === i4 && "value" in t3 && null == t3.value ? i4 = "value" : "download" === i4 && true === l3 ? l3 = "" : "translate" === c3 && "no" === l3 ? l3 = false : "o" === c3[0] && "n" === c3[1] ? "ondoubleclick" === c3 ? i4 = "ondblclick" : "onchange" !== c3 || "input" !== e3 && "textarea" !== e3 || X(t3.type) ? "onfocus" === c3 ? i4 = "onfocusin" : "onblur" === c3 ? i4 = "onfocusout" : J2.test(i4) && (i4 = c3) : c3 = i4 = "oninput" : o3 && G2.test(i4) ? i4 = i4.replace(K2, "-$&").toLowerCase() : null === l3 && (l3 = void 0), "oninput" === c3 && u4[i4 = c3] && (i4 = "oninputCapture"), u4[i4] = l3;
      }
    }
    "select" == e3 && u4.multiple && Array.isArray(u4.value) && (u4.value = H(t3.children).forEach(function(n4) {
      n4.props.selected = -1 != u4.value.indexOf(n4.props.value);
    })), "select" == e3 && null != u4.defaultValue && (u4.value = H(t3.children).forEach(function(n4) {
      n4.props.selected = u4.multiple ? -1 != u4.defaultValue.indexOf(n4.props.value) : u4.defaultValue == n4.props.value;
    })), t3.class && !t3.className ? (u4.class = t3.class, Object.defineProperty(u4, "className", cn)) : (t3.className && !t3.class || t3.class && t3.className) && (u4.class = u4.className = t3.className), n3.props = u4;
  }(n2), n2.$$typeof = q3, fn && fn(n2);
};
var an = l.__r;
l.__r = function(n2) {
  an && an(n2), ln = n2.__c;
};
var sn = l.diffed;
l.diffed = function(n2) {
  sn && sn(n2);
  var t3 = n2.props, e3 = n2.__e;
  null != e3 && "textarea" === n2.type && "value" in t3 && t3.value !== e3.value && (e3.value = null == t3.value ? "" : t3.value), ln = null;
};
var hn = { ReactCurrentDispatcher: { current: { readContext: function(n2) {
  return ln.__n[n2.__c].props.value;
}, useCallback: q2, useContext: x2, useDebugValue: P2, useDeferredValue: w3, useEffect: y2, useId: g2, useImperativeHandle: F2, useInsertionEffect: I2, useLayoutEffect: _2, useMemo: T2, useReducer: h2, useRef: A2, useState: d2, useSyncExternalStore: C3, useTransition: k3 } } };
var vn = "18.3.1";
function dn(n2) {
  return _.bind(null, n2);
}
function mn(n2) {
  return !!n2 && n2.$$typeof === q3;
}
function pn(n2) {
  return mn(n2) && n2.type === k;
}
function yn(n2) {
  return !!n2 && !!n2.displayName && ("string" == typeof n2.displayName || n2.displayName instanceof String) && n2.displayName.startsWith("Memo(");
}
function _n(n2) {
  return mn(n2) ? K.apply(null, arguments) : n2;
}
function bn(n2) {
  return !!n2.__k && (G(null, n2), true);
}
function Sn(n2) {
  return n2 && (n2.base || 1 === n2.nodeType && n2) || null;
}
var gn = function(n2, t3) {
  return n2(t3);
};
var En = function(n2, t3) {
  return n2(t3);
};
var Cn = k;
var xn = mn;
var Rn = { useState: d2, useId: g2, useReducer: h2, useEffect: y2, useLayoutEffect: _2, useInsertionEffect: I2, useTransition: k3, useDeferredValue: w3, useSyncExternalStore: C3, startTransition: R, useRef: A2, useImperativeHandle: F2, useMemo: T2, useCallback: q2, useContext: x2, useDebugValue: P2, version: "18.3.1", Children: O2, render: nn, hydrate: tn, unmountComponentAtNode: bn, createPortal: $2, createElement: _, createContext: Q, createFactory: dn, cloneElement: _n, createRef: b, Fragment: k, isValidElement: mn, isElement: xn, isFragment: pn, isMemo: yn, findDOMNode: Sn, Component: x, PureComponent: N2, memo: M2, forwardRef: D3, flushSync: En, unstable_batchedUpdates: gn, StrictMode: Cn, Suspense: P3, SuspenseList: B3, lazy: z3, __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: hn };

// node_modules/@radix-ui/primitive/dist/index.mjs
var canUseDOM = !!(typeof window !== "undefined" && window.document && window.document.createElement);
function composeEventHandlers(originalEventHandler, ourEventHandler, { checkForDefaultPrevented = true } = {}) {
  return function handleEvent(event) {
    originalEventHandler?.(event);
    if (checkForDefaultPrevented === false || !event.defaultPrevented) {
      return ourEventHandler?.(event);
    }
  };
}

// node_modules/@radix-ui/react-context/dist/index.mjs
function createContext2(rootComponentName, defaultContext) {
  const Context = Q(defaultContext);
  const Provider = (props) => {
    const { children, ...context } = props;
    const value = T2(() => context, Object.values(context));
    return /* @__PURE__ */ u3(Context.Provider, { value, children });
  };
  Provider.displayName = rootComponentName + "Provider";
  function useContext2(consumerName) {
    const context = x2(Context);
    if (context) return context;
    if (defaultContext !== void 0) return defaultContext;
    throw new Error(`\`${consumerName}\` must be used within \`${rootComponentName}\``);
  }
  return [Provider, useContext2];
}
function createContextScope(scopeName, createContextScopeDeps = []) {
  let defaultContexts = [];
  function createContext3(rootComponentName, defaultContext) {
    const BaseContext = Q(defaultContext);
    const index = defaultContexts.length;
    defaultContexts = [...defaultContexts, defaultContext];
    const Provider = (props) => {
      const { scope, children, ...context } = props;
      const Context = scope?.[scopeName]?.[index] || BaseContext;
      const value = T2(() => context, Object.values(context));
      return /* @__PURE__ */ u3(Context.Provider, { value, children });
    };
    Provider.displayName = rootComponentName + "Provider";
    function useContext2(consumerName, scope) {
      const Context = scope?.[scopeName]?.[index] || BaseContext;
      const context = x2(Context);
      if (context) return context;
      if (defaultContext !== void 0) return defaultContext;
      throw new Error(`\`${consumerName}\` must be used within \`${rootComponentName}\``);
    }
    return [Provider, useContext2];
  }
  const createScope = () => {
    const scopeContexts = defaultContexts.map((defaultContext) => {
      return Q(defaultContext);
    });
    return function useScope(scope) {
      const contexts = scope?.[scopeName] || scopeContexts;
      return T2(
        () => ({ [`__scope${scopeName}`]: { ...scope, [scopeName]: contexts } }),
        [scope, contexts]
      );
    };
  };
  createScope.scopeName = scopeName;
  return [createContext3, composeContextScopes(createScope, ...createContextScopeDeps)];
}
function composeContextScopes(...scopes) {
  const baseScope = scopes[0];
  if (scopes.length === 1) return baseScope;
  const createScope = () => {
    const scopeHooks = scopes.map((createScope2) => ({
      useScope: createScope2(),
      scopeName: createScope2.scopeName
    }));
    return function useComposedScopes(overrideScopes) {
      const nextScopes = scopeHooks.reduce((nextScopes2, { useScope, scopeName }) => {
        const scopeProps = useScope(overrideScopes);
        const currentScope = scopeProps[`__scope${scopeName}`];
        return { ...nextScopes2, ...currentScope };
      }, {});
      return T2(() => ({ [`__scope${baseScope.scopeName}`]: nextScopes }), [nextScopes]);
    };
  };
  createScope.scopeName = baseScope.scopeName;
  return createScope;
}

// node_modules/@radix-ui/react-compose-refs/dist/index.mjs
function setRef(ref, value) {
  if (typeof ref === "function") {
    return ref(value);
  } else if (ref !== null && ref !== void 0) {
    ref.current = value;
  }
}
function composeRefs(...refs) {
  return (node) => {
    let hasCleanup = false;
    const cleanups = refs.map((ref) => {
      const cleanup = setRef(ref, node);
      if (!hasCleanup && typeof cleanup == "function") {
        hasCleanup = true;
      }
      return cleanup;
    });
    if (hasCleanup) {
      return () => {
        for (let i4 = 0; i4 < cleanups.length; i4++) {
          const cleanup = cleanups[i4];
          if (typeof cleanup == "function") {
            cleanup();
          } else {
            setRef(refs[i4], null);
          }
        }
      };
    }
  };
}
function useComposedRefs(...refs) {
  return q2(composeRefs(...refs), refs);
}

// node_modules/@radix-ui/react-slot/dist/index.mjs
// @__NO_SIDE_EFFECTS__
function createSlot(ownerName) {
  const SlotClone = /* @__PURE__ */ createSlotClone(ownerName);
  const Slot2 = D3((props, forwardedRef) => {
    const { children, ...slotProps } = props;
    const childrenArray = O2.toArray(children);
    const slottable = childrenArray.find(isSlottable);
    if (slottable) {
      const newElement = slottable.props.children;
      const newChildren = childrenArray.map((child) => {
        if (child === slottable) {
          if (O2.count(newElement) > 1) return O2.only(null);
          return mn(newElement) ? newElement.props.children : null;
        } else {
          return child;
        }
      });
      return /* @__PURE__ */ u3(SlotClone, { ...slotProps, ref: forwardedRef, children: mn(newElement) ? _n(newElement, void 0, newChildren) : null });
    }
    return /* @__PURE__ */ u3(SlotClone, { ...slotProps, ref: forwardedRef, children });
  });
  Slot2.displayName = `${ownerName}.Slot`;
  return Slot2;
}
// @__NO_SIDE_EFFECTS__
function createSlotClone(ownerName) {
  const SlotClone = D3((props, forwardedRef) => {
    const { children, ...slotProps } = props;
    if (mn(children)) {
      const childrenRef = getElementRef(children);
      const props2 = mergeProps(slotProps, children.props);
      if (children.type !== k) {
        props2.ref = forwardedRef ? composeRefs(forwardedRef, childrenRef) : childrenRef;
      }
      return _n(children, props2);
    }
    return O2.count(children) > 1 ? O2.only(null) : null;
  });
  SlotClone.displayName = `${ownerName}.SlotClone`;
  return SlotClone;
}
var SLOTTABLE_IDENTIFIER = Symbol("radix.slottable");
function isSlottable(child) {
  return mn(child) && typeof child.type === "function" && "__radixId" in child.type && child.type.__radixId === SLOTTABLE_IDENTIFIER;
}
function mergeProps(slotProps, childProps) {
  const overrideProps = { ...childProps };
  for (const propName in childProps) {
    const slotPropValue = slotProps[propName];
    const childPropValue = childProps[propName];
    const isHandler = /^on[A-Z]/.test(propName);
    if (isHandler) {
      if (slotPropValue && childPropValue) {
        overrideProps[propName] = (...args) => {
          const result = childPropValue(...args);
          slotPropValue(...args);
          return result;
        };
      } else if (slotPropValue) {
        overrideProps[propName] = slotPropValue;
      }
    } else if (propName === "style") {
      overrideProps[propName] = { ...slotPropValue, ...childPropValue };
    } else if (propName === "className") {
      overrideProps[propName] = [slotPropValue, childPropValue].filter(Boolean).join(" ");
    }
  }
  return { ...slotProps, ...overrideProps };
}
function getElementRef(element) {
  let getter = Object.getOwnPropertyDescriptor(element.props, "ref")?.get;
  let mayWarn = getter && "isReactWarning" in getter && getter.isReactWarning;
  if (mayWarn) {
    return element.ref;
  }
  getter = Object.getOwnPropertyDescriptor(element, "ref")?.get;
  mayWarn = getter && "isReactWarning" in getter && getter.isReactWarning;
  if (mayWarn) {
    return element.props.ref;
  }
  return element.props.ref || element.ref;
}

// node_modules/@radix-ui/react-collection/dist/index.mjs
function createCollection(name) {
  const PROVIDER_NAME = name + "CollectionProvider";
  const [createCollectionContext, createCollectionScope2] = createContextScope(PROVIDER_NAME);
  const [CollectionProviderImpl, useCollectionContext] = createCollectionContext(
    PROVIDER_NAME,
    { collectionRef: { current: null }, itemMap: /* @__PURE__ */ new Map() }
  );
  const CollectionProvider = (props) => {
    const { scope, children } = props;
    const ref = Rn.useRef(null);
    const itemMap = Rn.useRef(/* @__PURE__ */ new Map()).current;
    return /* @__PURE__ */ u3(CollectionProviderImpl, { scope, itemMap, collectionRef: ref, children });
  };
  CollectionProvider.displayName = PROVIDER_NAME;
  const COLLECTION_SLOT_NAME = name + "CollectionSlot";
  const CollectionSlotImpl = createSlot(COLLECTION_SLOT_NAME);
  const CollectionSlot = Rn.forwardRef(
    (props, forwardedRef) => {
      const { scope, children } = props;
      const context = useCollectionContext(COLLECTION_SLOT_NAME, scope);
      const composedRefs = useComposedRefs(forwardedRef, context.collectionRef);
      return /* @__PURE__ */ u3(CollectionSlotImpl, { ref: composedRefs, children });
    }
  );
  CollectionSlot.displayName = COLLECTION_SLOT_NAME;
  const ITEM_SLOT_NAME = name + "CollectionItemSlot";
  const ITEM_DATA_ATTR = "data-radix-collection-item";
  const CollectionItemSlotImpl = createSlot(ITEM_SLOT_NAME);
  const CollectionItemSlot = Rn.forwardRef(
    (props, forwardedRef) => {
      const { scope, children, ...itemData } = props;
      const ref = Rn.useRef(null);
      const composedRefs = useComposedRefs(forwardedRef, ref);
      const context = useCollectionContext(ITEM_SLOT_NAME, scope);
      Rn.useEffect(() => {
        context.itemMap.set(ref, { ref, ...itemData });
        return () => void context.itemMap.delete(ref);
      });
      return /* @__PURE__ */ u3(CollectionItemSlotImpl, { ...{ [ITEM_DATA_ATTR]: "" }, ref: composedRefs, children });
    }
  );
  CollectionItemSlot.displayName = ITEM_SLOT_NAME;
  function useCollection2(scope) {
    const context = useCollectionContext(name + "CollectionConsumer", scope);
    const getItems = Rn.useCallback(() => {
      const collectionNode = context.collectionRef.current;
      if (!collectionNode) return [];
      const orderedNodes = Array.from(collectionNode.querySelectorAll(`[${ITEM_DATA_ATTR}]`));
      const items = Array.from(context.itemMap.values());
      const orderedItems = items.sort(
        (a3, b3) => orderedNodes.indexOf(a3.ref.current) - orderedNodes.indexOf(b3.ref.current)
      );
      return orderedItems;
    }, [context.collectionRef, context.itemMap]);
    return getItems;
  }
  return [
    { Provider: CollectionProvider, Slot: CollectionSlot, ItemSlot: CollectionItemSlot },
    useCollection2,
    createCollectionScope2
  ];
}

// node_modules/@radix-ui/react-use-layout-effect/dist/index.mjs
var useLayoutEffect2 = globalThis?.document ? _2 : () => {
};

// node_modules/@radix-ui/react-id/dist/index.mjs
var useReactId = compat_module_exports[" useId ".trim().toString()] || (() => void 0);
var count = 0;
function useId(deterministicId) {
  const [id, setId] = d2(useReactId());
  useLayoutEffect2(() => {
    if (!deterministicId) setId((reactId) => reactId ?? String(count++));
  }, [deterministicId]);
  return deterministicId || (id ? `radix-${id}` : "");
}

// node_modules/@radix-ui/react-primitive/dist/index.mjs
var NODES = [
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
];
var Primitive = NODES.reduce((primitive, node) => {
  const Slot2 = createSlot(`Primitive.${node}`);
  const Node2 = D3((props, forwardedRef) => {
    const { asChild, ...primitiveProps } = props;
    const Comp = asChild ? Slot2 : node;
    if (typeof window !== "undefined") {
      window[Symbol.for("radix-ui")] = true;
    }
    return /* @__PURE__ */ u3(Comp, { ...primitiveProps, ref: forwardedRef });
  });
  Node2.displayName = `Primitive.${node}`;
  return { ...primitive, [node]: Node2 };
}, {});
function dispatchDiscreteCustomEvent(target, event) {
  if (target) En(() => target.dispatchEvent(event));
}

// node_modules/@radix-ui/react-use-callback-ref/dist/index.mjs
function useCallbackRef(callback) {
  const callbackRef = A2(callback);
  y2(() => {
    callbackRef.current = callback;
  });
  return T2(() => (...args) => callbackRef.current?.(...args), []);
}

// node_modules/@radix-ui/react-use-controllable-state/dist/index.mjs
var useInsertionEffect = compat_module_exports[" useInsertionEffect ".trim().toString()] || useLayoutEffect2;
function useControllableState({
  prop,
  defaultProp,
  onChange = () => {
  },
  caller
}) {
  const [uncontrolledProp, setUncontrolledProp, onChangeRef] = useUncontrolledState({
    defaultProp,
    onChange
  });
  const isControlled = prop !== void 0;
  const value = isControlled ? prop : uncontrolledProp;
  if (true) {
    const isControlledRef = A2(prop !== void 0);
    y2(() => {
      const wasControlled = isControlledRef.current;
      if (wasControlled !== isControlled) {
        const from = wasControlled ? "controlled" : "uncontrolled";
        const to = isControlled ? "controlled" : "uncontrolled";
        console.warn(
          `${caller} is changing from ${from} to ${to}. Components should not switch from controlled to uncontrolled (or vice versa). Decide between using a controlled or uncontrolled value for the lifetime of the component.`
        );
      }
      isControlledRef.current = isControlled;
    }, [isControlled, caller]);
  }
  const setValue = q2(
    (nextValue) => {
      if (isControlled) {
        const value2 = isFunction(nextValue) ? nextValue(prop) : nextValue;
        if (value2 !== prop) {
          onChangeRef.current?.(value2);
        }
      } else {
        setUncontrolledProp(nextValue);
      }
    },
    [isControlled, prop, setUncontrolledProp, onChangeRef]
  );
  return [value, setValue];
}
function useUncontrolledState({
  defaultProp,
  onChange
}) {
  const [value, setValue] = d2(defaultProp);
  const prevValueRef = A2(value);
  const onChangeRef = A2(onChange);
  useInsertionEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  y2(() => {
    if (prevValueRef.current !== value) {
      onChangeRef.current?.(value);
      prevValueRef.current = value;
    }
  }, [value, prevValueRef]);
  return [value, setValue, onChangeRef];
}
function isFunction(value) {
  return typeof value === "function";
}
var SYNC_STATE = Symbol("RADIX:SYNC_STATE");

// node_modules/@radix-ui/react-direction/dist/index.mjs
var DirectionContext = Q(void 0);
function useDirection(localDir) {
  const globalDir = x2(DirectionContext);
  return localDir || globalDir || "ltr";
}

// node_modules/@radix-ui/react-roving-focus/dist/index.mjs
var ENTRY_FOCUS = "rovingFocusGroup.onEntryFocus";
var EVENT_OPTIONS = { bubbles: false, cancelable: true };
var GROUP_NAME = "RovingFocusGroup";
var [Collection, useCollection, createCollectionScope] = createCollection(GROUP_NAME);
var [createRovingFocusGroupContext, createRovingFocusGroupScope] = createContextScope(
  GROUP_NAME,
  [createCollectionScope]
);
var [RovingFocusProvider, useRovingFocusContext] = createRovingFocusGroupContext(GROUP_NAME);
var RovingFocusGroup = D3(
  (props, forwardedRef) => {
    return /* @__PURE__ */ u3(Collection.Provider, { scope: props.__scopeRovingFocusGroup, children: /* @__PURE__ */ u3(Collection.Slot, { scope: props.__scopeRovingFocusGroup, children: /* @__PURE__ */ u3(RovingFocusGroupImpl, { ...props, ref: forwardedRef }) }) });
  }
);
RovingFocusGroup.displayName = GROUP_NAME;
var RovingFocusGroupImpl = D3((props, forwardedRef) => {
  const {
    __scopeRovingFocusGroup,
    orientation,
    loop = false,
    dir,
    currentTabStopId: currentTabStopIdProp,
    defaultCurrentTabStopId,
    onCurrentTabStopIdChange,
    onEntryFocus,
    preventScrollOnEntryFocus = false,
    ...groupProps
  } = props;
  const ref = A2(null);
  const composedRefs = useComposedRefs(forwardedRef, ref);
  const direction = useDirection(dir);
  const [currentTabStopId, setCurrentTabStopId] = useControllableState({
    prop: currentTabStopIdProp,
    defaultProp: defaultCurrentTabStopId ?? null,
    onChange: onCurrentTabStopIdChange,
    caller: GROUP_NAME
  });
  const [isTabbingBackOut, setIsTabbingBackOut] = d2(false);
  const handleEntryFocus = useCallbackRef(onEntryFocus);
  const getItems = useCollection(__scopeRovingFocusGroup);
  const isClickFocusRef = A2(false);
  const [focusableItemsCount, setFocusableItemsCount] = d2(0);
  y2(() => {
    const node = ref.current;
    if (node) {
      node.addEventListener(ENTRY_FOCUS, handleEntryFocus);
      return () => node.removeEventListener(ENTRY_FOCUS, handleEntryFocus);
    }
  }, [handleEntryFocus]);
  return /* @__PURE__ */ u3(
    RovingFocusProvider,
    {
      scope: __scopeRovingFocusGroup,
      orientation,
      dir: direction,
      loop,
      currentTabStopId,
      onItemFocus: q2(
        (tabStopId) => setCurrentTabStopId(tabStopId),
        [setCurrentTabStopId]
      ),
      onItemShiftTab: q2(() => setIsTabbingBackOut(true), []),
      onFocusableItemAdd: q2(
        () => setFocusableItemsCount((prevCount) => prevCount + 1),
        []
      ),
      onFocusableItemRemove: q2(
        () => setFocusableItemsCount((prevCount) => prevCount - 1),
        []
      ),
      children: /* @__PURE__ */ u3(
        Primitive.div,
        {
          tabIndex: isTabbingBackOut || focusableItemsCount === 0 ? -1 : 0,
          "data-orientation": orientation,
          ...groupProps,
          ref: composedRefs,
          style: { outline: "none", ...props.style },
          onMouseDown: composeEventHandlers(props.onMouseDown, () => {
            isClickFocusRef.current = true;
          }),
          onFocus: composeEventHandlers(props.onFocus, (event) => {
            const isKeyboardFocus = !isClickFocusRef.current;
            if (event.target === event.currentTarget && isKeyboardFocus && !isTabbingBackOut) {
              const entryFocusEvent = new CustomEvent(ENTRY_FOCUS, EVENT_OPTIONS);
              event.currentTarget.dispatchEvent(entryFocusEvent);
              if (!entryFocusEvent.defaultPrevented) {
                const items = getItems().filter((item) => item.focusable);
                const activeItem = items.find((item) => item.active);
                const currentItem = items.find((item) => item.id === currentTabStopId);
                const candidateItems = [activeItem, currentItem, ...items].filter(
                  Boolean
                );
                const candidateNodes = candidateItems.map((item) => item.ref.current);
                focusFirst(candidateNodes, preventScrollOnEntryFocus);
              }
            }
            isClickFocusRef.current = false;
          }),
          onBlur: composeEventHandlers(props.onBlur, () => setIsTabbingBackOut(false))
        }
      )
    }
  );
});
var ITEM_NAME = "RovingFocusGroupItem";
var RovingFocusGroupItem = D3(
  (props, forwardedRef) => {
    const {
      __scopeRovingFocusGroup,
      focusable = true,
      active = false,
      tabStopId,
      children,
      ...itemProps
    } = props;
    const autoId = useId();
    const id = tabStopId || autoId;
    const context = useRovingFocusContext(ITEM_NAME, __scopeRovingFocusGroup);
    const isCurrentTabStop = context.currentTabStopId === id;
    const getItems = useCollection(__scopeRovingFocusGroup);
    const { onFocusableItemAdd, onFocusableItemRemove, currentTabStopId } = context;
    y2(() => {
      if (focusable) {
        onFocusableItemAdd();
        return () => onFocusableItemRemove();
      }
    }, [focusable, onFocusableItemAdd, onFocusableItemRemove]);
    return /* @__PURE__ */ u3(
      Collection.ItemSlot,
      {
        scope: __scopeRovingFocusGroup,
        id,
        focusable,
        active,
        children: /* @__PURE__ */ u3(
          Primitive.span,
          {
            tabIndex: isCurrentTabStop ? 0 : -1,
            "data-orientation": context.orientation,
            ...itemProps,
            ref: forwardedRef,
            onMouseDown: composeEventHandlers(props.onMouseDown, (event) => {
              if (!focusable) event.preventDefault();
              else context.onItemFocus(id);
            }),
            onFocus: composeEventHandlers(props.onFocus, () => context.onItemFocus(id)),
            onKeyDown: composeEventHandlers(props.onKeyDown, (event) => {
              if (event.key === "Tab" && event.shiftKey) {
                context.onItemShiftTab();
                return;
              }
              if (event.target !== event.currentTarget) return;
              const focusIntent = getFocusIntent(event, context.orientation, context.dir);
              if (focusIntent !== void 0) {
                if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
                event.preventDefault();
                const items = getItems().filter((item) => item.focusable);
                let candidateNodes = items.map((item) => item.ref.current);
                if (focusIntent === "last") candidateNodes.reverse();
                else if (focusIntent === "prev" || focusIntent === "next") {
                  if (focusIntent === "prev") candidateNodes.reverse();
                  const currentIndex = candidateNodes.indexOf(event.currentTarget);
                  candidateNodes = context.loop ? wrapArray(candidateNodes, currentIndex + 1) : candidateNodes.slice(currentIndex + 1);
                }
                setTimeout(() => focusFirst(candidateNodes));
              }
            }),
            children: typeof children === "function" ? children({ isCurrentTabStop, hasTabStop: currentTabStopId != null }) : children
          }
        )
      }
    );
  }
);
RovingFocusGroupItem.displayName = ITEM_NAME;
var MAP_KEY_TO_FOCUS_INTENT = {
  ArrowLeft: "prev",
  ArrowUp: "prev",
  ArrowRight: "next",
  ArrowDown: "next",
  PageUp: "first",
  Home: "first",
  PageDown: "last",
  End: "last"
};
function getDirectionAwareKey(key, dir) {
  if (dir !== "rtl") return key;
  return key === "ArrowLeft" ? "ArrowRight" : key === "ArrowRight" ? "ArrowLeft" : key;
}
function getFocusIntent(event, orientation, dir) {
  const key = getDirectionAwareKey(event.key, dir);
  if (orientation === "vertical" && ["ArrowLeft", "ArrowRight"].includes(key)) return void 0;
  if (orientation === "horizontal" && ["ArrowUp", "ArrowDown"].includes(key)) return void 0;
  return MAP_KEY_TO_FOCUS_INTENT[key];
}
function focusFirst(candidates, preventScroll = false) {
  const PREVIOUSLY_FOCUSED_ELEMENT = document.activeElement;
  for (const candidate of candidates) {
    if (candidate === PREVIOUSLY_FOCUSED_ELEMENT) return;
    candidate.focus({ preventScroll });
    if (document.activeElement !== PREVIOUSLY_FOCUSED_ELEMENT) return;
  }
}
function wrapArray(array, startIndex) {
  return array.map((_3, index) => array[(startIndex + index) % array.length]);
}
var Root = RovingFocusGroup;
var Item = RovingFocusGroupItem;

// node_modules/@radix-ui/react-presence/dist/index.mjs
function useStateMachine(initialState, machine) {
  return h2((state, event) => {
    const nextState = machine[state][event];
    return nextState ?? state;
  }, initialState);
}
var Presence = (props) => {
  const { present, children } = props;
  const presence = usePresence(present);
  const child = typeof children === "function" ? children({ present: presence.isPresent }) : O2.only(children);
  const ref = useComposedRefs(presence.ref, getElementRef2(child));
  const forceMount = typeof children === "function";
  return forceMount || presence.isPresent ? _n(child, { ref }) : null;
};
Presence.displayName = "Presence";
function usePresence(present) {
  const [node, setNode] = d2();
  const stylesRef = A2(null);
  const prevPresentRef = A2(present);
  const prevAnimationNameRef = A2("none");
  const initialState = present ? "mounted" : "unmounted";
  const [state, send] = useStateMachine(initialState, {
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
  y2(() => {
    const currentAnimationName = getAnimationName(stylesRef.current);
    prevAnimationNameRef.current = state === "mounted" ? currentAnimationName : "none";
  }, [state]);
  useLayoutEffect2(() => {
    const styles2 = stylesRef.current;
    const wasPresent = prevPresentRef.current;
    const hasPresentChanged = wasPresent !== present;
    if (hasPresentChanged) {
      const prevAnimationName = prevAnimationNameRef.current;
      const currentAnimationName = getAnimationName(styles2);
      if (present) {
        send("MOUNT");
      } else if (currentAnimationName === "none" || styles2?.display === "none") {
        send("UNMOUNT");
      } else {
        const isAnimating = prevAnimationName !== currentAnimationName;
        if (wasPresent && isAnimating) {
          send("ANIMATION_OUT");
        } else {
          send("UNMOUNT");
        }
      }
      prevPresentRef.current = present;
    }
  }, [present, send]);
  useLayoutEffect2(() => {
    if (node) {
      let timeoutId;
      const ownerWindow = node.ownerDocument.defaultView ?? window;
      const handleAnimationEnd = (event) => {
        const currentAnimationName = getAnimationName(stylesRef.current);
        const isCurrentAnimation = currentAnimationName.includes(CSS.escape(event.animationName));
        if (event.target === node && isCurrentAnimation) {
          send("ANIMATION_END");
          if (!prevPresentRef.current) {
            const currentFillMode = node.style.animationFillMode;
            node.style.animationFillMode = "forwards";
            timeoutId = ownerWindow.setTimeout(() => {
              if (node.style.animationFillMode === "forwards") {
                node.style.animationFillMode = currentFillMode;
              }
            });
          }
        }
      };
      const handleAnimationStart = (event) => {
        if (event.target === node) {
          prevAnimationNameRef.current = getAnimationName(stylesRef.current);
        }
      };
      node.addEventListener("animationstart", handleAnimationStart);
      node.addEventListener("animationcancel", handleAnimationEnd);
      node.addEventListener("animationend", handleAnimationEnd);
      return () => {
        ownerWindow.clearTimeout(timeoutId);
        node.removeEventListener("animationstart", handleAnimationStart);
        node.removeEventListener("animationcancel", handleAnimationEnd);
        node.removeEventListener("animationend", handleAnimationEnd);
      };
    } else {
      send("ANIMATION_END");
    }
  }, [node, send]);
  return {
    isPresent: ["mounted", "unmountSuspended"].includes(state),
    ref: q2((node2) => {
      stylesRef.current = node2 ? getComputedStyle(node2) : null;
      setNode(node2);
    }, [])
  };
}
function getAnimationName(styles2) {
  return styles2?.animationName || "none";
}
function getElementRef2(element) {
  let getter = Object.getOwnPropertyDescriptor(element.props, "ref")?.get;
  let mayWarn = getter && "isReactWarning" in getter && getter.isReactWarning;
  if (mayWarn) {
    return element.ref;
  }
  getter = Object.getOwnPropertyDescriptor(element, "ref")?.get;
  mayWarn = getter && "isReactWarning" in getter && getter.isReactWarning;
  if (mayWarn) {
    return element.props.ref;
  }
  return element.props.ref || element.ref;
}

// node_modules/@radix-ui/react-tabs/dist/index.mjs
var TABS_NAME = "Tabs";
var [createTabsContext, createTabsScope] = createContextScope(TABS_NAME, [
  createRovingFocusGroupScope
]);
var useRovingFocusGroupScope = createRovingFocusGroupScope();
var [TabsProvider, useTabsContext] = createTabsContext(TABS_NAME);
var Tabs = D3(
  (props, forwardedRef) => {
    const {
      __scopeTabs,
      value: valueProp,
      onValueChange,
      defaultValue,
      orientation = "horizontal",
      dir,
      activationMode = "automatic",
      ...tabsProps
    } = props;
    const direction = useDirection(dir);
    const [value, setValue] = useControllableState({
      prop: valueProp,
      onChange: onValueChange,
      defaultProp: defaultValue ?? "",
      caller: TABS_NAME
    });
    return /* @__PURE__ */ u3(
      TabsProvider,
      {
        scope: __scopeTabs,
        baseId: useId(),
        value,
        onValueChange: setValue,
        orientation,
        dir: direction,
        activationMode,
        children: /* @__PURE__ */ u3(
          Primitive.div,
          {
            dir: direction,
            "data-orientation": orientation,
            ...tabsProps,
            ref: forwardedRef
          }
        )
      }
    );
  }
);
Tabs.displayName = TABS_NAME;
var TAB_LIST_NAME = "TabsList";
var TabsList = D3(
  (props, forwardedRef) => {
    const { __scopeTabs, loop = true, ...listProps } = props;
    const context = useTabsContext(TAB_LIST_NAME, __scopeTabs);
    const rovingFocusGroupScope = useRovingFocusGroupScope(__scopeTabs);
    return /* @__PURE__ */ u3(
      Root,
      {
        asChild: true,
        ...rovingFocusGroupScope,
        orientation: context.orientation,
        dir: context.dir,
        loop,
        children: /* @__PURE__ */ u3(
          Primitive.div,
          {
            role: "tablist",
            "aria-orientation": context.orientation,
            ...listProps,
            ref: forwardedRef
          }
        )
      }
    );
  }
);
TabsList.displayName = TAB_LIST_NAME;
var TRIGGER_NAME = "TabsTrigger";
var TabsTrigger = D3(
  (props, forwardedRef) => {
    const { __scopeTabs, value, disabled = false, ...triggerProps } = props;
    const context = useTabsContext(TRIGGER_NAME, __scopeTabs);
    const rovingFocusGroupScope = useRovingFocusGroupScope(__scopeTabs);
    const triggerId = makeTriggerId(context.baseId, value);
    const contentId = makeContentId(context.baseId, value);
    const isSelected = value === context.value;
    return /* @__PURE__ */ u3(
      Item,
      {
        asChild: true,
        ...rovingFocusGroupScope,
        focusable: !disabled,
        active: isSelected,
        children: /* @__PURE__ */ u3(
          Primitive.button,
          {
            type: "button",
            role: "tab",
            "aria-selected": isSelected,
            "aria-controls": contentId,
            "data-state": isSelected ? "active" : "inactive",
            "data-disabled": disabled ? "" : void 0,
            disabled,
            id: triggerId,
            ...triggerProps,
            ref: forwardedRef,
            onMouseDown: composeEventHandlers(props.onMouseDown, (event) => {
              if (!disabled && event.button === 0 && event.ctrlKey === false) {
                context.onValueChange(value);
              } else {
                event.preventDefault();
              }
            }),
            onKeyDown: composeEventHandlers(props.onKeyDown, (event) => {
              if ([" ", "Enter"].includes(event.key)) context.onValueChange(value);
            }),
            onFocus: composeEventHandlers(props.onFocus, () => {
              const isAutomaticActivation = context.activationMode !== "manual";
              if (!isSelected && !disabled && isAutomaticActivation) {
                context.onValueChange(value);
              }
            })
          }
        )
      }
    );
  }
);
TabsTrigger.displayName = TRIGGER_NAME;
var CONTENT_NAME = "TabsContent";
var TabsContent = D3(
  (props, forwardedRef) => {
    const { __scopeTabs, value, forceMount, children, ...contentProps } = props;
    const context = useTabsContext(CONTENT_NAME, __scopeTabs);
    const triggerId = makeTriggerId(context.baseId, value);
    const contentId = makeContentId(context.baseId, value);
    const isSelected = value === context.value;
    const isMountAnimationPreventedRef = A2(isSelected);
    y2(() => {
      const rAF = requestAnimationFrame(() => isMountAnimationPreventedRef.current = false);
      return () => cancelAnimationFrame(rAF);
    }, []);
    return /* @__PURE__ */ u3(Presence, { present: forceMount || isSelected, children: ({ present }) => /* @__PURE__ */ u3(
      Primitive.div,
      {
        "data-state": isSelected ? "active" : "inactive",
        "data-orientation": context.orientation,
        role: "tabpanel",
        "aria-labelledby": triggerId,
        hidden: !present,
        id: contentId,
        tabIndex: 0,
        ...contentProps,
        ref: forwardedRef,
        style: {
          ...props.style,
          animationDuration: isMountAnimationPreventedRef.current ? "0s" : void 0
        },
        children: present && children
      }
    ) });
  }
);
TabsContent.displayName = CONTENT_NAME;
function makeTriggerId(baseId, value) {
  return `${baseId}-trigger-${value}`;
}
function makeContentId(baseId, value) {
  return `${baseId}-content-${value}`;
}
var Root2 = Tabs;
var List = TabsList;
var Trigger = TabsTrigger;
var Content = TabsContent;

// node_modules/@radix-ui/react-use-escape-keydown/dist/index.mjs
function useEscapeKeydown(onEscapeKeyDownProp, ownerDocument = globalThis?.document) {
  const onEscapeKeyDown = useCallbackRef(onEscapeKeyDownProp);
  y2(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onEscapeKeyDown(event);
      }
    };
    ownerDocument.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => ownerDocument.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [onEscapeKeyDown, ownerDocument]);
}

// node_modules/@radix-ui/react-dismissable-layer/dist/index.mjs
var DISMISSABLE_LAYER_NAME = "DismissableLayer";
var CONTEXT_UPDATE = "dismissableLayer.update";
var POINTER_DOWN_OUTSIDE = "dismissableLayer.pointerDownOutside";
var FOCUS_OUTSIDE = "dismissableLayer.focusOutside";
var originalBodyPointerEvents;
var DismissableLayerContext = Q({
  layers: /* @__PURE__ */ new Set(),
  layersWithOutsidePointerEventsDisabled: /* @__PURE__ */ new Set(),
  branches: /* @__PURE__ */ new Set()
});
var DismissableLayer = D3(
  (props, forwardedRef) => {
    const {
      disableOutsidePointerEvents = false,
      onEscapeKeyDown,
      onPointerDownOutside,
      onFocusOutside,
      onInteractOutside,
      onDismiss,
      ...layerProps
    } = props;
    const context = x2(DismissableLayerContext);
    const [node, setNode] = d2(null);
    const ownerDocument = node?.ownerDocument ?? globalThis?.document;
    const [, force] = d2({});
    const composedRefs = useComposedRefs(forwardedRef, (node2) => setNode(node2));
    const layers = Array.from(context.layers);
    const [highestLayerWithOutsidePointerEventsDisabled] = [...context.layersWithOutsidePointerEventsDisabled].slice(-1);
    const highestLayerWithOutsidePointerEventsDisabledIndex = layers.indexOf(highestLayerWithOutsidePointerEventsDisabled);
    const index = node ? layers.indexOf(node) : -1;
    const isBodyPointerEventsDisabled = context.layersWithOutsidePointerEventsDisabled.size > 0;
    const isPointerEventsEnabled = index >= highestLayerWithOutsidePointerEventsDisabledIndex;
    const pointerDownOutside = usePointerDownOutside((event) => {
      const target = event.target;
      const isPointerDownOnBranch = [...context.branches].some((branch) => branch.contains(target));
      if (!isPointerEventsEnabled || isPointerDownOnBranch) return;
      onPointerDownOutside?.(event);
      onInteractOutside?.(event);
      if (!event.defaultPrevented) onDismiss?.();
    }, ownerDocument);
    const focusOutside = useFocusOutside((event) => {
      const target = event.target;
      const isFocusInBranch = [...context.branches].some((branch) => branch.contains(target));
      if (isFocusInBranch) return;
      onFocusOutside?.(event);
      onInteractOutside?.(event);
      if (!event.defaultPrevented) onDismiss?.();
    }, ownerDocument);
    useEscapeKeydown((event) => {
      const isHighestLayer = index === context.layers.size - 1;
      if (!isHighestLayer) return;
      onEscapeKeyDown?.(event);
      if (!event.defaultPrevented && onDismiss) {
        event.preventDefault();
        onDismiss();
      }
    }, ownerDocument);
    y2(() => {
      if (!node) return;
      if (disableOutsidePointerEvents) {
        if (context.layersWithOutsidePointerEventsDisabled.size === 0) {
          originalBodyPointerEvents = ownerDocument.body.style.pointerEvents;
          ownerDocument.body.style.pointerEvents = "none";
        }
        context.layersWithOutsidePointerEventsDisabled.add(node);
      }
      context.layers.add(node);
      dispatchUpdate();
      return () => {
        if (disableOutsidePointerEvents && context.layersWithOutsidePointerEventsDisabled.size === 1) {
          ownerDocument.body.style.pointerEvents = originalBodyPointerEvents;
        }
      };
    }, [node, ownerDocument, disableOutsidePointerEvents, context]);
    y2(() => {
      return () => {
        if (!node) return;
        context.layers.delete(node);
        context.layersWithOutsidePointerEventsDisabled.delete(node);
        dispatchUpdate();
      };
    }, [node, context]);
    y2(() => {
      const handleUpdate = () => force({});
      document.addEventListener(CONTEXT_UPDATE, handleUpdate);
      return () => document.removeEventListener(CONTEXT_UPDATE, handleUpdate);
    }, []);
    return /* @__PURE__ */ u3(
      Primitive.div,
      {
        ...layerProps,
        ref: composedRefs,
        style: {
          pointerEvents: isBodyPointerEventsDisabled ? isPointerEventsEnabled ? "auto" : "none" : void 0,
          ...props.style
        },
        onFocusCapture: composeEventHandlers(props.onFocusCapture, focusOutside.onFocusCapture),
        onBlurCapture: composeEventHandlers(props.onBlurCapture, focusOutside.onBlurCapture),
        onPointerDownCapture: composeEventHandlers(
          props.onPointerDownCapture,
          pointerDownOutside.onPointerDownCapture
        )
      }
    );
  }
);
DismissableLayer.displayName = DISMISSABLE_LAYER_NAME;
var BRANCH_NAME = "DismissableLayerBranch";
var DismissableLayerBranch = D3((props, forwardedRef) => {
  const context = x2(DismissableLayerContext);
  const ref = A2(null);
  const composedRefs = useComposedRefs(forwardedRef, ref);
  y2(() => {
    const node = ref.current;
    if (node) {
      context.branches.add(node);
      return () => {
        context.branches.delete(node);
      };
    }
  }, [context.branches]);
  return /* @__PURE__ */ u3(Primitive.div, { ...props, ref: composedRefs });
});
DismissableLayerBranch.displayName = BRANCH_NAME;
function usePointerDownOutside(onPointerDownOutside, ownerDocument = globalThis?.document) {
  const handlePointerDownOutside = useCallbackRef(onPointerDownOutside);
  const isPointerInsideReactTreeRef = A2(false);
  const handleClickRef = A2(() => {
  });
  y2(() => {
    const handlePointerDown = (event) => {
      if (event.target && !isPointerInsideReactTreeRef.current) {
        let handleAndDispatchPointerDownOutsideEvent2 = function() {
          handleAndDispatchCustomEvent(
            POINTER_DOWN_OUTSIDE,
            handlePointerDownOutside,
            eventDetail,
            { discrete: true }
          );
        };
        var handleAndDispatchPointerDownOutsideEvent = handleAndDispatchPointerDownOutsideEvent2;
        const eventDetail = { originalEvent: event };
        if (event.pointerType === "touch") {
          ownerDocument.removeEventListener("click", handleClickRef.current);
          handleClickRef.current = handleAndDispatchPointerDownOutsideEvent2;
          ownerDocument.addEventListener("click", handleClickRef.current, { once: true });
        } else {
          handleAndDispatchPointerDownOutsideEvent2();
        }
      } else {
        ownerDocument.removeEventListener("click", handleClickRef.current);
      }
      isPointerInsideReactTreeRef.current = false;
    };
    const timerId = window.setTimeout(() => {
      ownerDocument.addEventListener("pointerdown", handlePointerDown);
    }, 0);
    return () => {
      window.clearTimeout(timerId);
      ownerDocument.removeEventListener("pointerdown", handlePointerDown);
      ownerDocument.removeEventListener("click", handleClickRef.current);
    };
  }, [ownerDocument, handlePointerDownOutside]);
  return {
    // ensures we check React component tree (not just DOM tree)
    onPointerDownCapture: () => isPointerInsideReactTreeRef.current = true
  };
}
function useFocusOutside(onFocusOutside, ownerDocument = globalThis?.document) {
  const handleFocusOutside = useCallbackRef(onFocusOutside);
  const isFocusInsideReactTreeRef = A2(false);
  y2(() => {
    const handleFocus = (event) => {
      if (event.target && !isFocusInsideReactTreeRef.current) {
        const eventDetail = { originalEvent: event };
        handleAndDispatchCustomEvent(FOCUS_OUTSIDE, handleFocusOutside, eventDetail, {
          discrete: false
        });
      }
    };
    ownerDocument.addEventListener("focusin", handleFocus);
    return () => ownerDocument.removeEventListener("focusin", handleFocus);
  }, [ownerDocument, handleFocusOutside]);
  return {
    onFocusCapture: () => isFocusInsideReactTreeRef.current = true,
    onBlurCapture: () => isFocusInsideReactTreeRef.current = false
  };
}
function dispatchUpdate() {
  const event = new CustomEvent(CONTEXT_UPDATE);
  document.dispatchEvent(event);
}
function handleAndDispatchCustomEvent(name, handler, detail, { discrete }) {
  const target = detail.originalEvent.target;
  const event = new CustomEvent(name, { bubbles: false, cancelable: true, detail });
  if (handler) target.addEventListener(name, handler, { once: true });
  if (discrete) {
    dispatchDiscreteCustomEvent(target, event);
  } else {
    target.dispatchEvent(event);
  }
}

// node_modules/@radix-ui/react-focus-scope/dist/index.mjs
var AUTOFOCUS_ON_MOUNT = "focusScope.autoFocusOnMount";
var AUTOFOCUS_ON_UNMOUNT = "focusScope.autoFocusOnUnmount";
var EVENT_OPTIONS2 = { bubbles: false, cancelable: true };
var FOCUS_SCOPE_NAME = "FocusScope";
var FocusScope = D3((props, forwardedRef) => {
  const {
    loop = false,
    trapped = false,
    onMountAutoFocus: onMountAutoFocusProp,
    onUnmountAutoFocus: onUnmountAutoFocusProp,
    ...scopeProps
  } = props;
  const [container, setContainer] = d2(null);
  const onMountAutoFocus = useCallbackRef(onMountAutoFocusProp);
  const onUnmountAutoFocus = useCallbackRef(onUnmountAutoFocusProp);
  const lastFocusedElementRef = A2(null);
  const composedRefs = useComposedRefs(forwardedRef, (node) => setContainer(node));
  const focusScope = A2({
    paused: false,
    pause() {
      this.paused = true;
    },
    resume() {
      this.paused = false;
    }
  }).current;
  y2(() => {
    if (trapped) {
      let handleFocusIn2 = function(event) {
        if (focusScope.paused || !container) return;
        const target = event.target;
        if (container.contains(target)) {
          lastFocusedElementRef.current = target;
        } else {
          focus(lastFocusedElementRef.current, { select: true });
        }
      }, handleFocusOut2 = function(event) {
        if (focusScope.paused || !container) return;
        const relatedTarget = event.relatedTarget;
        if (relatedTarget === null) return;
        if (!container.contains(relatedTarget)) {
          focus(lastFocusedElementRef.current, { select: true });
        }
      }, handleMutations2 = function(mutations) {
        const focusedElement = document.activeElement;
        if (focusedElement !== document.body) return;
        for (const mutation of mutations) {
          if (mutation.removedNodes.length > 0) focus(container);
        }
      };
      var handleFocusIn = handleFocusIn2, handleFocusOut = handleFocusOut2, handleMutations = handleMutations2;
      document.addEventListener("focusin", handleFocusIn2);
      document.addEventListener("focusout", handleFocusOut2);
      const mutationObserver = new MutationObserver(handleMutations2);
      if (container) mutationObserver.observe(container, { childList: true, subtree: true });
      return () => {
        document.removeEventListener("focusin", handleFocusIn2);
        document.removeEventListener("focusout", handleFocusOut2);
        mutationObserver.disconnect();
      };
    }
  }, [trapped, container, focusScope.paused]);
  y2(() => {
    if (container) {
      focusScopesStack.add(focusScope);
      const previouslyFocusedElement = document.activeElement;
      const hasFocusedCandidate = container.contains(previouslyFocusedElement);
      if (!hasFocusedCandidate) {
        const mountEvent = new CustomEvent(AUTOFOCUS_ON_MOUNT, EVENT_OPTIONS2);
        container.addEventListener(AUTOFOCUS_ON_MOUNT, onMountAutoFocus);
        container.dispatchEvent(mountEvent);
        if (!mountEvent.defaultPrevented) {
          focusFirst2(removeLinks(getTabbableCandidates(container)), { select: true });
          if (document.activeElement === previouslyFocusedElement) {
            focus(container);
          }
        }
      }
      return () => {
        container.removeEventListener(AUTOFOCUS_ON_MOUNT, onMountAutoFocus);
        setTimeout(() => {
          const unmountEvent = new CustomEvent(AUTOFOCUS_ON_UNMOUNT, EVENT_OPTIONS2);
          container.addEventListener(AUTOFOCUS_ON_UNMOUNT, onUnmountAutoFocus);
          container.dispatchEvent(unmountEvent);
          if (!unmountEvent.defaultPrevented) {
            focus(previouslyFocusedElement ?? document.body, { select: true });
          }
          container.removeEventListener(AUTOFOCUS_ON_UNMOUNT, onUnmountAutoFocus);
          focusScopesStack.remove(focusScope);
        }, 0);
      };
    }
  }, [container, onMountAutoFocus, onUnmountAutoFocus, focusScope]);
  const handleKeyDown = q2(
    (event) => {
      if (!loop && !trapped) return;
      if (focusScope.paused) return;
      const isTabKey = event.key === "Tab" && !event.altKey && !event.ctrlKey && !event.metaKey;
      const focusedElement = document.activeElement;
      if (isTabKey && focusedElement) {
        const container2 = event.currentTarget;
        const [first, last] = getTabbableEdges(container2);
        const hasTabbableElementsInside = first && last;
        if (!hasTabbableElementsInside) {
          if (focusedElement === container2) event.preventDefault();
        } else {
          if (!event.shiftKey && focusedElement === last) {
            event.preventDefault();
            if (loop) focus(first, { select: true });
          } else if (event.shiftKey && focusedElement === first) {
            event.preventDefault();
            if (loop) focus(last, { select: true });
          }
        }
      }
    },
    [loop, trapped, focusScope.paused]
  );
  return /* @__PURE__ */ u3(Primitive.div, { tabIndex: -1, ...scopeProps, ref: composedRefs, onKeyDown: handleKeyDown });
});
FocusScope.displayName = FOCUS_SCOPE_NAME;
function focusFirst2(candidates, { select = false } = {}) {
  const previouslyFocusedElement = document.activeElement;
  for (const candidate of candidates) {
    focus(candidate, { select });
    if (document.activeElement !== previouslyFocusedElement) return;
  }
}
function getTabbableEdges(container) {
  const candidates = getTabbableCandidates(container);
  const first = findVisible(candidates, container);
  const last = findVisible(candidates.reverse(), container);
  return [first, last];
}
function getTabbableCandidates(container) {
  const nodes = [];
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) => {
      const isHiddenInput = node.tagName === "INPUT" && node.type === "hidden";
      if (node.disabled || node.hidden || isHiddenInput) return NodeFilter.FILTER_SKIP;
      return node.tabIndex >= 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    }
  });
  while (walker.nextNode()) nodes.push(walker.currentNode);
  return nodes;
}
function findVisible(elements, container) {
  for (const element of elements) {
    if (!isHidden(element, { upTo: container })) return element;
  }
}
function isHidden(node, { upTo }) {
  if (getComputedStyle(node).visibility === "hidden") return true;
  while (node) {
    if (upTo !== void 0 && node === upTo) return false;
    if (getComputedStyle(node).display === "none") return true;
    node = node.parentElement;
  }
  return false;
}
function isSelectableInput(element) {
  return element instanceof HTMLInputElement && "select" in element;
}
function focus(element, { select = false } = {}) {
  if (element && element.focus) {
    const previouslyFocusedElement = document.activeElement;
    element.focus({ preventScroll: true });
    if (element !== previouslyFocusedElement && isSelectableInput(element) && select)
      element.select();
  }
}
var focusScopesStack = createFocusScopesStack();
function createFocusScopesStack() {
  let stack = [];
  return {
    add(focusScope) {
      const activeFocusScope = stack[0];
      if (focusScope !== activeFocusScope) {
        activeFocusScope?.pause();
      }
      stack = arrayRemove(stack, focusScope);
      stack.unshift(focusScope);
    },
    remove(focusScope) {
      stack = arrayRemove(stack, focusScope);
      stack[0]?.resume();
    }
  };
}
function arrayRemove(array, item) {
  const updatedArray = [...array];
  const index = updatedArray.indexOf(item);
  if (index !== -1) {
    updatedArray.splice(index, 1);
  }
  return updatedArray;
}
function removeLinks(items) {
  return items.filter((item) => item.tagName !== "A");
}

// node_modules/@radix-ui/react-portal/dist/index.mjs
var PORTAL_NAME = "Portal";
var Portal = D3((props, forwardedRef) => {
  const { container: containerProp, ...portalProps } = props;
  const [mounted, setMounted] = d2(false);
  useLayoutEffect2(() => setMounted(true), []);
  const container = containerProp || mounted && globalThis?.document?.body;
  return container ? Rn.createPortal(/* @__PURE__ */ u3(Primitive.div, { ...portalProps, ref: forwardedRef }), container) : null;
});
Portal.displayName = PORTAL_NAME;

// node_modules/@radix-ui/react-focus-guards/dist/index.mjs
var count2 = 0;
function useFocusGuards() {
  y2(() => {
    const edgeGuards = document.querySelectorAll("[data-radix-focus-guard]");
    document.body.insertAdjacentElement("afterbegin", edgeGuards[0] ?? createFocusGuard());
    document.body.insertAdjacentElement("beforeend", edgeGuards[1] ?? createFocusGuard());
    count2++;
    return () => {
      if (count2 === 1) {
        document.querySelectorAll("[data-radix-focus-guard]").forEach((node) => node.remove());
      }
      count2--;
    };
  }, []);
}
function createFocusGuard() {
  const element = document.createElement("span");
  element.setAttribute("data-radix-focus-guard", "");
  element.tabIndex = 0;
  element.style.outline = "none";
  element.style.opacity = "0";
  element.style.position = "fixed";
  element.style.pointerEvents = "none";
  return element;
}

// node_modules/tslib/tslib.es6.mjs
var __assign = function() {
  __assign = Object.assign || function __assign2(t3) {
    for (var s3, i4 = 1, n2 = arguments.length; i4 < n2; i4++) {
      s3 = arguments[i4];
      for (var p3 in s3) if (Object.prototype.hasOwnProperty.call(s3, p3)) t3[p3] = s3[p3];
    }
    return t3;
  };
  return __assign.apply(this, arguments);
};
function __rest(s3, e3) {
  var t3 = {};
  for (var p3 in s3) if (Object.prototype.hasOwnProperty.call(s3, p3) && e3.indexOf(p3) < 0)
    t3[p3] = s3[p3];
  if (s3 != null && typeof Object.getOwnPropertySymbols === "function")
    for (var i4 = 0, p3 = Object.getOwnPropertySymbols(s3); i4 < p3.length; i4++) {
      if (e3.indexOf(p3[i4]) < 0 && Object.prototype.propertyIsEnumerable.call(s3, p3[i4]))
        t3[p3[i4]] = s3[p3[i4]];
    }
  return t3;
}
function __spreadArray(to, from, pack) {
  if (pack || arguments.length === 2) for (var i4 = 0, l3 = from.length, ar; i4 < l3; i4++) {
    if (ar || !(i4 in from)) {
      if (!ar) ar = Array.prototype.slice.call(from, 0, i4);
      ar[i4] = from[i4];
    }
  }
  return to.concat(ar || Array.prototype.slice.call(from));
}

// node_modules/react-remove-scroll-bar/dist/es2015/constants.js
var zeroRightClassName = "right-scroll-bar-position";
var fullWidthClassName = "width-before-scroll-bar";
var noScrollbarsClassName = "with-scroll-bars-hidden";
var removedBarSizeVariable = "--removed-body-scroll-bar-size";

// node_modules/use-callback-ref/dist/es2015/assignRef.js
function assignRef(ref, value) {
  if (typeof ref === "function") {
    ref(value);
  } else if (ref) {
    ref.current = value;
  }
  return ref;
}

// node_modules/use-callback-ref/dist/es2015/useRef.js
function useCallbackRef2(initialValue, callback) {
  var ref = d2(function() {
    return {
      // value
      value: initialValue,
      // last callback
      callback,
      // "memoized" public interface
      facade: {
        get current() {
          return ref.value;
        },
        set current(value) {
          var last = ref.value;
          if (last !== value) {
            ref.value = value;
            ref.callback(value, last);
          }
        }
      }
    };
  })[0];
  ref.callback = callback;
  return ref.facade;
}

// node_modules/use-callback-ref/dist/es2015/useMergeRef.js
var useIsomorphicLayoutEffect = typeof window !== "undefined" ? _2 : y2;
var currentValues = /* @__PURE__ */ new WeakMap();
function useMergeRefs(refs, defaultValue) {
  var callbackRef = useCallbackRef2(defaultValue || null, function(newValue) {
    return refs.forEach(function(ref) {
      return assignRef(ref, newValue);
    });
  });
  useIsomorphicLayoutEffect(function() {
    var oldValue = currentValues.get(callbackRef);
    if (oldValue) {
      var prevRefs_1 = new Set(oldValue);
      var nextRefs_1 = new Set(refs);
      var current_1 = callbackRef.current;
      prevRefs_1.forEach(function(ref) {
        if (!nextRefs_1.has(ref)) {
          assignRef(ref, null);
        }
      });
      nextRefs_1.forEach(function(ref) {
        if (!prevRefs_1.has(ref)) {
          assignRef(ref, current_1);
        }
      });
    }
    currentValues.set(callbackRef, refs);
  }, [refs]);
  return callbackRef;
}

// node_modules/use-sidecar/dist/es2015/medium.js
function ItoI(a3) {
  return a3;
}
function innerCreateMedium(defaults, middleware) {
  if (middleware === void 0) {
    middleware = ItoI;
  }
  var buffer = [];
  var assigned = false;
  var medium = {
    read: function() {
      if (assigned) {
        throw new Error("Sidecar: could not `read` from an `assigned` medium. `read` could be used only with `useMedium`.");
      }
      if (buffer.length) {
        return buffer[buffer.length - 1];
      }
      return defaults;
    },
    useMedium: function(data) {
      var item = middleware(data, assigned);
      buffer.push(item);
      return function() {
        buffer = buffer.filter(function(x4) {
          return x4 !== item;
        });
      };
    },
    assignSyncMedium: function(cb) {
      assigned = true;
      while (buffer.length) {
        var cbs = buffer;
        buffer = [];
        cbs.forEach(cb);
      }
      buffer = {
        push: function(x4) {
          return cb(x4);
        },
        filter: function() {
          return buffer;
        }
      };
    },
    assignMedium: function(cb) {
      assigned = true;
      var pendingQueue = [];
      if (buffer.length) {
        var cbs = buffer;
        buffer = [];
        cbs.forEach(cb);
        pendingQueue = buffer;
      }
      var executeQueue = function() {
        var cbs2 = pendingQueue;
        pendingQueue = [];
        cbs2.forEach(cb);
      };
      var cycle = function() {
        return Promise.resolve().then(executeQueue);
      };
      cycle();
      buffer = {
        push: function(x4) {
          pendingQueue.push(x4);
          cycle();
        },
        filter: function(filter) {
          pendingQueue = pendingQueue.filter(filter);
          return buffer;
        }
      };
    }
  };
  return medium;
}
function createSidecarMedium(options) {
  if (options === void 0) {
    options = {};
  }
  var medium = innerCreateMedium(null);
  medium.options = __assign({ async: true, ssr: false }, options);
  return medium;
}

// node_modules/use-sidecar/dist/es2015/exports.js
var SideCar = function(_a) {
  var sideCar = _a.sideCar, rest = __rest(_a, ["sideCar"]);
  if (!sideCar) {
    throw new Error("Sidecar: please provide `sideCar` property to import the right car");
  }
  var Target = sideCar.read();
  if (!Target) {
    throw new Error("Sidecar medium not found");
  }
  return _(Target, __assign({}, rest));
};
SideCar.isSideCarExport = true;
function exportSidecar(medium, exported) {
  medium.useMedium(exported);
  return SideCar;
}

// node_modules/react-remove-scroll/dist/es2015/medium.js
var effectCar = createSidecarMedium();

// node_modules/react-remove-scroll/dist/es2015/UI.js
var nothing = function() {
  return;
};
var RemoveScroll = D3(function(props, parentRef) {
  var ref = A2(null);
  var _a = d2({
    onScrollCapture: nothing,
    onWheelCapture: nothing,
    onTouchMoveCapture: nothing
  }), callbacks = _a[0], setCallbacks = _a[1];
  var forwardProps = props.forwardProps, children = props.children, className = props.className, removeScrollBar = props.removeScrollBar, enabled = props.enabled, shards = props.shards, sideCar = props.sideCar, noRelative = props.noRelative, noIsolation = props.noIsolation, inert = props.inert, allowPinchZoom = props.allowPinchZoom, _b = props.as, Container = _b === void 0 ? "div" : _b, gapMode = props.gapMode, rest = __rest(props, ["forwardProps", "children", "className", "removeScrollBar", "enabled", "shards", "sideCar", "noRelative", "noIsolation", "inert", "allowPinchZoom", "as", "gapMode"]);
  var SideCar2 = sideCar;
  var containerRef = useMergeRefs([ref, parentRef]);
  var containerProps = __assign(__assign({}, rest), callbacks);
  return _(
    k,
    null,
    enabled && _(SideCar2, { sideCar: effectCar, removeScrollBar, shards, noRelative, noIsolation, inert, setCallbacks, allowPinchZoom: !!allowPinchZoom, lockRef: ref, gapMode }),
    forwardProps ? _n(O2.only(children), __assign(__assign({}, containerProps), { ref: containerRef })) : _(Container, __assign({}, containerProps, { className, ref: containerRef }), children)
  );
});
RemoveScroll.defaultProps = {
  enabled: true,
  removeScrollBar: true,
  inert: false
};
RemoveScroll.classNames = {
  fullWidth: fullWidthClassName,
  zeroRight: zeroRightClassName
};

// node_modules/get-nonce/dist/es2015/index.js
var currentNonce;
var getNonce = function() {
  if (currentNonce) {
    return currentNonce;
  }
  if (typeof __webpack_nonce__ !== "undefined") {
    return __webpack_nonce__;
  }
  return void 0;
};

// node_modules/react-style-singleton/dist/es2015/singleton.js
function makeStyleTag() {
  if (!document)
    return null;
  var tag = document.createElement("style");
  tag.type = "text/css";
  var nonce = getNonce();
  if (nonce) {
    tag.setAttribute("nonce", nonce);
  }
  return tag;
}
function injectStyles(tag, css) {
  if (tag.styleSheet) {
    tag.styleSheet.cssText = css;
  } else {
    tag.appendChild(document.createTextNode(css));
  }
}
function insertStyleTag(tag) {
  var head = document.head || document.getElementsByTagName("head")[0];
  head.appendChild(tag);
}
var stylesheetSingleton = function() {
  var counter = 0;
  var stylesheet = null;
  return {
    add: function(style) {
      if (counter == 0) {
        if (stylesheet = makeStyleTag()) {
          injectStyles(stylesheet, style);
          insertStyleTag(stylesheet);
        }
      }
      counter++;
    },
    remove: function() {
      counter--;
      if (!counter && stylesheet) {
        stylesheet.parentNode && stylesheet.parentNode.removeChild(stylesheet);
        stylesheet = null;
      }
    }
  };
};

// node_modules/react-style-singleton/dist/es2015/hook.js
var styleHookSingleton = function() {
  var sheet = stylesheetSingleton();
  return function(styles2, isDynamic) {
    y2(function() {
      sheet.add(styles2);
      return function() {
        sheet.remove();
      };
    }, [styles2 && isDynamic]);
  };
};

// node_modules/react-style-singleton/dist/es2015/component.js
var styleSingleton = function() {
  var useStyle = styleHookSingleton();
  var Sheet = function(_a) {
    var styles2 = _a.styles, dynamic = _a.dynamic;
    useStyle(styles2, dynamic);
    return null;
  };
  return Sheet;
};

// node_modules/react-remove-scroll-bar/dist/es2015/utils.js
var zeroGap = {
  left: 0,
  top: 0,
  right: 0,
  gap: 0
};
var parse = function(x4) {
  return parseInt(x4 || "", 10) || 0;
};
var getOffset = function(gapMode) {
  var cs = window.getComputedStyle(document.body);
  var left = cs[gapMode === "padding" ? "paddingLeft" : "marginLeft"];
  var top = cs[gapMode === "padding" ? "paddingTop" : "marginTop"];
  var right = cs[gapMode === "padding" ? "paddingRight" : "marginRight"];
  return [parse(left), parse(top), parse(right)];
};
var getGapWidth = function(gapMode) {
  if (gapMode === void 0) {
    gapMode = "margin";
  }
  if (typeof window === "undefined") {
    return zeroGap;
  }
  var offsets = getOffset(gapMode);
  var documentWidth = document.documentElement.clientWidth;
  var windowWidth = window.innerWidth;
  return {
    left: offsets[0],
    top: offsets[1],
    right: offsets[2],
    gap: Math.max(0, windowWidth - documentWidth + offsets[2] - offsets[0])
  };
};

// node_modules/react-remove-scroll-bar/dist/es2015/component.js
var Style = styleSingleton();
var lockAttribute = "data-scroll-locked";
var getStyles = function(_a, allowRelative, gapMode, important) {
  var left = _a.left, top = _a.top, right = _a.right, gap = _a.gap;
  if (gapMode === void 0) {
    gapMode = "margin";
  }
  return "\n  .".concat(noScrollbarsClassName, " {\n   overflow: hidden ").concat(important, ";\n   padding-right: ").concat(gap, "px ").concat(important, ";\n  }\n  body[").concat(lockAttribute, "] {\n    overflow: hidden ").concat(important, ";\n    overscroll-behavior: contain;\n    ").concat([
    allowRelative && "position: relative ".concat(important, ";"),
    gapMode === "margin" && "\n    padding-left: ".concat(left, "px;\n    padding-top: ").concat(top, "px;\n    padding-right: ").concat(right, "px;\n    margin-left:0;\n    margin-top:0;\n    margin-right: ").concat(gap, "px ").concat(important, ";\n    "),
    gapMode === "padding" && "padding-right: ".concat(gap, "px ").concat(important, ";")
  ].filter(Boolean).join(""), "\n  }\n  \n  .").concat(zeroRightClassName, " {\n    right: ").concat(gap, "px ").concat(important, ";\n  }\n  \n  .").concat(fullWidthClassName, " {\n    margin-right: ").concat(gap, "px ").concat(important, ";\n  }\n  \n  .").concat(zeroRightClassName, " .").concat(zeroRightClassName, " {\n    right: 0 ").concat(important, ";\n  }\n  \n  .").concat(fullWidthClassName, " .").concat(fullWidthClassName, " {\n    margin-right: 0 ").concat(important, ";\n  }\n  \n  body[").concat(lockAttribute, "] {\n    ").concat(removedBarSizeVariable, ": ").concat(gap, "px;\n  }\n");
};
var getCurrentUseCounter = function() {
  var counter = parseInt(document.body.getAttribute(lockAttribute) || "0", 10);
  return isFinite(counter) ? counter : 0;
};
var useLockAttribute = function() {
  y2(function() {
    document.body.setAttribute(lockAttribute, (getCurrentUseCounter() + 1).toString());
    return function() {
      var newCounter = getCurrentUseCounter() - 1;
      if (newCounter <= 0) {
        document.body.removeAttribute(lockAttribute);
      } else {
        document.body.setAttribute(lockAttribute, newCounter.toString());
      }
    };
  }, []);
};
var RemoveScrollBar = function(_a) {
  var noRelative = _a.noRelative, noImportant = _a.noImportant, _b = _a.gapMode, gapMode = _b === void 0 ? "margin" : _b;
  useLockAttribute();
  var gap = T2(function() {
    return getGapWidth(gapMode);
  }, [gapMode]);
  return _(Style, { styles: getStyles(gap, !noRelative, gapMode, !noImportant ? "!important" : "") });
};

// node_modules/react-remove-scroll/dist/es2015/aggresiveCapture.js
var passiveSupported = false;
if (typeof window !== "undefined") {
  try {
    options = Object.defineProperty({}, "passive", {
      get: function() {
        passiveSupported = true;
        return true;
      }
    });
    window.addEventListener("test", options, options);
    window.removeEventListener("test", options, options);
  } catch (err) {
    passiveSupported = false;
  }
}
var options;
var nonPassive = passiveSupported ? { passive: false } : false;

// node_modules/react-remove-scroll/dist/es2015/handleScroll.js
var alwaysContainsScroll = function(node) {
  return node.tagName === "TEXTAREA";
};
var elementCanBeScrolled = function(node, overflow) {
  if (!(node instanceof Element)) {
    return false;
  }
  var styles2 = window.getComputedStyle(node);
  return (
    // not-not-scrollable
    styles2[overflow] !== "hidden" && // contains scroll inside self
    !(styles2.overflowY === styles2.overflowX && !alwaysContainsScroll(node) && styles2[overflow] === "visible")
  );
};
var elementCouldBeVScrolled = function(node) {
  return elementCanBeScrolled(node, "overflowY");
};
var elementCouldBeHScrolled = function(node) {
  return elementCanBeScrolled(node, "overflowX");
};
var locationCouldBeScrolled = function(axis, node) {
  var ownerDocument = node.ownerDocument;
  var current = node;
  do {
    if (typeof ShadowRoot !== "undefined" && current instanceof ShadowRoot) {
      current = current.host;
    }
    var isScrollable = elementCouldBeScrolled(axis, current);
    if (isScrollable) {
      var _a = getScrollVariables(axis, current), scrollHeight = _a[1], clientHeight = _a[2];
      if (scrollHeight > clientHeight) {
        return true;
      }
    }
    current = current.parentNode;
  } while (current && current !== ownerDocument.body);
  return false;
};
var getVScrollVariables = function(_a) {
  var scrollTop = _a.scrollTop, scrollHeight = _a.scrollHeight, clientHeight = _a.clientHeight;
  return [
    scrollTop,
    scrollHeight,
    clientHeight
  ];
};
var getHScrollVariables = function(_a) {
  var scrollLeft = _a.scrollLeft, scrollWidth = _a.scrollWidth, clientWidth = _a.clientWidth;
  return [
    scrollLeft,
    scrollWidth,
    clientWidth
  ];
};
var elementCouldBeScrolled = function(axis, node) {
  return axis === "v" ? elementCouldBeVScrolled(node) : elementCouldBeHScrolled(node);
};
var getScrollVariables = function(axis, node) {
  return axis === "v" ? getVScrollVariables(node) : getHScrollVariables(node);
};
var getDirectionFactor = function(axis, direction) {
  return axis === "h" && direction === "rtl" ? -1 : 1;
};
var handleScroll = function(axis, endTarget, event, sourceDelta, noOverscroll) {
  var directionFactor = getDirectionFactor(axis, window.getComputedStyle(endTarget).direction);
  var delta = directionFactor * sourceDelta;
  var target = event.target;
  var targetInLock = endTarget.contains(target);
  var shouldCancelScroll = false;
  var isDeltaPositive = delta > 0;
  var availableScroll = 0;
  var availableScrollTop = 0;
  do {
    if (!target) {
      break;
    }
    var _a = getScrollVariables(axis, target), position = _a[0], scroll_1 = _a[1], capacity = _a[2];
    var elementScroll = scroll_1 - capacity - directionFactor * position;
    if (position || elementScroll) {
      if (elementCouldBeScrolled(axis, target)) {
        availableScroll += elementScroll;
        availableScrollTop += position;
      }
    }
    var parent_1 = target.parentNode;
    target = parent_1 && parent_1.nodeType === Node.DOCUMENT_FRAGMENT_NODE ? parent_1.host : parent_1;
  } while (
    // portaled content
    !targetInLock && target !== document.body || // self content
    targetInLock && (endTarget.contains(target) || endTarget === target)
  );
  if (isDeltaPositive && (noOverscroll && Math.abs(availableScroll) < 1 || !noOverscroll && delta > availableScroll)) {
    shouldCancelScroll = true;
  } else if (!isDeltaPositive && (noOverscroll && Math.abs(availableScrollTop) < 1 || !noOverscroll && -delta > availableScrollTop)) {
    shouldCancelScroll = true;
  }
  return shouldCancelScroll;
};

// node_modules/react-remove-scroll/dist/es2015/SideEffect.js
var getTouchXY = function(event) {
  return "changedTouches" in event ? [event.changedTouches[0].clientX, event.changedTouches[0].clientY] : [0, 0];
};
var getDeltaXY = function(event) {
  return [event.deltaX, event.deltaY];
};
var extractRef = function(ref) {
  return ref && "current" in ref ? ref.current : ref;
};
var deltaCompare = function(x4, y3) {
  return x4[0] === y3[0] && x4[1] === y3[1];
};
var generateStyle = function(id) {
  return "\n  .block-interactivity-".concat(id, " {pointer-events: none;}\n  .allow-interactivity-").concat(id, " {pointer-events: all;}\n");
};
var idCounter = 0;
var lockStack = [];
function RemoveScrollSideCar(props) {
  var shouldPreventQueue = A2([]);
  var touchStartRef = A2([0, 0]);
  var activeAxis = A2();
  var id = d2(idCounter++)[0];
  var Style2 = d2(styleSingleton)[0];
  var lastProps = A2(props);
  y2(function() {
    lastProps.current = props;
  }, [props]);
  y2(function() {
    if (props.inert) {
      document.body.classList.add("block-interactivity-".concat(id));
      var allow_1 = __spreadArray([props.lockRef.current], (props.shards || []).map(extractRef), true).filter(Boolean);
      allow_1.forEach(function(el) {
        return el.classList.add("allow-interactivity-".concat(id));
      });
      return function() {
        document.body.classList.remove("block-interactivity-".concat(id));
        allow_1.forEach(function(el) {
          return el.classList.remove("allow-interactivity-".concat(id));
        });
      };
    }
    return;
  }, [props.inert, props.lockRef.current, props.shards]);
  var shouldCancelEvent = q2(function(event, parent) {
    if ("touches" in event && event.touches.length === 2 || event.type === "wheel" && event.ctrlKey) {
      return !lastProps.current.allowPinchZoom;
    }
    var touch = getTouchXY(event);
    var touchStart = touchStartRef.current;
    var deltaX = "deltaX" in event ? event.deltaX : touchStart[0] - touch[0];
    var deltaY = "deltaY" in event ? event.deltaY : touchStart[1] - touch[1];
    var currentAxis;
    var target = event.target;
    var moveDirection = Math.abs(deltaX) > Math.abs(deltaY) ? "h" : "v";
    if ("touches" in event && moveDirection === "h" && target.type === "range") {
      return false;
    }
    var selection = window.getSelection();
    var anchorNode = selection && selection.anchorNode;
    var isTouchingSelection = anchorNode ? anchorNode === target || anchorNode.contains(target) : false;
    if (isTouchingSelection) {
      return false;
    }
    var canBeScrolledInMainDirection = locationCouldBeScrolled(moveDirection, target);
    if (!canBeScrolledInMainDirection) {
      return true;
    }
    if (canBeScrolledInMainDirection) {
      currentAxis = moveDirection;
    } else {
      currentAxis = moveDirection === "v" ? "h" : "v";
      canBeScrolledInMainDirection = locationCouldBeScrolled(moveDirection, target);
    }
    if (!canBeScrolledInMainDirection) {
      return false;
    }
    if (!activeAxis.current && "changedTouches" in event && (deltaX || deltaY)) {
      activeAxis.current = currentAxis;
    }
    if (!currentAxis) {
      return true;
    }
    var cancelingAxis = activeAxis.current || currentAxis;
    return handleScroll(cancelingAxis, parent, event, cancelingAxis === "h" ? deltaX : deltaY, true);
  }, []);
  var shouldPrevent = q2(function(_event) {
    var event = _event;
    if (!lockStack.length || lockStack[lockStack.length - 1] !== Style2) {
      return;
    }
    var delta = "deltaY" in event ? getDeltaXY(event) : getTouchXY(event);
    var sourceEvent = shouldPreventQueue.current.filter(function(e3) {
      return e3.name === event.type && (e3.target === event.target || event.target === e3.shadowParent) && deltaCompare(e3.delta, delta);
    })[0];
    if (sourceEvent && sourceEvent.should) {
      if (event.cancelable) {
        event.preventDefault();
      }
      return;
    }
    if (!sourceEvent) {
      var shardNodes = (lastProps.current.shards || []).map(extractRef).filter(Boolean).filter(function(node) {
        return node.contains(event.target);
      });
      var shouldStop = shardNodes.length > 0 ? shouldCancelEvent(event, shardNodes[0]) : !lastProps.current.noIsolation;
      if (shouldStop) {
        if (event.cancelable) {
          event.preventDefault();
        }
      }
    }
  }, []);
  var shouldCancel = q2(function(name, delta, target, should) {
    var event = { name, delta, target, should, shadowParent: getOutermostShadowParent(target) };
    shouldPreventQueue.current.push(event);
    setTimeout(function() {
      shouldPreventQueue.current = shouldPreventQueue.current.filter(function(e3) {
        return e3 !== event;
      });
    }, 1);
  }, []);
  var scrollTouchStart = q2(function(event) {
    touchStartRef.current = getTouchXY(event);
    activeAxis.current = void 0;
  }, []);
  var scrollWheel = q2(function(event) {
    shouldCancel(event.type, getDeltaXY(event), event.target, shouldCancelEvent(event, props.lockRef.current));
  }, []);
  var scrollTouchMove = q2(function(event) {
    shouldCancel(event.type, getTouchXY(event), event.target, shouldCancelEvent(event, props.lockRef.current));
  }, []);
  y2(function() {
    lockStack.push(Style2);
    props.setCallbacks({
      onScrollCapture: scrollWheel,
      onWheelCapture: scrollWheel,
      onTouchMoveCapture: scrollTouchMove
    });
    document.addEventListener("wheel", shouldPrevent, nonPassive);
    document.addEventListener("touchmove", shouldPrevent, nonPassive);
    document.addEventListener("touchstart", scrollTouchStart, nonPassive);
    return function() {
      lockStack = lockStack.filter(function(inst) {
        return inst !== Style2;
      });
      document.removeEventListener("wheel", shouldPrevent, nonPassive);
      document.removeEventListener("touchmove", shouldPrevent, nonPassive);
      document.removeEventListener("touchstart", scrollTouchStart, nonPassive);
    };
  }, []);
  var removeScrollBar = props.removeScrollBar, inert = props.inert;
  return _(
    k,
    null,
    inert ? _(Style2, { styles: generateStyle(id) }) : null,
    removeScrollBar ? _(RemoveScrollBar, { noRelative: props.noRelative, gapMode: props.gapMode }) : null
  );
}
function getOutermostShadowParent(node) {
  var shadowParent = null;
  while (node !== null) {
    if (node instanceof ShadowRoot) {
      shadowParent = node.host;
      node = node.host;
    }
    node = node.parentNode;
  }
  return shadowParent;
}

// node_modules/react-remove-scroll/dist/es2015/sidecar.js
var sidecar_default = exportSidecar(effectCar, RemoveScrollSideCar);

// node_modules/react-remove-scroll/dist/es2015/Combination.js
var ReactRemoveScroll = D3(function(props, ref) {
  return _(RemoveScroll, __assign({}, props, { ref, sideCar: sidecar_default }));
});
ReactRemoveScroll.classNames = RemoveScroll.classNames;
var Combination_default = ReactRemoveScroll;

// node_modules/aria-hidden/dist/es2015/index.js
var getDefaultParent = function(originalTarget) {
  if (typeof document === "undefined") {
    return null;
  }
  var sampleTarget = Array.isArray(originalTarget) ? originalTarget[0] : originalTarget;
  return sampleTarget.ownerDocument.body;
};
var counterMap = /* @__PURE__ */ new WeakMap();
var uncontrolledNodes = /* @__PURE__ */ new WeakMap();
var markerMap = {};
var lockCount = 0;
var unwrapHost = function(node) {
  return node && (node.host || unwrapHost(node.parentNode));
};
var correctTargets = function(parent, targets) {
  return targets.map(function(target) {
    if (parent.contains(target)) {
      return target;
    }
    var correctedTarget = unwrapHost(target);
    if (correctedTarget && parent.contains(correctedTarget)) {
      return correctedTarget;
    }
    console.error("aria-hidden", target, "in not contained inside", parent, ". Doing nothing");
    return null;
  }).filter(function(x4) {
    return Boolean(x4);
  });
};
var applyAttributeToOthers = function(originalTarget, parentNode, markerName, controlAttribute) {
  var targets = correctTargets(parentNode, Array.isArray(originalTarget) ? originalTarget : [originalTarget]);
  if (!markerMap[markerName]) {
    markerMap[markerName] = /* @__PURE__ */ new WeakMap();
  }
  var markerCounter = markerMap[markerName];
  var hiddenNodes = [];
  var elementsToKeep = /* @__PURE__ */ new Set();
  var elementsToStop = new Set(targets);
  var keep = function(el) {
    if (!el || elementsToKeep.has(el)) {
      return;
    }
    elementsToKeep.add(el);
    keep(el.parentNode);
  };
  targets.forEach(keep);
  var deep = function(parent) {
    if (!parent || elementsToStop.has(parent)) {
      return;
    }
    Array.prototype.forEach.call(parent.children, function(node) {
      if (elementsToKeep.has(node)) {
        deep(node);
      } else {
        try {
          var attr = node.getAttribute(controlAttribute);
          var alreadyHidden = attr !== null && attr !== "false";
          var counterValue = (counterMap.get(node) || 0) + 1;
          var markerValue = (markerCounter.get(node) || 0) + 1;
          counterMap.set(node, counterValue);
          markerCounter.set(node, markerValue);
          hiddenNodes.push(node);
          if (counterValue === 1 && alreadyHidden) {
            uncontrolledNodes.set(node, true);
          }
          if (markerValue === 1) {
            node.setAttribute(markerName, "true");
          }
          if (!alreadyHidden) {
            node.setAttribute(controlAttribute, "true");
          }
        } catch (e3) {
          console.error("aria-hidden: cannot operate on ", node, e3);
        }
      }
    });
  };
  deep(parentNode);
  elementsToKeep.clear();
  lockCount++;
  return function() {
    hiddenNodes.forEach(function(node) {
      var counterValue = counterMap.get(node) - 1;
      var markerValue = markerCounter.get(node) - 1;
      counterMap.set(node, counterValue);
      markerCounter.set(node, markerValue);
      if (!counterValue) {
        if (!uncontrolledNodes.has(node)) {
          node.removeAttribute(controlAttribute);
        }
        uncontrolledNodes.delete(node);
      }
      if (!markerValue) {
        node.removeAttribute(markerName);
      }
    });
    lockCount--;
    if (!lockCount) {
      counterMap = /* @__PURE__ */ new WeakMap();
      counterMap = /* @__PURE__ */ new WeakMap();
      uncontrolledNodes = /* @__PURE__ */ new WeakMap();
      markerMap = {};
    }
  };
};
var hideOthers = function(originalTarget, parentNode, markerName) {
  if (markerName === void 0) {
    markerName = "data-aria-hidden";
  }
  var targets = Array.from(Array.isArray(originalTarget) ? originalTarget : [originalTarget]);
  var activeParentNode = parentNode || getDefaultParent(originalTarget);
  if (!activeParentNode) {
    return function() {
      return null;
    };
  }
  targets.push.apply(targets, Array.from(activeParentNode.querySelectorAll("[aria-live], script")));
  return applyAttributeToOthers(targets, activeParentNode, markerName, "aria-hidden");
};

// node_modules/@radix-ui/react-dialog/dist/index.mjs
var DIALOG_NAME = "Dialog";
var [createDialogContext, createDialogScope] = createContextScope(DIALOG_NAME);
var [DialogProvider, useDialogContext] = createDialogContext(DIALOG_NAME);
var Dialog = (props) => {
  const {
    __scopeDialog,
    children,
    open: openProp,
    defaultOpen,
    onOpenChange,
    modal = true
  } = props;
  const triggerRef = A2(null);
  const contentRef = A2(null);
  const [open, setOpen] = useControllableState({
    prop: openProp,
    defaultProp: defaultOpen ?? false,
    onChange: onOpenChange,
    caller: DIALOG_NAME
  });
  return /* @__PURE__ */ u3(
    DialogProvider,
    {
      scope: __scopeDialog,
      triggerRef,
      contentRef,
      contentId: useId(),
      titleId: useId(),
      descriptionId: useId(),
      open,
      onOpenChange: setOpen,
      onOpenToggle: q2(() => setOpen((prevOpen) => !prevOpen), [setOpen]),
      modal,
      children
    }
  );
};
Dialog.displayName = DIALOG_NAME;
var TRIGGER_NAME2 = "DialogTrigger";
var DialogTrigger = D3(
  (props, forwardedRef) => {
    const { __scopeDialog, ...triggerProps } = props;
    const context = useDialogContext(TRIGGER_NAME2, __scopeDialog);
    const composedTriggerRef = useComposedRefs(forwardedRef, context.triggerRef);
    return /* @__PURE__ */ u3(
      Primitive.button,
      {
        type: "button",
        "aria-haspopup": "dialog",
        "aria-expanded": context.open,
        "aria-controls": context.contentId,
        "data-state": getState(context.open),
        ...triggerProps,
        ref: composedTriggerRef,
        onClick: composeEventHandlers(props.onClick, context.onOpenToggle)
      }
    );
  }
);
DialogTrigger.displayName = TRIGGER_NAME2;
var PORTAL_NAME2 = "DialogPortal";
var [PortalProvider, usePortalContext] = createDialogContext(PORTAL_NAME2, {
  forceMount: void 0
});
var DialogPortal = (props) => {
  const { __scopeDialog, forceMount, children, container } = props;
  const context = useDialogContext(PORTAL_NAME2, __scopeDialog);
  return /* @__PURE__ */ u3(PortalProvider, { scope: __scopeDialog, forceMount, children: O2.map(children, (child) => /* @__PURE__ */ u3(Presence, { present: forceMount || context.open, children: /* @__PURE__ */ u3(Portal, { asChild: true, container, children: child }) })) });
};
DialogPortal.displayName = PORTAL_NAME2;
var OVERLAY_NAME = "DialogOverlay";
var DialogOverlay = D3(
  (props, forwardedRef) => {
    const portalContext = usePortalContext(OVERLAY_NAME, props.__scopeDialog);
    const { forceMount = portalContext.forceMount, ...overlayProps } = props;
    const context = useDialogContext(OVERLAY_NAME, props.__scopeDialog);
    return context.modal ? /* @__PURE__ */ u3(Presence, { present: forceMount || context.open, children: /* @__PURE__ */ u3(DialogOverlayImpl, { ...overlayProps, ref: forwardedRef }) }) : null;
  }
);
DialogOverlay.displayName = OVERLAY_NAME;
var Slot = createSlot("DialogOverlay.RemoveScroll");
var DialogOverlayImpl = D3(
  (props, forwardedRef) => {
    const { __scopeDialog, ...overlayProps } = props;
    const context = useDialogContext(OVERLAY_NAME, __scopeDialog);
    return (
      // Make sure `Content` is scrollable even when it doesn't live inside `RemoveScroll`
      // ie. when `Overlay` and `Content` are siblings
      /* @__PURE__ */ u3(Combination_default, { as: Slot, allowPinchZoom: true, shards: [context.contentRef], children: /* @__PURE__ */ u3(
        Primitive.div,
        {
          "data-state": getState(context.open),
          ...overlayProps,
          ref: forwardedRef,
          style: { pointerEvents: "auto", ...overlayProps.style }
        }
      ) })
    );
  }
);
var CONTENT_NAME2 = "DialogContent";
var DialogContent = D3(
  (props, forwardedRef) => {
    const portalContext = usePortalContext(CONTENT_NAME2, props.__scopeDialog);
    const { forceMount = portalContext.forceMount, ...contentProps } = props;
    const context = useDialogContext(CONTENT_NAME2, props.__scopeDialog);
    return /* @__PURE__ */ u3(Presence, { present: forceMount || context.open, children: context.modal ? /* @__PURE__ */ u3(DialogContentModal, { ...contentProps, ref: forwardedRef }) : /* @__PURE__ */ u3(DialogContentNonModal, { ...contentProps, ref: forwardedRef }) });
  }
);
DialogContent.displayName = CONTENT_NAME2;
var DialogContentModal = D3(
  (props, forwardedRef) => {
    const context = useDialogContext(CONTENT_NAME2, props.__scopeDialog);
    const contentRef = A2(null);
    const composedRefs = useComposedRefs(forwardedRef, context.contentRef, contentRef);
    y2(() => {
      const content = contentRef.current;
      if (content) return hideOthers(content);
    }, []);
    return /* @__PURE__ */ u3(
      DialogContentImpl,
      {
        ...props,
        ref: composedRefs,
        trapFocus: context.open,
        disableOutsidePointerEvents: true,
        onCloseAutoFocus: composeEventHandlers(props.onCloseAutoFocus, (event) => {
          event.preventDefault();
          context.triggerRef.current?.focus();
        }),
        onPointerDownOutside: composeEventHandlers(props.onPointerDownOutside, (event) => {
          const originalEvent = event.detail.originalEvent;
          const ctrlLeftClick = originalEvent.button === 0 && originalEvent.ctrlKey === true;
          const isRightClick = originalEvent.button === 2 || ctrlLeftClick;
          if (isRightClick) event.preventDefault();
        }),
        onFocusOutside: composeEventHandlers(
          props.onFocusOutside,
          (event) => event.preventDefault()
        )
      }
    );
  }
);
var DialogContentNonModal = D3(
  (props, forwardedRef) => {
    const context = useDialogContext(CONTENT_NAME2, props.__scopeDialog);
    const hasInteractedOutsideRef = A2(false);
    const hasPointerDownOutsideRef = A2(false);
    return /* @__PURE__ */ u3(
      DialogContentImpl,
      {
        ...props,
        ref: forwardedRef,
        trapFocus: false,
        disableOutsidePointerEvents: false,
        onCloseAutoFocus: (event) => {
          props.onCloseAutoFocus?.(event);
          if (!event.defaultPrevented) {
            if (!hasInteractedOutsideRef.current) context.triggerRef.current?.focus();
            event.preventDefault();
          }
          hasInteractedOutsideRef.current = false;
          hasPointerDownOutsideRef.current = false;
        },
        onInteractOutside: (event) => {
          props.onInteractOutside?.(event);
          if (!event.defaultPrevented) {
            hasInteractedOutsideRef.current = true;
            if (event.detail.originalEvent.type === "pointerdown") {
              hasPointerDownOutsideRef.current = true;
            }
          }
          const target = event.target;
          const targetIsTrigger = context.triggerRef.current?.contains(target);
          if (targetIsTrigger) event.preventDefault();
          if (event.detail.originalEvent.type === "focusin" && hasPointerDownOutsideRef.current) {
            event.preventDefault();
          }
        }
      }
    );
  }
);
var DialogContentImpl = D3(
  (props, forwardedRef) => {
    const { __scopeDialog, trapFocus, onOpenAutoFocus, onCloseAutoFocus, ...contentProps } = props;
    const context = useDialogContext(CONTENT_NAME2, __scopeDialog);
    const contentRef = A2(null);
    const composedRefs = useComposedRefs(forwardedRef, contentRef);
    useFocusGuards();
    return /* @__PURE__ */ u3(k, { children: [
      /* @__PURE__ */ u3(
        FocusScope,
        {
          asChild: true,
          loop: true,
          trapped: trapFocus,
          onMountAutoFocus: onOpenAutoFocus,
          onUnmountAutoFocus: onCloseAutoFocus,
          children: /* @__PURE__ */ u3(
            DismissableLayer,
            {
              role: "dialog",
              id: context.contentId,
              "aria-describedby": context.descriptionId,
              "aria-labelledby": context.titleId,
              "data-state": getState(context.open),
              ...contentProps,
              ref: composedRefs,
              onDismiss: () => context.onOpenChange(false)
            }
          )
        }
      ),
      /* @__PURE__ */ u3(k, { children: [
        /* @__PURE__ */ u3(TitleWarning, { titleId: context.titleId }),
        /* @__PURE__ */ u3(DescriptionWarning, { contentRef, descriptionId: context.descriptionId })
      ] })
    ] });
  }
);
var TITLE_NAME = "DialogTitle";
var DialogTitle = D3(
  (props, forwardedRef) => {
    const { __scopeDialog, ...titleProps } = props;
    const context = useDialogContext(TITLE_NAME, __scopeDialog);
    return /* @__PURE__ */ u3(Primitive.h2, { id: context.titleId, ...titleProps, ref: forwardedRef });
  }
);
DialogTitle.displayName = TITLE_NAME;
var DESCRIPTION_NAME = "DialogDescription";
var DialogDescription = D3(
  (props, forwardedRef) => {
    const { __scopeDialog, ...descriptionProps } = props;
    const context = useDialogContext(DESCRIPTION_NAME, __scopeDialog);
    return /* @__PURE__ */ u3(Primitive.p, { id: context.descriptionId, ...descriptionProps, ref: forwardedRef });
  }
);
DialogDescription.displayName = DESCRIPTION_NAME;
var CLOSE_NAME = "DialogClose";
var DialogClose = D3(
  (props, forwardedRef) => {
    const { __scopeDialog, ...closeProps } = props;
    const context = useDialogContext(CLOSE_NAME, __scopeDialog);
    return /* @__PURE__ */ u3(
      Primitive.button,
      {
        type: "button",
        ...closeProps,
        ref: forwardedRef,
        onClick: composeEventHandlers(props.onClick, () => context.onOpenChange(false))
      }
    );
  }
);
DialogClose.displayName = CLOSE_NAME;
function getState(open) {
  return open ? "open" : "closed";
}
var TITLE_WARNING_NAME = "DialogTitleWarning";
var [WarningProvider, useWarningContext] = createContext2(TITLE_WARNING_NAME, {
  contentName: CONTENT_NAME2,
  titleName: TITLE_NAME,
  docsSlug: "dialog"
});
var TitleWarning = ({ titleId }) => {
  const titleWarningContext = useWarningContext(TITLE_WARNING_NAME);
  const MESSAGE = `\`${titleWarningContext.contentName}\` requires a \`${titleWarningContext.titleName}\` for the component to be accessible for screen reader users.

If you want to hide the \`${titleWarningContext.titleName}\`, you can wrap it with our VisuallyHidden component.

For more information, see https://radix-ui.com/primitives/docs/components/${titleWarningContext.docsSlug}`;
  y2(() => {
    if (titleId) {
      const hasTitle = document.getElementById(titleId);
      if (!hasTitle) console.error(MESSAGE);
    }
  }, [MESSAGE, titleId]);
  return null;
};
var DESCRIPTION_WARNING_NAME = "DialogDescriptionWarning";
var DescriptionWarning = ({ contentRef, descriptionId }) => {
  const descriptionWarningContext = useWarningContext(DESCRIPTION_WARNING_NAME);
  const MESSAGE = `Warning: Missing \`Description\` or \`aria-describedby={undefined}\` for {${descriptionWarningContext.contentName}}.`;
  y2(() => {
    const describedById = contentRef.current?.getAttribute("aria-describedby");
    if (descriptionId && describedById) {
      const hasDescription = document.getElementById(descriptionId);
      if (!hasDescription) console.warn(MESSAGE);
    }
  }, [MESSAGE, contentRef, descriptionId]);
  return null;
};
var Root3 = Dialog;
var Trigger2 = DialogTrigger;
var Portal2 = DialogPortal;
var Overlay = DialogOverlay;
var Content2 = DialogContent;
var Title = DialogTitle;
var Description = DialogDescription;

// node_modules/@radix-ui/react-use-previous/dist/index.mjs
function usePrevious(value) {
  const ref = A2({ value, previous: value });
  return T2(() => {
    if (ref.current.value !== value) {
      ref.current.previous = ref.current.value;
      ref.current.value = value;
    }
    return ref.current.previous;
  }, [value]);
}

// node_modules/@radix-ui/react-use-size/dist/index.mjs
function useSize(element) {
  const [size, setSize] = d2(void 0);
  useLayoutEffect2(() => {
    if (element) {
      setSize({ width: element.offsetWidth, height: element.offsetHeight });
      const resizeObserver = new ResizeObserver((entries) => {
        if (!Array.isArray(entries)) {
          return;
        }
        if (!entries.length) {
          return;
        }
        const entry = entries[0];
        let width;
        let height;
        if ("borderBoxSize" in entry) {
          const borderSizeEntry = entry["borderBoxSize"];
          const borderSize = Array.isArray(borderSizeEntry) ? borderSizeEntry[0] : borderSizeEntry;
          width = borderSize["inlineSize"];
          height = borderSize["blockSize"];
        } else {
          width = element.offsetWidth;
          height = element.offsetHeight;
        }
        setSize({ width, height });
      });
      resizeObserver.observe(element, { box: "border-box" });
      return () => resizeObserver.unobserve(element);
    } else {
      setSize(void 0);
    }
  }, [element]);
  return size;
}

// node_modules/@radix-ui/react-switch/dist/index.mjs
var SWITCH_NAME = "Switch";
var [createSwitchContext, createSwitchScope] = createContextScope(SWITCH_NAME);
var [SwitchProvider, useSwitchContext] = createSwitchContext(SWITCH_NAME);
var Switch = D3(
  (props, forwardedRef) => {
    const {
      __scopeSwitch,
      name,
      checked: checkedProp,
      defaultChecked,
      required,
      disabled,
      value = "on",
      onCheckedChange,
      form,
      ...switchProps
    } = props;
    const [button, setButton] = d2(null);
    const composedRefs = useComposedRefs(forwardedRef, (node) => setButton(node));
    const hasConsumerStoppedPropagationRef = A2(false);
    const isFormControl = button ? form || !!button.closest("form") : true;
    const [checked, setChecked] = useControllableState({
      prop: checkedProp,
      defaultProp: defaultChecked ?? false,
      onChange: onCheckedChange,
      caller: SWITCH_NAME
    });
    return /* @__PURE__ */ u3(SwitchProvider, { scope: __scopeSwitch, checked, disabled, children: [
      /* @__PURE__ */ u3(
        Primitive.button,
        {
          type: "button",
          role: "switch",
          "aria-checked": checked,
          "aria-required": required,
          "data-state": getState2(checked),
          "data-disabled": disabled ? "" : void 0,
          disabled,
          value,
          ...switchProps,
          ref: composedRefs,
          onClick: composeEventHandlers(props.onClick, (event) => {
            setChecked((prevChecked) => !prevChecked);
            if (isFormControl) {
              hasConsumerStoppedPropagationRef.current = event.isPropagationStopped();
              if (!hasConsumerStoppedPropagationRef.current) event.stopPropagation();
            }
          })
        }
      ),
      isFormControl && /* @__PURE__ */ u3(
        SwitchBubbleInput,
        {
          control: button,
          bubbles: !hasConsumerStoppedPropagationRef.current,
          name,
          value,
          checked,
          required,
          disabled,
          form,
          style: { transform: "translateX(-100%)" }
        }
      )
    ] });
  }
);
Switch.displayName = SWITCH_NAME;
var THUMB_NAME = "SwitchThumb";
var SwitchThumb = D3(
  (props, forwardedRef) => {
    const { __scopeSwitch, ...thumbProps } = props;
    const context = useSwitchContext(THUMB_NAME, __scopeSwitch);
    return /* @__PURE__ */ u3(
      Primitive.span,
      {
        "data-state": getState2(context.checked),
        "data-disabled": context.disabled ? "" : void 0,
        ...thumbProps,
        ref: forwardedRef
      }
    );
  }
);
SwitchThumb.displayName = THUMB_NAME;
var BUBBLE_INPUT_NAME = "SwitchBubbleInput";
var SwitchBubbleInput = D3(
  ({
    __scopeSwitch,
    control,
    checked,
    bubbles = true,
    ...props
  }, forwardedRef) => {
    const ref = A2(null);
    const composedRefs = useComposedRefs(ref, forwardedRef);
    const prevChecked = usePrevious(checked);
    const controlSize = useSize(control);
    y2(() => {
      const input = ref.current;
      if (!input) return;
      const inputProto = window.HTMLInputElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(
        inputProto,
        "checked"
      );
      const setChecked = descriptor.set;
      if (prevChecked !== checked && setChecked) {
        const event = new Event("click", { bubbles });
        setChecked.call(input, checked);
        input.dispatchEvent(event);
      }
    }, [prevChecked, checked, bubbles]);
    return /* @__PURE__ */ u3(
      "input",
      {
        type: "checkbox",
        "aria-hidden": true,
        defaultChecked: checked,
        ...props,
        tabIndex: -1,
        ref: composedRefs,
        style: {
          ...props.style,
          ...controlSize,
          position: "absolute",
          pointerEvents: "none",
          opacity: 0,
          margin: 0
        }
      }
    );
  }
);
SwitchBubbleInput.displayName = BUBBLE_INPUT_NAME;
function getState2(checked) {
  return checked ? "checked" : "unchecked";
}
var Root4 = Switch;
var Thumb = SwitchThumb;

// src/islands/shadcn-compat.tsx
function ShadcnCompat() {
  const [open, setOpen] = d2(false);
  const [toggled, setToggled] = d2(false);
  return /* @__PURE__ */ u3("div", { class: "p-4", children: [
    /* @__PURE__ */ u3("h2", { class: "text-lg font-bold mb-2", children: "shadcn/ui compatibility demo" }),
    /* @__PURE__ */ u3(Root2, { defaultValue: "tab1", children: [
      /* @__PURE__ */ u3(List, { "aria-label": "tabs", children: [
        /* @__PURE__ */ u3(Trigger, { value: "tab1", children: "Tab 1" }),
        /* @__PURE__ */ u3(Trigger, { value: "tab2", children: "Tab 2" })
      ] }),
      /* @__PURE__ */ u3(Content, { value: "tab1", children: /* @__PURE__ */ u3("p", { children: "Content for tab 1" }) }),
      /* @__PURE__ */ u3(Content, { value: "tab2", children: /* @__PURE__ */ u3("p", { children: "Content for tab 2" }) })
    ] }),
    /* @__PURE__ */ u3("div", { class: "mt-4", children: /* @__PURE__ */ u3(Root3, { open, onOpenChange: setOpen, children: [
      /* @__PURE__ */ u3(Trigger2, { asChild: true, children: /* @__PURE__ */ u3("button", { class: "px-3 py-1 bg-blue-600 text-white rounded", children: "Open Dialog" }) }),
      /* @__PURE__ */ u3(Portal2, { children: [
        /* @__PURE__ */ u3(Overlay, { class: "fixed inset-0 bg-black/40" }),
        /* @__PURE__ */ u3(Content2, { class: "fixed left-1/2 top-1/3 -translate-x-1/2 bg-white p-4 rounded shadow", children: [
          /* @__PURE__ */ u3(Title, { children: "Dialog Title" }),
          /* @__PURE__ */ u3(Description, { children: "Simple dialog content for testing." }),
          /* @__PURE__ */ u3("div", { class: "mt-2", children: /* @__PURE__ */ u3("button", { onClick: () => setOpen(false), class: "px-2 py-1 bg-gray-200 rounded", children: "Close" }) })
        ] })
      ] })
    ] }) }),
    /* @__PURE__ */ u3("div", { class: "mt-4 flex items-center gap-3", children: /* @__PURE__ */ u3("label", { class: "flex items-center gap-2", children: [
      /* @__PURE__ */ u3(Root4, { checked: toggled, onCheckedChange: (v3) => setToggled(v3), children: /* @__PURE__ */ u3(Thumb, { class: "inline-block w-4 h-4 bg-white rounded-full" }) }),
      /* @__PURE__ */ u3("span", { children: toggled ? "On" : "Off" })
    ] }) })
  ] });
}

// src/ui/contracts/Settings.Overview.contract.ts
var OverviewDashboardSchema = external_exports.object({
  // Connection summary
  connection: external_exports.object({
    paperlessApiUrl: external_exports.string().optional(),
    isConnected: external_exports.boolean().optional().default(false),
    lastTestAt: external_exports.string().optional()
    // ISO timestamp
  }).optional(),
  // AI Provider summary
  aiProvider: external_exports.object({
    provider: external_exports.enum(["openai", "ollama", "custom", "azure"]).optional(),
    model: external_exports.string().optional(),
    tokenLimit: external_exports.number().int().optional()
  }).optional(),
  // Expert Models summary
  expertModels: external_exports.object({
    enabled: external_exports.boolean().optional().default(false),
    medicalVisionModel: external_exports.string().optional(),
    financialAnalysisModel: external_exports.string().optional(),
    legalVisionModel: external_exports.string().optional()
  }).optional(),
  // Advanced highlights
  advanced: external_exports.object({
    expertPipelineEnabled: external_exports.boolean().optional().default(false),
    activateTagging: external_exports.boolean().optional().default(false),
    activateCorrespondents: external_exports.boolean().optional().default(false),
    scanInterval: external_exports.string().optional()
  }).optional()
});

// src/islands/OverviewDashboardIsland.tsx
function OverviewDashboardIsland(props) {
  const validated = OverviewDashboardSchema.parse(props);
  const [isLoading, setIsLoading] = d2(false);
  const handleNavigate = (category) => {
    if (typeof document !== "undefined") {
      document.dispatchEvent(new CustomEvent("settings:navigate", {
        detail: { category }
      }));
    }
    if (typeof window !== "undefined") {
      window.location.hash = category;
    }
  };
  const handleExport = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/settings/export");
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a3 = document.createElement("a");
        a3.href = url;
        a3.download = `paperless-ai-settings-${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.env`;
        document.body.appendChild(a3);
        a3.click();
        document.body.removeChild(a3);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsLoading(false);
    }
  };
  return /* @__PURE__ */ u3("div", { className: "overview-dashboard space-y-6 p-6", "data-testid": "overview-dashboard-root", children: [
    /* @__PURE__ */ u3("div", { className: "space-y-2", children: [
      /* @__PURE__ */ u3("h2", { className: "text-2xl font-bold", children: "Settings Overview" }),
      /* @__PURE__ */ u3("p", { className: "text-gray-600", children: "Quick summary of your current configuration" })
    ] }),
    /* @__PURE__ */ u3("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4", children: [
      /* @__PURE__ */ u3("div", { className: "border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow", children: [
        /* @__PURE__ */ u3("div", { className: "flex items-center justify-between mb-2", children: [
          /* @__PURE__ */ u3("h3", { className: "font-semibold text-lg", children: "Connection" }),
          /* @__PURE__ */ u3("div", { className: `w-2 h-2 rounded-full ${validated.connection?.isConnected ? "bg-green-500" : "bg-gray-300"}` })
        ] }),
        /* @__PURE__ */ u3("div", { className: "space-y-1 text-sm text-gray-600", children: [
          /* @__PURE__ */ u3("p", { className: "truncate", children: validated.connection?.paperlessApiUrl || "Not configured" }),
          /* @__PURE__ */ u3("p", { className: "text-xs", children: validated.connection?.isConnected ? "\u2713 Connected" : "\u25CB Not tested" })
        ] }),
        /* @__PURE__ */ u3(
          "button",
          {
            onClick: () => handleNavigate("connection"),
            className: "mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium",
            children: "Configure \u2192"
          }
        )
      ] }),
      /* @__PURE__ */ u3("div", { className: "border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow", children: [
        /* @__PURE__ */ u3("div", { className: "flex items-center justify-between mb-2", children: /* @__PURE__ */ u3("h3", { className: "font-semibold text-lg", children: "AI Provider" }) }),
        /* @__PURE__ */ u3("div", { className: "space-y-1 text-sm text-gray-600", children: [
          /* @__PURE__ */ u3("p", { className: "capitalize", children: validated.aiProvider?.provider || "Not configured" }),
          /* @__PURE__ */ u3("p", { className: "truncate text-xs", children: validated.aiProvider?.model || "-" }),
          validated.aiProvider?.tokenLimit && /* @__PURE__ */ u3("p", { className: "text-xs", children: [
            "Limit: ",
            validated.aiProvider.tokenLimit.toLocaleString()
          ] })
        ] }),
        /* @__PURE__ */ u3(
          "button",
          {
            onClick: () => handleNavigate("ai-provider"),
            className: "mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium",
            children: "Configure \u2192"
          }
        )
      ] }),
      /* @__PURE__ */ u3("div", { className: "border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow", children: [
        /* @__PURE__ */ u3("div", { className: "flex items-center justify-between mb-2", children: [
          /* @__PURE__ */ u3("h3", { className: "font-semibold text-lg", children: "Expert Models" }),
          /* @__PURE__ */ u3("div", { className: `w-2 h-2 rounded-full ${validated.expertModels?.enabled ? "bg-green-500" : "bg-gray-300"}` })
        ] }),
        /* @__PURE__ */ u3("div", { className: "space-y-1 text-sm text-gray-600", children: [
          /* @__PURE__ */ u3("p", { children: validated.expertModels?.enabled ? "Enabled" : "Disabled" }),
          validated.expertModels?.enabled && /* @__PURE__ */ u3(k, { children: [
            /* @__PURE__ */ u3("p", { className: "text-xs truncate", children: [
              "Medical: ",
              validated.expertModels.medicalVisionModel || "-"
            ] }),
            /* @__PURE__ */ u3("p", { className: "text-xs truncate", children: [
              "Financial: ",
              validated.expertModels.financialAnalysisModel || "-"
            ] })
          ] })
        ] }),
        /* @__PURE__ */ u3(
          "button",
          {
            onClick: () => handleNavigate("expert-models"),
            className: "mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium",
            children: "Configure \u2192"
          }
        )
      ] }),
      /* @__PURE__ */ u3("div", { className: "border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow", children: [
        /* @__PURE__ */ u3("div", { className: "flex items-center justify-between mb-2", children: /* @__PURE__ */ u3("h3", { className: "font-semibold text-lg", children: "Advanced" }) }),
        /* @__PURE__ */ u3("div", { className: "space-y-1 text-sm text-gray-600", children: [
          /* @__PURE__ */ u3("p", { className: "text-xs", children: [
            validated.advanced?.activateTagging ? "\u2713" : "\u25CB",
            " Tagging"
          ] }),
          /* @__PURE__ */ u3("p", { className: "text-xs", children: [
            validated.advanced?.activateCorrespondents ? "\u2713" : "\u25CB",
            " Correspondents"
          ] }),
          /* @__PURE__ */ u3("p", { className: "text-xs", children: [
            "Scan: ",
            validated.advanced?.scanInterval || "Not set"
          ] })
        ] }),
        /* @__PURE__ */ u3(
          "button",
          {
            onClick: () => handleNavigate("advanced"),
            className: "mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium",
            children: "Configure \u2192"
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ u3("div", { className: "border-t pt-6", children: [
      /* @__PURE__ */ u3("h3", { className: "font-semibold text-lg mb-4", children: "Quick Actions" }),
      /* @__PURE__ */ u3("div", { className: "flex gap-3", children: [
        /* @__PURE__ */ u3(
          "button",
          {
            onClick: handleExport,
            disabled: isLoading,
            className: "px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed",
            children: isLoading ? "Exporting..." : "Export Settings"
          }
        ),
        /* @__PURE__ */ u3(
          "button",
          {
            onClick: () => handleNavigate("connection"),
            className: "px-4 py-2 border border-gray-300 rounded hover:bg-gray-50",
            children: "Test Connection"
          }
        )
      ] })
    ] })
  ] });
}

// src/ui/contracts/Settings.Sidebar.contract.ts
var SettingsSidebarSchema = external_exports.object({
  // Initial active category
  activeCategory: external_exports.enum([
    "overview",
    "connection",
    "ai-provider",
    "expert-models",
    "advanced",
    "developer"
  ]).optional().default("overview"),
  // Developer mode initial state (can be overridden by localStorage)
  developerModeEnabled: external_exports.boolean().optional().default(false),
  // Optional: initial last visited category from server
  lastVisitedCategory: external_exports.string().optional(),
  // Active AI provider used for category gating
  aiProvider: external_exports.string().optional().default("ollama")
});

// src/islands/SettingsSidebarIsland.tsx
var STORAGE_KEY_DEVELOPER_MODE = "settings:developerMode";
var STORAGE_KEY_LAST_CATEGORY = "settings:lastCategory";
var CATEGORIES = [
  { id: "overview", label: "Overview", icon: "\u{1F4CA}" },
  { id: "connection", label: "Connection", icon: "\u{1F50C}" },
  { id: "ai-provider", label: "AI Provider", icon: "\u{1F916}" },
  { id: "expert-models", label: "Expert Models", icon: "\u{1F393}" },
  { id: "advanced", label: "Advanced", icon: "\u2699\uFE0F" },
  { id: "developer", label: "Developer", icon: "\u{1F468}\u200D\u{1F4BB}", requiresDeveloperMode: true }
];
function SettingsSidebarIsland(props) {
  const validated = SettingsSidebarSchema.parse(props);
  const [developerMode, setDeveloperMode] = d2(() => {
    if (typeof localStorage === "undefined") return Boolean(validated.developerModeEnabled || false);
    const stored = localStorage.getItem(STORAGE_KEY_DEVELOPER_MODE);
    return stored ? stored === "true" : Boolean(validated.developerModeEnabled || false);
  });
  const [activeCategory, setActiveCategory] = d2(() => {
    if (typeof localStorage === "undefined") return validated.activeCategory || "overview";
    const stored = localStorage.getItem(STORAGE_KEY_LAST_CATEGORY);
    return stored || validated.activeCategory || "overview";
  });
  const [aiProvider, setAiProvider] = d2(validated.aiProvider || "ollama");
  const toggleRef = A2(null);
  y2(() => {
    if (toggleRef.current) toggleRef.current.setAttribute("aria-checked", String(developerMode));
  }, [developerMode]);
  const dispatchSettingsEvent = (name, detail) => {
    if (typeof document === "undefined") return;
    const CustomEventCtor = typeof window !== "undefined" && typeof window.CustomEvent === "function" ? window.CustomEvent : null;
    if (!CustomEventCtor) return;
    document.dispatchEvent(new CustomEventCtor(name, { detail }));
  };
  y2(() => {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY_DEVELOPER_MODE, String(developerMode));
  }, [developerMode]);
  y2(() => {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY_LAST_CATEGORY, activeCategory);
  }, [activeCategory]);
  y2(() => {
    if (typeof document === "undefined") return;
    const handleNavigate = (e3) => {
      const customEvent = e3;
      if (customEvent.detail?.category) {
        setActiveCategory(customEvent.detail.category);
      }
    };
    document.addEventListener("settings:navigate", handleNavigate);
    return () => document.removeEventListener("settings:navigate", handleNavigate);
  }, []);
  y2(() => {
    if (typeof window === "undefined") return;
    const win = window;
    const handleHashChange = () => {
      const hash = win.location.hash.slice(1);
      if (hash && CATEGORIES.some((cat) => cat.id === hash)) {
        setActiveCategory(hash);
      }
    };
    win.addEventListener("hashchange", handleHashChange);
    handleHashChange();
    return () => win.removeEventListener("hashchange", handleHashChange);
  }, []);
  y2(() => {
    if (typeof document === "undefined") return;
    const handleSettingsChanged = (e3) => {
      const customEvent = e3;
      const nextProvider = customEvent.detail?.settings?.AI_PROVIDER;
      if (nextProvider) {
        setAiProvider(String(nextProvider));
      }
    };
    document.addEventListener("settings:changed", handleSettingsChanged);
    return () => document.removeEventListener("settings:changed", handleSettingsChanged);
  }, []);
  y2(() => {
    if (aiProvider === "ollama") return;
    if (activeCategory !== "expert-models") return;
    const nextCategory = "ai-provider";
    setActiveCategory(nextCategory);
    dispatchSettingsEvent("settings:category-changed", {
      category: nextCategory
    });
    if (typeof window !== "undefined") {
      window.location.hash = nextCategory;
    }
  }, [aiProvider, activeCategory]);
  const handleCategoryClick = (categoryId) => {
    const targetCategory = categoryId === "expert-models" ? "ai-provider" : categoryId;
    setActiveCategory(targetCategory);
    const detail = { category: targetCategory };
    if (categoryId === "expert-models") detail.focus = "expert-models";
    dispatchSettingsEvent("settings:category-changed", detail);
    if (typeof window !== "undefined") {
      window.location.hash = targetCategory;
    }
  };
  const handleDeveloperToggle = () => {
    const newValue = !developerMode;
    setDeveloperMode(newValue);
    dispatchSettingsEvent("developer:toggled", {
      enabled: newValue
    });
    if (!newValue && activeCategory === "developer") {
      handleCategoryClick("overview");
    }
  };
  const visibleCategories = CATEGORIES.filter((cat) => {
    if (cat.id === "expert-models" && aiProvider !== "ollama") return false;
    return !cat.requiresDeveloperMode || developerMode;
  });
  return /* @__PURE__ */ u3("div", { className: "settings-sidebar", "data-testid": "settings-sidebar-root", children: [
    /* @__PURE__ */ u3("div", { className: "settings-sidebar-header", children: /* @__PURE__ */ u3("h2", { className: "settings-sidebar-title", children: "Settings" }) }),
    /* @__PURE__ */ u3("nav", { className: "flex-1 overflow-y-auto p-2", children: /* @__PURE__ */ u3("ul", { className: "space-y-1", children: visibleCategories.map((category) => /* @__PURE__ */ u3("li", { children: /* @__PURE__ */ u3(
      "button",
      {
        onClick: () => handleCategoryClick(category.id),
        className: `settings-category-btn ${activeCategory === category.id ? "active" : ""}`,
        "data-testid": `category-${category.id}`,
        children: [
          /* @__PURE__ */ u3("span", { className: "mr-2", children: category.icon }),
          category.label
        ]
      }
    ) }, category.id)) }) }),
    /* @__PURE__ */ u3("div", { className: "settings-sidebar-footer", children: [
      /* @__PURE__ */ u3("div", { className: "flex items-center justify-between", children: [
        /* @__PURE__ */ u3("label", { htmlFor: "developer-toggle", className: "text-sm text-gray-700 cursor-pointer dark:text-gray-300", children: "Developer Mode" }),
        /* @__PURE__ */ u3(
          "button",
          {
            id: "developer-toggle",
            role: "switch",
            "aria-checked": "false",
            ref: (el) => {
              toggleRef.current = el;
            },
            onClick: handleDeveloperToggle,
            className: `relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${developerMode ? "bg-blue-600" : "bg-gray-300"}`,
            "data-testid": "developer-toggle",
            children: /* @__PURE__ */ u3(
              "span",
              {
                className: `inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${developerMode ? "translate-x-6" : "translate-x-1"}`
              }
            )
          }
        )
      ] }),
      developerMode && /* @__PURE__ */ u3("p", { className: "mt-2 text-xs text-gray-500", children: "\u{1F468}\u200D\u{1F4BB} Developer category enabled" })
    ] })
  ] });
}

// src/ui/contracts/Settings.Connection.contract.ts
var ConnectionSettingsSchema = external_exports.object({
  paperlessApiUrl: external_exports.string().url().optional(),
  paperlessApiToken: external_exports.string().optional(),
  paperlessUsername: external_exports.string().optional(),
  testConnectionTimeoutMs: external_exports.number().int().nonnegative().optional().default(5e3)
});

// src/islands/ConnectionSettingsIsland.tsx
function ConnectionSettingsIsland(props) {
  const validated = ConnectionSettingsSchema.parse(props);
  const [apiUrl, setApiUrl] = d2(validated.paperlessApiUrl || "");
  const [apiToken, setApiToken] = d2(validated.paperlessApiToken || "");
  const [username, setUsername] = d2(validated.paperlessUsername || "");
  const [isTesting, setIsTesting] = d2(false);
  const [isSaving, setIsSaving] = d2(false);
  const [testResult, setTestResult] = d2(null);
  const [saveMessage, setSaveMessage] = d2(null);
  y2(() => {
    if (testResult) {
      const timer = setTimeout(() => setTestResult(null), 5e3);
      return () => clearTimeout(timer);
    }
  }, [testResult]);
  y2(() => {
    if (saveMessage) {
      const timer = setTimeout(() => setSaveMessage(null), 3e3);
      return () => clearTimeout(timer);
    }
  }, [saveMessage]);
  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const response = await fetch("/api/settings/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paperlessApiUrl: apiUrl,
          paperlessApiToken: apiToken,
          timeout: validated.testConnectionTimeoutMs
        })
      });
      const result = await response.json();
      if (response.ok && result.success) {
        setTestResult({
          success: true,
          message: result.message || "Connection successful!"
        });
      } else {
        setTestResult({
          success: false,
          message: result.message || result.error || "Connection failed"
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: `Connection test failed: ${error instanceof Error ? error.message : "Unknown error"}`
      });
    } finally {
      setIsTesting(false);
    }
  };
  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const settings = {
        PAPERLESS_API_URL: apiUrl,
        PAPERLESS_API_TOKEN: apiToken,
        ...username && { PAPERLESS_USERNAME: username }
      };
      const response = await fetch("/settings/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "connection",
          settings,
          requiresRestart: true
        })
      });
      const result = await response.json();
      if (response.ok && result.success) {
        setSaveMessage("Settings saved successfully");
        if (typeof document !== "undefined") {
          document.dispatchEvent(new CustomEvent("settings:changed", {
            detail: {
              type: "settings:changed",
              category: "connection",
              settings,
              requiresRestart: true
            }
          }));
          document.dispatchEvent(new CustomEvent("settings:restart-required", {
            detail: {
              type: "settings:restart-required",
              reason: "Connection settings changed",
              settings: ["API URL", "API Token"]
            }
          }));
          document.dispatchEvent(new CustomEvent("settings:saved", {
            detail: {
              type: "settings:saved",
              category: "connection",
              success: true,
              message: "Settings saved successfully"
            }
          }));
        }
      } else {
        setSaveMessage(`Save failed: ${result.message || result.error || "Unknown error"}`);
      }
    } catch (error) {
      setSaveMessage(`Save failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSaving(false);
    }
  };
  const isFormValid = apiUrl.trim() !== "" && apiToken.trim() !== "";
  return /* @__PURE__ */ u3("div", { className: "connection-settings space-y-6 p-6 max-w-2xl", "data-testid": "connection-settings-root", children: [
    /* @__PURE__ */ u3("div", { className: "space-y-2", children: [
      /* @__PURE__ */ u3("h2", { className: "text-2xl font-bold", children: "Connection Settings" }),
      /* @__PURE__ */ u3("p", { className: "text-gray-600", children: "Configure connection to Paperless-ngx instance" })
    ] }),
    /* @__PURE__ */ u3("div", { className: "space-y-4", children: [
      /* @__PURE__ */ u3("div", { className: "space-y-2", children: [
        /* @__PURE__ */ u3("label", { htmlFor: "api-url", className: "block text-sm font-medium text-gray-700", children: [
          "API URL ",
          /* @__PURE__ */ u3("span", { className: "text-red-500", children: "*" })
        ] }),
        /* @__PURE__ */ u3(
          "input",
          {
            id: "api-url",
            type: "url",
            value: apiUrl,
            onChange: (e3) => setApiUrl(e3.target.value),
            placeholder: "http://localhost:8000",
            className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
            "data-testid": "api-url-input"
          }
        ),
        /* @__PURE__ */ u3("p", { className: "text-xs text-gray-500", children: "Base URL of your Paperless-ngx instance" })
      ] }),
      /* @__PURE__ */ u3("div", { className: "space-y-2", children: [
        /* @__PURE__ */ u3("label", { htmlFor: "api-token", className: "block text-sm font-medium text-gray-700", children: [
          "API Token ",
          /* @__PURE__ */ u3("span", { className: "text-red-500", children: "*" })
        ] }),
        /* @__PURE__ */ u3(
          "input",
          {
            id: "api-token",
            type: "password",
            value: apiToken,
            onChange: (e3) => setApiToken(e3.target.value),
            placeholder: "Enter API token",
            className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
            "data-testid": "api-token-input"
          }
        ),
        /* @__PURE__ */ u3("p", { className: "text-xs text-gray-500", children: "Authentication token from Paperless-ngx settings" })
      ] }),
      /* @__PURE__ */ u3("div", { className: "space-y-2", children: [
        /* @__PURE__ */ u3("label", { htmlFor: "username", className: "block text-sm font-medium text-gray-700", children: [
          "Username ",
          /* @__PURE__ */ u3("span", { className: "text-gray-400", children: "(optional)" })
        ] }),
        /* @__PURE__ */ u3(
          "input",
          {
            id: "username",
            type: "text",
            value: username,
            onChange: (e3) => setUsername(e3.target.value),
            placeholder: "Enter username",
            className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
            "data-testid": "username-input"
          }
        ),
        /* @__PURE__ */ u3("p", { className: "text-xs text-gray-500", children: "Optional username for API authentication" })
      ] })
    ] }),
    /* @__PURE__ */ u3("div", { className: "border-t pt-4", children: [
      /* @__PURE__ */ u3(
        "button",
        {
          onClick: handleTestConnection,
          disabled: !isFormValid || isTesting,
          className: "px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed",
          "data-testid": "test-connection-button",
          children: isTesting ? "Testing..." : "Test Connection"
        }
      ),
      testResult && /* @__PURE__ */ u3(
        "div",
        {
          className: `mt-3 p-3 rounded ${testResult.success ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800"}`,
          "data-testid": "test-result",
          children: /* @__PURE__ */ u3("div", { className: "flex items-start", children: [
            /* @__PURE__ */ u3("span", { className: "mr-2", children: testResult.success ? "\u2713" : "\u2717" }),
            /* @__PURE__ */ u3("span", { children: testResult.message })
          ] })
        }
      )
    ] }),
    /* @__PURE__ */ u3("div", { className: "border-t pt-4", children: [
      /* @__PURE__ */ u3(
        "button",
        {
          onClick: handleSave,
          disabled: !isFormValid || isSaving,
          className: "px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed",
          "data-testid": "save-button",
          children: isSaving ? "Saving..." : "Save Settings"
        }
      ),
      saveMessage && /* @__PURE__ */ u3(
        "div",
        {
          className: "mt-3 p-3 rounded bg-blue-50 border border-blue-200 text-blue-800",
          "data-testid": "save-message",
          children: saveMessage
        }
      ),
      /* @__PURE__ */ u3("p", { className: "mt-2 text-sm text-gray-500", children: "\u26A0\uFE0F Changing connection settings requires a restart to take effect" })
    ] })
  ] });
}

// src/ui/contracts/Settings.AIProvider.contract.ts
var TokenLimitsSchema = external_exports.object({
  contextWindow: external_exports.number().int().positive().optional().default(128e3),
  maxResponseTokens: external_exports.number().int().positive().optional().default(4096)
});
var OpenAISchema = external_exports.object({
  apiKey: external_exports.string().optional().default("")
});
var OllamaSchema = external_exports.object({
  apiUrl: external_exports.string().url().optional().default("http://localhost:11434"),
  model: external_exports.string().optional().default("sauerkraut-llama3.1:8b"),
  repairModel: external_exports.string().optional(),
  visionModel: external_exports.string().optional().default("qwen3-vl:8b"),
  plannerModel: external_exports.string().optional(),
  routerModel: external_exports.string().optional(),
  orchestratorModel: external_exports.string().optional(),
  visionKeepAlive: external_exports.string().optional().default("5m"),
  textKeepAlive: external_exports.string().optional().default("2m"),
  routerKeepAlive: external_exports.string().optional().default("5m"),
  limits: external_exports.object({
    text: TokenLimitsSchema.optional(),
    vision: TokenLimitsSchema.optional(),
    planner: TokenLimitsSchema.optional(),
    expert: TokenLimitsSchema.optional(),
    imageTokenOverhead: external_exports.number().int().nonnegative().optional().default(1024)
  }).optional()
});
var CustomSchema = external_exports.object({
  apiUrl: external_exports.string().optional().default(""),
  apiKey: external_exports.string().optional().default(""),
  model: external_exports.string().optional().default("")
});
var AzureSchema = external_exports.object({
  apiKey: external_exports.string().optional().default(""),
  endpoint: external_exports.string().optional().default(""),
  deploymentName: external_exports.string().optional().default(""),
  apiVersion: external_exports.string().optional().default("2023-05-15")
});
var AIProviderSettingsSchema = external_exports.object({
  // Provider selection (General tab)
  provider: external_exports.enum(["openai", "ollama", "azure", "custom"]).optional().default("openai"),
  // Provider-specific configurations
  openai: OpenAISchema.optional(),
  ollama: OllamaSchema.optional(),
  custom: CustomSchema.optional(),
  azure: AzureSchema.optional(),
  // Auto-save debounce interval (ms)
  autoSaveDebounceMs: external_exports.number().int().positive().optional().default(1e3)
});

// src/ui/contracts/Settings.ExpertModels.contract.ts
var MedicalModelsSchema = external_exports.object({
  vision: external_exports.string().optional().default("llava-med-v1.6"),
  analysis: external_exports.string().optional().default("medtext-llama3"),
  radiology: external_exports.string().optional().default("llava-med-v1.6")
});
var FinancialModelsSchema = external_exports.object({
  analysis: external_exports.string().optional().default("fino1-8b"),
  reasoning: external_exports.string().optional().default("llm-pro-finance-8b"),
  vision: external_exports.string().optional().default("llm-pro-finance-8b"),
  vatExpert: external_exports.string().optional().default("llm-pro-finance-8b")
});
var LegalModelsSchema = external_exports.object({
  vision: external_exports.string().optional().default("qwen3-vl:8b"),
  analysis: external_exports.string().optional().default("gpt-oss"),
  orchestrator: external_exports.string().optional()
});
var ExpertModelsSettingsSchema = external_exports.object({
  // Medical domain models
  medical: MedicalModelsSchema.optional(),
  // Financial domain models
  financial: FinancialModelsSchema.optional(),
  // Legal domain models
  legal: LegalModelsSchema.optional(),
  // Expert pipeline enabled toggle
  expertPipelineEnabled: external_exports.boolean().optional().default(true),
  // Auto-save debounce interval (ms)
  autoSaveDebounceMs: external_exports.number().int().positive().optional().default(1e3)
});

// src/islands/ExpertModelsIsland.tsx
function ExpertModelsIsland(props) {
  const validated = ExpertModelsSettingsSchema.parse(props);
  const [activeTab, setActiveTab] = d2("medical");
  const [isDirty2, setIsDirty] = d2(false);
  const [isSaving, setIsSaving] = d2(false);
  const [saveMessage, setSaveMessage] = d2(null);
  const [expertPipelineEnabled, setExpertPipelineEnabled] = d2(validated.expertPipelineEnabled || true);
  const [medicalVision, setMedicalVision] = d2(validated.medical?.vision || "llava-med-v1.6");
  const [medicalAnalysis, setMedicalAnalysis] = d2(validated.medical?.analysis || "medtext-llama3");
  const [medicalRadiology, setMedicalRadiology] = d2(validated.medical?.radiology || "llava-med-v1.6");
  const [financialAnalysis, setFinancialAnalysis] = d2(validated.financial?.analysis || "fino1-8b");
  const [financialReasoning, setFinancialReasoning] = d2(validated.financial?.reasoning || "llm-pro-finance-8b");
  const [financialVision, setFinancialVision] = d2(validated.financial?.vision || "llm-pro-finance-8b");
  const [financialVatExpert, setFinancialVatExpert] = d2(validated.financial?.vatExpert || "llm-pro-finance-8b");
  const [legalVision, setLegalVision] = d2(validated.legal?.vision || "qwen3-vl:8b");
  const [legalAnalysis, setLegalAnalysis] = d2(validated.legal?.analysis || "gpt-oss");
  const [legalOrchestrator, setLegalOrchestrator] = d2(validated.legal?.orchestrator || "");
  y2(() => {
    if (saveMessage) {
      const timer = setTimeout(() => setSaveMessage(null), 3e3);
      return () => clearTimeout(timer);
    }
  }, [saveMessage]);
  y2(() => {
    try {
      const raw = window.localStorage.getItem("expert-models-settings");
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.medicalVision) setMedicalVision(saved.medicalVision);
        if (saved.medicalAnalysis) setMedicalAnalysis(saved.medicalAnalysis);
        if (saved.medicalRadiology) setMedicalRadiology(saved.medicalRadiology);
        if (saved.financialAnalysis) setFinancialAnalysis(saved.financialAnalysis);
        if (saved.financialReasoning) setFinancialReasoning(saved.financialReasoning);
        if (saved.financialVision) setFinancialVision(saved.financialVision);
        if (saved.financialVatExpert) setFinancialVatExpert(saved.financialVatExpert);
        if (saved.legalVision) setLegalVision(saved.legalVision);
        if (saved.legalAnalysis) setLegalAnalysis(saved.legalAnalysis);
        if (saved.legalOrchestrator) setLegalOrchestrator(saved.legalOrchestrator);
        if (typeof saved.expertPipelineEnabled === "boolean") setExpertPipelineEnabled(Boolean(saved.expertPipelineEnabled));
      }
    } catch (err) {
    }
  }, []);
  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const settings = {
        EXPERT_PIPELINE_ENABLED: expertPipelineEnabled ? "yes" : "no",
        // Medical models
        MEDICAL_VISION_MODEL: medicalVision,
        MEDICAL_ANALYSIS_MODEL: medicalAnalysis,
        MEDICAL_RADIOLOGY_MODEL: medicalRadiology,
        // Financial models
        FINANCIAL_ANALYSIS_MODEL: financialAnalysis,
        FINANCIAL_REASONING_MODEL: financialReasoning,
        FINANCIAL_VISION_MODEL: financialVision,
        FINANCIAL_VAT_EXPERT: financialVatExpert,
        // Legal models
        LEGAL_VISION_MODEL: legalVision,
        LEGAL_ANALYSIS_MODEL: legalAnalysis
      };
      if (legalOrchestrator) {
        settings.LEGAL_ORCHESTRATOR_MODEL = legalOrchestrator;
      }
      const response = await fetch("/settings/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "expert-models",
          settings,
          requiresRestart: true
          // Expert model changes require restart
        })
      });
      const result = await response.json();
      if (response.ok && result.success) {
        setSaveMessage("Expert models settings saved successfully");
        setIsDirty(false);
        if (typeof document !== "undefined") {
          document.dispatchEvent(new CustomEvent("settings:changed", {
            detail: {
              type: "settings:changed",
              category: "expert-models",
              settings,
              requiresRestart: true
            }
          }));
          document.dispatchEvent(new CustomEvent("settings:restart-required", {
            detail: {
              type: "settings:restart-required",
              reason: "Expert models settings changed",
              settings: ["Expert Models"]
            }
          }));
          document.dispatchEvent(new CustomEvent("settings:saved", {
            detail: {
              type: "settings:saved",
              category: "expert-models",
              success: true,
              message: "Expert models settings saved successfully"
            }
          }));
        }
      } else {
        setSaveMessage(`Save failed: ${result.message || result.error || "Unknown error"}`);
      }
    } catch (error) {
      setSaveMessage(`Save failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSaving(false);
    }
  };
  const markDirty = () => setIsDirty(true);
  return /* @__PURE__ */ u3("div", { className: "expert-models-settings space-y-6 p-6 max-w-4xl", "data-testid": "expert-models-root", children: [
    /* @__PURE__ */ u3("div", { className: "space-y-2", children: [
      /* @__PURE__ */ u3("h2", { className: "text-2xl font-bold", children: "Expert Models Settings" }),
      /* @__PURE__ */ u3("p", { className: "text-gray-600", children: "Configure domain-specific expert models for Medical, Financial, and Legal documents" })
    ] }),
    /* @__PURE__ */ u3("div", { className: "space-y-4 border-b pb-4", children: /* @__PURE__ */ u3("div", { className: "flex items-center justify-between", children: [
      /* @__PURE__ */ u3("div", { children: [
        /* @__PURE__ */ u3("label", { htmlFor: "expert-pipeline-toggle", className: "block text-sm font-medium text-gray-700", children: "Expert Pipeline Enabled" }),
        /* @__PURE__ */ u3("p", { className: "text-xs text-gray-500 mt-1", children: "Enable domain-specific expert models for enhanced document processing" })
      ] }),
      /* @__PURE__ */ u3("label", { className: "relative inline-flex items-center cursor-pointer", children: [
        /* @__PURE__ */ u3(
          "input",
          {
            id: "expert-pipeline-toggle",
            type: "checkbox",
            checked: expertPipelineEnabled,
            onChange: (e3) => {
              setExpertPipelineEnabled(e3.target.checked);
              markDirty();
            },
            className: "sr-only peer",
            "data-testid": "expert-pipeline-toggle"
          }
        ),
        /* @__PURE__ */ u3("div", { className: "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" })
      ] })
    ] }) }),
    /* @__PURE__ */ u3("div", { className: "border-b border-gray-200", children: /* @__PURE__ */ u3("nav", { className: "-mb-px flex space-x-8", "data-testid": "expert-models-tabs", children: [
      /* @__PURE__ */ u3(
        "button",
        {
          onClick: () => setActiveTab("medical"),
          className: `py-2 px-1 border-b-2 font-medium text-sm ${activeTab === "medical" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`,
          "data-testid": "tab-medical",
          children: "Medical"
        }
      ),
      /* @__PURE__ */ u3(
        "button",
        {
          onClick: () => setActiveTab("financial"),
          className: `py-2 px-1 border-b-2 font-medium text-sm ${activeTab === "financial" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`,
          "data-testid": "tab-financial",
          children: "Financial"
        }
      ),
      /* @__PURE__ */ u3(
        "button",
        {
          onClick: () => setActiveTab("legal"),
          className: `py-2 px-1 border-b-2 font-medium text-sm ${activeTab === "legal" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`,
          "data-testid": "tab-legal",
          children: "Legal"
        }
      )
    ] }) }),
    /* @__PURE__ */ u3("div", { className: "mt-6", children: [
      activeTab === "medical" && /* @__PURE__ */ u3("div", { className: "space-y-4", "data-testid": "tab-content-medical", children: [
        /* @__PURE__ */ u3("h3", { className: "text-lg font-semibold", children: "Medical Domain Models" }),
        /* @__PURE__ */ u3("p", { className: "text-sm text-gray-600", children: "Configure models for medical document analysis, including radiology and clinical text processing" }),
        /* @__PURE__ */ u3("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4 mt-4", children: [
          /* @__PURE__ */ u3("div", { className: "space-y-2", children: [
            /* @__PURE__ */ u3("label", { htmlFor: "medical-vision", className: "block text-sm font-medium text-gray-700", children: "Vision Model" }),
            /* @__PURE__ */ u3(
              "input",
              {
                id: "medical-vision",
                type: "text",
                value: medicalVision,
                onChange: (e3) => {
                  setMedicalVision(e3.target.value);
                  markDirty();
                },
                placeholder: "llava-med-v1.6",
                className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
                "data-testid": "medical-vision-input"
              }
            ),
            /* @__PURE__ */ u3("p", { className: "text-xs text-gray-500", children: "Model for medical image analysis" })
          ] }),
          /* @__PURE__ */ u3("div", { className: "space-y-2", children: [
            /* @__PURE__ */ u3("label", { htmlFor: "medical-analysis", className: "block text-sm font-medium text-gray-700", children: "Analysis Model" }),
            /* @__PURE__ */ u3(
              "input",
              {
                id: "medical-analysis",
                type: "text",
                value: medicalAnalysis,
                onChange: (e3) => {
                  setMedicalAnalysis(e3.target.value);
                  markDirty();
                },
                placeholder: "medtext-llama3",
                className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
                "data-testid": "medical-analysis-input"
              }
            ),
            /* @__PURE__ */ u3("p", { className: "text-xs text-gray-500", children: "Model for medical text analysis" })
          ] }),
          /* @__PURE__ */ u3("div", { className: "space-y-2", children: [
            /* @__PURE__ */ u3("label", { htmlFor: "medical-radiology", className: "block text-sm font-medium text-gray-700", children: "Radiology Model" }),
            /* @__PURE__ */ u3(
              "input",
              {
                id: "medical-radiology",
                type: "text",
                value: medicalRadiology,
                onChange: (e3) => {
                  setMedicalRadiology(e3.target.value);
                  markDirty();
                },
                placeholder: "llava-med-v1.6",
                className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
                "data-testid": "medical-radiology-input"
              }
            ),
            /* @__PURE__ */ u3("p", { className: "text-xs text-gray-500", children: "Specialized model for radiology images" })
          ] })
        ] })
      ] }),
      activeTab === "financial" && /* @__PURE__ */ u3("div", { className: "space-y-4", "data-testid": "tab-content-financial", children: [
        /* @__PURE__ */ u3("h3", { className: "text-lg font-semibold", children: "Financial Domain Models" }),
        /* @__PURE__ */ u3("p", { className: "text-sm text-gray-600", children: "Configure models for financial document analysis, including invoices, receipts, and tax documents" }),
        /* @__PURE__ */ u3("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4 mt-4", children: [
          /* @__PURE__ */ u3("div", { className: "space-y-2", children: [
            /* @__PURE__ */ u3("label", { htmlFor: "financial-analysis", className: "block text-sm font-medium text-gray-700", children: "Analysis Model" }),
            /* @__PURE__ */ u3(
              "input",
              {
                id: "financial-analysis",
                type: "text",
                value: financialAnalysis,
                onChange: (e3) => {
                  setFinancialAnalysis(e3.target.value);
                  markDirty();
                },
                placeholder: "fino1-8b",
                className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
                "data-testid": "financial-analysis-input"
              }
            ),
            /* @__PURE__ */ u3("p", { className: "text-xs text-gray-500", children: "Model for financial document analysis" })
          ] }),
          /* @__PURE__ */ u3("div", { className: "space-y-2", children: [
            /* @__PURE__ */ u3("label", { htmlFor: "financial-reasoning", className: "block text-sm font-medium text-gray-700", children: "Reasoning Model" }),
            /* @__PURE__ */ u3(
              "input",
              {
                id: "financial-reasoning",
                type: "text",
                value: financialReasoning,
                onChange: (e3) => {
                  setFinancialReasoning(e3.target.value);
                  markDirty();
                },
                placeholder: "llm-pro-finance-8b",
                className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
                "data-testid": "financial-reasoning-input"
              }
            ),
            /* @__PURE__ */ u3("p", { className: "text-xs text-gray-500", children: "Model for financial reasoning tasks" })
          ] }),
          /* @__PURE__ */ u3("div", { className: "space-y-2", children: [
            /* @__PURE__ */ u3("label", { htmlFor: "financial-vision", className: "block text-sm font-medium text-gray-700", children: "Vision Model" }),
            /* @__PURE__ */ u3(
              "input",
              {
                id: "financial-vision",
                type: "text",
                value: financialVision,
                onChange: (e3) => {
                  setFinancialVision(e3.target.value);
                  markDirty();
                },
                placeholder: "llm-pro-finance-8b",
                className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
                "data-testid": "financial-vision-input"
              }
            ),
            /* @__PURE__ */ u3("p", { className: "text-xs text-gray-500", children: "Model for financial document images" })
          ] }),
          /* @__PURE__ */ u3("div", { className: "space-y-2", children: [
            /* @__PURE__ */ u3("label", { htmlFor: "financial-vat", className: "block text-sm font-medium text-gray-700", children: "VAT Expert Model" }),
            /* @__PURE__ */ u3(
              "input",
              {
                id: "financial-vat",
                type: "text",
                value: financialVatExpert,
                onChange: (e3) => {
                  setFinancialVatExpert(e3.target.value);
                  markDirty();
                },
                placeholder: "llm-pro-finance-8b",
                className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
                "data-testid": "financial-vat-input"
              }
            ),
            /* @__PURE__ */ u3("p", { className: "text-xs text-gray-500", children: "Specialized model for VAT/tax analysis" })
          ] })
        ] })
      ] }),
      activeTab === "legal" && /* @__PURE__ */ u3("div", { className: "space-y-4", "data-testid": "tab-content-legal", children: [
        /* @__PURE__ */ u3("h3", { className: "text-lg font-semibold", children: "Legal Domain Models" }),
        /* @__PURE__ */ u3("p", { className: "text-sm text-gray-600", children: "Configure models for legal document analysis, including contracts and compliance documents" }),
        /* @__PURE__ */ u3("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4 mt-4", children: [
          /* @__PURE__ */ u3("div", { className: "space-y-2", children: [
            /* @__PURE__ */ u3("label", { htmlFor: "legal-vision", className: "block text-sm font-medium text-gray-700", children: "Vision Model" }),
            /* @__PURE__ */ u3(
              "input",
              {
                id: "legal-vision",
                type: "text",
                value: legalVision,
                onChange: (e3) => {
                  setLegalVision(e3.target.value);
                  markDirty();
                },
                placeholder: "qwen3-vl:8b",
                className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
                "data-testid": "legal-vision-input"
              }
            ),
            /* @__PURE__ */ u3("p", { className: "text-xs text-gray-500", children: "Model for legal document images" })
          ] }),
          /* @__PURE__ */ u3("div", { className: "space-y-2", children: [
            /* @__PURE__ */ u3("label", { htmlFor: "legal-analysis", className: "block text-sm font-medium text-gray-700", children: "Analysis Model" }),
            /* @__PURE__ */ u3(
              "input",
              {
                id: "legal-analysis",
                type: "text",
                value: legalAnalysis,
                onChange: (e3) => {
                  setLegalAnalysis(e3.target.value);
                  markDirty();
                },
                placeholder: "gpt-oss",
                className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
                "data-testid": "legal-analysis-input"
              }
            ),
            /* @__PURE__ */ u3("p", { className: "text-xs text-gray-500", children: "Model for legal text analysis" })
          ] }),
          /* @__PURE__ */ u3("div", { className: "space-y-2", children: [
            /* @__PURE__ */ u3("label", { htmlFor: "legal-orchestrator", className: "block text-sm font-medium text-gray-700", children: [
              "Orchestrator Model ",
              /* @__PURE__ */ u3("span", { className: "text-gray-400", children: "(optional)" })
            ] }),
            /* @__PURE__ */ u3(
              "input",
              {
                id: "legal-orchestrator",
                type: "text",
                value: legalOrchestrator,
                onChange: (e3) => {
                  setLegalOrchestrator(e3.target.value);
                  markDirty();
                },
                placeholder: "Leave empty to use default",
                className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
                "data-testid": "legal-orchestrator-input"
              }
            ),
            /* @__PURE__ */ u3("p", { className: "text-xs text-gray-500", children: "Optional orchestrator for complex legal workflows" })
          ] })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ u3("div", { className: "border-t pt-4", children: [
      /* @__PURE__ */ u3(
        "button",
        {
          onClick: handleSave,
          disabled: !isDirty2 || isSaving,
          className: "px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed",
          "data-testid": "save-button",
          children: isSaving ? "Saving..." : "Save Settings"
        }
      ),
      saveMessage && /* @__PURE__ */ u3(
        "div",
        {
          className: "mt-3 p-3 rounded bg-blue-50 border border-blue-200 text-blue-800",
          "data-testid": "save-message",
          children: saveMessage
        }
      ),
      /* @__PURE__ */ u3("p", { className: "mt-2 text-sm text-gray-500", children: "\u26A0\uFE0F Changing expert models requires a restart to take effect" })
    ] })
  ] });
}

// src/islands/AIProviderIsland.tsx
function AIProviderIsland(props) {
  const validated = AIProviderSettingsSchema.parse(props);
  const [activeTab, setActiveTab] = d2("general");
  const [provider, setProvider] = d2(validated.provider || "openai");
  const [isDirty2, setIsDirty] = d2(false);
  const [isSaving, setIsSaving] = d2(false);
  const [saveMessage, setSaveMessage] = d2(null);
  const [openaiApiKey, setOpenaiApiKey] = d2(validated.openai?.apiKey || "");
  const [ollamaApiUrl, setOllamaApiUrl] = d2(validated.ollama?.apiUrl || "http://localhost:11434");
  const [ollamaModel, setOllamaModel] = d2(validated.ollama?.model || "sauerkraut-llama3.1:8b");
  const [ollamaVisionModel, setOllamaVisionModel] = d2(validated.ollama?.visionModel || "qwen3-vl:8b");
  const [ollamaPlannerModel, setOllamaPlannerModel] = d2(validated.ollama?.plannerModel || "");
  const [ollamaRouterModel, setOllamaRouterModel] = d2(validated.ollama?.routerModel || "");
  const [ollamaOrchestratorModel, setOllamaOrchestratorModel] = d2(validated.ollama?.orchestratorModel || "");
  const [ollamaVisionKeepAlive, setOllamaVisionKeepAlive] = d2(validated.ollama?.visionKeepAlive || "5m");
  const [ollamaTextKeepAlive, setOllamaTextKeepAlive] = d2(validated.ollama?.textKeepAlive || "2m");
  const [ollamaRouterKeepAlive, setOllamaRouterKeepAlive] = d2(validated.ollama?.routerKeepAlive || "5m");
  const [ollamaTextContextWindow, setOllamaTextContextWindow] = d2(validated.ollama?.limits?.text?.contextWindow || 128e3);
  const [ollamaTextMaxTokens, setOllamaTextMaxTokens] = d2(validated.ollama?.limits?.text?.maxResponseTokens || 4096);
  const [ollamaVisionContextWindow, setOllamaVisionContextWindow] = d2(validated.ollama?.limits?.vision?.contextWindow || 128e3);
  const [ollamaVisionMaxTokens, setOllamaVisionMaxTokens] = d2(validated.ollama?.limits?.vision?.maxResponseTokens || 2048);
  const [ollamaPlannerContextWindow, setOllamaPlannerContextWindow] = d2(validated.ollama?.limits?.planner?.contextWindow || 128e3);
  const [ollamaPlannerMaxTokens, setOllamaPlannerMaxTokens] = d2(validated.ollama?.limits?.planner?.maxResponseTokens || 700);
  const [ollamaExpertContextWindow, setOllamaExpertContextWindow] = d2(validated.ollama?.limits?.expert?.contextWindow || 128e3);
  const [ollamaExpertMaxTokens, setOllamaExpertMaxTokens] = d2(validated.ollama?.limits?.expert?.maxResponseTokens || 4096);
  const [ollamaImageTokenOverhead, setOllamaImageTokenOverhead] = d2(validated.ollama?.limits?.imageTokenOverhead || 1024);
  const [customApiUrl, setCustomApiUrl] = d2(validated.custom?.apiUrl || "");
  const [customApiKey, setCustomApiKey] = d2(validated.custom?.apiKey || "");
  const [customModel, setCustomModel] = d2(validated.custom?.model || "");
  const [azureApiKey, setAzureApiKey] = d2(validated.azure?.apiKey || "");
  const [azureEndpoint, setAzureEndpoint] = d2(validated.azure?.endpoint || "");
  const [azureDeploymentName, setAzureDeploymentName] = d2(validated.azure?.deploymentName || "");
  const [azureApiVersion, setAzureApiVersion] = d2(validated.azure?.apiVersion || "2023-05-15");
  const debounceTimerRef = A2(null);
  const hasPendingAutoSave = A2(false);
  const expertRef = A2(null);
  const [expertAnnouncement, setExpertAnnouncement] = d2(null);
  y2(() => {
    if (saveMessage) {
      const timer = setTimeout(() => setSaveMessage(null), 3e3);
      return () => clearTimeout(timer);
    }
  }, [saveMessage]);
  y2(() => {
    return () => {
      if (hasPendingAutoSave.current && debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        flushAutoSave();
      }
    };
  }, []);
  const flushAutoSave = () => {
    if (!hasPendingAutoSave.current) return;
    const autoSaveSettings = {
      OLLAMA_CONTEXT_WINDOW: ollamaTextContextWindow,
      OLLAMA_MAX_RESPONSE_TOKENS: ollamaTextMaxTokens,
      OLLAMA_VISION_CONTEXT_WINDOW: ollamaVisionContextWindow,
      OLLAMA_VISION_MAX_RESPONSE_TOKENS: ollamaVisionMaxTokens,
      OLLAMA_PLANNER_CONTEXT_WINDOW: ollamaPlannerContextWindow,
      OLLAMA_PLANNER_MAX_RESPONSE_TOKENS: ollamaPlannerMaxTokens,
      OLLAMA_EXPERT_CONTEXT_WINDOW: ollamaExpertContextWindow,
      OLLAMA_EXPERT_MAX_RESPONSE_TOKENS: ollamaExpertMaxTokens,
      OLLAMA_VISION_IMAGE_TOKENS: ollamaImageTokenOverhead
    };
    fetch("/settings/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: "ai-provider",
        settings: autoSaveSettings,
        requiresRestart: false
        // Token limits don't require restart
      })
    }).catch((err) => console.error("Auto-save failed:", err));
    hasPendingAutoSave.current = false;
  };
  const handleAutoSaveField = () => {
    hasPendingAutoSave.current = true;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      flushAutoSave();
    }, validated.autoSaveDebounceMs || 1e3);
  };
  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      if (hasPendingAutoSave.current && debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        flushAutoSave();
      }
      const settings = {
        AI_PROVIDER: provider
      };
      if (provider === "openai") {
        settings.PAPERLESS_OPENAI_API_KEY = openaiApiKey;
      } else if (provider === "ollama") {
        settings.OLLAMA_API_URL = ollamaApiUrl;
        settings.OLLAMA_MODEL = ollamaModel;
        settings.OLLAMA_VISION_MODEL = ollamaVisionModel;
        if (ollamaPlannerModel) settings.PLANNER_MODEL = ollamaPlannerModel;
        if (ollamaRouterModel) settings.ROUTER_MODEL = ollamaRouterModel;
        if (ollamaOrchestratorModel) settings.ORCHESTRATOR_MODEL = ollamaOrchestratorModel;
        settings.VISION_KEEP_ALIVE = ollamaVisionKeepAlive;
        settings.TEXT_KEEP_ALIVE = ollamaTextKeepAlive;
        settings.ROUTER_KEEP_ALIVE = ollamaRouterKeepAlive;
      } else if (provider === "custom") {
        settings.CUSTOM_BASE_URL = customApiUrl;
        settings.CUSTOM_API_KEY = customApiKey;
        settings.CUSTOM_MODEL = customModel;
      } else if (provider === "azure") {
        settings.AZURE_API_KEY = azureApiKey;
        settings.AZURE_ENDPOINT = azureEndpoint;
        settings.AZURE_DEPLOYMENT_NAME = azureDeploymentName;
        settings.AZURE_API_VERSION = azureApiVersion;
      }
      const response = await fetch("/settings/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "ai-provider",
          settings,
          requiresRestart: true
          // Provider changes require restart
        })
      });
      const result = await response.json();
      if (response.ok && result.success) {
        setSaveMessage("AI provider settings saved successfully");
        setIsDirty(false);
        if (typeof document !== "undefined") {
          document.dispatchEvent(new CustomEvent("settings:changed", {
            detail: {
              type: "settings:changed",
              category: "ai-provider",
              settings,
              requiresRestart: true
            }
          }));
          document.dispatchEvent(new CustomEvent("settings:restart-required", {
            detail: {
              type: "settings:restart-required",
              reason: "AI provider settings changed",
              settings: ["AI Provider", "API Configuration"]
            }
          }));
          document.dispatchEvent(new CustomEvent("settings:saved", {
            detail: {
              type: "settings:saved",
              category: "ai-provider",
              success: true,
              message: "AI provider settings saved successfully"
            }
          }));
        }
      } else {
        setSaveMessage(`Save failed: ${result.message || result.error || "Unknown error"}`);
      }
    } catch (error) {
      setSaveMessage(`Save failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSaving(false);
    }
  };
  const markDirty = () => setIsDirty(true);
  y2(() => {
    if (typeof window === "undefined") return;
    if (provider === "ollama") {
      setExpertAnnouncement("Expert Models are now available.");
    } else {
      setExpertAnnouncement("Expert Models are available only when Ollama is selected as the AI provider.");
    }
    const t3 = setTimeout(() => setExpertAnnouncement(null), 3e3);
    return () => clearTimeout(t3);
  }, [provider]);
  y2(() => {
    const onNavigate = (e3) => {
      const detail = e3?.detail || {};
      if (detail && detail.focus === "expert-models") {
        setActiveTab("ollama");
        setTimeout(() => {
          if (expertRef.current) {
            try {
              expertRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
              const switchBtn = expertRef.current.querySelector('[data-testid="switch-to-ollama-btn"]');
              if (switchBtn && provider !== "ollama") switchBtn.focus();
            } catch (err) {
            }
          }
        }, 100);
      }
    };
    window.addEventListener("settings:category-changed", onNavigate);
    return () => window.removeEventListener("settings:category-changed", onNavigate);
  }, [provider]);
  y2(() => {
    try {
      const area = expertRef.current?.querySelector('[data-testid="expert-models-area"]');
      const locked = expertRef.current?.querySelector('[data-testid="expert-models-locked"]');
      if (area) area.setAttribute("aria-hidden", String(provider !== "ollama"));
      if (locked) locked.setAttribute("aria-hidden", String(provider === "ollama"));
    } catch (err) {
    }
  }, [provider]);
  return /* @__PURE__ */ u3("div", { className: "ai-provider-settings space-y-6 p-6 max-w-4xl", "data-testid": "ai-provider-root", children: [
    /* @__PURE__ */ u3("div", { className: "space-y-2", children: [
      /* @__PURE__ */ u3("h2", { className: "text-2xl font-bold", children: "AI Provider Settings" }),
      /* @__PURE__ */ u3("p", { className: "text-gray-600", children: "Configure AI provider and model settings" })
    ] }),
    /* @__PURE__ */ u3("div", { className: "border-b border-gray-200", children: /* @__PURE__ */ u3("nav", { className: "-mb-px flex space-x-8", "data-testid": "ai-provider-tabs", children: [
      /* @__PURE__ */ u3(
        "button",
        {
          onClick: () => setActiveTab("general"),
          className: `py-2 px-1 border-b-2 font-medium text-sm ${activeTab === "general" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`,
          "data-testid": "tab-general",
          children: "General"
        }
      ),
      /* @__PURE__ */ u3(
        "button",
        {
          onClick: () => setActiveTab("openai"),
          className: `py-2 px-1 border-b-2 font-medium text-sm ${activeTab === "openai" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`,
          "data-testid": "tab-openai",
          children: "OpenAI"
        }
      ),
      /* @__PURE__ */ u3(
        "button",
        {
          onClick: () => setActiveTab("ollama"),
          className: `py-2 px-1 border-b-2 font-medium text-sm ${activeTab === "ollama" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`,
          "data-testid": "tab-ollama",
          children: "Ollama"
        }
      ),
      /* @__PURE__ */ u3(
        "button",
        {
          onClick: () => setActiveTab("custom"),
          className: `py-2 px-1 border-b-2 font-medium text-sm ${activeTab === "custom" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`,
          "data-testid": "tab-custom",
          children: "Custom"
        }
      ),
      /* @__PURE__ */ u3(
        "button",
        {
          onClick: () => setActiveTab("azure"),
          className: `py-2 px-1 border-b-2 font-medium text-sm ${activeTab === "azure" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`,
          "data-testid": "tab-azure",
          children: "Azure"
        }
      )
    ] }) }),
    /* @__PURE__ */ u3("div", { className: "mt-6", children: [
      activeTab === "general" && /* @__PURE__ */ u3("div", { className: "space-y-4", "data-testid": "tab-content-general", children: [
        /* @__PURE__ */ u3("h3", { className: "text-lg font-semibold", children: "Provider Selection" }),
        /* @__PURE__ */ u3("div", { className: "space-y-2", children: [
          /* @__PURE__ */ u3("label", { htmlFor: "provider", className: "block text-sm font-medium text-gray-700", children: [
            "Active AI Provider ",
            /* @__PURE__ */ u3("span", { className: "text-red-500", children: "*" })
          ] }),
          /* @__PURE__ */ u3(
            "select",
            {
              id: "provider",
              value: provider,
              onChange: (e3) => {
                setProvider(e3.target.value);
                markDirty();
              },
              className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
              "data-testid": "provider-select",
              children: [
                /* @__PURE__ */ u3("option", { value: "openai", children: "OpenAI" }),
                /* @__PURE__ */ u3("option", { value: "ollama", children: "Ollama (Local)" }),
                /* @__PURE__ */ u3("option", { value: "custom", children: "Custom Provider" }),
                /* @__PURE__ */ u3("option", { value: "azure", children: "Azure OpenAI" })
              ]
            }
          ),
          /* @__PURE__ */ u3("p", { className: "text-xs text-gray-500", children: "Select which AI provider to use for document processing" })
        ] }),
        /* @__PURE__ */ u3("div", { className: "mt-4 p-4 bg-blue-50 border border-blue-200 rounded", children: [
          /* @__PURE__ */ u3("p", { className: "text-sm text-blue-800", children: [
            /* @__PURE__ */ u3("span", { className: "font-medium", children: "Current provider:" }),
            " ",
            provider
          ] }),
          /* @__PURE__ */ u3("p", { className: "text-sm text-blue-700 mt-1", children: "Configure provider-specific settings in the respective tab" })
        ] })
      ] }),
      activeTab === "openai" && /* @__PURE__ */ u3("div", { className: "space-y-4", "data-testid": "tab-content-openai", children: [
        /* @__PURE__ */ u3("h3", { className: "text-lg font-semibold", children: "OpenAI Configuration" }),
        /* @__PURE__ */ u3("div", { className: "space-y-2", children: [
          /* @__PURE__ */ u3("label", { htmlFor: "openai-api-key", className: "block text-sm font-medium text-gray-700", children: [
            "API Key ",
            /* @__PURE__ */ u3("span", { className: "text-red-500", children: "*" })
          ] }),
          /* @__PURE__ */ u3(
            "input",
            {
              id: "openai-api-key",
              type: "password",
              value: openaiApiKey,
              onChange: (e3) => {
                setOpenaiApiKey(e3.target.value);
                markDirty();
              },
              placeholder: "sk-...",
              className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
              "data-testid": "openai-api-key-input"
            }
          ),
          /* @__PURE__ */ u3("p", { className: "text-xs text-gray-500", children: "Your OpenAI API key from platform.openai.com" })
        ] })
      ] }),
      activeTab === "ollama" && /* @__PURE__ */ u3("div", { className: "space-y-6", "data-testid": "tab-content-ollama", children: [
        /* @__PURE__ */ u3("h3", { className: "text-lg font-semibold", children: "Ollama Configuration" }),
        /* @__PURE__ */ u3("div", { className: "space-y-4", children: [
          /* @__PURE__ */ u3("h4", { className: "text-md font-medium", children: "Connection" }),
          /* @__PURE__ */ u3("div", { className: "space-y-2", children: [
            /* @__PURE__ */ u3("label", { htmlFor: "ollama-api-url", className: "block text-sm font-medium text-gray-700", children: [
              "API URL ",
              /* @__PURE__ */ u3("span", { className: "text-red-500", children: "*" })
            ] }),
            /* @__PURE__ */ u3(
              "input",
              {
                id: "ollama-api-url",
                type: "url",
                value: ollamaApiUrl,
                onChange: (e3) => {
                  setOllamaApiUrl(e3.target.value);
                  markDirty();
                },
                placeholder: "http://localhost:11434",
                className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
                "data-testid": "ollama-api-url-input"
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ u3("div", { className: "space-y-4", children: [
          /* @__PURE__ */ u3("h4", { className: "text-md font-medium", children: "Models" }),
          /* @__PURE__ */ u3("div", { className: "grid grid-cols-2 gap-4", children: [
            /* @__PURE__ */ u3("div", { className: "space-y-2", children: [
              /* @__PURE__ */ u3("label", { htmlFor: "ollama-text-model", className: "block text-sm font-medium text-gray-700", children: "Text Model" }),
              /* @__PURE__ */ u3(
                "input",
                {
                  id: "ollama-text-model",
                  type: "text",
                  value: ollamaModel,
                  onChange: (e3) => {
                    setOllamaModel(e3.target.value);
                    markDirty();
                  },
                  placeholder: "sauerkraut-llama3.1:8b",
                  className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
                  "data-testid": "ollama-text-model-input"
                }
              )
            ] }),
            /* @__PURE__ */ u3("div", { className: "space-y-2", children: [
              /* @__PURE__ */ u3("label", { htmlFor: "ollama-vision-model", className: "block text-sm font-medium text-gray-700", children: "Vision Model" }),
              /* @__PURE__ */ u3(
                "input",
                {
                  id: "ollama-vision-model",
                  type: "text",
                  value: ollamaVisionModel,
                  onChange: (e3) => {
                    setOllamaVisionModel(e3.target.value);
                    markDirty();
                  },
                  placeholder: "qwen3-vl:8b",
                  className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
                  "data-testid": "ollama-vision-model-input"
                }
              )
            ] })
          ] })
        ] }),
        /* @__PURE__ */ u3("div", { className: "space-y-4 border-t pt-4", children: [
          /* @__PURE__ */ u3("div", { className: "flex items-center justify-between", children: [
            /* @__PURE__ */ u3("h4", { className: "text-md font-medium", children: "Token Limits" }),
            /* @__PURE__ */ u3("span", { className: "text-xs text-gray-500 italic", children: "Auto-saves on change" })
          ] }),
          /* @__PURE__ */ u3("div", { className: "grid grid-cols-2 gap-4", children: [
            /* @__PURE__ */ u3("div", { className: "space-y-2", children: [
              /* @__PURE__ */ u3("label", { htmlFor: "ollama-text-context", className: "block text-sm font-medium text-gray-700", children: "Text Context Window" }),
              /* @__PURE__ */ u3(
                "input",
                {
                  id: "ollama-text-context",
                  type: "number",
                  value: ollamaTextContextWindow,
                  onChange: (e3) => {
                    setOllamaTextContextWindow(parseInt(e3.target.value));
                    handleAutoSaveField();
                  },
                  className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
                  "data-testid": "ollama-text-context-input"
                }
              )
            ] }),
            /* @__PURE__ */ u3("div", { className: "space-y-2", children: [
              /* @__PURE__ */ u3("label", { htmlFor: "ollama-text-max-tokens", className: "block text-sm font-medium text-gray-700", children: "Text Max Response Tokens" }),
              /* @__PURE__ */ u3(
                "input",
                {
                  id: "ollama-text-max-tokens",
                  type: "number",
                  value: ollamaTextMaxTokens,
                  onChange: (e3) => {
                    setOllamaTextMaxTokens(parseInt(e3.target.value));
                    handleAutoSaveField();
                  },
                  className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
                  "data-testid": "ollama-text-max-tokens-input"
                }
              )
            ] })
          ] })
        ] }),
        /* @__PURE__ */ u3("div", { className: "mt-6", ref: expertRef, children: [
          /* @__PURE__ */ u3("div", { role: "status", "aria-live": "polite", className: "sr-only", "data-testid": "expert-models-announcement", children: expertAnnouncement }),
          provider === "ollama" ? /* @__PURE__ */ u3("div", { "data-testid": "expert-models-area", children: [
            /* @__PURE__ */ u3("h4", { className: "text-md font-medium", children: "Expert Models (Ollama)" }),
            /* @__PURE__ */ u3(ExpertModelsIsland, { ...props.expertModels || {} })
          ] }) : /* @__PURE__ */ u3("div", { "data-testid": "expert-models-locked", role: "region", "aria-labelledby": "expert-locked-label", "aria-disabled": "true", className: "p-3 bg-yellow-50 border border-yellow-200 rounded", children: [
            /* @__PURE__ */ u3("p", { id: "expert-locked-label", className: "text-sm text-yellow-800", children: [
              "Expert models are available only when ",
              /* @__PURE__ */ u3("strong", { children: "Ollama" }),
              " is selected as the AI provider."
            ] }),
            /* @__PURE__ */ u3("button", { "data-testid": "switch-to-ollama-btn", "aria-label": "Switch to Ollama provider to enable Expert Models", type: "button", onClick: () => {
              setProvider("ollama");
              markDirty();
            }, className: "mt-2 px-3 py-1 bg-yellow-200 rounded", children: "Switch to Ollama" })
          ] })
        ] })
      ] }),
      activeTab === "custom" && /* @__PURE__ */ u3("div", { className: "space-y-4", "data-testid": "tab-content-custom", children: [
        /* @__PURE__ */ u3("h3", { className: "text-lg font-semibold", children: "Custom Provider Configuration" }),
        /* @__PURE__ */ u3("div", { className: "space-y-4", children: [
          /* @__PURE__ */ u3("div", { className: "space-y-2", children: [
            /* @__PURE__ */ u3("label", { htmlFor: "custom-api-url", className: "block text-sm font-medium text-gray-700", children: [
              "API Base URL ",
              /* @__PURE__ */ u3("span", { className: "text-red-500", children: "*" })
            ] }),
            /* @__PURE__ */ u3(
              "input",
              {
                id: "custom-api-url",
                type: "url",
                value: customApiUrl,
                onChange: (e3) => {
                  setCustomApiUrl(e3.target.value);
                  markDirty();
                },
                placeholder: "https://api.example.com/v1",
                className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
                "data-testid": "custom-api-url-input"
              }
            )
          ] }),
          /* @__PURE__ */ u3("div", { className: "space-y-2", children: [
            /* @__PURE__ */ u3("label", { htmlFor: "custom-api-key", className: "block text-sm font-medium text-gray-700", children: [
              "API Key ",
              /* @__PURE__ */ u3("span", { className: "text-red-500", children: "*" })
            ] }),
            /* @__PURE__ */ u3(
              "input",
              {
                id: "custom-api-key",
                type: "password",
                value: customApiKey,
                onChange: (e3) => {
                  setCustomApiKey(e3.target.value);
                  markDirty();
                },
                placeholder: "Enter API key",
                className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
                "data-testid": "custom-api-key-input"
              }
            )
          ] }),
          /* @__PURE__ */ u3("div", { className: "space-y-2", children: [
            /* @__PURE__ */ u3("label", { htmlFor: "custom-model", className: "block text-sm font-medium text-gray-700", children: [
              "Model Name ",
              /* @__PURE__ */ u3("span", { className: "text-red-500", children: "*" })
            ] }),
            /* @__PURE__ */ u3(
              "input",
              {
                id: "custom-model",
                type: "text",
                value: customModel,
                onChange: (e3) => {
                  setCustomModel(e3.target.value);
                  markDirty();
                },
                placeholder: "model-name",
                className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
                "data-testid": "custom-model-input"
              }
            )
          ] })
        ] })
      ] }),
      activeTab === "azure" && /* @__PURE__ */ u3("div", { className: "space-y-4", "data-testid": "tab-content-azure", children: [
        /* @__PURE__ */ u3("h3", { className: "text-lg font-semibold", children: "Azure OpenAI Configuration" }),
        /* @__PURE__ */ u3("div", { className: "space-y-4", children: [
          /* @__PURE__ */ u3("div", { className: "space-y-2", children: [
            /* @__PURE__ */ u3("label", { htmlFor: "azure-endpoint", className: "block text-sm font-medium text-gray-700", children: [
              "Endpoint ",
              /* @__PURE__ */ u3("span", { className: "text-red-500", children: "*" })
            ] }),
            /* @__PURE__ */ u3(
              "input",
              {
                id: "azure-endpoint",
                type: "url",
                value: azureEndpoint,
                onChange: (e3) => {
                  setAzureEndpoint(e3.target.value);
                  markDirty();
                },
                placeholder: "https://your-resource.openai.azure.com",
                className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
                "data-testid": "azure-endpoint-input"
              }
            )
          ] }),
          /* @__PURE__ */ u3("div", { className: "space-y-2", children: [
            /* @__PURE__ */ u3("label", { htmlFor: "azure-api-key", className: "block text-sm font-medium text-gray-700", children: [
              "API Key ",
              /* @__PURE__ */ u3("span", { className: "text-red-500", children: "*" })
            ] }),
            /* @__PURE__ */ u3(
              "input",
              {
                id: "azure-api-key",
                type: "password",
                value: azureApiKey,
                onChange: (e3) => {
                  setAzureApiKey(e3.target.value);
                  markDirty();
                },
                placeholder: "Enter Azure API key",
                className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
                "data-testid": "azure-api-key-input"
              }
            )
          ] }),
          /* @__PURE__ */ u3("div", { className: "space-y-2", children: [
            /* @__PURE__ */ u3("label", { htmlFor: "azure-deployment", className: "block text-sm font-medium text-gray-700", children: [
              "Deployment Name ",
              /* @__PURE__ */ u3("span", { className: "text-red-500", children: "*" })
            ] }),
            /* @__PURE__ */ u3(
              "input",
              {
                id: "azure-deployment",
                type: "text",
                value: azureDeploymentName,
                onChange: (e3) => {
                  setAzureDeploymentName(e3.target.value);
                  markDirty();
                },
                placeholder: "your-deployment-name",
                className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
                "data-testid": "azure-deployment-input"
              }
            )
          ] }),
          /* @__PURE__ */ u3("div", { className: "space-y-2", children: [
            /* @__PURE__ */ u3("label", { htmlFor: "azure-api-version", className: "block text-sm font-medium text-gray-700", children: "API Version" }),
            /* @__PURE__ */ u3(
              "input",
              {
                id: "azure-api-version",
                type: "text",
                value: azureApiVersion,
                onChange: (e3) => {
                  setAzureApiVersion(e3.target.value);
                  markDirty();
                },
                placeholder: "2023-05-15",
                className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
                "data-testid": "azure-api-version-input"
              }
            )
          ] })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ u3("div", { className: "border-t pt-4", children: [
      /* @__PURE__ */ u3(
        "button",
        {
          onClick: handleSave,
          disabled: !isDirty2 || isSaving,
          className: "px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed",
          "data-testid": "save-button",
          children: isSaving ? "Saving..." : "Save Settings"
        }
      ),
      saveMessage && /* @__PURE__ */ u3(
        "div",
        {
          className: "mt-3 p-3 rounded bg-blue-50 border border-blue-200 text-blue-800",
          "data-testid": "save-message",
          children: saveMessage
        }
      ),
      /* @__PURE__ */ u3("p", { className: "mt-2 text-sm text-gray-500", children: "\u26A0\uFE0F Changing AI provider settings requires a restart to take effect" })
    ] })
  ] });
}

// src/ui/contracts/Settings.RestartBanner.contract.ts
var RestartBannerSettingsSchema = external_exports.object({
  // Initial visibility state
  initiallyVisible: external_exports.boolean().optional().default(false),
  // Reason for restart requirement
  initialReason: external_exports.string().optional().default("Settings changed"),
  // List of changed settings
  initialChangedSettings: external_exports.array(external_exports.string()).optional().default([])
});

// src/islands/RestartBannerIsland.tsx
function RestartBannerIsland(props) {
  const validated = RestartBannerSettingsSchema.parse(props);
  const [isVisible, setIsVisible] = d2(validated.initiallyVisible || false);
  const [reason, setReason] = d2(validated.initialReason || "Settings changed");
  const [changedSettings, setChangedSettings] = d2(validated.initialChangedSettings || []);
  y2(() => {
    const handleRestartRequired = (event) => {
      const detail = event.detail;
      setIsVisible(true);
      setReason(detail.reason || "Settings changed");
      if (detail.settings && Array.isArray(detail.settings)) {
        setChangedSettings((prev) => {
          const additions = detail.settings || [];
          const combined = [...prev, ...additions];
          return Array.from(new Set(combined));
        });
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("settings:restart-required", handleRestartRequired);
    }
    return () => {
      if (typeof document !== "undefined") {
        document.removeEventListener("settings:restart-required", handleRestartRequired);
      }
    };
  }, []);
  const handleDismiss = () => {
    setIsVisible(false);
    setChangedSettings([]);
  };
  const handleRestart = async () => {
    try {
      const response = await fetch("/api/restart", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (response.ok) {
        setReason("Restarting...");
      }
    } catch (error) {
      console.error("Failed to trigger restart:", error);
    }
  };
  return /* @__PURE__ */ u3(
    "div",
    {
      className: `restart-banner ${isVisible ? "fixed top-0 left-0 right-0 z-50 bg-yellow-100 border-b-2 border-yellow-400 px-6 py-4 shadow-md" : "hidden"}`,
      "data-testid": "restart-banner-root",
      "data-visible": isVisible ? "true" : "false",
      children: !isVisible ? null : /* @__PURE__ */ u3("div", { className: "flex items-center justify-between max-w-7xl mx-auto", children: [
        /* @__PURE__ */ u3("div", { className: "flex items-center space-x-4", children: [
          /* @__PURE__ */ u3("div", { className: "flex-shrink-0", children: /* @__PURE__ */ u3(
            "svg",
            {
              className: "h-6 w-6 text-yellow-600",
              fill: "none",
              viewBox: "0 0 24 24",
              stroke: "currentColor",
              "data-testid": "warning-icon",
              children: /* @__PURE__ */ u3(
                "path",
                {
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                  strokeWidth: 2,
                  d: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                }
              )
            }
          ) }),
          /* @__PURE__ */ u3("div", { children: [
            /* @__PURE__ */ u3("p", { className: "text-sm font-medium text-yellow-800", "data-testid": "restart-message", children: [
              /* @__PURE__ */ u3("span", { className: "font-semibold", children: "Restart Required:" }),
              " ",
              reason
            ] }),
            changedSettings.length > 0 && /* @__PURE__ */ u3("p", { className: "text-xs text-yellow-700 mt-1", "data-testid": "changed-settings", children: [
              "Changed: ",
              changedSettings.join(", ")
            ] })
          ] })
        ] }),
        /* @__PURE__ */ u3("div", { className: "flex items-center space-x-3", children: [
          /* @__PURE__ */ u3(
            "button",
            {
              onClick: handleRestart,
              className: "px-4 py-2 bg-yellow-600 text-white text-sm font-medium rounded hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500",
              "data-testid": "restart-button",
              children: "Restart Now"
            }
          ),
          /* @__PURE__ */ u3(
            "button",
            {
              onClick: handleDismiss,
              className: "px-3 py-2 text-yellow-700 hover:text-yellow-900 focus:outline-none",
              "data-testid": "dismiss-button",
              "aria-label": "Dismiss",
              children: /* @__PURE__ */ u3("svg", { className: "h-5 w-5", fill: "currentColor", viewBox: "0 0 20 20", children: /* @__PURE__ */ u3(
                "path",
                {
                  fillRule: "evenodd",
                  d: "M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z",
                  clipRule: "evenodd"
                }
              ) })
            }
          )
        ] })
      ] })
    }
  );
}

// src/ui/contracts/Settings.Developer.contract.ts
var FeatureFlagsSchema = external_exports.object({
  // Expert pipeline
  expertPipelineEnabled: external_exports.boolean().optional().default(true),
  // Visual RAG
  visualRagEnabled: external_exports.boolean().optional().default(false),
  visualRagSidecarEnabled: external_exports.boolean().optional().default(false),
  forceVisualRag: external_exports.boolean().optional().default(false),
  // Guidance service
  guidanceServiceEnabled: external_exports.boolean().optional().default(true),
  // Metrics
  metricsEnabled: external_exports.boolean().optional().default(true),
  // Duplicate detection
  duplicateDetectionEnabled: external_exports.boolean().optional().default(true),
  // OCR checkpoint
  ocrCheckpointEnabled: external_exports.boolean().optional().default(true),
  // Summary fallback
  summaryFallbackEnabled: external_exports.boolean().optional().default(true)
});
var EnvironmentVariablesSchema = external_exports.object({
  // Processing
  disableAutomaticProcessing: external_exports.string().optional().default("no"),
  scanInterval: external_exports.string().optional().default("*/30 * * * *"),
  // Token limits
  tokenLimit: external_exports.number().int().positive().optional().default(128e3),
  responseTokens: external_exports.number().int().positive().optional().default(4096),
  // Visual RAG settings
  textQualityThreshold: external_exports.number().int().min(0).max(100).optional().default(60),
  maxVisionPages: external_exports.number().int().positive().optional().default(4),
  // Timeouts
  guidanceTimeout: external_exports.number().int().positive().optional().default(9e4),
  visualRagTimeout: external_exports.number().int().positive().optional().default(3e4)
});
var DeveloperSettingsSchema = external_exports.object({
  // Feature flags (auto-save, most don't require restart)
  featureFlags: FeatureFlagsSchema.optional(),
  // Environment variables (manual save, restart required)
  environmentVariables: EnvironmentVariablesSchema.optional(),
  // Auto-save debounce for feature flags (ms)
  autoSaveDebounceMs: external_exports.number().int().positive().optional().default(500)
});

// src/islands/DeveloperSettingsIsland.tsx
var STORAGE_KEY_DEVELOPER_MODE2 = "settings:developerMode";
function DeveloperSettingsIsland(props) {
  const validated = DeveloperSettingsSchema.parse(props);
  const initialDeveloperMode = (() => {
    if (typeof localStorage === "undefined") return false;
    const stored = localStorage.getItem(STORAGE_KEY_DEVELOPER_MODE2);
    return stored === "true";
  })();
  const [isDeveloperMode, setIsDeveloperMode] = d2(initialDeveloperMode);
  const [featureFlagsExpanded, setFeatureFlagsExpanded] = d2(true);
  const [envVarsExpanded, setEnvVarsExpanded] = d2(false);
  const [runtimeStateExpanded, setRuntimeStateExpanded] = d2(false);
  const [expertPipeline, setExpertPipeline] = d2(validated.featureFlags?.expertPipelineEnabled ?? true);
  const [visualRag, setVisualRag] = d2(validated.featureFlags?.visualRagEnabled ?? false);
  const [visualRagSidecar, setVisualRagSidecar] = d2(validated.featureFlags?.visualRagSidecarEnabled ?? false);
  const [forceVisualRag, setForceVisualRag] = d2(validated.featureFlags?.forceVisualRag ?? false);
  const [guidanceService, setGuidanceService] = d2(validated.featureFlags?.guidanceServiceEnabled ?? true);
  const [metrics, setMetrics] = d2(validated.featureFlags?.metricsEnabled ?? true);
  const [duplicateDetection, setDuplicateDetection] = d2(validated.featureFlags?.duplicateDetectionEnabled ?? true);
  const [ocrCheckpoint, setOcrCheckpoint] = d2(validated.featureFlags?.ocrCheckpointEnabled ?? true);
  const [summaryFallback, setSummaryFallback] = d2(validated.featureFlags?.summaryFallbackEnabled ?? true);
  const [disableAutoProcessing, setDisableAutoProcessing] = d2(validated.environmentVariables?.disableAutomaticProcessing || "no");
  const [scanInterval, setScanInterval] = d2(validated.environmentVariables?.scanInterval || "*/30 * * * *");
  const [tokenLimit, setTokenLimit] = d2(validated.environmentVariables?.tokenLimit || 128e3);
  const [responseTokens, setResponseTokens] = d2(validated.environmentVariables?.responseTokens || 4096);
  const [textQualityThreshold, setTextQualityThreshold] = d2(validated.environmentVariables?.textQualityThreshold || 60);
  const [maxVisionPages, setMaxVisionPages] = d2(validated.environmentVariables?.maxVisionPages || 4);
  const [guidanceTimeout, setGuidanceTimeout] = d2(validated.environmentVariables?.guidanceTimeout || 9e4);
  const [visualRagTimeout, setVisualRagTimeout] = d2(validated.environmentVariables?.visualRagTimeout || 3e4);
  const [isDirty2, setIsDirty] = d2(false);
  const [isSaving, setIsSaving] = d2(false);
  const [saveMessage, setSaveMessage] = d2(null);
  const [runtimeState, setRuntimeState] = d2(null);
  const [isLoadingRuntimeState, setIsLoadingRuntimeState] = d2(false);
  const [runtimeStateError, setRuntimeStateError] = d2(null);
  const debounceTimerRef = A2(null);
  const refreshIntervalRef = A2(null);
  y2(() => {
    const handleDeveloperToggle = (event) => {
      const enabled = event.detail?.enabled ?? false;
      setIsDeveloperMode(enabled);
      if (!enabled) {
        setFeatureFlagsExpanded(false);
        setEnvVarsExpanded(false);
        setRuntimeStateExpanded(false);
      }
    };
    document.addEventListener("developer:toggled", handleDeveloperToggle);
    return () => {
      document.removeEventListener("developer:toggled", handleDeveloperToggle);
    };
  }, []);
  y2(() => {
    if (saveMessage) {
      const timer = setTimeout(() => setSaveMessage(null), 3e3);
      return () => clearTimeout(timer);
    }
  }, [saveMessage]);
  const fetchRuntimeState = async () => {
    setIsLoadingRuntimeState(true);
    setRuntimeStateError(null);
    try {
      const response = await fetch("/api/runtime/state");
      if (response.ok) {
        const data = await response.json();
        setRuntimeState(data);
      } else {
        setRuntimeStateError("Failed to fetch runtime state");
      }
    } catch (error) {
      setRuntimeStateError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsLoadingRuntimeState(false);
    }
  };
  y2(() => {
    if (runtimeStateExpanded) {
      fetchRuntimeState();
      refreshIntervalRef.current = setInterval(() => {
        fetchRuntimeState();
      }, 1e4);
    } else {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    }
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [runtimeStateExpanded]);
  const handleFeatureFlagChange = async (flagName, value) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const settings = {};
        switch (flagName) {
          case "expertPipelineEnabled":
            settings.EXPERT_PIPELINE_ENABLED = value ? "yes" : "no";
            break;
          case "visualRagEnabled":
            settings.ENABLE_VISUAL_RAG = value ? "yes" : "no";
            break;
          case "visualRagSidecarEnabled":
            settings.ENABLE_VISUAL_RAG_SIDECAR = value ? "yes" : "no";
            break;
          case "forceVisualRag":
            settings.FORCE_VISUAL_RAG = value ? "yes" : "no";
            break;
          case "guidanceServiceEnabled":
            settings.GUIDANCE_SERVICE_ENABLED = value ? "yes" : "no";
            break;
          case "metricsEnabled":
            settings.ENABLE_MODEL_METRICS = value ? "yes" : "no";
            break;
          case "duplicateDetectionEnabled":
            settings.DUPLICATE_DETECTION_ENABLED = value ? "yes" : "no";
            break;
          case "ocrCheckpointEnabled":
            settings.OCR_CHECKPOINT_ENABLED = value ? "yes" : "no";
            break;
          case "summaryFallbackEnabled":
            settings.SUMMARY_FALLBACK_ENABLED = value ? "yes" : "no";
            break;
        }
        const response = await fetch("/settings/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: "developer-feature-flags",
            settings,
            requiresRestart: false
            // Most feature flags don't require restart
          })
        });
        if (response.ok) {
          if (typeof document !== "undefined") {
            document.dispatchEvent(new CustomEvent("settings:changed", {
              detail: {
                type: "settings:changed",
                category: "developer-feature-flags",
                settings,
                requiresRestart: false
              }
            }));
          }
        }
      } catch (error) {
        console.error("Feature flag auto-save failed:", error);
      }
    }, validated.autoSaveDebounceMs || 500);
  };
  const handleSaveEnvVars = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const settings = {
        DISABLE_AUTOMATIC_PROCESSING: disableAutoProcessing,
        SCAN_INTERVAL: scanInterval,
        TOKEN_LIMIT: tokenLimit.toString(),
        RESPONSE_TOKENS: responseTokens.toString(),
        TEXT_QUALITY_THRESHOLD: textQualityThreshold.toString(),
        MAX_VISION_PAGES: maxVisionPages.toString(),
        GUIDANCE_TIMEOUT: guidanceTimeout.toString(),
        VISUAL_RAG_TIMEOUT: visualRagTimeout.toString()
      };
      const response = await fetch("/settings/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "developer-env-vars",
          settings,
          requiresRestart: true
          // Environment variables require restart
        })
      });
      const result = await response.json();
      if (response.ok && result.success) {
        setSaveMessage("Environment variables saved successfully");
        setIsDirty(false);
        if (typeof document !== "undefined") {
          document.dispatchEvent(new CustomEvent("settings:changed", {
            detail: {
              type: "settings:changed",
              category: "developer-env-vars",
              settings,
              requiresRestart: true
            }
          }));
          document.dispatchEvent(new CustomEvent("settings:restart-required", {
            detail: {
              type: "settings:restart-required",
              reason: "Developer environment variables changed",
              settings: ["Environment Variables"]
            }
          }));
          document.dispatchEvent(new CustomEvent("settings:saved", {
            detail: {
              type: "settings:saved",
              category: "developer-env-vars",
              success: true,
              message: "Environment variables saved successfully"
            }
          }));
        }
      } else {
        setSaveMessage(`Save failed: ${result.message || result.error || "Unknown error"}`);
      }
    } catch (error) {
      setSaveMessage(`Save failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSaving(false);
    }
  };
  const markDirty = () => setIsDirty(true);
  if (!isDeveloperMode) {
    return null;
  }
  return /* @__PURE__ */ u3("div", { className: "developer-settings space-y-6 p-6 max-w-4xl", "data-testid": "developer-settings-root", children: [
    /* @__PURE__ */ u3("div", { className: "space-y-2", children: [
      /* @__PURE__ */ u3("h2", { className: "text-2xl font-bold", children: "Developer Settings" }),
      /* @__PURE__ */ u3("p", { className: "text-gray-600", children: "Advanced configuration for developers and power users" }),
      /* @__PURE__ */ u3("p", { className: "text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2", "data-testid": "developer-warning", children: "\u26A0\uFE0F Warning: These settings can affect system behavior. Only modify if you understand the implications." })
    ] }),
    /* @__PURE__ */ u3("div", { className: "border rounded-lg", children: [
      /* @__PURE__ */ u3(
        "button",
        {
          onClick: () => setFeatureFlagsExpanded(!featureFlagsExpanded),
          className: "w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-t-lg",
          "data-testid": "feature-flags-header",
          children: [
            /* @__PURE__ */ u3("div", { className: "flex items-center space-x-2", children: [
              /* @__PURE__ */ u3("h3", { className: "text-lg font-semibold", children: "Feature Flags" }),
              /* @__PURE__ */ u3("span", { className: "text-xs text-gray-500 italic", "data-testid": "feature-flags-indicator", children: "Auto-saves on change" })
            ] }),
            /* @__PURE__ */ u3(
              "svg",
              {
                className: `w-5 h-5 transition-transform ${featureFlagsExpanded ? "rotate-180" : ""}`,
                fill: "none",
                viewBox: "0 0 24 24",
                stroke: "currentColor",
                children: /* @__PURE__ */ u3("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 9l-7 7-7-7" })
              }
            )
          ]
        }
      ),
      featureFlagsExpanded && /* @__PURE__ */ u3("div", { className: "p-4 space-y-4", "data-testid": "feature-flags-content", children: /* @__PURE__ */ u3("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [
        /* @__PURE__ */ u3("div", { className: "flex items-center justify-between p-3 border rounded", children: [
          /* @__PURE__ */ u3("div", { children: [
            /* @__PURE__ */ u3("label", { htmlFor: "flag-expert-pipeline", className: "block text-sm font-medium text-gray-700", children: "Expert Pipeline" }),
            /* @__PURE__ */ u3("p", { className: "text-xs text-gray-500", children: "Enable domain-specific expert models" })
          ] }),
          /* @__PURE__ */ u3("label", { className: "relative inline-flex items-center cursor-pointer", children: [
            /* @__PURE__ */ u3(
              "input",
              {
                id: "flag-expert-pipeline",
                type: "checkbox",
                checked: expertPipeline,
                onChange: (e3) => {
                  const value = e3.target.checked;
                  setExpertPipeline(value);
                  handleFeatureFlagChange("expertPipelineEnabled", value);
                },
                className: "sr-only peer",
                "data-testid": "toggle-expertPipelineEnabled"
              }
            ),
            /* @__PURE__ */ u3("div", { className: "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" })
          ] })
        ] }),
        /* @__PURE__ */ u3("div", { className: "flex items-center justify-between p-3 border rounded", children: [
          /* @__PURE__ */ u3("div", { children: [
            /* @__PURE__ */ u3("label", { htmlFor: "flag-visual-rag", className: "block text-sm font-medium text-gray-700", children: "Visual RAG" }),
            /* @__PURE__ */ u3("p", { className: "text-xs text-gray-500", children: "Enable visual document analysis" })
          ] }),
          /* @__PURE__ */ u3("label", { className: "relative inline-flex items-center cursor-pointer", children: [
            /* @__PURE__ */ u3(
              "input",
              {
                id: "flag-visual-rag",
                type: "checkbox",
                checked: visualRag,
                onChange: (e3) => {
                  const value = e3.target.checked;
                  setVisualRag(value);
                  handleFeatureFlagChange("visualRagEnabled", value);
                },
                className: "sr-only peer",
                "data-testid": "toggle-visualRagEnabled"
              }
            ),
            /* @__PURE__ */ u3("div", { className: "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" })
          ] })
        ] }),
        /* @__PURE__ */ u3("div", { className: "flex items-center justify-between p-3 border rounded", children: [
          /* @__PURE__ */ u3("div", { children: [
            /* @__PURE__ */ u3("label", { htmlFor: "flag-visual-rag-sidecar", className: "block text-sm font-medium text-gray-700", children: "Visual RAG Sidecar" }),
            /* @__PURE__ */ u3("p", { className: "text-xs text-gray-500", children: "Use GPU-accelerated sidecar service" })
          ] }),
          /* @__PURE__ */ u3("label", { className: "relative inline-flex items-center cursor-pointer", children: [
            /* @__PURE__ */ u3(
              "input",
              {
                id: "flag-visual-rag-sidecar",
                type: "checkbox",
                checked: visualRagSidecar,
                onChange: (e3) => {
                  const value = e3.target.checked;
                  setVisualRagSidecar(value);
                  handleFeatureFlagChange("visualRagSidecarEnabled", value);
                },
                className: "sr-only peer",
                "data-testid": "toggle-visualRagSidecarEnabled"
              }
            ),
            /* @__PURE__ */ u3("div", { className: "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" })
          ] })
        ] }),
        /* @__PURE__ */ u3("div", { className: "flex items-center justify-between p-3 border rounded", children: [
          /* @__PURE__ */ u3("div", { children: [
            /* @__PURE__ */ u3("label", { htmlFor: "flag-force-visual-rag", className: "block text-sm font-medium text-gray-700", children: "Force Visual RAG" }),
            /* @__PURE__ */ u3("p", { className: "text-xs text-gray-500", children: "Always use visual analysis" })
          ] }),
          /* @__PURE__ */ u3("label", { className: "relative inline-flex items-center cursor-pointer", children: [
            /* @__PURE__ */ u3(
              "input",
              {
                id: "flag-force-visual-rag",
                type: "checkbox",
                checked: forceVisualRag,
                onChange: (e3) => {
                  const value = e3.target.checked;
                  setForceVisualRag(value);
                  handleFeatureFlagChange("forceVisualRag", value);
                },
                className: "sr-only peer",
                "data-testid": "toggle-forceVisualRag"
              }
            ),
            /* @__PURE__ */ u3("div", { className: "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" })
          ] })
        ] }),
        /* @__PURE__ */ u3("div", { className: "flex items-center justify-between p-3 border rounded", children: [
          /* @__PURE__ */ u3("div", { children: [
            /* @__PURE__ */ u3("label", { htmlFor: "flag-guidance", className: "block text-sm font-medium text-gray-700", children: "Guidance Service" }),
            /* @__PURE__ */ u3("p", { className: "text-xs text-gray-500", children: "Deterministic JSON extraction" })
          ] }),
          /* @__PURE__ */ u3("label", { className: "relative inline-flex items-center cursor-pointer", children: [
            /* @__PURE__ */ u3(
              "input",
              {
                id: "flag-guidance",
                type: "checkbox",
                checked: guidanceService,
                onChange: (e3) => {
                  const value = e3.target.checked;
                  setGuidanceService(value);
                  handleFeatureFlagChange("guidanceServiceEnabled", value);
                },
                className: "sr-only peer",
                "data-testid": "toggle-guidanceServiceEnabled"
              }
            ),
            /* @__PURE__ */ u3("div", { className: "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" })
          ] })
        ] }),
        /* @__PURE__ */ u3("div", { className: "flex items-center justify-between p-3 border rounded", children: [
          /* @__PURE__ */ u3("div", { children: [
            /* @__PURE__ */ u3("label", { htmlFor: "flag-metrics", className: "block text-sm font-medium text-gray-700", children: "Model Metrics" }),
            /* @__PURE__ */ u3("p", { className: "text-xs text-gray-500", children: "Track model performance metrics" })
          ] }),
          /* @__PURE__ */ u3("label", { className: "relative inline-flex items-center cursor-pointer", children: [
            /* @__PURE__ */ u3(
              "input",
              {
                id: "flag-metrics",
                type: "checkbox",
                checked: metrics,
                onChange: (e3) => {
                  const value = e3.target.checked;
                  setMetrics(value);
                  handleFeatureFlagChange("metricsEnabled", value);
                },
                className: "sr-only peer",
                "data-testid": "toggle-metricsEnabled"
              }
            ),
            /* @__PURE__ */ u3("div", { className: "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" })
          ] })
        ] }),
        /* @__PURE__ */ u3("div", { className: "flex items-center justify-between p-3 border rounded", children: [
          /* @__PURE__ */ u3("div", { children: [
            /* @__PURE__ */ u3("label", { htmlFor: "flag-duplicate-detection", className: "block text-sm font-medium text-gray-700", children: "Duplicate Detection" }),
            /* @__PURE__ */ u3("p", { className: "text-xs text-gray-500", children: "Prevent duplicate document processing" })
          ] }),
          /* @__PURE__ */ u3("label", { className: "relative inline-flex items-center cursor-pointer", children: [
            /* @__PURE__ */ u3(
              "input",
              {
                id: "flag-duplicate-detection",
                type: "checkbox",
                checked: duplicateDetection,
                onChange: (e3) => {
                  const value = e3.target.checked;
                  setDuplicateDetection(value);
                  handleFeatureFlagChange("duplicateDetectionEnabled", value);
                },
                className: "sr-only peer",
                "data-testid": "toggle-duplicateDetectionEnabled"
              }
            ),
            /* @__PURE__ */ u3("div", { className: "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" })
          ] })
        ] }),
        /* @__PURE__ */ u3("div", { className: "flex items-center justify-between p-3 border rounded", children: [
          /* @__PURE__ */ u3("div", { children: [
            /* @__PURE__ */ u3("label", { htmlFor: "flag-ocr-checkpoint", className: "block text-sm font-medium text-gray-700", children: "OCR Checkpoint" }),
            /* @__PURE__ */ u3("p", { className: "text-xs text-gray-500", children: "Checkpoint after OCR step" })
          ] }),
          /* @__PURE__ */ u3("label", { className: "relative inline-flex items-center cursor-pointer", children: [
            /* @__PURE__ */ u3(
              "input",
              {
                id: "flag-ocr-checkpoint",
                type: "checkbox",
                checked: ocrCheckpoint,
                onChange: (e3) => {
                  const value = e3.target.checked;
                  setOcrCheckpoint(value);
                  handleFeatureFlagChange("ocrCheckpointEnabled", value);
                },
                className: "sr-only peer",
                "data-testid": "toggle-ocrCheckpointEnabled"
              }
            ),
            /* @__PURE__ */ u3("div", { className: "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" })
          ] })
        ] }),
        /* @__PURE__ */ u3("div", { className: "flex items-center justify-between p-3 border rounded", children: [
          /* @__PURE__ */ u3("div", { children: [
            /* @__PURE__ */ u3("label", { htmlFor: "flag-summary-fallback", className: "block text-sm font-medium text-gray-700", children: "Summary Fallback" }),
            /* @__PURE__ */ u3("p", { className: "text-xs text-gray-500", children: "Use summary fallback on errors" })
          ] }),
          /* @__PURE__ */ u3("label", { className: "relative inline-flex items-center cursor-pointer", children: [
            /* @__PURE__ */ u3(
              "input",
              {
                id: "flag-summary-fallback",
                type: "checkbox",
                checked: summaryFallback,
                onChange: (e3) => {
                  const value = e3.target.checked;
                  setSummaryFallback(value);
                  handleFeatureFlagChange("summaryFallbackEnabled", value);
                },
                className: "sr-only peer",
                "data-testid": "toggle-summaryFallbackEnabled"
              }
            ),
            /* @__PURE__ */ u3("div", { className: "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" })
          ] })
        ] })
      ] }) })
    ] }),
    /* @__PURE__ */ u3("div", { className: "border rounded-lg", children: [
      /* @__PURE__ */ u3(
        "button",
        {
          onClick: () => setEnvVarsExpanded(!envVarsExpanded),
          className: "w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-t-lg",
          "data-testid": "env-vars-header",
          children: [
            /* @__PURE__ */ u3("div", { className: "flex items-center space-x-2", children: [
              /* @__PURE__ */ u3("h3", { className: "text-lg font-semibold", children: "Environment Variables" }),
              /* @__PURE__ */ u3("span", { className: "text-xs text-gray-500 italic", "data-testid": "env-vars-indicator", children: "Manual save required" })
            ] }),
            /* @__PURE__ */ u3(
              "svg",
              {
                className: `w-5 h-5 transition-transform ${envVarsExpanded ? "rotate-180" : ""}`,
                fill: "none",
                viewBox: "0 0 24 24",
                stroke: "currentColor",
                children: /* @__PURE__ */ u3("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 9l-7 7-7-7" })
              }
            )
          ]
        }
      ),
      envVarsExpanded && /* @__PURE__ */ u3("div", { className: "p-4 space-y-4", "data-testid": "env-vars-content", children: [
        /* @__PURE__ */ u3("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [
          /* @__PURE__ */ u3("div", { className: "space-y-2", children: [
            /* @__PURE__ */ u3("label", { htmlFor: "scan-interval", className: "block text-sm font-medium text-gray-700", children: "Scan Interval (cron)" }),
            /* @__PURE__ */ u3(
              "input",
              {
                id: "scan-interval",
                type: "text",
                value: scanInterval,
                onChange: (e3) => {
                  setScanInterval(e3.target.value);
                  markDirty();
                },
                placeholder: "*/30 * * * *",
                className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
                "data-testid": "scan-interval-input"
              }
            ),
            /* @__PURE__ */ u3("p", { className: "text-xs text-gray-500", children: "Cron expression for document scanning" })
          ] }),
          /* @__PURE__ */ u3("div", { className: "space-y-2", children: [
            /* @__PURE__ */ u3("label", { htmlFor: "token-limit", className: "block text-sm font-medium text-gray-700", children: "Token Limit" }),
            /* @__PURE__ */ u3(
              "input",
              {
                id: "token-limit",
                type: "number",
                value: tokenLimit,
                onChange: (e3) => {
                  setTokenLimit(parseInt(e3.target.value));
                  markDirty();
                },
                className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
                "data-testid": "token-limit-input"
              }
            ),
            /* @__PURE__ */ u3("p", { className: "text-xs text-gray-500", children: "Maximum context window size" })
          ] }),
          /* @__PURE__ */ u3("div", { className: "space-y-2", children: [
            /* @__PURE__ */ u3("label", { htmlFor: "response-tokens", className: "block text-sm font-medium text-gray-700", children: "Response Tokens" }),
            /* @__PURE__ */ u3(
              "input",
              {
                id: "response-tokens",
                type: "number",
                value: responseTokens,
                onChange: (e3) => {
                  setResponseTokens(parseInt(e3.target.value));
                  markDirty();
                },
                className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
                "data-testid": "response-tokens-input"
              }
            ),
            /* @__PURE__ */ u3("p", { className: "text-xs text-gray-500", children: "Maximum response length" })
          ] }),
          /* @__PURE__ */ u3("div", { className: "space-y-2", children: [
            /* @__PURE__ */ u3("label", { htmlFor: "text-quality", className: "block text-sm font-medium text-gray-700", children: "Text Quality Threshold (%)" }),
            /* @__PURE__ */ u3(
              "input",
              {
                id: "text-quality",
                type: "number",
                min: "0",
                max: "100",
                value: textQualityThreshold,
                onChange: (e3) => {
                  setTextQualityThreshold(parseInt(e3.target.value));
                  markDirty();
                },
                className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
                "data-testid": "text-quality-threshold-input"
              }
            ),
            /* @__PURE__ */ u3("p", { className: "text-xs text-gray-500", children: "Minimum OCR quality for text extraction" })
          ] }),
          /* @__PURE__ */ u3("div", { className: "space-y-2", children: [
            /* @__PURE__ */ u3("label", { htmlFor: "max-vision-pages", className: "block text-sm font-medium text-gray-700", children: "Max Vision Pages" }),
            /* @__PURE__ */ u3(
              "input",
              {
                id: "max-vision-pages",
                type: "number",
                min: "1",
                value: maxVisionPages,
                onChange: (e3) => {
                  setMaxVisionPages(parseInt(e3.target.value));
                  markDirty();
                },
                className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
                "data-testid": "max-vision-pages-input"
              }
            ),
            /* @__PURE__ */ u3("p", { className: "text-xs text-gray-500", children: "Maximum pages for visual analysis" })
          ] }),
          /* @__PURE__ */ u3("div", { className: "space-y-2", children: [
            /* @__PURE__ */ u3("label", { htmlFor: "guidance-timeout", className: "block text-sm font-medium text-gray-700", children: "Guidance Timeout (ms)" }),
            /* @__PURE__ */ u3(
              "input",
              {
                id: "guidance-timeout",
                type: "number",
                min: "1000",
                value: guidanceTimeout,
                onChange: (e3) => {
                  setGuidanceTimeout(parseInt(e3.target.value));
                  markDirty();
                },
                className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
                "data-testid": "guidance-timeout-input"
              }
            ),
            /* @__PURE__ */ u3("p", { className: "text-xs text-gray-500", children: "Timeout for guidance service calls" })
          ] }),
          /* @__PURE__ */ u3("div", { className: "space-y-2", children: [
            /* @__PURE__ */ u3("label", { htmlFor: "visual-rag-timeout", className: "block text-sm font-medium text-gray-700", children: "Visual RAG Timeout (ms)" }),
            /* @__PURE__ */ u3(
              "input",
              {
                id: "visual-rag-timeout",
                type: "number",
                min: "1000",
                value: visualRagTimeout,
                onChange: (e3) => {
                  setVisualRagTimeout(parseInt(e3.target.value));
                  markDirty();
                },
                className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
                "data-testid": "visual-rag-timeout-input"
              }
            ),
            /* @__PURE__ */ u3("p", { className: "text-xs text-gray-500", children: "Timeout for visual RAG service calls" })
          ] })
        ] }),
        /* @__PURE__ */ u3("div", { className: "border-t pt-4", children: [
          /* @__PURE__ */ u3(
            "button",
            {
              onClick: handleSaveEnvVars,
              disabled: !isDirty2 || isSaving,
              className: "px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed",
              "data-testid": "save-env-vars-button",
              children: isSaving ? "Saving..." : "Save Environment Variables"
            }
          ),
          saveMessage && /* @__PURE__ */ u3(
            "div",
            {
              className: "mt-3 p-3 rounded bg-blue-50 border border-blue-200 text-blue-800",
              "data-testid": "save-message",
              children: saveMessage
            }
          ),
          /* @__PURE__ */ u3("p", { className: "mt-2 text-sm text-gray-500", children: "\u26A0\uFE0F Changing environment variables requires a restart to take effect" })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ u3("div", { className: "border rounded-lg", children: [
      /* @__PURE__ */ u3(
        "button",
        {
          onClick: () => setRuntimeStateExpanded(!runtimeStateExpanded),
          className: "w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-t-lg",
          "data-testid": "runtime-state-header",
          children: [
            /* @__PURE__ */ u3("div", { className: "flex items-center space-x-2", children: [
              /* @__PURE__ */ u3("h3", { className: "text-lg font-semibold", children: "Runtime State" }),
              /* @__PURE__ */ u3("span", { className: "text-xs text-gray-500 italic", children: "Read-only, auto-refreshes" })
            ] }),
            /* @__PURE__ */ u3(
              "svg",
              {
                className: `w-5 h-5 transition-transform ${runtimeStateExpanded ? "rotate-180" : ""}`,
                fill: "none",
                viewBox: "0 0 24 24",
                stroke: "currentColor",
                children: /* @__PURE__ */ u3("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 9l-7 7-7-7" })
              }
            )
          ]
        }
      ),
      runtimeStateExpanded && /* @__PURE__ */ u3("div", { className: "p-4 space-y-4", "data-testid": "runtime-state-content", children: [
        /* @__PURE__ */ u3("div", { className: "flex items-center justify-between mb-4", children: [
          /* @__PURE__ */ u3("p", { className: "text-sm text-gray-600", children: "Auto-refreshes every 10 seconds" }),
          /* @__PURE__ */ u3(
            "button",
            {
              onClick: fetchRuntimeState,
              disabled: isLoadingRuntimeState,
              className: "px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed",
              "data-testid": "refresh-runtime-state-button",
              children: isLoadingRuntimeState ? "Refreshing..." : "Refresh Now"
            }
          )
        ] }),
        runtimeStateError && /* @__PURE__ */ u3("div", { className: "p-3 bg-red-50 border border-red-200 rounded text-red-800", "data-testid": "runtime-state-error", children: [
          "Error: ",
          runtimeStateError
        ] }),
        runtimeState && /* @__PURE__ */ u3("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [
          runtimeState.circuitBreaker && /* @__PURE__ */ u3("div", { className: "p-3 border rounded", "data-testid": "circuit-breaker-status", children: [
            /* @__PURE__ */ u3("h4", { className: "text-sm font-semibold text-gray-700 mb-2", children: "Circuit Breaker" }),
            /* @__PURE__ */ u3("div", { className: "space-y-1 text-sm", children: [
              /* @__PURE__ */ u3("div", { className: "flex justify-between", children: [
                /* @__PURE__ */ u3("span", { className: "text-gray-600", children: "State:" }),
                /* @__PURE__ */ u3("span", { className: `font-medium ${runtimeState.circuitBreaker.state === "CLOSED" ? "text-green-600" : "text-red-600"}`, children: runtimeState.circuitBreaker.state })
              ] }),
              /* @__PURE__ */ u3("div", { className: "flex justify-between", children: [
                /* @__PURE__ */ u3("span", { className: "text-gray-600", children: "Failures:" }),
                /* @__PURE__ */ u3("span", { children: runtimeState.circuitBreaker.failures || 0 })
              ] }),
              /* @__PURE__ */ u3("div", { className: "flex justify-between", children: [
                /* @__PURE__ */ u3("span", { className: "text-gray-600", children: "Successes:" }),
                /* @__PURE__ */ u3("span", { children: runtimeState.circuitBreaker.successes || 0 })
              ] })
            ] })
          ] }),
          runtimeState.vram && /* @__PURE__ */ u3("div", { className: "p-3 border rounded", "data-testid": "vram-status", children: [
            /* @__PURE__ */ u3("h4", { className: "text-sm font-semibold text-gray-700 mb-2", children: "VRAM Usage" }),
            /* @__PURE__ */ u3("div", { className: "space-y-1 text-sm", children: [
              /* @__PURE__ */ u3("div", { className: "flex justify-between", children: [
                /* @__PURE__ */ u3("span", { className: "text-gray-600", children: "Used:" }),
                /* @__PURE__ */ u3("span", { children: runtimeState.vram.used || "N/A" })
              ] }),
              /* @__PURE__ */ u3("div", { className: "flex justify-between", children: [
                /* @__PURE__ */ u3("span", { className: "text-gray-600", children: "Total:" }),
                /* @__PURE__ */ u3("span", { children: runtimeState.vram.total || "N/A" })
              ] }),
              /* @__PURE__ */ u3("div", { className: "flex justify-between", children: [
                /* @__PURE__ */ u3("span", { className: "text-gray-600", children: "Utilization:" }),
                /* @__PURE__ */ u3("span", { className: `font-medium ${(runtimeState.vram.utilization || 0) > 80 ? "text-red-600" : "text-green-600"}`, children: [
                  runtimeState.vram.utilization || 0,
                  "%"
                ] })
              ] })
            ] })
          ] }),
          runtimeState.qdrant && /* @__PURE__ */ u3("div", { className: "p-3 border rounded", "data-testid": "qdrant-status", children: [
            /* @__PURE__ */ u3("h4", { className: "text-sm font-semibold text-gray-700 mb-2", children: "Qdrant Vector Store" }),
            /* @__PURE__ */ u3("div", { className: "space-y-1 text-sm", children: [
              /* @__PURE__ */ u3("div", { className: "flex justify-between", children: [
                /* @__PURE__ */ u3("span", { className: "text-gray-600", children: "Status:" }),
                /* @__PURE__ */ u3("span", { className: `font-medium ${runtimeState.qdrant.connected ? "text-green-600" : "text-red-600"}`, children: runtimeState.qdrant.connected ? "Connected" : "Disconnected" })
              ] }),
              /* @__PURE__ */ u3("div", { className: "flex justify-between", children: [
                /* @__PURE__ */ u3("span", { className: "text-gray-600", children: "Collections:" }),
                /* @__PURE__ */ u3("span", { children: runtimeState.qdrant.collections || 0 })
              ] }),
              /* @__PURE__ */ u3("div", { className: "flex justify-between", children: [
                /* @__PURE__ */ u3("span", { className: "text-gray-600", children: "Documents:" }),
                /* @__PURE__ */ u3("span", { children: runtimeState.qdrant.documents || 0 })
              ] })
            ] })
          ] }),
          runtimeState.sidecars && /* @__PURE__ */ u3("div", { className: "p-3 border rounded", "data-testid": "sidecar-status", children: [
            /* @__PURE__ */ u3("h4", { className: "text-sm font-semibold text-gray-700 mb-2", children: "AI Sidecars" }),
            /* @__PURE__ */ u3("div", { className: "space-y-1 text-sm", children: [
              /* @__PURE__ */ u3("div", { className: "flex justify-between", children: [
                /* @__PURE__ */ u3("span", { className: "text-gray-600", children: "Visual RAG:" }),
                /* @__PURE__ */ u3("span", { className: `font-medium ${runtimeState.sidecars.visualRag ? "text-green-600" : "text-gray-400"}`, children: runtimeState.sidecars.visualRag ? "Running" : "Offline" })
              ] }),
              /* @__PURE__ */ u3("div", { className: "flex justify-between", children: [
                /* @__PURE__ */ u3("span", { className: "text-gray-600", children: "Guidance:" }),
                /* @__PURE__ */ u3("span", { className: `font-medium ${runtimeState.sidecars.guidance ? "text-green-600" : "text-gray-400"}`, children: runtimeState.sidecars.guidance ? "Running" : "Offline" })
              ] }),
              /* @__PURE__ */ u3("div", { className: "flex justify-between", children: [
                /* @__PURE__ */ u3("span", { className: "text-gray-600", children: "Bias Engine:" }),
                /* @__PURE__ */ u3("span", { className: `font-medium ${runtimeState.sidecars.biasEngine ? "text-green-600" : "text-gray-400"}`, children: runtimeState.sidecars.biasEngine ? "Running" : "Offline" })
              ] })
            ] })
          ] }),
          runtimeState.backgroundSync && /* @__PURE__ */ u3("div", { className: "p-3 border rounded col-span-full", "data-testid": "background-sync-status", children: [
            /* @__PURE__ */ u3("h4", { className: "text-sm font-semibold text-gray-700 mb-2", children: "Background Sync" }),
            /* @__PURE__ */ u3("div", { className: "grid grid-cols-2 gap-x-4 gap-y-1 text-sm", children: [
              /* @__PURE__ */ u3("div", { className: "flex justify-between", children: [
                /* @__PURE__ */ u3("span", { className: "text-gray-600", children: "Last Sync:" }),
                /* @__PURE__ */ u3("span", { children: runtimeState.backgroundSync.lastSync || "Never" })
              ] }),
              /* @__PURE__ */ u3("div", { className: "flex justify-between", children: [
                /* @__PURE__ */ u3("span", { className: "text-gray-600", children: "Next Sync:" }),
                /* @__PURE__ */ u3("span", { children: runtimeState.backgroundSync.nextSync || "Not scheduled" })
              ] }),
              /* @__PURE__ */ u3("div", { className: "flex justify-between", children: [
                /* @__PURE__ */ u3("span", { className: "text-gray-600", children: "Status:" }),
                /* @__PURE__ */ u3("span", { className: `font-medium ${runtimeState.backgroundSync.running ? "text-blue-600" : "text-gray-600"}`, children: runtimeState.backgroundSync.running ? "Running" : "Idle" })
              ] }),
              /* @__PURE__ */ u3("div", { className: "flex justify-between", children: [
                /* @__PURE__ */ u3("span", { className: "text-gray-600", children: "Documents Processed:" }),
                /* @__PURE__ */ u3("span", { children: runtimeState.backgroundSync.documentsProcessed || 0 })
              ] })
            ] })
          ] })
        ] }),
        isLoadingRuntimeState && !runtimeState && /* @__PURE__ */ u3("div", { className: "text-center py-8 text-gray-500", "data-testid": "runtime-state-loading", children: "Loading runtime state..." })
      ] })
    ] })
  ] });
}

// src/ui/contracts/Settings.Presets.contract.ts
var PresetMetadataSchema = external_exports.object({
  name: external_exports.string(),
  displayName: external_exports.string(),
  description: external_exports.string(),
  category: external_exports.enum(["development", "production", "medical", "financial", "legal", "custom"]).optional(),
  icon: external_exports.string().optional()
});
var PresetDiffItemSchema = external_exports.object({
  key: external_exports.string(),
  currentValue: external_exports.any().optional(),
  newValue: external_exports.any(),
  category: external_exports.string().optional()
});
var PresetDiffSchema = external_exports.object({
  presetName: external_exports.string(),
  changes: external_exports.array(PresetDiffItemSchema),
  requiresRestart: external_exports.boolean()
});
var PresetsManagerSettingsSchema = external_exports.object({
  // Initial state
  isOpen: external_exports.boolean().optional().default(false),
  presetName: external_exports.string().optional()
});

// src/islands/PresetsManagerIsland.tsx
function PresetsManagerIsland(props) {
  const validated = PresetsManagerSettingsSchema.parse(props);
  const [isOpen, setIsOpen] = d2(validated.isOpen || false);
  const [presets, setPresets] = d2([]);
  const [isLoading, setIsLoading] = d2(false);
  const [error, setError] = d2(null);
  const [selectedPreset, setSelectedPreset] = d2(null);
  const [presetDiff, setPresetDiff] = d2(null);
  const [isApplying, setIsApplying] = d2(false);
  const [isImportMode, setIsImportMode] = d2(false);
  const [selectedFile, setSelectedFile] = d2(null);
  const fileInputRef = A2(null);
  y2(() => {
    if (isOpen) {
      fetchPresets();
    }
  }, [isOpen]);
  y2(() => {
    const handlePresetOpen = () => {
      setIsOpen(true);
    };
    document.addEventListener("preset:open", handlePresetOpen);
    return () => {
      document.removeEventListener("preset:open", handlePresetOpen);
    };
  }, []);
  const fetchPresets = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/settings/presets");
      if (response.ok) {
        const data = await response.json();
        setPresets(data.presets || []);
      } else {
        setError("Failed to load presets");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };
  const handleSelectPreset = async (presetName) => {
    setSelectedPreset(presetName);
    setError(null);
    try {
      const response = await fetch(`/settings/presets/${presetName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preview: true })
      });
      if (response.ok) {
        const data = await response.json();
        setPresetDiff(data.diff);
      } else {
        setError("Failed to load preset diff");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  };
  const handleApplyPreset = async () => {
    if (!selectedPreset) return;
    setIsApplying(true);
    setError(null);
    try {
      const response = await fetch(`/settings/presets/${selectedPreset}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preview: false })
      });
      if (response.ok) {
        const data = await response.json();
        if (typeof document !== "undefined") {
          document.dispatchEvent(new CustomEvent("preset:loaded", {
            detail: {
              presetName: selectedPreset,
              requiresRestart: data.requiresRestart || false
            }
          }));
          document.dispatchEvent(new CustomEvent("settings:saved", {
            detail: {
              type: "settings:saved",
              category: "preset",
              success: true,
              message: `Preset "${selectedPreset}" applied successfully`
            }
          }));
          if (data.requiresRestart) {
            document.dispatchEvent(new CustomEvent("settings:restart-required", {
              detail: {
                type: "settings:restart-required",
                reason: `Preset "${selectedPreset}" applied`,
                settings: ["Preset"]
              }
            }));
          }
        }
        handleClose();
      } else {
        setError("Failed to apply preset");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsApplying(false);
    }
  };
  const handleClose = () => {
    setIsOpen(false);
    setSelectedPreset(null);
    setPresetDiff(null);
    setError(null);
    setIsImportMode(false);
    setSelectedFile(null);
  };
  const handleCancelDiff = () => {
    setSelectedPreset(null);
    setPresetDiff(null);
    setError(null);
    setIsImportMode(false);
    setSelectedFile(null);
  };
  const handleExport = () => {
    window.location.href = "/settings/export";
  };
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };
  const handleFileSelect = async (event) => {
    const target = event.target;
    const file = target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".env")) {
      setError("Please select a .env file");
      return;
    }
    setSelectedFile(file);
    setIsImportMode(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("preview", "true");
    try {
      const response = await fetch("/settings/import", {
        method: "POST",
        body: formData
      });
      if (response.ok) {
        const data = await response.json();
        setPresetDiff(data.diff);
      } else {
        const errorData = await response.json();
        if (errorData.details) {
          setError(`Invalid .env file:
${errorData.details.join("\n")}`);
        } else {
          setError(errorData.error || "Failed to import settings");
        }
        setIsImportMode(false);
        setSelectedFile(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setIsImportMode(false);
      setSelectedFile(null);
    }
    target.value = "";
  };
  const handleApplyImport = async () => {
    if (!selectedFile) return;
    setIsApplying(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("preview", "false");
    try {
      const response = await fetch("/settings/import", {
        method: "POST",
        body: formData
      });
      if (response.ok) {
        const data = await response.json();
        if (typeof document !== "undefined") {
          document.dispatchEvent(new CustomEvent("settings:saved", {
            detail: {
              type: "settings:saved",
              category: "import",
              success: true,
              message: `Settings imported successfully (${data.changesCount} changes)`
            }
          }));
          if (data.requiresRestart) {
            document.dispatchEvent(new CustomEvent("settings:restart-required", {
              detail: {
                type: "settings:restart-required",
                reason: "Settings imported",
                settings: ["Import"]
              }
            }));
          }
        }
        handleClose();
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to import settings");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsApplying(false);
    }
  };
  if (!isOpen) {
    return null;
  }
  return /* @__PURE__ */ u3("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50", "data-testid": "presets-modal", children: /* @__PURE__ */ u3("div", { className: "bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden", "data-testid": "presets-modal-content", children: [
    /* @__PURE__ */ u3("div", { className: "flex items-center justify-between p-6 border-b", children: [
      /* @__PURE__ */ u3("div", { children: [
        /* @__PURE__ */ u3("h2", { className: "text-2xl font-bold", children: "Presets, Import & Export" }),
        /* @__PURE__ */ u3("p", { className: "text-sm text-gray-600", children: "Load presets, import settings, or export current settings" })
      ] }),
      /* @__PURE__ */ u3("div", { className: "flex items-center space-x-3", children: [
        /* @__PURE__ */ u3(
          "button",
          {
            onClick: handleImportClick,
            className: "px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700",
            "data-testid": "import-settings-button",
            children: [
              /* @__PURE__ */ u3("svg", { className: "w-4 h-4 inline-block mr-2", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: /* @__PURE__ */ u3("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" }) }),
              "Import Settings"
            ]
          }
        ),
        /* @__PURE__ */ u3(
          "button",
          {
            onClick: handleExport,
            className: "px-4 py-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-700",
            "data-testid": "export-settings-button",
            children: [
              /* @__PURE__ */ u3("svg", { className: "w-4 h-4 inline-block mr-2", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: /* @__PURE__ */ u3("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" }) }),
              "Export Settings"
            ]
          }
        ),
        /* @__PURE__ */ u3(
          "button",
          {
            onClick: handleClose,
            className: "text-gray-400 hover:text-gray-600",
            "data-testid": "close-modal-button",
            "aria-label": "Close",
            children: /* @__PURE__ */ u3("svg", { className: "w-6 h-6", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: /* @__PURE__ */ u3("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) })
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ u3("div", { className: "p-6 overflow-y-auto max-h-[calc(90vh-200px)]", children: [
      error && /* @__PURE__ */ u3("div", { className: "mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-800", "data-testid": "error-message", children: error.split("\n").map((line, index) => /* @__PURE__ */ u3("div", { children: line }, index)) }),
      !presetDiff && /* @__PURE__ */ u3("div", { children: [
        isLoading ? /* @__PURE__ */ u3("div", { className: "text-center py-8 text-gray-500", "data-testid": "loading-presets", children: "Loading presets..." }) : /* @__PURE__ */ u3("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: presets.map((preset) => /* @__PURE__ */ u3(
          "button",
          {
            onClick: () => handleSelectPreset(preset.name),
            className: "p-4 border-2 rounded-lg text-left hover:border-blue-500 hover:bg-blue-50 transition-colors",
            "data-testid": `preset-${preset.name}`,
            children: /* @__PURE__ */ u3("div", { className: "flex items-start space-x-3", children: [
              preset.icon && /* @__PURE__ */ u3("span", { className: "text-3xl", children: preset.icon }),
              /* @__PURE__ */ u3("div", { className: "flex-1", children: [
                /* @__PURE__ */ u3("h3", { className: "font-semibold text-lg", children: preset.displayName }),
                /* @__PURE__ */ u3("p", { className: "text-sm text-gray-600", children: preset.description }),
                preset.category && /* @__PURE__ */ u3("span", { className: "inline-block mt-2 px-2 py-1 text-xs bg-gray-200 rounded", children: preset.category })
              ] })
            ] })
          },
          preset.name
        )) }),
        !isLoading && presets.length === 0 && /* @__PURE__ */ u3("div", { className: "text-center py-8 text-gray-500", "data-testid": "no-presets", children: "No presets available" })
      ] }),
      presetDiff && /* @__PURE__ */ u3("div", { "data-testid": "preset-diff", children: [
        /* @__PURE__ */ u3("div", { className: "mb-4", children: [
          /* @__PURE__ */ u3("h3", { className: "text-lg font-semibold", children: "Review Changes" }),
          /* @__PURE__ */ u3("p", { className: "text-sm text-gray-600", children: isImportMode ? "The following settings will be changed when you import this file" : `The following settings will be changed when you apply "${selectedPreset}"` })
        ] }),
        /* @__PURE__ */ u3("div", { className: "space-y-2 mb-6", children: presetDiff.changes.map((change, index) => /* @__PURE__ */ u3(
          "div",
          {
            className: "p-3 bg-gray-50 border rounded",
            "data-testid": `diff-item-${index}`,
            children: /* @__PURE__ */ u3("div", { className: "flex justify-between items-start", children: [
              /* @__PURE__ */ u3("div", { className: "flex-1", children: [
                /* @__PURE__ */ u3("div", { className: "font-medium text-sm", children: change.key }),
                change.category && /* @__PURE__ */ u3("div", { className: "text-xs text-gray-500", children: change.category })
              ] }),
              /* @__PURE__ */ u3("div", { className: "flex items-center space-x-2 text-sm", children: [
                /* @__PURE__ */ u3("span", { className: "text-red-600", "data-testid": `current-value-${index}`, children: String(change.currentValue ?? "not set") }),
                /* @__PURE__ */ u3("span", { className: "text-gray-400", children: "\u2192" }),
                /* @__PURE__ */ u3("span", { className: "text-green-600 font-medium", "data-testid": `new-value-${index}`, children: String(change.newValue) })
              ] })
            ] })
          },
          index
        )) }),
        presetDiff.requiresRestart && /* @__PURE__ */ u3("div", { className: "mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-800", children: "\u26A0\uFE0F Applying this preset will require a restart" }),
        /* @__PURE__ */ u3("div", { className: "flex justify-end space-x-3", children: [
          /* @__PURE__ */ u3(
            "button",
            {
              onClick: handleCancelDiff,
              className: "px-4 py-2 border rounded hover:bg-gray-50",
              "data-testid": "cancel-diff-button",
              children: isImportMode ? "Cancel Import" : "Back to Presets"
            }
          ),
          /* @__PURE__ */ u3(
            "button",
            {
              onClick: isImportMode ? handleApplyImport : handleApplyPreset,
              disabled: isApplying,
              className: "px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed",
              "data-testid": isImportMode ? "apply-import-button" : "apply-preset-button",
              children: isApplying ? "Applying..." : isImportMode ? "Apply Import" : "Apply Preset"
            }
          )
        ] })
      ] })
    ] }),
    /* @__PURE__ */ u3(
      "input",
      {
        ref: fileInputRef,
        type: "file",
        accept: ".env",
        onChange: handleFileSelect,
        className: "hidden",
        "aria-hidden": "true",
        "data-testid": "file-input"
      }
    )
  ] }) });
}

// src/islands/ExportPanelIsland.tsx
function ExportPanelIsland(props) {
  const [showModal, setShowModal] = d2(false);
  const [exportType, setExportType] = d2("text");
  const [data, setData] = d2(null);
  const [format, setFormat] = d2("png");
  const [loading, setLoading] = d2(false);
  y2(() => {
    const onRegion = (e3) => {
      setData(e3.detail?.imageBase64);
      setExportType("region");
      setFormat("png");
      setShowModal(true);
    };
    const onText = (e3) => {
      setData(e3.detail?.text);
      setExportType("text");
      setFormat("txt");
      setShowModal(true);
    };
    const onAnnotations = (e3) => {
      setData(e3.detail?.annotations);
      setExportType("annotations");
      setFormat("json");
      setShowModal(true);
    };
    window.addEventListener("export:region-requested", onRegion);
    window.addEventListener("export:text-requested", onText);
    window.addEventListener("export:annotations-requested", onAnnotations);
    return () => {
      window.removeEventListener("export:region-requested", onRegion);
      window.removeEventListener("export:text-requested", onText);
      window.removeEventListener("export:annotations-requested", onAnnotations);
    };
  }, []);
  const handleExport = async () => {
    setLoading(true);
    try {
      let endpoint = "";
      let body = {};
      if (exportType === "region") {
        endpoint = "/manual/export/region";
        body = { imageBase64: data, format };
      } else if (exportType === "text") {
        endpoint = "/manual/export/text";
        body = { text: data, format };
      } else if (exportType === "annotations") {
        endpoint = "/manual/export/annotations";
        body = { annotations: data, documentId: props.documentId };
      }
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a3 = document.createElement("a");
      a3.href = url;
      const disposition = response.headers.get("Content-Disposition");
      let filename = `export.${format}`;
      if (disposition && disposition.indexOf("filename=") !== -1) {
        const matches = /filename="([^"]*)"/.exec(disposition);
        if (matches != null && matches[1]) {
          filename = matches[1];
        }
      }
      a3.download = filename;
      document.body.appendChild(a3);
      a3.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a3);
      setShowModal(false);
    } catch (e3) {
      console.error("Export error", e3);
      alert("Export failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  const handleCopy = async () => {
    try {
      if (exportType === "text") {
        await navigator.clipboard.writeText(data);
        alert("Copied to clipboard!");
      } else if (exportType === "annotations") {
        await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        alert("Copied to clipboard!");
      } else if (exportType === "region") {
        alert("Image copy not supported yet. Please download.");
      }
    } catch (e3) {
      console.error("Copy failed", e3);
    }
  };
  if (!showModal) return null;
  return /* @__PURE__ */ u3("div", { className: "fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm", children: /* @__PURE__ */ u3("div", { className: "bg-white rounded-lg shadow-xl p-6 w-full max-w-md", children: [
    /* @__PURE__ */ u3("h2", { className: "text-xl font-bold mb-4 capitalize", children: [
      "Export ",
      exportType
    ] }),
    /* @__PURE__ */ u3("div", { className: "mb-4", children: [
      /* @__PURE__ */ u3("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Format" }),
      /* @__PURE__ */ u3("div", { className: "flex gap-2", children: [
        exportType === "region" && /* @__PURE__ */ u3(k, { children: [
          /* @__PURE__ */ u3(
            "button",
            {
              onClick: () => setFormat("png"),
              className: `px-3 py-2 border rounded ${format === "png" ? "bg-blue-50 border-blue-500 text-blue-700" : "bg-white"}`,
              children: "PNG"
            }
          ),
          /* @__PURE__ */ u3(
            "button",
            {
              onClick: () => setFormat("pdf"),
              className: `px-3 py-2 border rounded ${format === "pdf" ? "bg-blue-50 border-blue-500 text-blue-700" : "bg-white"}`,
              children: "PDF"
            }
          )
        ] }),
        exportType === "text" && /* @__PURE__ */ u3(k, { children: [
          /* @__PURE__ */ u3(
            "button",
            {
              onClick: () => setFormat("txt"),
              className: `px-3 py-2 border rounded ${format === "txt" ? "bg-blue-50 border-blue-500 text-blue-700" : "bg-white"}`,
              children: "TXT"
            }
          ),
          /* @__PURE__ */ u3(
            "button",
            {
              onClick: () => setFormat("pdf"),
              className: `px-3 py-2 border rounded ${format === "pdf" ? "bg-blue-50 border-blue-500 text-blue-700" : "bg-white"}`,
              children: "PDF"
            }
          )
        ] }),
        exportType === "annotations" && /* @__PURE__ */ u3(
          "button",
          {
            onClick: () => setFormat("json"),
            className: `px-3 py-2 border rounded ${format === "json" ? "bg-blue-50 border-blue-500 text-blue-700" : "bg-white"}`,
            children: "JSON"
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ u3("div", { className: "flex justify-end gap-3 mt-6", children: [
      /* @__PURE__ */ u3(
        "button",
        {
          onClick: () => setShowModal(false),
          className: "px-4 py-2 text-gray-600 hover:bg-gray-100 rounded",
          children: "Cancel"
        }
      ),
      /* @__PURE__ */ u3(
        "button",
        {
          onClick: handleCopy,
          className: "px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50",
          children: "Copy"
        }
      ),
      /* @__PURE__ */ u3(
        "button",
        {
          onClick: handleExport,
          disabled: loading,
          className: "px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50",
          children: loading ? "Exporting..." : "Download"
        }
      )
    ] })
  ] }) });
}

// src/ui/contracts/ViewModeToggle.contract.ts
var ViewModeToggleSchema = external_exports.object({
  documentId: external_exports.number().int().nullable().optional(),
  mode: external_exports.enum(["text", "visual"]).optional().default("text"),
  visualEnabled: external_exports.boolean().optional().default(true)
});
var ViewModeChangedEventSchema = external_exports.object({
  type: external_exports.literal("viewmode:changed"),
  mode: external_exports.enum(["text", "visual"]),
  documentId: external_exports.number().int().nullable().optional()
});

// src/islands/ViewModeToggleIsland.tsx
function dispatchEventSafe4(name, detail) {
  if (typeof document === "undefined") return;
  if (typeof document.dispatchEvent !== "function") return;
  const EventConstructor = typeof window !== "undefined" && window.CustomEvent ? window.CustomEvent : CustomEvent;
  document.dispatchEvent(new EventConstructor(name, { detail }));
}
function ViewModeToggleIsland(props) {
  const validated = ViewModeToggleSchema.parse(props);
  const [mode, setMode] = d2(props.mode || "text");
  const [visualEnabled, setVisualEnabled] = d2(props.visualEnabled !== false);
  y2(() => {
    const onDocumentSelected = (e3) => {
      const detail = e3?.detail || {};
      if (detail.documentId) {
        setVisualEnabled(true);
        return;
      }
      setVisualEnabled(false);
      setMode("text");
    };
    window.addEventListener("document:selected", onDocumentSelected);
    return () => window.removeEventListener("document:selected", onDocumentSelected);
  }, []);
  y2(() => {
    try {
      window.__viewmode_toggle_island_mounted = true;
    } catch (e3) {
    }
  }, []);
  const handleModeChange = q2((newMode) => {
    if (newMode === mode) return;
    setMode(newMode);
    dispatchEventSafe4("viewmode:changed", {
      type: "viewmode:changed",
      mode: newMode,
      documentId: props.documentId ?? null
    });
  }, [mode, props.documentId]);
  const textBtnRef = A2(null);
  const visualBtnRef = A2(null);
  y2(() => {
    if (textBtnRef.current) textBtnRef.current.setAttribute("aria-pressed", String(mode === "text"));
    if (visualBtnRef.current) visualBtnRef.current.setAttribute("aria-pressed", String(mode === "visual"));
  }, [mode]);
  return /* @__PURE__ */ u3("div", { "data-testid": "view-mode-toggle-root", "data-hydrated": "true", className: "vmt-root", children: [
    /* @__PURE__ */ u3("div", { className: "vmt-toggle-group", role: "group", "aria-label": "View mode toggle", children: [
      /* @__PURE__ */ u3(
        "button",
        {
          type: "button",
          "data-testid": "view-text-btn",
          ref: (el) => {
            textBtnRef.current = el;
          },
          onClick: () => handleModeChange("text"),
          className: `vmt-btn ${mode === "text" ? "vmt-btn-active" : "vmt-btn-inactive"}`,
          children: [
            /* @__PURE__ */ u3("i", { className: "fas fa-file-alt vmt-icon", "aria-hidden": "true" }),
            /* @__PURE__ */ u3("span", { children: "Text" })
          ]
        }
      ),
      /* @__PURE__ */ u3(
        "button",
        {
          type: "button",
          "data-testid": "view-visual-btn",
          onClick: () => handleModeChange("visual"),
          className: `vmt-btn ${mode === "visual" ? "vmt-btn-active" : "vmt-btn-inactive"}`,
          ref: (el) => {
            visualBtnRef.current = el;
          },
          disabled: !visualEnabled,
          children: [
            /* @__PURE__ */ u3("i", { className: "fas fa-image vmt-icon", "aria-hidden": "true" }),
            /* @__PURE__ */ u3("span", { children: "Visual" })
          ]
        }
      )
    ] }),
    /* @__PURE__ */ u3("style", { children: `
        .vmt-root {
          font-family: system-ui, -apple-system, sans-serif;
        }
        .vmt-toggle-group {
          display: flex;
          gap: 8px;
        }
        .vmt-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 6px 12px;
          font-size: 0.875rem;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
          border: 1px solid var(--border-color, #ddd);
        }
        .vmt-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .vmt-btn-active {
          background: var(--accent-primary, #3498db);
          color: white;
          border-color: var(--accent-primary, #3498db);
        }
        .vmt-btn-inactive {
          background: var(--bg-secondary, #f8f9fa);
          color: var(--text-primary, #333);
        }
        .vmt-btn-inactive:hover:not(:disabled) {
          background: var(--hover-bg, #e9ecef);
        }
        .vmt-icon {
          font-size: 0.875rem;
        }
      ` })
  ] });
}

// src/ui/contracts/TagsManager.contract.ts
var TagSchema2 = external_exports.object({
  id: external_exports.number().int(),
  name: external_exports.string(),
  color: external_exports.string().optional()
});
var TagsManagerSchema = external_exports.object({
  documentId: external_exports.number().int().nullable().optional(),
  currentTags: external_exports.array(TagSchema2).optional().default([]),
  suggestedTags: external_exports.array(TagSchema2).optional().default([]),
  availableTags: external_exports.array(TagSchema2).optional().default([]),
  isSaving: external_exports.boolean().optional().default(false)
});
var TagsUpdatedEventSchema = external_exports.object({
  type: external_exports.literal("tags:updated"),
  documentId: external_exports.number().int().nullable().optional(),
  currentTags: external_exports.array(external_exports.number().int()),
  action: external_exports.enum(["add", "remove", "accept-suggestion", "save"])
});
var TagsSuggestionsReceivedEventSchema = external_exports.object({
  type: external_exports.literal("tags:suggestions-received"),
  documentId: external_exports.number().int().nullable().optional(),
  suggestedTags: external_exports.array(TagSchema2)
});

// src/islands/TagsManagerIsland.tsx
function dispatchEventSafe5(name, detail) {
  if (typeof document === "undefined") return;
  if (typeof document.dispatchEvent !== "function") return;
  const EventConstructor = typeof window !== "undefined" && window.CustomEvent ? window.CustomEvent : CustomEvent;
  document.dispatchEvent(new EventConstructor(name, { detail }));
}
function TagsManagerIsland(props) {
  const validated = TagsManagerSchema.parse(props);
  const [currentTags, setCurrentTags] = d2(props.currentTags || []);
  const [suggestedTags, setSuggestedTags] = d2(props.suggestedTags || []);
  const [availableTags, setAvailableTags] = d2(props.availableTags || []);
  const [selectedTagId, setSelectedTagId] = d2("");
  const [isSaving, setIsSaving] = d2(false);
  const [saveStatus, setSaveStatus] = d2("idle");
  const [documentId, setDocumentId] = d2(props.documentId ?? null);
  const resolveTags = q2((tags) => {
    if (!Array.isArray(tags)) return [];
    return tags.map((tag, idx) => {
      if (typeof tag === "object" && tag !== null && "name" in tag) {
        return tag;
      }
      const tagName = String(tag);
      const match = availableTags.find(
        (t3) => t3.name.toLowerCase() === tagName.toLowerCase()
      );
      return match || { id: -1 - idx, name: tagName };
    });
  }, [availableTags]);
  y2(() => {
    const fetchTags = async () => {
      try {
        const res = await fetch("/manual/tags");
        if (res.ok) {
          const tags = await res.json();
          setAvailableTags(tags);
        }
      } catch (err) {
        console.warn("Failed to fetch tags:", err);
      }
    };
    if (availableTags.length === 0) {
      fetchTags();
    }
  }, []);
  y2(() => {
    if (availableTags.length === 0) return;
    setCurrentTags((prev) => resolveTags(prev));
    setSuggestedTags((prev) => resolveTags(prev));
  }, [availableTags, resolveTags]);
  y2(() => {
    const onSuggestionsReceived = (e3) => {
      const detail = e3?.detail || {};
      if (detail.suggestedTags) {
        setSuggestedTags(resolveTags(detail.suggestedTags));
      }
    };
    const onAnalysisCompleted = (e3) => {
      const detail = e3?.detail || {};
      if (detail.result?.tags) {
        setSuggestedTags(resolveTags(detail.result.tags));
      }
    };
    window.addEventListener("tags:suggestions-received", onSuggestionsReceived);
    window.addEventListener("ai:analysis-completed", onAnalysisCompleted);
    return () => {
      window.removeEventListener("tags:suggestions-received", onSuggestionsReceived);
      window.removeEventListener("ai:analysis-completed", onAnalysisCompleted);
    };
  }, [resolveTags]);
  y2(() => {
    const onDocumentSelected = (e3) => {
      const detail = e3?.detail || {};
      if (detail.documentId !== void 0) {
        setDocumentId(detail.documentId ?? null);
      }
      if (detail.tags) {
        setCurrentTags(resolveTags(detail.tags));
      } else if (detail.documentId === null || detail.documentId === void 0) {
        setCurrentTags([]);
      }
      setSuggestedTags([]);
      setSaveStatus("idle");
    };
    window.addEventListener("document:selected", onDocumentSelected);
    return () => {
      window.removeEventListener("document:selected", onDocumentSelected);
    };
  }, [resolveTags]);
  y2(() => {
    try {
      window.__tags_manager_island_mounted = true;
    } catch (e3) {
    }
  }, []);
  y2(() => {
    if (saveStatus !== "idle") {
      const timer = setTimeout(() => setSaveStatus("idle"), 3e3);
      return () => clearTimeout(timer);
    }
  }, [saveStatus]);
  const handleAcceptSuggestion = q2((tag) => {
    if (!currentTags.find((t3) => t3.id === tag.id || t3.name === tag.name)) {
      const newCurrentTags = [...currentTags, tag];
      setCurrentTags(newCurrentTags);
      dispatchEventSafe5("tags:updated", {
        type: "tags:updated",
        documentId,
        currentTags: newCurrentTags.map((t3) => t3.id),
        action: "accept-suggestion"
      });
    }
    setSuggestedTags((prev) => prev.filter((t3) => t3.id !== tag.id && t3.name !== tag.name));
  }, [currentTags, props.documentId]);
  const handleDismissSuggestion = q2((tag) => {
    setSuggestedTags((prev) => prev.filter((t3) => t3.id !== tag.id && t3.name !== tag.name));
  }, []);
  const handleRemoveTag = q2((tag) => {
    const newCurrentTags = currentTags.filter((t3) => t3.id !== tag.id);
    setCurrentTags(newCurrentTags);
    dispatchEventSafe5("tags:updated", {
      type: "tags:updated",
      documentId,
      currentTags: newCurrentTags.map((t3) => t3.id),
      action: "remove"
    });
  }, [currentTags, documentId]);
  const handleAddTag = q2(() => {
    if (!selectedTagId) return;
    const tag = availableTags.find((t3) => t3.id === parseInt(selectedTagId));
    if (!tag) return;
    if (!currentTags.find((t3) => t3.id === tag.id)) {
      const newCurrentTags = [...currentTags, tag];
      setCurrentTags(newCurrentTags);
      dispatchEventSafe5("tags:updated", {
        type: "tags:updated",
        documentId,
        currentTags: newCurrentTags.map((t3) => t3.id),
        action: "add"
      });
    }
    setSelectedTagId("");
  }, [selectedTagId, availableTags, currentTags, documentId]);
  const handleSaveTags = q2(async () => {
    if (!documentId) return;
    setIsSaving(true);
    setSaveStatus("idle");
    try {
      const tagIds = currentTags.map((t3) => t3.id).filter((id) => id > 0);
      const res = await fetch("/manual/updateDocument", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId,
          tags: tagIds
        })
      });
      if (res.ok) {
        setSaveStatus("success");
        dispatchEventSafe5("tags:updated", {
          type: "tags:updated",
          documentId,
          currentTags: tagIds,
          action: "save"
        });
      } else {
        throw new Error("Failed to save");
      }
    } catch (err) {
      console.error("Failed to save tags:", err);
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
    }
  }, [currentTags, documentId]);
  const selectableTags = availableTags.filter(
    (at) => !currentTags.find((ct) => ct.id === at.id)
  );
  return /* @__PURE__ */ u3("div", { "data-testid": "tags-manager-root", "data-hydrated": "true", className: "tm-root", children: [
    /* @__PURE__ */ u3("div", { className: "tm-section", children: [
      /* @__PURE__ */ u3("h3", { className: "tm-section-title", children: "AI Suggestions" }),
      /* @__PURE__ */ u3("div", { className: "tm-tags-container", "data-testid": "suggested-tags-container", children: suggestedTags.length === 0 ? /* @__PURE__ */ u3("span", { className: "tm-empty", children: "No suggestions yet" }) : suggestedTags.map((tag, idx) => /* @__PURE__ */ u3(
        "span",
        {
          className: "tm-tag tm-tag-suggested",
          "data-testid": `suggested-tag-${idx}`,
          children: [
            /* @__PURE__ */ u3("span", { className: "tm-tag-name", children: tag.name }),
            /* @__PURE__ */ u3(
              "button",
              {
                type: "button",
                className: "tm-tag-btn tm-tag-accept",
                onClick: () => handleAcceptSuggestion(tag),
                "aria-label": `Accept tag ${tag.name}`,
                "data-testid": `accept-tag-${idx}`,
                children: /* @__PURE__ */ u3("i", { className: "fas fa-plus", "aria-hidden": "true" })
              }
            ),
            /* @__PURE__ */ u3(
              "button",
              {
                type: "button",
                className: "tm-tag-btn tm-tag-dismiss",
                onClick: () => handleDismissSuggestion(tag),
                "aria-label": `Dismiss tag ${tag.name}`,
                "data-testid": `dismiss-tag-${idx}`,
                children: /* @__PURE__ */ u3("i", { className: "fas fa-times", "aria-hidden": "true" })
              }
            )
          ]
        },
        tag.id || idx
      )) })
    ] }),
    /* @__PURE__ */ u3("div", { className: "tm-section", children: [
      /* @__PURE__ */ u3("div", { className: "tm-section-header", children: [
        /* @__PURE__ */ u3("h3", { className: "tm-section-title", children: "Current Tags" }),
        /* @__PURE__ */ u3(
          "button",
          {
            type: "button",
            className: "tm-save-btn",
            onClick: handleSaveTags,
            disabled: isSaving || !documentId,
            "data-testid": "save-tags-btn",
            children: isSaving ? "Saving..." : "Save Tags"
          }
        )
      ] }),
      saveStatus === "success" && /* @__PURE__ */ u3("div", { className: "tm-status tm-status-success", children: "Tags saved successfully" }),
      saveStatus === "error" && /* @__PURE__ */ u3("div", { className: "tm-status tm-status-error", children: "Failed to save tags" }),
      /* @__PURE__ */ u3("div", { className: "tm-tags-container", "data-testid": "current-tags-container", children: currentTags.length === 0 ? /* @__PURE__ */ u3("span", { className: "tm-empty", children: "No tags assigned" }) : currentTags.map((tag, idx) => /* @__PURE__ */ u3(
        "span",
        {
          className: "tm-tag tm-tag-current",
          "data-testid": `current-tag-${idx}`,
          "data-tag-id": tag.id,
          children: [
            /* @__PURE__ */ u3("span", { className: "tm-tag-name", children: tag.name }),
            /* @__PURE__ */ u3(
              "button",
              {
                type: "button",
                className: "tm-tag-btn tm-tag-remove",
                onClick: () => handleRemoveTag(tag),
                "aria-label": `Remove tag ${tag.name}`,
                "data-testid": `remove-tag-${idx}`,
                children: /* @__PURE__ */ u3("i", { className: "fas fa-times", "aria-hidden": "true" })
              }
            )
          ]
        },
        tag.id
      )) })
    ] }),
    /* @__PURE__ */ u3("div", { className: "tm-section", children: [
      /* @__PURE__ */ u3("h3", { className: "tm-section-title", children: "Add New Tag" }),
      /* @__PURE__ */ u3("div", { className: "tm-add-container", children: [
        /* @__PURE__ */ u3(
          "select",
          {
            className: "tm-select",
            value: selectedTagId,
            onChange: (e3) => setSelectedTagId(e3.target.value),
            "data-testid": "new-tag-select",
            "aria-label": "Select tag to add",
            children: [
              /* @__PURE__ */ u3("option", { value: "", children: "Select a tag..." }),
              selectableTags.map((tag) => /* @__PURE__ */ u3("option", { value: tag.id, children: tag.name }, tag.id))
            ]
          }
        ),
        /* @__PURE__ */ u3(
          "button",
          {
            type: "button",
            className: "tm-add-btn",
            onClick: handleAddTag,
            disabled: !selectedTagId,
            "data-testid": "add-tag-btn",
            "aria-label": "Add selected tag",
            children: /* @__PURE__ */ u3("i", { className: "fas fa-plus", "aria-hidden": "true" })
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ u3("style", { children: `
        .tm-root {
          font-family: system-ui, -apple-system, sans-serif;
        }
        .tm-section {
          margin-bottom: 16px;
        }
        .tm-section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .tm-section-title {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-secondary, #666);
          margin: 0 0 8px;
        }
        .tm-section-header .tm-section-title {
          margin: 0;
        }
        .tm-tags-container {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          min-height: 32px;
        }
        .tm-empty {
          color: var(--text-secondary, #999);
          font-size: 0.875rem;
          font-style: italic;
        }
        .tm-tag {
          display: inline-flex;
          align-items: center;
          padding: 4px 8px;
          border-radius: 9999px;
          font-size: 0.875rem;
          font-weight: 500;
        }
        .tm-tag-suggested {
          background: rgba(59, 130, 246, 0.1);
          color: var(--accent-primary, #3b82f6);
        }
        .tm-tag-current {
          background: rgba(107, 114, 128, 0.1);
          color: var(--text-primary, #374151);
        }
        .tm-tag-name {
          margin-right: 4px;
        }
        .tm-tag-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 2px 4px;
          font-size: 0.75rem;
          opacity: 0.7;
          transition: opacity 0.2s;
        }
        .tm-tag-btn:hover {
          opacity: 1;
        }
        .tm-tag-accept {
          color: #10b981;
        }
        .tm-tag-dismiss, .tm-tag-remove {
          color: #ef4444;
        }
        .tm-add-container {
          display: flex;
          gap: 8px;
        }
        .tm-select {
          flex: 1;
          padding: 8px;
          border: 1px solid var(--border-color, #ddd);
          border-radius: 4px;
          background: var(--bg-primary, white);
          color: var(--text-primary, #333);
          font-size: 0.875rem;
        }
        .tm-add-btn {
          padding: 8px 12px;
          background: var(--accent-primary, #3498db);
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .tm-add-btn:hover:not(:disabled) {
          background: var(--accent-secondary, #2980b9);
        }
        .tm-add-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .tm-save-btn {
          padding: 4px 8px;
          font-size: 0.75rem;
          background: #10b981;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .tm-save-btn:hover:not(:disabled) {
          background: #059669;
        }
        .tm-save-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .tm-status {
          padding: 8px;
          border-radius: 4px;
          font-size: 0.875rem;
          margin-bottom: 8px;
        }
        .tm-status-success {
          background: rgba(16, 185, 129, 0.1);
          color: #10b981;
        }
        .tm-status-error {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
        }
      ` })
  ] });
}

// src/ui/contracts/AIAnalysis.contract.ts
var AIAnalysisSchema = external_exports.object({
  documentId: external_exports.number().int().nullable().optional(),
  content: external_exports.string().optional(),
  isAnalyzing: external_exports.boolean().optional().default(false),
  analysisType: external_exports.enum(["text", "visual", "chat"]).nullable().optional(),
  gpuState: external_exports.enum(["idle", "checking", "preparing", "ready", "error"]).optional().default("idle")
});
var AIAnalysisResultSchema = external_exports.object({
  tags: external_exports.array(external_exports.string()).optional(),
  correspondent: external_exports.string().nullable().optional(),
  title: external_exports.string().nullable().optional(),
  domain: external_exports.string().optional()
});
var AIAnalysisCompletedEventSchema = external_exports.object({
  type: external_exports.literal("ai:analysis-completed"),
  documentId: external_exports.number().int().nullable().optional(),
  analysisType: external_exports.enum(["text", "visual"]),
  result: AIAnalysisResultSchema.optional()
});
var AIAnalysisStartedEventSchema = external_exports.object({
  type: external_exports.literal("ai:analysis-started"),
  documentId: external_exports.number().int().nullable().optional(),
  analysisType: external_exports.enum(["text", "visual", "chat"])
});

// src/islands/AIAnalysisIsland.tsx
function dispatchEventSafe6(name, detail) {
  if (typeof document === "undefined") return;
  if (typeof document.dispatchEvent !== "function") return;
  const EventConstructor = typeof window !== "undefined" && window.CustomEvent ? window.CustomEvent : CustomEvent;
  document.dispatchEvent(new EventConstructor(name, { detail }));
}
function AIAnalysisIsland(props) {
  const validated = AIAnalysisSchema.parse(props);
  const [isAnalyzing, setIsAnalyzing] = d2(false);
  const [analysisType, setAnalysisType] = d2(null);
  const [gpuState, setGpuState] = d2(props.gpuState || "idle");
  const [statusMessage, setStatusMessage] = d2("");
  const [documentId, setDocumentId] = d2(props.documentId ?? null);
  const [content, setContent] = d2(props.content || "");
  y2(() => {
    let mounted = true;
    const checkGpu = async () => {
      setGpuState("checking");
      try {
        const res = await fetch("/api/visual-rag/health", { signal: AbortSignal.timeout(5e3) });
        if (!mounted) return;
        if (res.status === 503) {
          setGpuState("preparing");
        } else if (res.ok) {
          setGpuState("ready");
        } else {
          setGpuState("error");
        }
      } catch {
        if (mounted) setGpuState("error");
      }
    };
    checkGpu();
    return () => {
      mounted = false;
    };
  }, []);
  y2(() => {
    const onDocumentSelected = (e3) => {
      const detail = e3?.detail || {};
      if (detail.documentId !== void 0) {
        setDocumentId(detail.documentId);
      }
      if (detail.content !== void 0) {
        setContent(detail.content);
      }
    };
    const onMetadataUpdated = (e3) => {
      const detail = e3?.detail || {};
      if (detail.content !== void 0) {
        setContent(detail.content);
      }
    };
    window.addEventListener("document:selected", onDocumentSelected);
    window.addEventListener("manual:metadata-updated", onMetadataUpdated);
    return () => {
      window.removeEventListener("document:selected", onDocumentSelected);
      window.removeEventListener("manual:metadata-updated", onMetadataUpdated);
    };
  }, []);
  y2(() => {
    try {
      window.__ai_analysis_island_mounted = true;
    } catch (e3) {
    }
  }, []);
  y2(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(""), 5e3);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);
  const toManualFields = q2((doc, fallbackDomain = "AI") => {
    if (!doc || typeof doc !== "object") return [];
    const customFields = doc?.custom_fields;
    if (!customFields || typeof customFields !== "object") return [];
    return Object.entries(customFields).map(([label, value]) => ({
      label,
      value: value != null ? String(value) : "",
      domain: doc?.domain || fallbackDomain,
      confidence: 1
    }));
  }, []);
  const handleTextAnalysis = q2(async () => {
    if (!documentId) return;
    setIsAnalyzing(true);
    setAnalysisType("text");
    setStatusMessage("AI is analyzing the document...");
    dispatchEventSafe6("ai:analysis-started", {
      type: "ai:analysis-started",
      documentId,
      analysisType: "text"
    });
    try {
      let analysisContent = content;
      if (!analysisContent || analysisContent === "No content available") {
        throw new Error("No document content available for analysis");
      }
      if (analysisContent.length > 5e4) {
        analysisContent = analysisContent.substring(0, 5e4);
      }
      const res = await fetch("/manual/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: analysisContent,
          id: documentId
        })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Analysis failed");
      }
      const result = await res.json();
      const doc = result?.document || result?.result?.document || result?.result || {};
      const tags = Array.isArray(doc.tags) ? doc.tags : [];
      const fields = toManualFields(doc);
      const documentType = doc.document_type || null;
      dispatchEventSafe6("ai:analysis-completed", {
        type: "ai:analysis-completed",
        documentId,
        analysisType: "text",
        result: {
          tags,
          correspondent: doc.correspondent || null,
          title: doc.title || null,
          documentType,
          fields
        }
      });
      if (tags && tags.length > 0) {
        dispatchEventSafe6("tags:suggestions-received", {
          type: "tags:suggestions-received",
          documentId,
          suggestedTags: tags
        });
      }
      setStatusMessage("Analysis completed successfully");
    } catch (err) {
      console.error("Analysis error:", err);
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
      setAnalysisType(null);
    }
  }, [documentId, content, toManualFields]);
  const handleVisualAnalysis = q2(async () => {
    if (!documentId) return;
    if (gpuState !== "ready") {
      setStatusMessage("GPU is not ready for visual analysis");
      return;
    }
    setIsAnalyzing(true);
    setAnalysisType("visual");
    setStatusMessage("Running Visual Analysis (Expert Pipeline)...");
    dispatchEventSafe6("ai:analysis-started", {
      type: "ai:analysis-started",
      documentId,
      analysisType: "visual"
    });
    try {
      const res = await fetch("/manual/analyze-visual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId: documentId })
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Visual analysis failed");
      }
      dispatchEventSafe6("visual:fallback", {
        type: "visual:fallback",
        documentId,
        fallback: data.fallback || null
      });
      const doc = data.result || data.document || {};
      const tags = Array.isArray(doc.tags) ? doc.tags : [];
      const domain = doc.domain || "general";
      const fields = toManualFields(doc, domain);
      const documentType = doc.document_type || null;
      dispatchEventSafe6("ai:analysis-completed", {
        type: "ai:analysis-completed",
        documentId,
        analysisType: "visual",
        result: {
          tags,
          correspondent: doc.correspondent || null,
          title: doc.title || null,
          domain,
          documentType,
          fields
        }
      });
      if (tags.length > 0) {
        dispatchEventSafe6("tags:suggestions-received", {
          type: "tags:suggestions-received",
          documentId,
          suggestedTags: tags
        });
      }
      setStatusMessage(`Visual analysis complete! Domain: ${data.result?.domain || "general"}, Overlays: ${data.overlayCount || 0}`);
    } catch (err) {
      console.error("Visual analysis error:", err);
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
      setAnalysisType(null);
    }
  }, [documentId, gpuState, toManualFields]);
  const handleChat = q2(() => {
    if (!documentId) return;
    dispatchEventSafe6("ai:analysis-started", {
      type: "ai:analysis-started",
      documentId,
      analysisType: "chat"
    });
    window.location.href = `/chat?open=${documentId}`;
  }, [documentId]);
  const isDisabled = !documentId || isAnalyzing;
  const visualDisabled = isDisabled || gpuState !== "ready";
  return /* @__PURE__ */ u3("div", { "data-testid": "ai-analysis-root", "data-hydrated": "true", className: "aia-root", children: [
    /* @__PURE__ */ u3(
      "button",
      {
        type: "button",
        className: "aia-btn aia-btn-primary",
        onClick: handleTextAnalysis,
        disabled: isDisabled,
        "data-testid": "analyze-btn",
        children: isAnalyzing && analysisType === "text" ? /* @__PURE__ */ u3(k, { children: [
          /* @__PURE__ */ u3("i", { className: "fas fa-spinner fa-spin aia-icon", "aria-hidden": "true" }),
          /* @__PURE__ */ u3("span", { children: "Analyzing..." })
        ] }) : /* @__PURE__ */ u3(k, { children: [
          /* @__PURE__ */ u3("i", { className: "fas fa-robot aia-icon", "aria-hidden": "true" }),
          /* @__PURE__ */ u3("span", { children: "Analyze with AI" })
        ] })
      }
    ),
    /* @__PURE__ */ u3(
      "button",
      {
        type: "button",
        className: "aia-btn aia-btn-secondary",
        onClick: handleChat,
        disabled: !documentId,
        "data-testid": "open-chat-btn",
        children: [
          /* @__PURE__ */ u3("i", { className: "fas fa-comment aia-icon", "aria-hidden": "true" }),
          /* @__PURE__ */ u3("span", { children: "Chat with AI (Beta)" })
        ]
      }
    ),
    /* @__PURE__ */ u3(
      "button",
      {
        type: "button",
        className: "aia-btn aia-btn-accent",
        onClick: handleVisualAnalysis,
        disabled: visualDisabled,
        "data-testid": "analyze-visual-btn",
        children: isAnalyzing && analysisType === "visual" ? /* @__PURE__ */ u3(k, { children: [
          /* @__PURE__ */ u3("i", { className: "fas fa-spinner fa-spin aia-icon", "aria-hidden": "true" }),
          /* @__PURE__ */ u3("span", { children: "Analyzing..." })
        ] }) : /* @__PURE__ */ u3(k, { children: [
          /* @__PURE__ */ u3("i", { className: "fas fa-eye aia-icon", "aria-hidden": "true" }),
          /* @__PURE__ */ u3("span", { children: "Visual Analysis (Expert Pipeline)" }),
          gpuState === "preparing" && /* @__PURE__ */ u3("span", { className: "aia-gpu-badge aia-gpu-preparing", children: "GPU Warming" }),
          gpuState === "error" && /* @__PURE__ */ u3("span", { className: "aia-gpu-badge aia-gpu-error", children: "GPU Unavailable" })
        ] })
      }
    ),
    statusMessage && /* @__PURE__ */ u3(
      "div",
      {
        className: `aia-status ${statusMessage.startsWith("Error") ? "aia-status-error" : "aia-status-info"}`,
        "data-testid": "ai-status",
        role: "status",
        "aria-live": "polite",
        children: [
          !statusMessage.startsWith("Error") && isAnalyzing && /* @__PURE__ */ u3("i", { className: "fas fa-spinner fa-spin aia-icon", "aria-hidden": "true" }),
          /* @__PURE__ */ u3("span", { children: statusMessage })
        ]
      }
    ),
    /* @__PURE__ */ u3("style", { children: `
        .aia-root {
          font-family: system-ui, -apple-system, sans-serif;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .aia-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 10px 16px;
          font-size: 0.875rem;
          font-weight: 500;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
          border: 1px solid var(--border-color, #ddd);
        }
        .aia-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .aia-btn-primary {
          background: var(--bg-primary, white);
          color: var(--text-primary, #333);
        }
        .aia-btn-primary:hover:not(:disabled) {
          background: var(--hover-bg, #f5f5f5);
        }
        .aia-btn-secondary {
          background: var(--bg-primary, white);
          color: var(--text-primary, #333);
        }
        .aia-btn-secondary:hover:not(:disabled) {
          background: var(--hover-bg, #f5f5f5);
        }
        .aia-btn-accent {
          background: var(--bg-primary, white);
          color: var(--accent-primary, #3498db);
          border-color: var(--accent-primary, #3498db);
        }
        .aia-btn-accent:hover:not(:disabled) {
          background: var(--accent-primary, #3498db);
          color: white;
        }
        .aia-icon {
          font-size: 0.875rem;
        }
        .aia-gpu-badge {
          font-size: 0.625rem;
          padding: 2px 6px;
          border-radius: 4px;
          margin-left: 8px;
        }
        .aia-gpu-preparing {
          background: #fef3c7;
          color: #92400e;
        }
        .aia-gpu-error {
          background: #fee2e2;
          color: #991b1b;
        }
        .aia-status {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          border-radius: 4px;
          font-size: 0.875rem;
          animation: aia-fade-in 0.3s ease;
        }
        .aia-status-info {
          background: rgba(59, 130, 246, 0.1);
          color: var(--accent-primary, #3b82f6);
        }
        .aia-status-error {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
        }
        @keyframes aia-fade-in {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      ` })
  ] });
}

// src/islands/ChatWorkspaceIsland.tsx
var safeMarkdown = (text) => {
  const marked = window.marked;
  if (marked && typeof marked.parse === "function") {
    return marked.parse(text);
  }
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;").replace(/\n/g, "<br/>");
};
var highlightBlocks = (container) => {
  const hljs = window.hljs;
  if (!container || !hljs) return;
  const blocks = container.querySelectorAll("pre code");
  blocks.forEach((block) => {
    try {
      hljs.highlightBlock(block);
    } catch (err) {
    }
  });
};
var makeId = () => `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`;
function ChatWorkspaceIsland(props) {
  const documents = Array.isArray(props.documents) ? props.documents : [];
  const [selectedDocumentId, setSelectedDocumentId] = d2(
    props.openDocumentId ?? null
  );
  const [selectedDocumentTitle, setSelectedDocumentTitle] = d2("");
  const [chatMessages, setChatMessages] = d2([]);
  const [messageInput, setMessageInput] = d2("");
  const [isStreaming, setIsStreaming] = d2(false);
  const [streamError, setStreamError] = d2(null);
  const [activeTab, setActiveTab] = d2("chat");
  const [docPreview, setDocPreview] = d2({
    title: "",
    content: "",
    tags: [],
    originalUrl: null,
    pageCount: 1
  });
  const [modelOptions, setModelOptions] = d2([]);
  const [selectedModel, setSelectedModel] = d2(
    props.ollamaDefaultModel ?? null
  );
  const [isModelLoading, setIsModelLoading] = d2(false);
  const [modelLoadError, setModelLoadError] = d2(null);
  const [guidedStep, setGuidedStep] = d2("Select a document to begin.");
  const [statusMessage, setStatusMessage] = d2(null);
  const [chatContext, setChatContext] = d2([]);
  const chatEndRef = A2(null);
  const chatHistoryRef = A2(null);
  const streamMessageIdRef = A2(null);
  const aiProvider = props.aiProvider || "ollama";
  y2(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const ctxParam = params.get("context");
      if (ctxParam) {
        try {
          const parsed = JSON.parse(decodeURIComponent(ctxParam));
          const ctxArray = Array.isArray(parsed) ? parsed : [parsed];
          setChatContext(ctxArray);
          if (ctxArray.some((c3) => c3.type === "visual")) {
            setMessageInput("Analyze this visual region.");
          } else if (ctxArray.some((c3) => c3.type === "text")) {
            setMessageInput("Analyze this text.");
          }
          if (ctxArray[0] && ctxArray[0].documentId) {
            setSelectedDocumentId(Number(ctxArray[0].documentId));
          }
          const newUrl = window.location.pathname + window.location.search.replace(/([&?]context=[^&]*)/, "");
          window.history.replaceState({}, "", newUrl);
        } catch (e3) {
          console.error("Failed to parse context", e3);
        }
      }
    }
  }, []);
  y2(() => {
    if (props.openDocumentId && !selectedDocumentId) {
      setSelectedDocumentId(props.openDocumentId);
    }
  }, [props.openDocumentId]);
  y2(() => {
    if (props.modelConfig && props.modelConfig.providers) {
      const providers = props.modelConfig.providers || {};
      const groups = Object.keys(providers).flatMap((provider) => {
        const models = Array.isArray(providers[provider]) ? providers[provider] : [];
        if (!models.length) return [];
        return [{
          label: `${provider} models`,
          models: models.map((m3) => ({ label: m3, model: m3 }))
        }];
      });
      const expertRaw = props.modelConfig.expertModels;
      if (Array.isArray(expertRaw) && expertRaw.length) {
        groups.push({
          label: "Expert models",
          models: expertRaw.map((entry) => ({ label: entry.label ? `${entry.label} (${entry.model})` : entry.model, model: entry.model }))
        });
      }
      setModelOptions(groups);
      const defaultModel = props.ollamaDefaultModel || props.modelConfig && props.modelConfig.currentProvider && (providers[props.modelConfig.currentProvider] || [])[0];
      if (defaultModel) {
        setSelectedModel(defaultModel);
      } else if (groups.length && groups[0].models.length) {
        setSelectedModel(groups[0].models[0].model);
      }
    } else {
      if (aiProvider === "ollama") {
        void loadOllamaModels();
      }
    }
  }, [aiProvider, props.modelConfig, props.ollamaDefaultModel]);
  const verifyModel = async (model) => {
    try {
      const resp = await fetch(`/api/ollama/verify?model=${encodeURIComponent(model)}`);
      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        return { ok: false, text };
      }
      const data = await resp.json();
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  };
  y2(() => {
    if (!selectedDocumentId) {
      setGuidedStep("Select a document to begin.");
      return;
    }
    if (chatMessages.length === 0) {
      setGuidedStep("Ask your first question to start the analysis.");
      return;
    }
    if (activeTab === "visual") {
      setGuidedStep("Inspect visual evidence and compare with the chat.");
      return;
    }
    setGuidedStep("Refine your request or capture a decision.");
  }, [selectedDocumentId, chatMessages.length, activeTab]);
  y2(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [chatMessages, isStreaming]);
  const loadOllamaModels = async () => {
    setIsModelLoading(true);
    setModelLoadError(null);
    try {
      const response = await fetch("/api/ollama/models");
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`Failed to load models: ${response.status} ${text}`);
      }
      const data = await response.json();
      const installed = Array.isArray(data.models) ? data.models : [];
      const expertRaw = Array.isArray(data.expertModels) ? data.expertModels : [];
      const placeholders = Array.isArray(data.placeholderModels) ? data.placeholderModels : [];
      const installedSet = new Set(installed.filter(Boolean));
      const expertEntries = expertRaw.filter((entry) => entry?.model);
      const expertSet = new Set(
        expertEntries.map((entry) => entry.model)
      );
      const placeholderEntries = placeholders.filter((model) => {
        return model && !installedSet.has(model) && !expertSet.has(model);
      });
      const groups = [];
      if (installedSet.size) {
        groups.push({
          label: "Installed models",
          models: Array.from(installedSet).map((model) => ({
            label: model,
            model
          }))
        });
      }
      if (expertEntries.length) {
        groups.push({
          label: "Expert models",
          models: expertEntries.map((entry) => ({
            label: entry.label ? `${entry.label} (${entry.model})` : entry.model,
            model: entry.model
          }))
        });
      }
      if (placeholderEntries.length) {
        const placeholderLabel = data.providerMismatch ? "Configured models (lazy load)" : "Configured models (not verified)";
        groups.push({
          label: placeholderLabel,
          models: placeholderEntries.map((model) => ({
            label: `${model} (lazy load)`,
            model,
            placeholder: true
          }))
        });
      }
      setModelOptions(groups);
      const defaultModel = data.defaultModel || props.ollamaDefaultModel;
      const defaultExists = Boolean(defaultModel) && groups.some(
        (group) => group.models.some((model) => model.model === defaultModel)
      );
      if (defaultExists) {
        setSelectedModel(defaultModel);
      } else if (groups.length && groups[0].models.length) {
        setSelectedModel(groups[0].models[0].model);
      }
    } catch (error) {
      setModelLoadError(error.message || String(error));
      setModelOptions([]);
      setSelectedModel(props.ollamaDefaultModel ?? null);
    } finally {
      setIsModelLoading(false);
    }
  };
  const loadDocumentPreview = q2(async (documentId) => {
    try {
      const response = await fetch(`/manual/preview/${documentId}`);
      if (!response.ok) throw new Error("Preview unavailable");
      const data = await response.json();
      setDocPreview({
        title: data.title || `Document ${documentId}`,
        content: data.content || "No content available",
        tags: Array.isArray(data.tags) ? data.tags : [],
        originalUrl: data.normalized_original_url || data.original_url || null,
        pageCount: data.pageCount || 1
      });
    } catch (error) {
      setDocPreview({
        title: `Document ${documentId}`,
        content: "Preview unavailable.",
        tags: [],
        originalUrl: null,
        pageCount: 1
      });
    }
  }, []);
  const [localTextRagStatus, setLocalTextRagStatus] = d2(null);
  const initializeChat = q2(async (documentId) => {
    try {
      setStreamError(null);
      setStatusMessage("Initializing chat...");
      const modelParam = selectedModel ? `?model=${encodeURIComponent(selectedModel)}` : "";
      const response = await fetch(`/chat/init/${documentId}${modelParam}`);
      if (!response.ok) throw new Error("Failed to initialize chat");
      const data = await response.json();
      setSelectedDocumentTitle(data.documentTitle || `Document ${documentId}`);
      if (Array.isArray(data.history) && data.history.length > 0) {
        setChatMessages(
          data.history.map((m3) => ({ id: makeId(), role: m3.role, content: m3.content }))
        );
      } else {
        setChatMessages([
          {
            id: makeId(),
            role: "status",
            content: `Chat ready for ${data.documentTitle || `Document ${documentId}`}.`
          }
        ]);
      }
      if (data.textRagStatus) setLocalTextRagStatus(data.textRagStatus);
      await loadDocumentPreview(documentId);
    } catch (error) {
      setStreamError(error.message || "Failed to initialize chat");
    } finally {
      setStatusMessage(null);
    }
  }, [loadDocumentPreview, selectedModel]);
  y2(() => {
    if (selectedDocumentId) {
      void initializeChat(selectedDocumentId);
    } else {
      setChatMessages([]);
      setDocPreview({
        title: "",
        content: "",
        tags: [],
        originalUrl: null,
        pageCount: 1
      });
      setSelectedDocumentTitle("");
    }
  }, [selectedDocumentId]);
  const sendMessage = q2(async () => {
    if (!messageInput.trim() || !selectedDocumentId) return;
    const userMessage = messageInput.trim();
    setMessageInput("");
    setStreamError(null);
    const userEntry = {
      id: makeId(),
      role: "user",
      content: userMessage
    };
    const assistantEntryId = makeId();
    streamMessageIdRef.current = assistantEntryId;
    setChatMessages((prev) => [
      ...prev,
      userEntry,
      {
        id: assistantEntryId,
        role: "assistant",
        content: ""
      }
    ]);
    setIsStreaming(true);
    try {
      const response = await fetch("/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: selectedDocumentId,
          message: userMessage,
          model: selectedModel,
          context: chatContext.length > 0 ? chatContext.map((c3) => ({
            type: c3.type,
            page: c3.data?.page,
            excerpt: c3.data?.text,
            imageBase64: c3.data?.imageBase64
          })) : void 0
        })
      });
      if (chatContext.length > 0) setChatContext([]);
      if (!response.ok || !response.body) {
        throw new Error("Failed to send message");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (!payload || payload === "[DONE]") continue;
          let parsed = null;
          try {
            parsed = JSON.parse(payload);
          } catch (err) {
            parsed = { content: payload };
          }
          if (parsed.error) {
            setStreamError(parsed.error);
            continue;
          }
          if (parsed.content) {
            setChatMessages(
              (prev) => prev.map(
                (msg) => msg.id === assistantEntryId ? { ...msg, content: msg.content + parsed.content } : msg
              )
            );
          }
        }
      }
    } catch (error) {
      setStreamError(error.message || "Failed to stream response");
    } finally {
      setIsStreaming(false);
    }
  }, [messageInput, selectedDocumentId, selectedModel]);
  const tabs = T2(() => [
    { id: "chat", label: "Chat" },
    { id: "document", label: "Document" },
    { id: "visual", label: "Visual" }
  ], []);
  return /* @__PURE__ */ u3("div", { "data-testid": "chat-workspace-root", "data-hydrated": "true", className: "sg-shell", children: [
    /* @__PURE__ */ u3("div", { className: "guided-rail", "data-testid": "chat-guided-rail", children: [
      /* @__PURE__ */ u3("div", { className: "guided-rail__label", children: "Guided Rail" }),
      /* @__PURE__ */ u3("div", { className: "guided-rail__text", children: guidedStep }),
      statusMessage && /* @__PURE__ */ u3("div", { className: "guided-rail__status", children: statusMessage })
    ] }),
    /* @__PURE__ */ u3("div", { className: "material-card sg-card", children: /* @__PURE__ */ u3("div", { className: "flex flex-wrap items-center gap-4", children: [
      /* @__PURE__ */ u3("div", { className: "flex-1 min-w-[220px]", children: [
        /* @__PURE__ */ u3("label", { className: "sg-label", htmlFor: "chat-document-select", children: "Document" }),
        /* @__PURE__ */ u3(
          "select",
          {
            id: "chat-document-select",
            "data-testid": "chat-document-select",
            className: "sg-select",
            value: selectedDocumentId ?? "",
            onChange: (e3) => {
              const value = e3.target.value;
              setSelectedDocumentId(value ? Number(value) : null);
            },
            children: [
              /* @__PURE__ */ u3("option", { value: "", children: "Choose a document..." }),
              documents.map((doc) => /* @__PURE__ */ u3("option", { value: doc.id, children: doc.title || doc.original_filename || `Document ${doc.id}` }, doc.id))
            ]
          }
        )
      ] }),
      /* @__PURE__ */ u3("div", { className: "flex-1 min-w-[220px]", children: [
        /* @__PURE__ */ u3("label", { className: "sg-label", htmlFor: "chat-model-select", children: "Model" }),
        isModelLoading ? /* @__PURE__ */ u3("div", { "data-testid": "chat-model-loading", className: "flex items-center gap-2", children: [
          /* @__PURE__ */ u3("div", { className: "animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" }),
          /* @__PURE__ */ u3("div", { className: "text-sm text-gray-600", children: "Loading models..." })
        ] }) : modelLoadError ? /* @__PURE__ */ u3("div", { className: "text-sm text-red-600", children: [
          /* @__PURE__ */ u3("div", { "data-testid": "chat-model-error", children: modelLoadError }),
          /* @__PURE__ */ u3(
            "button",
            {
              className: "mt-2 sg-link",
              onClick: () => void loadOllamaModels(),
              "data-testid": "chat-model-retry",
              children: "Retry"
            }
          )
        ] }) : /* @__PURE__ */ u3(k, { children: [
          /* @__PURE__ */ u3("div", { className: "flex items-center gap-3", children: [
            /* @__PURE__ */ u3(
              "select",
              {
                id: "chat-model-select",
                "data-testid": "chat-model-select",
                className: "sg-select",
                value: selectedModel ?? "",
                onFocus: () => {
                  if (!modelOptions.length) void loadOllamaModels();
                },
                onChange: async (e3) => {
                  const value = e3.target.value || null;
                  setSelectedModel(value);
                  const cfgProvider = props.modelConfig && props.modelConfig.currentProvider || aiProvider;
                  if (value && cfgProvider === "ollama") {
                    const result = await verifyModel(value);
                    if (!result.ok) {
                      console.warn("[Model Verify] verify failed:", result);
                    } else if (result.data) {
                      console.info("[Model Verify] verify result:", result.data);
                      if (!result.data.installed && !result.data.loaded) {
                        setModelLoadError(`Model ${value} not installed/loaded on Ollama.`);
                      } else {
                        setModelLoadError(null);
                      }
                    }
                  }
                },
                children: [
                  modelOptions.length === 0 && /* @__PURE__ */ u3("option", { value: "", children: "No models returned" }),
                  modelOptions.map((group) => /* @__PURE__ */ u3("optgroup", { label: group.label, children: group.models.map((model) => /* @__PURE__ */ u3("option", { value: model.model, children: model.label }, model.model)) }, group.label))
                ]
              }
            ),
            (props.textRagStatus && props.textRagStatus.available === false || localTextRagStatus && localTextRagStatus.available === false) && /* @__PURE__ */ u3("div", { "data-testid": "chat-text-rag-status", className: "text-sm text-red-600", children: "Text-RAG unavailable" })
          ] }),
          /* @__PURE__ */ u3("p", { className: "sg-helper", children: "Installed, expert, and configured placeholders are listed. Select to use." })
        ] })
      ] })
    ] }) }),
    /* @__PURE__ */ u3("div", { className: "material-card sg-card sg-card--workspace", children: [
      /* @__PURE__ */ u3("div", { className: "sg-tabs", children: tabs.map((tab) => /* @__PURE__ */ u3(
        "button",
        {
          type: "button",
          "data-testid": `chat-tab-${tab.id}`,
          className: `sg-tab ${activeTab === tab.id ? "sg-tab--active" : ""}`,
          onClick: () => setActiveTab(tab.id),
          children: tab.label
        },
        tab.id
      )) }),
      activeTab === "chat" && /* @__PURE__ */ u3("div", { className: "sg-tab-panel", children: [
        !selectedDocumentId && /* @__PURE__ */ u3("div", { className: "sg-empty", "data-testid": "chat-empty-state", children: "Select a document to start a conversation." }),
        selectedDocumentId && /* @__PURE__ */ u3("div", { className: "sg-chat-panel", children: [
          /* @__PURE__ */ u3(
            "div",
            {
              ref: chatHistoryRef,
              className: "sg-chat-history",
              "data-testid": "chat-history",
              children: [
                chatMessages.map((msg) => /* @__PURE__ */ u3(
                  "div",
                  {
                    className: `sg-message sg-message--${msg.role}`,
                    "data-testid": `chat-message-${msg.role}`,
                    ref: (el) => {
                      if (msg.role === "assistant" && el) {
                        highlightBlocks(el);
                      }
                    },
                    dangerouslySetInnerHTML: {
                      __html: msg.role === "assistant" ? safeMarkdown(msg.content).replace(/\[visual:(\d+)\/(\d+)\/(.*?)\]/g, (match, docId, pg, bbox) => {
                        return `<a href="/manual?open=${docId}&page=${pg}&highlight=${encodeURIComponent(bbox)}" class="text-blue-600 hover:underline inline-flex items-center gap-1" title="View in Manual Mode"><i class="fas fa-search"></i> Visual Reference (Page ${pg})</a>`;
                      }) : msg.content
                    }
                  },
                  msg.id
                )),
                streamError && /* @__PURE__ */ u3("div", { className: "sg-message sg-message--error", children: streamError }),
                /* @__PURE__ */ u3("div", { ref: chatEndRef })
              ]
            }
          ),
          /* @__PURE__ */ u3("div", { className: "sg-chat-input", children: [
            /* @__PURE__ */ u3(
              "textarea",
              {
                "data-testid": "chat-input",
                className: "sg-textarea",
                placeholder: "Ask about the document...",
                value: messageInput,
                onInput: (e3) => setMessageInput(e3.target.value),
                onKeyDown: (e3) => {
                  if (e3.key === "Enter" && !e3.shiftKey) {
                    e3.preventDefault();
                    if (!isStreaming) void sendMessage();
                  }
                },
                rows: 2
              }
            ),
            /* @__PURE__ */ u3(
              "button",
              {
                "data-testid": "chat-send-button",
                type: "button",
                className: "sg-primary",
                disabled: !messageInput.trim() || isStreaming,
                onClick: () => void sendMessage(),
                children: isStreaming ? "Sending..." : "Send"
              }
            )
          ] })
        ] })
      ] }),
      activeTab === "document" && /* @__PURE__ */ u3("div", { className: "sg-tab-panel", "data-testid": "chat-document-panel", children: [
        !selectedDocumentId && /* @__PURE__ */ u3("div", { className: "sg-empty", children: "Select a document to preview." }),
        selectedDocumentId && /* @__PURE__ */ u3("div", { className: "sg-document-preview", children: [
          /* @__PURE__ */ u3("div", { className: "sg-document-header", children: [
            /* @__PURE__ */ u3("div", { children: [
              /* @__PURE__ */ u3("h3", { className: "sg-display", children: docPreview.title || selectedDocumentTitle }),
              /* @__PURE__ */ u3("p", { className: "sg-helper", children: docPreview.tags.length ? `Tags: ${docPreview.tags.join(", ")}` : "No tags yet." })
            ] }),
            /* @__PURE__ */ u3(
              "a",
              {
                "data-testid": "chat-open-history",
                href: `/history/doc/${selectedDocumentId}`,
                className: "sg-link",
                children: "Open in history"
              }
            )
          ] }),
          /* @__PURE__ */ u3("div", { className: "sg-document-content", children: docPreview.content || "No content available." })
        ] })
      ] }),
      activeTab === "visual" && /* @__PURE__ */ u3("div", { className: "sg-tab-panel", "data-testid": "chat-visual-panel", children: [
        !selectedDocumentId && /* @__PURE__ */ u3("div", { className: "sg-empty", children: "Select a document to review visual overlays." }),
        selectedDocumentId && /* @__PURE__ */ u3("div", { className: "sg-visual-panel", children: /* @__PURE__ */ u3(
          OverlayViewerIsland,
          {
            documentId: selectedDocumentId,
            page: 1,
            originalUrl: docPreview.originalUrl || void 0,
            pageCount: docPreview.pageCount,
            overlayMode: "document",
            showLegend: true
          }
        ) })
      ] })
    ] })
  ] });
}

// src/ui/contracts/HistoryManager.contract.ts
var HistoryTagSchema = external_exports.object({
  id: external_exports.number().int(),
  name: external_exports.string()
});
var HistoryFiltersSchema = external_exports.object({
  tags: external_exports.array(HistoryTagSchema).optional().default([]),
  correspondents: external_exports.array(external_exports.string()).optional().default([])
});
var HistorySortSchema = external_exports.object({
  column: external_exports.enum(["document_id", "title", "created_at", "tags", "correspondent"]).optional().default("created_at"),
  dir: external_exports.enum(["asc", "desc"]).optional().default("desc")
});
var HistoryQuerySchema = external_exports.object({
  search: external_exports.string().optional().default(""),
  tag: external_exports.string().nullable().optional().default(null),
  correspondent: external_exports.string().nullable().optional().default(null),
  sort: HistorySortSchema.optional().default({
    column: "created_at",
    dir: "desc"
  }),
  page: external_exports.number().int().nonnegative().optional().default(0),
  pageSize: external_exports.number().int().positive().optional().default(10)
});
var HistoryManagerSchema = external_exports.object({
  filters: HistoryFiltersSchema,
  initialQuery: HistoryQuerySchema.optional().default({})
});

// src/islands/HistoryManagerIsland.tsx
var columns = [
  "document_id",
  "document_id",
  "title",
  "tags",
  "correspondent",
  "created_at",
  "document_id",
  "document_id"
];
var domainColors = {
  FINANCIAL: "#F97316",
  MEDICAL: "#22C55E",
  LEGAL: "#A855F7",
  GENERAL: "#3B82F6"
};
var getDomainColor = (domain) => domainColors[domain.toUpperCase()] || "#6B7280";
function HistoryManagerIsland(props) {
  const validated = HistoryManagerSchema.parse(props);
  const filters = validated.filters;
  const initialQuery = validated.initialQuery;
  const [query, setQuery] = d2(initialQuery);
  const [rows, setRows] = d2([]);
  const [total, setTotal] = d2(0);
  const [filteredTotal, setFilteredTotal] = d2(0);
  const [loading, setLoading] = d2(false);
  const [error, setError] = d2(null);
  const [selected, setSelected] = d2(/* @__PURE__ */ new Set());
  const [confirmMode, setConfirmMode] = d2(null);
  const [overlaySummaries, setOverlaySummaries] = d2({});
  const [visualDocId, setVisualDocId] = d2(null);
  const [visualPageCount, setVisualPageCount] = d2(1);
  const [visualOriginalUrl, setVisualOriginalUrl] = d2(null);
  const pageCount = Math.max(1, Math.ceil(filteredTotal / query.pageSize));
  const loadHistory = q2(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("draw", String(Date.now()));
      params.set("start", String(query.page * query.pageSize));
      params.set("length", String(query.pageSize));
      params.set("search[value]", query.search || "");
      if (query.tag) params.set("tag", query.tag);
      if (query.correspondent) params.set("correspondent", query.correspondent);
      const sortColumn = query.sort?.column || "created_at";
      const sortDir = query.sort?.dir || "desc";
      const columnIndex = columns.indexOf(sortColumn);
      params.set("order[0][column]", String(columnIndex < 0 ? 2 : columnIndex));
      params.set("order[0][dir]", sortDir);
      columns.forEach((col, idx) => {
        params.set(`columns[${idx}][data]`, col);
      });
      const response = await fetch(`/api/history?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to load history");
      const data = await response.json();
      setRows(Array.isArray(data.data) ? data.data : []);
      setTotal(data.recordsTotal || 0);
      setFilteredTotal(data.recordsFiltered || 0);
      setSelected(/* @__PURE__ */ new Set());
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message || "Failed to load history");
    } finally {
      setLoading(false);
    }
  }, [query]);
  y2(() => {
    void loadHistory();
  }, [loadHistory]);
  y2(() => {
    if (rows.length === 0) return;
    const controller = new AbortController();
    const summaries = {};
    const loadSummaries = async () => {
      await Promise.all(
        rows.map(async (row) => {
          try {
            const response = await fetch(
              `/api/visual-rag/overlays/${row.document_id}`,
              { signal: controller.signal }
            );
            if (!response.ok) return;
            const data = await response.json();
            const overlays = Array.isArray(data.overlays) ? data.overlays : [];
            const domains = {};
            let mandatory = 0;
            overlays.forEach((overlay) => {
              const domain = (overlay.domain || "GENERAL").toUpperCase();
              domains[domain] = (domains[domain] || 0) + 1;
              if (overlay.isMandatory) mandatory += 1;
            });
            summaries[row.document_id] = {
              total: overlays.length,
              mandatory,
              domains
            };
          } catch (err) {
          }
        })
      );
      if (!controller.signal.aborted) {
        setOverlaySummaries((prev) => ({ ...prev, ...summaries }));
      }
    };
    void loadSummaries();
    return () => controller.abort();
  }, [rows]);
  const toggleSelectAll = (checked) => {
    if (checked) {
      setSelected(new Set(rows.map((row) => row.document_id)));
    } else {
      setSelected(/* @__PURE__ */ new Set());
    }
  };
  const toggleSelectOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };
  const resetSelected = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    try {
      const response = await fetch("/api/reset-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids })
      });
      if (!response.ok) throw new Error("Reset failed");
      setConfirmMode(null);
      await loadHistory();
    } catch (err) {
      setError(err.message || "Reset failed");
    }
  };
  const resetAll = async () => {
    try {
      const response = await fetch("/api/reset-all-documents", { method: "POST" });
      if (!response.ok) throw new Error("Reset failed");
      setConfirmMode(null);
      await loadHistory();
    } catch (err) {
      setError(err.message || "Reset failed");
    }
  };
  const reanalyzeDocument = async (docId) => {
    try {
      const response = await fetch(`/api/history/reanalyze/${docId}`, {
        method: "POST"
      });
      if (!response.ok) throw new Error("Re-analysis failed");
    } catch (err) {
      setError(err.message || "Re-analysis failed");
    }
  };
  const openVisualModal = async (docId) => {
    setVisualDocId(docId);
    setVisualOriginalUrl(null);
    setVisualPageCount(1);
    try {
      const preview = await fetch(`/manual/preview/${docId}`);
      if (preview.ok) {
        const data = await preview.json();
        const nextOriginalUrl = data.normalized_original_url || data.original_url || null;
        const nextPageCount = Number.isFinite(Number(data.pageCount)) ? Number(data.pageCount) || 1 : 1;
        setVisualOriginalUrl(nextOriginalUrl);
        setVisualPageCount(nextPageCount);
        if (typeof window !== "undefined" && window.dispatchEvent) {
          setTimeout(() => {
            const EvCtor = typeof window.CustomEvent === "function" ? window.CustomEvent : CustomEvent;
            const ev = new EvCtor("overlay:document-changed", {
              detail: {
                documentId: docId,
                page: 1,
                originalUrl: nextOriginalUrl,
                pageCount: nextPageCount
              }
            });
            window.dispatchEvent(ev);
          }, 0);
        }
        return;
      }
    } catch (err) {
    }
    try {
      const info = await fetch(`/api/document/${docId}/page-count`);
      if (info.ok) {
        const data = await info.json();
        setVisualPageCount(data.pageCount || 1);
      }
    } catch (err) {
    }
  };
  const closeVisualModal = () => {
    setVisualDocId(null);
  };
  const guidedMessage = T2(() => {
    if (loading) return "Loading history entries...";
    if (rows.length === 0) return "No history yet. Process a document to begin.";
    if (selected.size > 0) return "Ready to reset selected documents.";
    return "Filter, review overlays, and take corrective action.";
  }, [loading, rows.length, selected.size]);
  return /* @__PURE__ */ u3("div", { "data-testid": "history-manager-root", "data-hydrated": "true", className: "sg-shell", children: [
    /* @__PURE__ */ u3("div", { className: "guided-rail", "data-testid": "history-guided-rail", children: [
      /* @__PURE__ */ u3("div", { className: "guided-rail__label", children: "Guided Rail" }),
      /* @__PURE__ */ u3("div", { className: "guided-rail__text", children: guidedMessage })
    ] }),
    /* @__PURE__ */ u3("div", { className: "sg-actions", children: [
      /* @__PURE__ */ u3(
        "button",
        {
          type: "button",
          className: "sg-danger",
          "data-testid": "history-reset-selected",
          onClick: () => setConfirmMode("selected"),
          disabled: selected.size === 0,
          children: "Reset Selected"
        }
      ),
      /* @__PURE__ */ u3(
        "button",
        {
          type: "button",
          className: "sg-danger",
          "data-testid": "history-reset-all",
          onClick: () => setConfirmMode("all"),
          children: "Reset All"
        }
      )
    ] }),
    /* @__PURE__ */ u3("div", { className: "sg-filters", children: [
      /* @__PURE__ */ u3(
        "input",
        {
          type: "text",
          "data-testid": "history-search",
          className: "sg-input",
          placeholder: "Search title, correspondent, tags...",
          "aria-label": "Search history",
          value: query.search || "",
          onInput: (e3) => setQuery((prev) => ({ ...prev, search: e3.target.value, page: 0 }))
        }
      ),
      /* @__PURE__ */ u3(
        "select",
        {
          "data-testid": "history-tag-filter",
          className: "sg-select",
          "aria-label": "Filter by tag",
          value: query.tag || "",
          onChange: (e3) => setQuery((prev) => ({ ...prev, tag: e3.target.value || null, page: 0 })),
          children: [
            /* @__PURE__ */ u3("option", { value: "", children: "All Tags" }),
            filters.tags?.map((tag) => /* @__PURE__ */ u3("option", { value: String(tag.id), children: tag.name }, tag.id))
          ]
        }
      ),
      /* @__PURE__ */ u3(
        "select",
        {
          "data-testid": "history-correspondent-filter",
          className: "sg-select",
          "aria-label": "Filter by correspondent",
          value: query.correspondent || "",
          onChange: (e3) => setQuery((prev) => ({
            ...prev,
            correspondent: e3.target.value || null,
            page: 0
          })),
          children: [
            /* @__PURE__ */ u3("option", { value: "", children: "All Correspondents" }),
            filters.correspondents?.map((corr) => /* @__PURE__ */ u3("option", { value: corr, children: corr }, corr))
          ]
        }
      )
    ] }),
    /* @__PURE__ */ u3("div", { className: "sg-table-wrapper", children: [
      error && /* @__PURE__ */ u3("div", { className: "sg-error", children: error }),
      /* @__PURE__ */ u3("table", { className: "sg-table", "data-testid": "history-table", children: [
        /* @__PURE__ */ u3("thead", { children: /* @__PURE__ */ u3("tr", { children: [
          /* @__PURE__ */ u3("th", { children: /* @__PURE__ */ u3(
            "input",
            {
              type: "checkbox",
              "data-testid": "history-select-all",
              "aria-label": "Select all history rows",
              checked: rows.length > 0 && selected.size === rows.length,
              onChange: (e3) => toggleSelectAll(e3.target.checked)
            }
          ) }),
          /* @__PURE__ */ u3("th", { children: "ID" }),
          /* @__PURE__ */ u3("th", { children: /* @__PURE__ */ u3(
            "button",
            {
              type: "button",
              className: "sg-sort",
              onClick: () => setQuery((prev) => ({
                ...prev,
                sort: {
                  column: "title",
                  dir: prev.sort?.dir === "asc" ? "desc" : "asc"
                }
              })),
              children: "Title"
            }
          ) }),
          /* @__PURE__ */ u3("th", { children: "Tags" }),
          /* @__PURE__ */ u3("th", { children: "Correspondent" }),
          /* @__PURE__ */ u3("th", { children: /* @__PURE__ */ u3(
            "button",
            {
              type: "button",
              className: "sg-sort",
              onClick: () => setQuery((prev) => ({
                ...prev,
                sort: {
                  column: "created_at",
                  dir: prev.sort?.dir === "asc" ? "desc" : "asc"
                }
              })),
              children: "Modified"
            }
          ) }),
          /* @__PURE__ */ u3("th", { children: "Overlays" }),
          /* @__PURE__ */ u3("th", { children: "Actions" })
        ] }) }),
        /* @__PURE__ */ u3("tbody", { children: [
          loading && /* @__PURE__ */ u3("tr", { children: /* @__PURE__ */ u3("td", { colSpan: 8, className: "sg-loading", children: "Loading history..." }) }),
          !loading && rows.length === 0 && /* @__PURE__ */ u3("tr", { children: /* @__PURE__ */ u3("td", { colSpan: 8, className: "sg-empty", children: "No history entries found." }) }),
          !loading && rows.map((row) => {
            const summary = overlaySummaries[row.document_id];
            return /* @__PURE__ */ u3("tr", { children: [
              /* @__PURE__ */ u3("td", { children: /* @__PURE__ */ u3(
                "input",
                {
                  type: "checkbox",
                  "data-testid": `history-select-${row.document_id}`,
                  "aria-label": `Select history row ${row.document_id}`,
                  checked: selected.has(row.document_id),
                  onChange: () => toggleSelectOne(row.document_id)
                }
              ) }),
              /* @__PURE__ */ u3("td", { children: row.document_id }),
              /* @__PURE__ */ u3("td", { children: [
                /* @__PURE__ */ u3("div", { className: "font-medium", children: row.title }),
                /* @__PURE__ */ u3("div", { className: "text-xs text-gray-500", children: new Date(row.created_at).toLocaleString() })
              ] }),
              /* @__PURE__ */ u3("td", { children: row.tags?.length ? /* @__PURE__ */ u3("div", { className: "sg-tags", children: row.tags.map((tag) => /* @__PURE__ */ u3("span", { className: "sg-tag", children: tag.name }, tag.id)) }) : /* @__PURE__ */ u3("span", { className: "text-xs text-gray-400", children: "No tags" }) }),
              /* @__PURE__ */ u3("td", { children: row.correspondent || "Not assigned" }),
              /* @__PURE__ */ u3("td", { className: "text-xs text-gray-500", children: new Date(row.created_at).toLocaleString() }),
              /* @__PURE__ */ u3("td", { children: summary ? /* @__PURE__ */ u3("div", { className: "sg-overlays", children: [
                Object.entries(summary.domains).map(([domain, count3]) => /* @__PURE__ */ u3(
                  "span",
                  {
                    className: "sg-badge",
                    ref: (el) => {
                      if (el) {
                        const color = getDomainColor(domain);
                        el.style.setProperty("color", color);
                        el.style.setProperty("border-color", `${color}55`);
                      }
                    },
                    children: [
                      domain.slice(0, 1),
                      " ",
                      count3
                    ]
                  },
                  domain
                )),
                summary.mandatory > 0 && /* @__PURE__ */ u3("span", { className: "sg-mandatory", children: [
                  "*",
                  summary.mandatory
                ] })
              ] }) : /* @__PURE__ */ u3("span", { className: "text-xs text-gray-400", children: "-" }) }),
              /* @__PURE__ */ u3("td", { children: /* @__PURE__ */ u3("div", { className: "sg-row-actions", children: [
                /* @__PURE__ */ u3(
                  "a",
                  {
                    href: `/history/doc/${row.document_id}`,
                    className: "sg-link",
                    "data-testid": `history-view-${row.document_id}`,
                    children: "View"
                  }
                ),
                /* @__PURE__ */ u3(
                  "button",
                  {
                    type: "button",
                    className: "sg-link",
                    "data-testid": `history-visual-${row.document_id}`,
                    onClick: () => void openVisualModal(row.document_id),
                    children: "Visual"
                  }
                ),
                /* @__PURE__ */ u3(
                  "a",
                  {
                    href: `/chat?open=${row.document_id}`,
                    className: "sg-link",
                    "data-testid": `history-chat-${row.document_id}`,
                    children: "Chat"
                  }
                ),
                /* @__PURE__ */ u3(
                  "button",
                  {
                    type: "button",
                    className: "sg-link",
                    onClick: () => void reanalyzeDocument(row.document_id),
                    "data-testid": `history-reanalyze-${row.document_id}`,
                    children: "Re-analyse"
                  }
                ),
                /* @__PURE__ */ u3(
                  "button",
                  {
                    type: "button",
                    className: "sg-link",
                    onClick: () => {
                      if (window.feedbackForm) {
                        window.feedbackForm.show({
                          documentId: row.document_id
                        });
                      }
                    },
                    children: "Feedback"
                  }
                )
              ] }) })
            ] }, row.document_id);
          })
        ] })
      ] }),
      /* @__PURE__ */ u3("div", { className: "sg-pagination", children: [
        /* @__PURE__ */ u3(
          "button",
          {
            type: "button",
            className: "sg-link",
            disabled: query.page <= 0,
            onClick: () => setQuery((prev) => ({ ...prev, page: Math.max(0, prev.page - 1) })),
            children: "Previous"
          }
        ),
        /* @__PURE__ */ u3("span", { className: "text-xs text-gray-500", children: [
          "Page ",
          query.page + 1,
          " of ",
          pageCount
        ] }),
        /* @__PURE__ */ u3(
          "button",
          {
            type: "button",
            className: "sg-link",
            disabled: query.page + 1 >= pageCount,
            onClick: () => setQuery((prev) => ({
              ...prev,
              page: Math.min(pageCount - 1, prev.page + 1)
            })),
            children: "Next"
          }
        )
      ] })
    ] }),
    confirmMode && /* @__PURE__ */ u3("div", { className: "sg-modal", "data-testid": "history-confirm-modal", children: /* @__PURE__ */ u3("div", { className: "sg-modal__content", children: [
      /* @__PURE__ */ u3("h3", { className: "sg-display", children: "Confirm Reset" }),
      /* @__PURE__ */ u3("p", { className: "sg-helper", children: confirmMode === "selected" ? "Reset selected documents to original values?" : "Reset all documents to original values?" }),
      /* @__PURE__ */ u3("div", { className: "sg-modal__actions", children: [
        /* @__PURE__ */ u3(
          "button",
          {
            type: "button",
            className: "sg-link",
            onClick: () => setConfirmMode(null),
            children: "Cancel"
          }
        ),
        /* @__PURE__ */ u3(
          "button",
          {
            type: "button",
            className: "sg-danger",
            onClick: () => confirmMode === "selected" ? void resetSelected() : void resetAll(),
            children: "Confirm Reset"
          }
        )
      ] })
    ] }) }),
    visualDocId && /* @__PURE__ */ u3("div", { className: "sg-modal", "data-testid": "history-visual-modal", children: /* @__PURE__ */ u3("div", { className: "sg-modal__content sg-modal__content--wide", children: [
      /* @__PURE__ */ u3("div", { className: "sg-modal__header", children: [
        /* @__PURE__ */ u3("h3", { className: "sg-display", children: "Document Visual Preview" }),
        /* @__PURE__ */ u3("button", { type: "button", className: "sg-link", onClick: closeVisualModal, children: "Close" })
      ] }),
      /* @__PURE__ */ u3(
        OverlayViewerIsland,
        {
          documentId: visualDocId,
          page: 1,
          originalUrl: visualOriginalUrl || void 0,
          pageCount: visualPageCount,
          overlayMode: "document",
          showLegend: true
        }
      )
    ] }) })
  ] });
}

// src/islands/ManualWorkspaceIsland.tsx
function dispatchEventSafe7(name, detail) {
  if (typeof document === "undefined") return;
  if (typeof document.dispatchEvent !== "function") return;
  const EventConstructor = typeof window !== "undefined" && window.CustomEvent ? window.CustomEvent : CustomEvent;
  document.dispatchEvent(new EventConstructor(name, { detail }));
}
function formatDocumentLabel(doc) {
  return doc.title || doc.original_filename || `Document ${doc.id}`;
}
function ManualWorkspaceIsland(props) {
  const [documents, setDocuments] = d2(props.documents || []);
  const [documentId, setDocumentId] = d2(props.documentId ?? null);
  const [content, setContent] = d2(props.content || "");
  const [title, setTitle] = d2(props.title || "");
  const [correspondent, setCorrespondent] = d2(props.correspondent || "");
  const [documentType, setDocumentType] = d2("");
  const [tags, setTags] = d2(props.tags || []);
  const [originalUrl, setOriginalUrl] = d2(props.originalUrl ?? null);
  const [pageCount, setPageCount] = d2(props.pageCount ?? null);
  const [viewMode, setViewMode] = d2("text");
  const [isLoading, setIsLoading] = d2(false);
  const [status, setStatus] = d2(null);
  const [showFallback, setShowFallback] = d2(false);
  const selectRef = A2(null);
  y2(() => {
    if (typeof window !== "undefined" && documentId) {
      const params = new URLSearchParams(window.location.search);
      const highlight = params.get("highlight");
      const pageParam = params.get("page");
      if (pageParam || highlight) {
        const targetPage = pageParam ? Number(pageParam) : props.page || 1;
        if (highlight) {
          setViewMode("visual");
        }
        setTimeout(() => {
          if (highlight) {
            try {
              const bbox = JSON.parse(decodeURIComponent(highlight));
              dispatchEventSafe7("overlay:highlight-region", { bbox, page: targetPage });
            } catch (e3) {
              console.error("Failed to parse highlight", e3);
            }
          }
          if (targetPage > 1) {
            dispatchEventSafe7("overlay:document-changed", { documentId, page: targetPage });
          }
        }, 500);
      }
    }
  }, [documentId]);
  const correspondentInfoRef = A2(null);
  const correspondentNameRef = A2(null);
  const titleInfoRef = A2(null);
  const titleNameRef = A2(null);
  const textSectionRef = A2(null);
  const visualSectionRef = A2(null);
  y2(() => {
    selectRef.current = document.getElementById("documentSelect");
    correspondentInfoRef.current = document.getElementById("correspondentInfo");
    correspondentNameRef.current = document.getElementById("correspondentName");
    titleInfoRef.current = document.getElementById("titleInfo");
    titleNameRef.current = document.getElementById("titleName");
    textSectionRef.current = document.getElementById("textPreviewSection");
    visualSectionRef.current = document.getElementById("visualPreviewSection");
  }, []);
  y2(() => {
    if (!selectRef.current) return;
    const select = selectRef.current;
    select.innerHTML = '<option value="">Choose a document...</option>';
    documents.forEach((doc) => {
      const option = document.createElement("option");
      option.value = String(doc.id);
      option.textContent = formatDocumentLabel(doc);
      select.appendChild(option);
    });
    if (documentId) {
      select.value = String(documentId);
    }
  }, [documents, documentId]);
  const updateCorrespondentDisplay = q2((value) => {
    if (!correspondentInfoRef.current || !correspondentNameRef.current) return;
    if (value) {
      correspondentNameRef.current.textContent = value.name || value;
      correspondentInfoRef.current.classList.remove("hidden");
    } else {
      correspondentInfoRef.current.classList.add("hidden");
    }
  }, []);
  const updateTitleDisplay = q2((value) => {
    if (!titleInfoRef.current || !titleNameRef.current) return;
    if (value) {
      titleNameRef.current.textContent = value.name || value;
      titleInfoRef.current.classList.remove("hidden");
    } else {
      titleInfoRef.current.classList.add("hidden");
    }
  }, []);
  y2(() => {
    updateCorrespondentDisplay(correspondent);
  }, [correspondent, updateCorrespondentDisplay]);
  y2(() => {
    updateTitleDisplay(title);
  }, [title, updateTitleDisplay]);
  y2(() => {
    if (!textSectionRef.current || !visualSectionRef.current) return;
    if (viewMode === "visual") {
      textSectionRef.current.classList.add("hidden");
      visualSectionRef.current.classList.remove("hidden");
    } else {
      visualSectionRef.current.classList.add("hidden");
      textSectionRef.current.classList.remove("hidden");
    }
  }, [viewMode]);
  y2(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(null), 5e3);
    return () => clearTimeout(timer);
  }, [status]);
  const dispatchDocumentFields = q2((fields, docId) => {
    dispatchEventSafe7("manual:fields-updated", { fields, documentId: docId });
  }, []);
  const dispatchDocumentMetadata = q2((metadata) => {
    dispatchEventSafe7("manual:metadata-updated", metadata);
  }, []);
  const dispatchDocumentSelected = q2((detail) => {
    dispatchEventSafe7("document:selected", detail);
  }, []);
  const dispatchOverlayDocumentChanged = q2((detail) => {
    dispatchEventSafe7("overlay:document-changed", detail);
  }, []);
  const resetDocumentState = q2(() => {
    setDocumentId(null);
    setContent("");
    setTitle("");
    setCorrespondent("");
    setDocumentType("");
    setTags([]);
    setOriginalUrl(null);
    setPageCount(null);
    setShowFallback(false);
    setViewMode("text");
    dispatchDocumentFields([], null);
    dispatchDocumentMetadata({
      title: "",
      content: "",
      correspondent: "",
      documentType: ""
    });
    dispatchDocumentSelected({ documentId: null, tags: [], content: "" });
    dispatchOverlayDocumentChanged({ documentId: null, page: 1, originalUrl: null });
  }, [
    dispatchDocumentFields,
    dispatchDocumentMetadata,
    dispatchDocumentSelected,
    dispatchOverlayDocumentChanged
  ]);
  const fetchWithTimeout = q2(async (url, timeoutMs = 8e3) => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal });
      return response;
    } finally {
      window.clearTimeout(timer);
    }
  }, []);
  const handleDocumentSelection = q2(async (nextId) => {
    setStatus(null);
    setShowFallback(false);
    if (!nextId) {
      resetDocumentState();
      return;
    }
    const docId = Number(nextId);
    if (!Number.isFinite(docId)) {
      setStatus({ tone: "error", text: "Invalid document selection." });
      return;
    }
    setDocumentId(docId);
    setDocumentType("");
    setIsLoading(true);
    try {
      const response = await fetchWithTimeout(`/manual/preview/${docId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch document content");
      }
      const data = await response.json();
      const nextContent = data.content || "";
      const nextTitle = data.title || "";
      const nextCorrespondent = data.correspondent || "";
      const nextDocumentType = data.documentType || "";
      const nextTags = Array.isArray(data.tags) ? data.tags : [];
      const nextOriginalUrl = data.normalized_original_url || data.original_url || null;
      const nextPageCount = data.pageCount || 1;
      setContent(nextContent);
      setTitle(nextTitle);
      setCorrespondent(nextCorrespondent);
      setDocumentType(nextDocumentType);
      setTags(nextTags);
      setOriginalUrl(nextOriginalUrl);
      setPageCount(nextPageCount);
      if (data.visualFields && data.visualFields.length > 0) {
        dispatchDocumentFields(data.visualFields, data.id);
      } else if (data.customFields && data.customFields.length > 0) {
        const fields = data.customFields.map((cf) => ({
          label: cf.field?.name || `Field ${cf.field}`,
          value: cf.value || "",
          domain: "PAPERLESS",
          confidence: 1
        }));
        dispatchDocumentFields(fields, data.id);
      } else {
        dispatchDocumentFields([], data.id);
      }
      dispatchDocumentMetadata({
        title: nextTitle,
        content: nextContent,
        correspondent: nextCorrespondent,
        documentType: nextDocumentType,
        pageCount: nextPageCount
      });
      dispatchDocumentSelected({
        documentId: data.id,
        tags: nextTags,
        content: nextContent,
        correspondent: data.correspondent || null,
        title: data.title || null,
        originalUrl: nextOriginalUrl,
        pageCount: nextPageCount
      });
      dispatchOverlayDocumentChanged({
        documentId: data.id,
        page: 1,
        originalUrl: nextOriginalUrl,
        pageCount: nextPageCount
      });
      setStatus({ tone: "success", text: "Document preview loaded." });
    } catch (error) {
      setStatus({
        tone: "error",
        text: `Error loading document: ${error.message || "Unknown error"}`
      });
    } finally {
      setIsLoading(false);
    }
  }, [
    dispatchDocumentFields,
    dispatchDocumentMetadata,
    dispatchDocumentSelected,
    dispatchOverlayDocumentChanged,
    fetchWithTimeout,
    resetDocumentState
  ]);
  const refreshDocuments = q2(async () => {
    setStatus(null);
    try {
      const response = await fetchWithTimeout("/manual/documents");
      if (!response.ok) throw new Error("Failed to fetch documents");
      const docs = await response.json();
      setDocuments(Array.isArray(docs) ? docs : []);
    } catch (error) {
      setStatus({
        tone: "error",
        text: `Error loading documents: ${error.message || "Unknown error"}`
      });
    }
  }, [fetchWithTimeout]);
  y2(() => {
    if (!documents || documents.length === 0) {
      refreshDocuments();
    }
  }, [documents, refreshDocuments]);
  y2(() => {
    const select = selectRef.current;
    if (!select) return;
    const handler = (event) => {
      const target = event.target;
      handleDocumentSelection(target.value);
    };
    select.addEventListener("change", handler);
    return () => {
      select.removeEventListener("change", handler);
    };
  }, [handleDocumentSelection]);
  y2(() => {
    const onViewMode = (e3) => {
      const detail = e3?.detail || {};
      setViewMode(detail.mode === "visual" ? "visual" : "text");
    };
    const onAnalysisStarted = (e3) => {
      const detail = e3?.detail || {};
      const analysisType = detail.analysisType || "ai";
      setStatus({
        tone: "info",
        text: `Running ${analysisType} analysis...`
      });
    };
    const onAnalysisCompleted = (e3) => {
      const detail = e3?.detail || {};
      const result = detail.result || {};
      const nextTitle = result.title || title;
      const nextCorrespondent = result.correspondent || correspondent;
      const nextDocumentType = result.documentType || documentType;
      const nextPageCount = pageCount || 1;
      const nextDocId = detail.documentId ?? documentId;
      if (result.correspondent) setCorrespondent(result.correspondent);
      if (result.title) setTitle(result.title);
      if (result.documentType) setDocumentType(result.documentType);
      if (Array.isArray(result.fields) && result.fields.length > 0) {
        dispatchDocumentFields(result.fields, nextDocId ?? null);
      }
      dispatchDocumentMetadata({
        title: nextTitle,
        correspondent: nextCorrespondent,
        documentType: nextDocumentType,
        content,
        pageCount: nextPageCount
      });
    };
    const onFallback = (e3) => {
      const detail = e3?.detail || {};
      const fallbackActive = Boolean(
        detail.fallback && detail.fallback.evidence_source === "text"
      );
      setShowFallback(fallbackActive);
    };
    const onTagsUpdated = (e3) => {
      const detail = e3?.detail || {};
      if (Array.isArray(detail.currentTags)) {
        setTags(detail.currentTags);
      }
    };
    window.addEventListener("viewmode:changed", onViewMode);
    window.addEventListener("ai:analysis-started", onAnalysisStarted);
    window.addEventListener("ai:analysis-completed", onAnalysisCompleted);
    window.addEventListener("visual:fallback", onFallback);
    window.addEventListener("tags:updated", onTagsUpdated);
    return () => {
      window.removeEventListener("viewmode:changed", onViewMode);
      window.removeEventListener("ai:analysis-started", onAnalysisStarted);
      window.removeEventListener("ai:analysis-completed", onAnalysisCompleted);
      window.removeEventListener("visual:fallback", onFallback);
      window.removeEventListener("tags:updated", onTagsUpdated);
    };
  }, [
    content,
    correspondent,
    dispatchDocumentFields,
    dispatchDocumentMetadata,
    documentId,
    documentType,
    pageCount,
    title
  ]);
  const railText = T2(() => {
    if (!documentId) {
      return "Select a document to begin a guided review.";
    }
    return `Reviewing ${title || `Document ${documentId}`}`;
  }, [documentId, title]);
  const railStatus = T2(() => {
    if (!documentId) {
      return "Step 1: Choose a document to unlock analysis and tags.";
    }
    if (isLoading) {
      return "Loading preview...";
    }
    if (viewMode === "visual") {
      return "Visual mode active. Inspect overlays or run visual analysis.";
    }
    return "Text mode active. Run AI analysis or switch to visual.";
  }, [documentId, isLoading, viewMode]);
  return /* @__PURE__ */ u3("div", { "data-testid": "manual-workspace-root", className: "sg-shell", children: [
    /* @__PURE__ */ u3("div", { className: "guided-rail", "data-testid": "guided-rail", children: [
      /* @__PURE__ */ u3("div", { className: "guided-rail__label", children: "Guided Review" }),
      /* @__PURE__ */ u3("div", { className: "guided-rail__text", children: railText }),
      /* @__PURE__ */ u3("div", { className: "guided-rail__status", children: railStatus })
    ] }),
    showFallback && /* @__PURE__ */ u3(
      "div",
      {
        className: "mb-4 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900",
        "data-testid": "visual-fallback-banner",
        children: "Visual analysis is unavailable. Showing text-only results. Visual evidence required for full validation."
      }
    ),
    status && /* @__PURE__ */ u3(
      "div",
      {
        className: `sg-card ${status.tone === "error" ? "sg-error" : ""}`,
        "data-testid": "manual-status",
        role: "status",
        "aria-live": "polite",
        children: status.text
      }
    ),
    /* @__PURE__ */ u3("div", { className: "flex items-center justify-between mb-4", children: [
      /* @__PURE__ */ u3("div", { className: "text-sm text-gray-500", children: documentId ? `Tags: ${tags.length}` : "No document selected" }),
      /* @__PURE__ */ u3(
        "button",
        {
          type: "button",
          className: "sg-link",
          onClick: refreshDocuments,
          "data-testid": "refresh-documents",
          children: "Refresh documents"
        }
      )
    ] })
  ] });
}

// src/islands/DocumentContentIsland.tsx
function DocumentContentIsland(props) {
  const [documentId, setDocumentId] = d2(null);
  const [content, setContent] = d2("");
  const [searchQuery, setSearchQuery] = d2("");
  const [caseSensitive, setCaseSensitive] = d2(false);
  const [useRegex, setUseRegex] = d2(false);
  y2(() => {
    if (props.documentId !== void 0 && props.documentId !== null) {
      setDocumentId(props.documentId);
    }
    if (props.content !== void 0) {
      setContent(props.content);
    }
    if (props.initialQuery !== void 0) {
      setSearchQuery(props.initialQuery);
    }
  }, [props.documentId, props.content, props.initialQuery]);
  const [matches, setMatches] = d2([]);
  const [currentMatchIndex, setCurrentMatchIndex] = d2(-1);
  const [regexError, setRegexError] = d2(null);
  const contentRef = A2(null);
  y2(() => {
    const handler = (e3) => {
      const detail = e3?.detail || {};
      if (detail.documentId !== void 0) setDocumentId(detail.documentId);
      if (detail.content !== void 0) {
        setContent(detail.content);
        setSearchQuery("");
        setMatches([]);
        setCurrentMatchIndex(-1);
      }
    };
    window.addEventListener("document:selected", handler);
    return () => window.removeEventListener("document:selected", handler);
  }, []);
  y2(() => {
    const timer = setTimeout(() => {
      if (!searchQuery) {
        setMatches([]);
        setCurrentMatchIndex(-1);
        setRegexError(null);
        return;
      }
      try {
        const flags = caseSensitive ? "g" : "gi";
        let regex;
        if (useRegex) {
          regex = new RegExp(searchQuery, flags);
        } else {
          const escaped = searchQuery.replace(/[.*+?^${}()|[\\]/g, "\\$&");
          regex = new RegExp(escaped, flags);
        }
        const newMatches = [];
        let match;
        let count3 = 0;
        const maxMatches = 1e3;
        while ((match = regex.exec(content)) !== null && count3 < maxMatches) {
          newMatches.push({
            index: count3,
            start: match.index,
            end: match.index + match[0].length
          });
          count3++;
        }
        setMatches(newMatches);
        setRegexError(null);
        if (newMatches.length > 0) {
          setCurrentMatchIndex(0);
        } else {
          setCurrentMatchIndex(-1);
        }
      } catch (err) {
        const msg = err && typeof err === "object" && "message" in err ? err.message : String(err);
        setRegexError(msg);
        setMatches([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [content, searchQuery, caseSensitive, useRegex]);
  y2(() => {
    if (currentMatchIndex >= 0 && matches[currentMatchIndex]) {
      const matchId = `match-${currentMatchIndex}`;
      const el = document.getElementById(matchId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [currentMatchIndex, matches]);
  const navigate = (dir) => {
    if (matches.length === 0) return;
    setCurrentMatchIndex((prev) => {
      const next = prev + dir;
      if (next >= matches.length) return 0;
      if (next < 0) return matches.length - 1;
      return next;
    });
  };
  const renderedContent = T2(() => {
    if (!content) return /* @__PURE__ */ u3("div", { className: "text-gray-400 italic p-4", children: "No content available." });
    if (matches.length === 0) return /* @__PURE__ */ u3("div", { className: "font-mono text-sm whitespace-pre-wrap", children: content });
    const parts = [];
    let lastIndex = 0;
    matches.forEach((m3, i4) => {
      if (m3.start > lastIndex) {
        parts.push(content.substring(lastIndex, m3.start));
      }
      const isCurrent = i4 === currentMatchIndex;
      parts.push(
        /* @__PURE__ */ u3(
          "mark",
          {
            id: `match-${i4}`,
            className: `${isCurrent ? "bg-yellow-400 ring-2 ring-yellow-600" : "bg-yellow-200"}`,
            children: content.substring(m3.start, m3.end)
          },
          `match-${i4}`
        )
      );
      lastIndex = m3.end;
    });
    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }
    return /* @__PURE__ */ u3("div", { className: "font-mono text-sm whitespace-pre-wrap", children: parts });
  }, [content, matches, currentMatchIndex]);
  return /* @__PURE__ */ u3("div", { "data-testid": "document-content-island-root", className: "h-full flex flex-col", children: [
    /* @__PURE__ */ u3("div", { className: "bg-gray-50 border-b border-gray-200 p-2 flex flex-wrap gap-2 items-center text-sm sticky top-0 z-10", children: [
      /* @__PURE__ */ u3("div", { className: "relative flex-1 min-w-[200px]", children: [
        /* @__PURE__ */ u3(
          "input",
          {
            type: "text",
            "data-testid": "search-input",
            value: searchQuery,
            onInput: (e3) => setSearchQuery(e3.target.value),
            placeholder: "Search in document...",
            className: `w-full pl-8 pr-4 py-1.5 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${regexError ? "border-red-500 bg-red-50" : "border-gray-300"}`
          }
        ),
        /* @__PURE__ */ u3("i", { className: "fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" })
      ] }),
      /* @__PURE__ */ u3("div", { className: "flex items-center gap-1 bg-white border border-gray-300 rounded-md p-0.5", children: [
        /* @__PURE__ */ u3(
          "button",
          {
            onClick: () => navigate(-1),
            disabled: matches.length === 0,
            className: "p-1 px-2 hover:bg-gray-100 rounded disabled:opacity-50",
            title: "Previous match",
            "data-testid": "search-prev",
            children: /* @__PURE__ */ u3("i", { className: "fas fa-chevron-up" })
          }
        ),
        /* @__PURE__ */ u3("span", { className: "text-xs text-gray-500 min-w-[60px] text-center", "data-testid": "search-count", children: matches.length > 0 ? `${currentMatchIndex + 1}/${matches.length}` : "0/0" }),
        /* @__PURE__ */ u3(
          "button",
          {
            onClick: () => navigate(1),
            disabled: matches.length === 0,
            className: "p-1 px-2 hover:bg-gray-100 rounded disabled:opacity-50",
            title: "Next match",
            "data-testid": "search-next",
            children: /* @__PURE__ */ u3("i", { className: "fas fa-chevron-down" })
          }
        )
      ] }),
      /* @__PURE__ */ u3("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ u3(
          "button",
          {
            onClick: () => setCaseSensitive(!caseSensitive),
            className: `px-2 py-1 border rounded text-xs ${caseSensitive ? "bg-blue-100 border-blue-300 text-blue-700" : "bg-white border-gray-300 text-gray-600"}`,
            title: "Match Case",
            "data-testid": "search-case-sensitive",
            children: "Aa"
          }
        ),
        /* @__PURE__ */ u3(
          "button",
          {
            onClick: () => setUseRegex(!useRegex),
            className: `px-2 py-1 border rounded text-xs ${useRegex ? "bg-blue-100 border-blue-300 text-blue-700" : "bg-white border-gray-300 text-gray-600"}`,
            title: "Use Regular Expression",
            "data-testid": "search-regex",
            children: ".*"
          }
        ),
        /* @__PURE__ */ u3(
          "button",
          {
            onClick: () => {
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("export:text-requested", { detail: { text: content } }));
              }
            },
            className: "px-2 py-1 border rounded text-xs bg-white border-gray-300 text-gray-600 hover:bg-gray-50",
            title: "Export Document Text",
            "data-testid": "export-text",
            children: /* @__PURE__ */ u3("i", { className: "fas fa-download" })
          }
        ),
        /* @__PURE__ */ u3(
          "button",
          {
            onClick: () => {
              const context = { type: "text", data: { text: content.substring(0, 5e3) }, documentId };
              window.location.href = `/chat?context=${encodeURIComponent(JSON.stringify(context))}`;
            },
            className: "px-2 py-1 border rounded text-xs bg-white border-gray-300 hover:bg-gray-50 text-green-600",
            title: "Send to Chat",
            "data-testid": "send-to-chat",
            children: /* @__PURE__ */ u3("i", { className: "fas fa-comment-dots" })
          }
        )
      ] })
    ] }),
    regexError && /* @__PURE__ */ u3("div", { className: "bg-red-50 text-red-700 text-xs px-3 py-1 border-b border-red-100", children: [
      "Invalid Regex: ",
      regexError
    ] }),
    /* @__PURE__ */ u3(
      "div",
      {
        ref: contentRef,
        "data-testid": "document-content-area",
        className: "flex-1 overflow-auto p-4 bg-white",
        children: renderedContent
      }
    )
  ] });
}

// src/islands/UnifiedWorkspaceIsland.tsx
function dispatchEventSafe8(name, detail) {
  try {
    const _doc = typeof document !== "undefined" ? document : typeof window !== "undefined" && window.document ? window.document : null;
    if (_doc && typeof _doc.dispatchEvent === "function") _doc.dispatchEvent(new CustomEvent(name, { detail }));
  } catch (err) {
  }
  try {
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") window.dispatchEvent(new CustomEvent(name, { detail }));
  } catch (err) {
  }
}
function UnifiedWorkspaceIsland(props) {
  const [isDirty2, setIsDirty] = d2(false);
  y2(() => {
    const handler = (e3) => {
      const detail = e3?.detail || {};
      const fieldId = detail.fieldId || detail.field_id || detail.id;
      try {
        window.__last_metadata_locate = { fieldId, handled: false };
      } catch (err) {
      }
      if (!fieldId) return;
      const visual = props.visual || {};
      const overlays = visual.overlays || visual.overlayItems || visual.items || [];
      const vfields = visual.fields || [];
      const getBboxFromOverlay = (ov) => {
        if (!ov) return null;
        if (ov.bbox) return ov.bbox;
        if (ov.box) return ov.box;
        if (Array.isArray(ov.bbox_array)) {
          const [x4, y3, w4, h3] = ov.bbox_array;
          return { x: x4, y: y3, width: w4, height: h3 };
        }
        return null;
      };
      let found = vfields.find((f4) => f4.id === fieldId || f4.name === fieldId || f4.label === fieldId || f4.paperlessMapping === fieldId);
      if (found && (found.bbox || found.overlay || found.overlayId || found.overlay_bbox)) {
        const bbox = found.bbox || found.overlay?.bbox || found.overlay_bbox || null;
        const page = found.pageNumber || found.page || 1;
        if (bbox) {
          window.dispatchEvent(new CustomEvent("overlay:highlight-region", { detail: { bbox, page } }));
          try {
            window.__last_metadata_locate = { fieldId, handled: true, bbox, page };
          } catch (err) {
          }
          return;
        }
        if (found.overlayId) {
          const overlay = overlays.find((o3) => o3.id === found.overlayId || o3.overlayId === found.overlayId);
          const bbox2 = getBboxFromOverlay(overlay);
          const page2 = overlay?.pageNumber || overlay?.page || found.pageNumber || 1;
          if (bbox2) {
            window.dispatchEvent(new CustomEvent("overlay:highlight-region", { detail: { bbox: bbox2, page: page2 } }));
            try {
              window.__last_metadata_locate = { fieldId, handled: true, bbox: bbox2, page: page2 };
            } catch (err) {
            }
            return;
          }
        }
      }
      const overlayByMapping = overlays.find((o3) => o3.paperlessMapping === fieldId || o3.paperless_mapping === fieldId || o3.paperless_mapping === vfields.find((f4) => f4.id === fieldId)?.paperlessMapping);
      if (overlayByMapping) {
        const bbox = getBboxFromOverlay(overlayByMapping);
        const page = overlayByMapping?.pageNumber || overlayByMapping?.page || 1;
        if (bbox) {
          window.dispatchEvent(new CustomEvent("overlay:highlight-region", { detail: { bbox, page } }));
          try {
            window.__last_metadata_locate = { fieldId, handled: true, bbox, page };
          } catch (err) {
          }
          return;
        }
      }
      const overlayById = overlays.find((o3) => o3.id === fieldId);
      if (overlayById) {
        const bbox = getBboxFromOverlay(overlayById);
        const page = overlayById?.pageNumber || overlayById?.page || 1;
        if (bbox) {
          window.dispatchEvent(new CustomEvent("overlay:highlight-region", { detail: { bbox, page } }));
          try {
            window.__last_metadata_locate = { fieldId, handled: true, bbox, page };
          } catch (err) {
          }
          return;
        }
      }
      try {
        window.__last_metadata_locate = { fieldId, handled: false };
      } catch (err) {
      }
      console.warn("[UnifiedWorkspaceIsland] metadata:locate-field: could not resolve fieldId to overlay bbox", fieldId);
    };
    window.addEventListener("metadata:locate-field", handler);
    return () => window.removeEventListener("metadata:locate-field", handler);
  }, [props.visual]);
  y2(() => {
    window.__workspaceState = window.__workspaceState || {};
    const onDirty = (e3) => {
      const documentId = e3?.detail?.documentId ?? props.documentId ?? null;
      if (!documentId) return;
      const state = window.__workspaceState;
      state[documentId] = state[documentId] || {};
      state[documentId].isDirty = true;
      state[documentId].lastDirtyAt = Date.now();
      window.__workspaceState = state;
      if (props.documentId && Number(props.documentId) === Number(documentId)) setIsDirty(true);
      try {
        window.__last_workspace_state_change = { documentId, isDirty: true };
      } catch (err) {
      }
      dispatchEventSafe8("workspace:state-change", { documentId, isDirty: true });
    };
    const onSaved = (e3) => {
      const documentId = e3?.detail?.documentId ?? props.documentId ?? null;
      if (!documentId) return;
      const state = window.__workspaceState;
      state[documentId] = state[documentId] || {};
      state[documentId].isDirty = false;
      state[documentId].lastSavedAt = Date.now();
      window.__workspaceState = state;
      if (props.documentId && Number(props.documentId) === Number(documentId)) setIsDirty(false);
      try {
        window.__last_workspace_state_change = { documentId, isDirty: false };
      } catch (err) {
      }
      dispatchEventSafe8("workspace:state-change", { documentId, isDirty: false });
    };
    window.addEventListener("workspace:dirty", onDirty);
    window.addEventListener("sync:success", onSaved);
    try {
      const initDirty = window.__workspaceState?.[props.documentId]?.isDirty || false;
      setIsDirty(Boolean(initDirty));
    } catch (err) {
    }
    return () => {
      window.removeEventListener("workspace:dirty", onDirty);
      window.removeEventListener("sync:success", onSaved);
    };
  }, [props.documentId]);
  return /* @__PURE__ */ u3("div", { className: "h-full w-full flex flex-col p-8", children: /* @__PURE__ */ u3("div", { className: "flex-1 border-2 border-dashed border-[#e5e0d8] rounded-lg flex items-center justify-center relative", children: [
    /* @__PURE__ */ u3("p", { className: "font-['Space_Grotesk'] text-[#888]", children: "Document Viewer Area Placeholder" }),
    props.documentId ? /* @__PURE__ */ u3("div", { "data-testid": "workspace-state-badge", "data-state": isDirty2 ? "unsaved" : "clean", className: "absolute top-4 right-4 px-3 py-1 rounded-full text-sm font-semibold bg-white border", children: isDirty2 ? "Unsaved Changes" : "Saved" }) : null
  ] }) });
}

// src/islands/DocumentContextBarIsland.tsx
function DocumentContextBarIsland(props) {
  const [isDropdownOpen, setIsDropdownOpen] = d2(false);
  const [searchTerm, setSearchOpen] = d2("");
  const filteredDocuments = T2(() => {
    if (!searchTerm) return props.availableDocuments;
    const term = searchTerm.toLowerCase();
    return props.availableDocuments.filter(
      (doc) => (doc.title || "").toLowerCase().includes(term) || (doc.original_filename || "").toLowerCase().includes(term) || String(doc.id).includes(term)
    );
  }, [props.availableDocuments, searchTerm]);
  const currentIndex = T2(() => {
    if (!props.documentId) return -1;
    return props.availableDocuments.findIndex((doc) => doc.id === props.documentId);
  }, [props.availableDocuments, props.documentId]);
  const handleNavigate = q2((id) => {
    window.location.href = `/document/${id}`;
  }, []);
  const handlePrev = q2(() => {
    if (currentIndex > 0) {
      handleNavigate(props.availableDocuments[currentIndex - 1].id);
    }
  }, [currentIndex, props.availableDocuments, handleNavigate]);
  const handleNext = q2(() => {
    if (currentIndex < props.availableDocuments.length - 1) {
      handleNavigate(props.availableDocuments[currentIndex + 1].id);
    }
  }, [currentIndex, props.availableDocuments, handleNavigate]);
  y2(() => {
    const onDirty = (e3) => {
      const d3 = e3?.detail || {};
      if (d3 && (d3.documentId === props.documentId || props.documentId == null)) {
        const root = document.querySelector('[data-testid="document-context-bar-root"]');
        if (root) root.setAttribute("data-status", "unsaved");
      }
    };
    const onSaved = (_e) => {
      const root = document.querySelector('[data-testid="document-context-bar-root"]');
      if (root) root.setAttribute("data-status", "saved");
    };
    window.addEventListener("workspace:dirty", onDirty);
    window.addEventListener("sync:success", onSaved);
    return () => {
      window.removeEventListener("workspace:dirty", onDirty);
      window.removeEventListener("sync:success", onSaved);
    };
  }, [props.documentId]);
  const getStatusBadge = () => {
    switch (props.status) {
      case "processing":
        return /* @__PURE__ */ u3("span", { className: "flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full border border-blue-100", "data-testid": "status-processing", children: [
          /* @__PURE__ */ u3("i", { class: "fas fa-circle-notch fa-spin" }),
          " Processing"
        ] });
      case "unsaved":
        return /* @__PURE__ */ u3("span", { className: "flex items-center gap-1.5 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full border border-amber-100", "data-testid": "status-unsaved", children: [
          /* @__PURE__ */ u3("i", { class: "fas fa-circle text-[8px]" }),
          " Unsaved Changes"
        ] });
      case "error":
        return /* @__PURE__ */ u3("span", { className: "flex items-center gap-1.5 text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full border border-red-100", "data-testid": "status-error", children: [
          /* @__PURE__ */ u3("i", { class: "fas fa-exclamation-circle" }),
          " Error"
        ] });
      case "saved":
      default:
        return /* @__PURE__ */ u3("span", { className: "flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100", "data-testid": "status-saved", children: [
          /* @__PURE__ */ u3("i", { class: "fas fa-check-circle" }),
          " Saved"
        ] });
    }
  };
  return /* @__PURE__ */ u3("div", { className: "flex items-center gap-4 w-full max-w-4xl", "data-testid": "document-context-bar-root", children: [
    /* @__PURE__ */ u3("div", { className: "flex items-center bg-[#fdfaf6] border border-[#e5e0d8] rounded-lg p-1", children: [
      /* @__PURE__ */ u3(
        "button",
        {
          onClick: handlePrev,
          disabled: currentIndex <= 0,
          className: "p-2 text-[#555] hover:text-[#b87333] disabled:opacity-30 disabled:cursor-not-allowed transition-colors",
          "data-testid": "nav-prev-btn",
          title: "Previous Document",
          children: /* @__PURE__ */ u3("i", { class: "fas fa-chevron-left" })
        }
      ),
      /* @__PURE__ */ u3("div", { className: "relative", children: [
        /* @__PURE__ */ u3(
          "button",
          {
            onClick: () => setIsDropdownOpen(!isDropdownOpen),
            className: "flex items-center gap-2 px-4 py-1.5 hover:bg-white rounded-md transition-colors min-w-[200px] justify-between group",
            "data-testid": "document-selector-trigger",
            children: [
              /* @__PURE__ */ u3("span", { className: "font-['Space_Grotesk'] font-medium truncate max-w-[240px]", children: props.title || "Select Document" }),
              /* @__PURE__ */ u3("i", { class: `fas fa-chevron-down text-xs transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""}` })
            ]
          }
        ),
        isDropdownOpen && /* @__PURE__ */ u3("div", { className: "absolute top-full left-0 mt-2 w-[320px] bg-white border border-[#e5e0d8] rounded-xl shadow-xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200", "data-testid": "document-selector-dropdown", children: [
          /* @__PURE__ */ u3("div", { className: "p-3 border-b border-[#f5f0e8] bg-[#fdfaf6]", children: /* @__PURE__ */ u3("div", { className: "relative", children: [
            /* @__PURE__ */ u3("i", { class: "fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-[#aaa] text-xs" }),
            /* @__PURE__ */ u3(
              "input",
              {
                type: "text",
                placeholder: "Search documents...",
                className: "w-full pl-9 pr-4 py-2 bg-white border border-[#e5e0d8] rounded-lg text-sm focus:outline-none focus:border-[#b87333] transition-colors",
                value: searchTerm,
                onInput: (e3) => setSearchOpen(e3.target.value),
                autoFocus: true,
                "data-testid": "document-search-input"
              }
            )
          ] }) }),
          /* @__PURE__ */ u3("div", { className: "max-h-[400px] overflow-y-auto p-1", children: filteredDocuments.length > 0 ? filteredDocuments.map((doc) => /* @__PURE__ */ u3(
            "button",
            {
              onClick: () => handleNavigate(doc.id),
              className: `w-full text-left px-4 py-3 rounded-lg flex flex-col gap-0.5 hover:bg-[#fdfaf6] transition-colors group ${doc.id === props.documentId ? "bg-[#fdfaf6]" : ""}`,
              "data-testid": `document-option-${doc.id}`,
              children: [
                /* @__PURE__ */ u3("span", { className: `text-sm font-medium truncate ${doc.id === props.documentId ? "text-[#b87333]" : "text-[#2c2c2c]"}`, children: doc.title || doc.original_filename }),
                /* @__PURE__ */ u3("span", { className: "text-[10px] text-[#888] font-mono", children: [
                  "#",
                  doc.id
                ] })
              ]
            },
            doc.id
          )) : /* @__PURE__ */ u3("div", { className: "px-4 py-8 text-center text-[#888] text-sm", children: "No documents found" }) })
        ] })
      ] }),
      /* @__PURE__ */ u3(
        "button",
        {
          onClick: handleNext,
          disabled: currentIndex < 0 || currentIndex >= props.availableDocuments.length - 1,
          className: "p-2 text-[#555] hover:text-[#b87333] disabled:opacity-30 disabled:cursor-not-allowed transition-colors",
          "data-testid": "nav-next-btn",
          title: "Next Document",
          children: /* @__PURE__ */ u3("i", { class: "fas fa-chevron-right" })
        }
      )
    ] }),
    /* @__PURE__ */ u3("div", { className: "flex items-center gap-3 ml-auto", children: [
      /* @__PURE__ */ u3("div", { className: "hidden sm:block", children: getStatusBadge() }),
      /* @__PURE__ */ u3("div", { className: "h-6 w-[1px] bg-[#e5e0d8] mx-1 hidden sm:block" }),
      /* @__PURE__ */ u3("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ u3(
          "button",
          {
            className: "px-4 py-1.5 text-sm font-medium text-[#555] hover:bg-[#f5f0e8] rounded-lg transition-colors flex items-center gap-2 border border-[#e5e0d8]",
            "data-testid": "reprocess-btn",
            children: [
              /* @__PURE__ */ u3("i", { class: "fas fa-redo-alt text-xs" }),
              "Reprocess"
            ]
          }
        ),
        /* @__PURE__ */ u3(
          "button",
          {
            className: "px-4 py-1.5 text-sm font-medium text-white bg-[#b87333] hover:bg-[#a06028] rounded-lg shadow-sm transition-colors flex items-center gap-2 border border-[#905020]",
            "data-testid": "save-all-btn",
            children: [
              /* @__PURE__ */ u3("i", { class: "fas fa-save text-xs" }),
              "Save Changes"
            ]
          }
        )
      ] })
    ] }),
    isDropdownOpen && /* @__PURE__ */ u3(
      "div",
      {
        className: "fixed inset-0 z-40 bg-transparent",
        onClick: () => setIsDropdownOpen(false)
      }
    )
  ] });
}

// src/islands/ContextSidebarIsland.tsx
var STORAGE_KEY = "paperless:context-sidebar.activeTab";
function ContextSidebarIsland(props) {
  const initial = typeof window !== "undefined" && window.localStorage && window.localStorage.getItem(STORAGE_KEY) || props.activeTab || "metadata";
  const [activeTab, setActiveTab] = d2(initial);
  const tabRefs = A2({});
  y2(() => {
    tabs.forEach((t3) => {
      const el = tabRefs.current[t3.key];
      if (el) el.setAttribute("aria-pressed", String(activeTab === t3.key));
    });
  }, [activeTab]);
  const isAdmin = Boolean(props.isAdmin || typeof window !== "undefined" && window.__TEST_IS_ADMIN === true);
  y2(() => {
    try {
      if (window && window.localStorage) {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) setActiveTab(stored);
      }
    } catch (e3) {
    }
  }, []);
  y2(() => {
    try {
      if (window && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, activeTab);
      }
    } catch (e3) {
    }
  }, [activeTab]);
  y2(() => {
    try {
      window.__context_sidebar_mounted = true;
    } catch (e3) {
    }
  }, []);
  const tabs = [
    { key: "metadata", label: "Metadata", icon: "fa-list", testid: "tab-metadata" },
    { key: "content", label: "Content", icon: "fa-file-text", testid: "tab-content" },
    { key: "chat", label: "Chat", icon: "fa-comments", testid: "tab-chat" }
  ];
  if (isAdmin) {
    tabs.push({ key: "debug", label: "Debug", icon: "fa-bug", testid: "tab-debug" });
  }
  return /* @__PURE__ */ u3("div", { "data-testid": "context-sidebar-root", "data-hydrated": "true", className: "h-full flex flex-col", children: [
    /* @__PURE__ */ u3("div", { role: "tablist", "aria-label": "Context Sidebar Tabs", className: "flex border-b border-[#e5e0d8] bg-[#fdfaf6]", children: tabs.map((t3) => /* @__PURE__ */ u3(
      "button",
      {
        role: "tab",
        "data-testid": t3.testid,
        ref: (el) => {
          tabRefs.current[t3.key] = el;
        },
        className: `flex-1 py-3 text-sm font-['Space_Grotesk'] font-medium ${activeTab === t3.key ? "border-b-2 border-copper text-copper" : "text-[#888]"}`,
        onClick: () => setActiveTab(t3.key),
        children: [
          /* @__PURE__ */ u3("i", { className: `fas ${t3.icon} mr-2` }),
          /* @__PURE__ */ u3("span", { className: "hidden sm:inline", children: t3.label })
        ]
      },
      t3.key
    )) }),
    /* @__PURE__ */ u3("div", { className: "p-4 overflow-auto flex-1", children: [
      activeTab === "metadata" && /* @__PURE__ */ u3("div", { "data-testid": "tab-panel-metadata", children: /* @__PURE__ */ u3(
        SmartMetadataIsland,
        {
          documentId: props.document?.id,
          metadata: props.document,
          customFields: props.document?.customFields || props.visual?.fields
        }
      ) }),
      activeTab === "content" && /* @__PURE__ */ u3("div", { "data-testid": "tab-panel-content", children: /* @__PURE__ */ u3(DocumentContentIsland, { documentId: props.document?.id, content: props.document?.content || "" }) }),
      activeTab === "chat" && /* @__PURE__ */ u3("div", { "data-testid": "tab-panel-chat", children: /* @__PURE__ */ u3(ChatWorkspaceIsland, { documents: props.availableDocuments || [], openDocumentId: props.document?.id, ...props.chat }) }),
      activeTab === "debug" && isAdmin && /* @__PURE__ */ u3("div", { "data-testid": "tab-panel-debug", children: /* @__PURE__ */ u3("pre", { className: "text-xs whitespace-pre-wrap text-gray-700", "data-testid": "debug-content", children: JSON.stringify({ document: props.document, chat: props.chat, visual: props.visual }, null, 2) }) })
    ] })
  ] });
}

// src/islands/runtime.browser.tsx
var registry = {
  "visual-annotation-island": VisualAnnotationIsland,
  "feedback-controls-island": FeedbackControlsIsland,
  "manual-editor-island": ManualEditorIsland,
  "history-tabs-island": HistoryTabsIsland,
  "overlay-viewer-island": OverlayViewerIsland,
  "visual-overlays-island": VisualOverlaysIsland,
  "playground-island": PlaygroundIsland,
  "shadcn-compat": ShadcnCompat,
  "overview-dashboard-island": OverviewDashboardIsland,
  "settings-sidebar-island": SettingsSidebarIsland,
  "connection-settings-island": ConnectionSettingsIsland,
  "ai-provider-island": AIProviderIsland,
  "expert-models-island": ExpertModelsIsland,
  "restart-banner-island": RestartBannerIsland,
  "developer-settings-island": DeveloperSettingsIsland,
  "presets-manager-island": PresetsManagerIsland,
  "export-panel-island": ExportPanelIsland,
  "view-mode-toggle-island": ViewModeToggleIsland,
  "tags-manager-island": TagsManagerIsland,
  "ai-analysis-island": AIAnalysisIsland,
  "chat-workspace-island": ChatWorkspaceIsland,
  "history-manager-island": HistoryManagerIsland,
  "manual-workspace-island": ManualWorkspaceIsland,
  "document-content-island": DocumentContentIsland,
  "smart-metadata-island": SmartMetadataIsland,
  "unified-workspace-island": UnifiedWorkspaceIsland,
  "document-context-bar-island": DocumentContextBarIsland,
  "context-sidebar-island": ContextSidebarIsland
};
function parseProps(el) {
  const raw = el.getAttribute("data-props") || "{}";
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.warn("island-runtime: failed to parse props", err);
    return null;
  }
}
function registerIsland(name, component) {
  registry[name] = component;
}
function mountIslands(container = document) {
  if (typeof window !== "undefined") {
    window.__islandRuntimeMounted = true;
  }
  const nodes = container.querySelectorAll("[data-island]");
  nodes.forEach((el) => {
    const name = el.getAttribute("data-island");
    if (!name) return;
    const Component = registry[name];
    if (!Component) {
      console.warn(`island-runtime: no component for '${name}'`);
      return;
    }
    const props = parseProps(el);
    if (props === null) return;
    G(_(Component, props), el);
    const host = el;
    if (host.dataset) {
      host.dataset.mounted = "true";
    }
    const root = host.querySelector('[data-testid$="-root"]');
    if (root && !root.getAttribute("data-hydrated")) {
      root.setAttribute("data-hydrated", "true");
    }
  });
}
if (typeof window !== "undefined") {
  window.mountIslands = mountIslands;
  window.islandRuntime = {
    mountIslands,
    registerIsland,
    _registry: registry
  };
  const autoMount = () => {
    if (window.__islandRuntimeMounted) return;
    if (document.querySelector("[data-island]")) {
      mountIslands(document);
    }
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoMount);
  } else {
    setTimeout(autoMount, 0);
  }
}
export {
  mountIslands,
  registerIsland
};
