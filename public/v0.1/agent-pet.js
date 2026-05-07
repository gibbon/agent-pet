import { jsx as t, jsxs as l } from "react/jsx-runtime";
import { createContext as Qe, useMemo as D, useState as v, useEffect as P, useRef as q, useCallback as ae, useContext as Ze, useId as et } from "react";
const tt = "agent-pet:config";
class nt {
  constructor(n = tt) {
    this.key = n;
  }
  async load() {
    if (typeof window > "u") return null;
    try {
      const n = window.localStorage.getItem(this.key);
      return n ? JSON.parse(n) : null;
    } catch {
      return null;
    }
  }
  async save(n) {
    if (!(typeof window > "u"))
      try {
        window.localStorage.setItem(this.key, JSON.stringify(n));
      } catch {
      }
  }
}
const Me = "agent-pet:library";
class it {
  load() {
    if (typeof window > "u") return [];
    try {
      return JSON.parse(window.localStorage.getItem(Me) ?? "[]");
    } catch {
      return [];
    }
  }
  save(n) {
    if (!(typeof window > "u"))
      try {
        window.localStorage.setItem(Me, JSON.stringify(n));
      } catch {
      }
  }
  add(n) {
    const a = this.load(), r = a.findIndex((u) => u.id === n.id);
    r >= 0 ? a[r] = n : a.push(n), this.save(a);
  }
  remove(n) {
    this.save(this.load().filter((a) => a.id !== n));
  }
}
const Se = "https://ihzwckyzfcuktrljwpha.supabase.co/functions/v1/petshare", rt = "https://j20.nz/hatchery/api/pets.json";
class at {
  async fetchList() {
    const [n, a] = await Promise.allSettled([
      this.fetchPetshare(),
      this.fetchHatchery()
    ]), r = [];
    return n.status === "fulfilled" && r.push(...n.value), a.status === "fulfilled" && r.push(...a.value), { pets: r };
  }
  async sync() {
    try {
      const { pets: n } = await this.fetchList();
      return { wrote: 0, total: n.length };
    } catch (n) {
      return { wrote: 0, total: 0, error: n instanceof Error ? n.message : "Sync failed" };
    }
  }
  async fetchPetshare() {
    const n = await fetch(`${Se}/list?page=1&pageSize=50`);
    return n.ok ? ((await n.json()).pets ?? []).map((r) => ({
      id: String(r.id ?? ""),
      displayName: String(r.displayName ?? r.id ?? ""),
      description: r.description,
      spritesheetUrl: r.spritesheetUrl ?? `${Se}/spritesheet/${r.id}`,
      bundled: !1
    })).filter((r) => r.id && r.spritesheetUrl) : [];
  }
  async fetchHatchery() {
    const n = await fetch(rt);
    return n.ok ? ((await n.json()).pets ?? []).map((r) => ({
      id: String(r.petManifestId ?? r.id ?? ""),
      displayName: String(r.displayName ?? r.id ?? ""),
      description: r.description,
      spritesheetUrl: String(r.spritesheetUrl ?? ""),
      bundled: !1
    })).filter((r) => r.id && r.spritesheetUrl) : [];
  }
}
const R = "custom", Be = 1, pe = 24, ge = 1, me = 30, ot = {
  adopted: !1,
  enabled: !0,
  petId: R,
  custom: fe()
};
function fe() {
  return { name: "Buddy", glyph: "🐶", accent: "#7eb8da", greeting: "Hi! I am here whenever you need me." };
}
function ye(e) {
  return e != null && e.adopted ? lt(e.custom) : null;
}
function lt(e) {
  var n, a, r, u;
  return {
    id: R,
    name: ((n = e.name) == null ? void 0 : n.trim()) || "Buddy",
    glyph: ((a = e.glyph) == null ? void 0 : a.trim()) || "🦄",
    accent: ((r = e.accent) == null ? void 0 : r.trim()) || "#c96442",
    greeting: ((u = e.greeting) == null ? void 0 : u.trim()) || "Hi! I am here whenever you need me.",
    animation: "float",
    imageUrl: e.imageUrl,
    frames: st(e.frames),
    fps: dt(e.fps),
    atlas: ct(e.atlas)
  };
}
function st(e) {
  return Number.isFinite(e) ? Math.max(Be, Math.min(pe, Math.round(e))) : 1;
}
function dt(e) {
  return Number.isFinite(e) ? Math.max(ge, Math.min(me, Math.round(e))) : 6;
}
function ct(e) {
  if (!e) return;
  const n = Math.max(1, Math.floor(e.cols)), a = Math.max(1, Math.floor(e.rows));
  if (!Number.isFinite(n) || !Number.isFinite(a)) return;
  const r = /* @__PURE__ */ new Set(), u = [];
  for (const s of e.rowsDef ?? []) {
    if (!s || typeof s.id != "string" || !s.id.trim()) continue;
    const h = Math.floor(s.index);
    !Number.isFinite(h) || h < 0 || h >= a || r.has(h) || (r.add(h), u.push({ index: h, id: s.id.trim(), frames: Math.max(1, Math.min(n, Math.floor(s.frames) || 1)), fps: Math.max(ge, Math.min(me, Math.floor(s.fps) || 6)) }));
  }
  if (u.length !== 0)
    return { cols: n, rows: a, rowsDef: u.sort((s, h) => s.index - h.index) };
}
const ut = {
  // Gesture / pointer states
  idle: "idle",
  hover: "waving",
  "drag-right": "running-right",
  "drag-left": "running-left",
  "drag-up": "jumping",
  "drag-down": "waving",
  waiting: "waiting",
  // Named host-state mappings → specific atlas rows
  working: "running",
  sending: "running-right",
  leaving: "running-left",
  excited: "jumping",
  failed: "failed",
  greeting: "waving",
  thinking: "review"
}, ht = ["idle", "waiting", "waving", "running", "running-right"];
function pt(e) {
  return ut[e];
}
function dn(e, n) {
  if (!e || e.rowsDef.length === 0) return;
  const a = e.rowsDef.find((r) => r.id === n);
  if (a) return a;
  for (const r of ht) {
    const u = e.rowsDef.find((s) => s.id === r);
    if (u) return u;
  }
  return e.rowsDef[0];
}
const gt = ["waving", "review", "jumping", "running", "running-right", "running-left"];
function mt(e, n) {
  if (!e || e.rowsDef.length === 0) return null;
  const a = e.rowsDef.filter((s) => gt.includes(s.id));
  if (a.length === 0) return null;
  const r = a.length > 1 && n ? a.filter((s) => s.id !== n) : a, u = r.length > 0 ? r : a;
  return u[Math.floor(Math.random() * u.length)] ?? null;
}
function ft(e) {
  return [
    `${e}: nudge me when you want a fresh idea.`,
    `${e}: I will keep you company while it runs.`,
    `${e}: take a breath — it will be ready soon.`,
    `${e}: small tweaks compound. Keep going!`
  ];
}
const yt = {
  // Semantic widget states
  idle: "idle",
  active: "hover",
  hover: "hover",
  thinking: "thinking",
  building: "working",
  working: "working",
  delegating: "sending",
  sending: "sending",
  leaving: "leaving",
  away: "leaving",
  success: "excited",
  done: "excited",
  completed: "excited",
  excited: "excited",
  error: "failed",
  failed: "failed",
  greeting: "greeting",
  hello: "greeting",
  welcome: "greeting",
  waiting: "waiting",
  // Codex atlas row name aliases — pass them straight through so callers
  // can drive the pet using the original row vocabulary.
  "running-right": "sending",
  "running-left": "leaving",
  waving: "greeting",
  jumping: "excited",
  review: "thinking",
  running: "working"
}, bt = {
  map(e) {
    return yt[e.toLowerCase()] ?? "idle";
  }
}, he = "agent-pet:config-changed", Fe = Qe(null);
function cn({ children: e, store: n, catalog: a, adapter: r, storageKey: u }) {
  const s = D(() => n ?? new nt(u), [n, u]), h = D(() => a ?? new at(), [a]), p = D(() => r ?? bt, [r]), [d, w] = v(ot);
  P(() => {
    s.load().then((x) => {
      x && w(x);
    });
  }, []);
  const g = q(!1);
  P(() => {
    const x = () => {
      if (g.current) {
        g.current = !1;
        return;
      }
      s.load().then((I) => {
        I && w(I);
      });
    };
    return window.addEventListener(he, x), () => window.removeEventListener(he, x);
  }, [s]);
  const b = ae((x) => {
    g.current = !0, w(x), s.save(x), window.dispatchEvent(new CustomEvent(he));
  }, [s]);
  return /* @__PURE__ */ t(Fe.Provider, { value: { pet: d, setPet: b, store: s, catalog: h, adapter: p }, children: e });
}
function be() {
  const e = Ze(Fe);
  if (!e) throw new Error("usePetContext must be used inside PetProvider");
  return e;
}
function we({ active: e, className: n, size: a, rowId: r }) {
  if (!e.imageUrl) {
    const p = a ? { fontSize: Math.round(a * 0.85), width: a, height: a, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" } : void 0;
    return /* @__PURE__ */ t("span", { className: n, "aria-hidden": !0, style: p, children: e.glyph });
  }
  if (e.atlas && e.atlas.rowsDef.length > 0)
    return /* @__PURE__ */ t(
      wt,
      {
        imageUrl: e.imageUrl,
        cols: Math.max(1, e.atlas.cols),
        rows: Math.max(1, e.atlas.rows),
        rowsDef: e.atlas.rowsDef,
        rowId: r,
        className: n,
        size: a
      }
    );
  const u = Math.max(1, e.frames ?? 1), s = Math.max(1, e.fps ?? 6);
  if (u === 1)
    return /* @__PURE__ */ t(
      "span",
      {
        className: `${n ?? ""} ap-image ap-static`.trim(),
        "aria-hidden": !0,
        style: { backgroundImage: `url(${e.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center", width: a, height: a, display: "inline-block" }
      }
    );
  const h = Math.round(u / s * 1e3);
  return /* @__PURE__ */ t(
    "span",
    {
      className: `${n ?? ""} ap-image ap-frames`.trim(),
      "aria-hidden": !0,
      style: {
        backgroundImage: `url(${e.imageUrl})`,
        backgroundSize: `${u * 100}% 100%`,
        animation: `ap-frames ${h}ms steps(${u}, jump-none) infinite`,
        width: a,
        height: a,
        display: "inline-block"
      }
    }
  );
}
function wt({ imageUrl: e, cols: n, rows: a, rowsDef: r, rowId: u, className: s, size: h }) {
  const p = r.find((C) => C.id === u) ?? r.find((C) => C.id === "idle") ?? r[0], d = Math.max(1, p.frames), w = Math.max(1, p.fps), [g, b] = v(0);
  P(() => {
    if (b(0), d <= 1) return;
    const C = Math.max(16, Math.round(1e3 / w)), M = window.setInterval(() => b((A) => (A + 1) % d), C);
    return () => window.clearInterval(M);
  }, [p.id, p.index, d, w]);
  const x = n > 1 ? g / (n - 1) * 100 : 0, I = a > 1 ? p.index / (a - 1) * 100 : 0;
  return /* @__PURE__ */ t(
    "span",
    {
      className: `${s ?? ""} ap-image ap-atlas`.trim(),
      "aria-hidden": !0,
      style: {
        backgroundImage: `url(${e})`,
        backgroundSize: `${n * 100}% ${a * 100}%`,
        backgroundPosition: `${x}% ${I}%`,
        transition: "background-position-y 220ms ease",
        width: h,
        height: h,
        display: "inline-block"
      }
    }
  );
}
function xt({ size: e = 14, style: n }) {
  return /* @__PURE__ */ t("svg", { width: e, height: e, viewBox: "0 0 16 16", fill: "currentColor", style: n, "aria-hidden": !0, children: /* @__PURE__ */ t("path", { d: "M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm5.9-2.5a5.9 5.9 0 0 0-.06-.5l1.2-.93a.3.3 0 0 0 .07-.38l-1.14-1.97a.3.3 0 0 0-.36-.13l-1.4.56a5.6 5.6 0 0 0-.87-.5l-.21-1.49A.3.3 0 0 0 10.83 2H8.17a.3.3 0 0 0-.3.26l-.21 1.49a5.6 5.6 0 0 0-.87.5l-1.4-.56a.3.3 0 0 0-.36.13L3.9 5.79a.3.3 0 0 0 .07.38l1.2.93a5.9 5.9 0 0 0-.06.5c0 .17.02.34.06.5l-1.2.93a.3.3 0 0 0-.07.38l1.14 1.97a.3.3 0 0 0 .36.13l1.4-.56c.27.19.56.35.87.5l.21 1.49c.04.15.17.26.3.26h2.66a.3.3 0 0 0 .3-.26l.21-1.49c.31-.15.6-.31.87-.5l1.4.56a.3.3 0 0 0 .36-.13l1.14-1.97a.3.3 0 0 0-.07-.38l-1.2-.93c.04-.16.06-.33.06-.5z" }) });
}
function oe({ size: e = 14, style: n }) {
  return /* @__PURE__ */ t("svg", { width: e, height: e, viewBox: "0 0 16 16", fill: "currentColor", style: n, "aria-hidden": !0, children: /* @__PURE__ */ t("path", { d: "M12.7 4.7l-1.4-1.4L8 6.6 4.7 3.3 3.3 4.7 6.6 8l-3.3 3.3 1.4 1.4L8 9.4l3.3 3.3 1.4-1.4L9.4 8z" }) });
}
function ie({ size: e = 14, style: n }) {
  return /* @__PURE__ */ t("svg", { width: e, height: e, viewBox: "0 0 16 16", fill: "currentColor", style: n, "aria-hidden": !0, children: /* @__PURE__ */ t("path", { d: "M6.5 12L2 7.5l1.4-1.4 3.1 3.1 6.1-6.1 1.4 1.4z" }) });
}
function K({ size: e = 14, style: n }) {
  return /* @__PURE__ */ t("svg", { width: e, height: e, viewBox: "0 0 16 16", fill: "currentColor", style: n, "aria-hidden": !0, children: /* @__PURE__ */ t("path", { d: "M8 1l1.5 3.5L13 6l-3.5 1.5L8 11l-1.5-3.5L3 6l3.5-1.5zm5 8l.8 1.7 1.7.8-1.7.8L13 14l-.8-1.7-1.7-.8 1.7-.8zM3 11l.5 1 1 .5-1 .5L3 14l-.5-1-1-.5 1-.5z" }) });
}
function vt({ size: e = 14, style: n }) {
  return /* @__PURE__ */ t("svg", { width: e, height: e, viewBox: "0 0 16 16", fill: "currentColor", style: n, "aria-hidden": !0, children: /* @__PURE__ */ t("path", { d: "M8 3C4.5 3 1.5 5.5 0 8c1.5 2.5 4.5 5 8 5s6.5-2.5 8-5c-1.5-2.5-4.5-5-8-5zm0 8a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm0-5a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" }) });
}
function Ct({ size: e = 14, style: n }) {
  return /* @__PURE__ */ t("svg", { width: e, height: e, viewBox: "0 0 16 16", fill: "currentColor", style: n, "aria-hidden": !0, children: /* @__PURE__ */ t("path", { d: "M8 1L4 5h3v5h2V5h3zm-6 11h12v2H2z" }) });
}
function Ee({ size: e = 14, style: n }) {
  return /* @__PURE__ */ t("svg", { width: e, height: e, viewBox: "0 0 16 16", fill: "currentColor", style: n, "aria-hidden": !0, children: /* @__PURE__ */ t("path", { d: "M8 11L4 7h3V2h2v5h3zm-6 2h12v2H2z" }) });
}
function It({ size: e = 14, style: n }) {
  return /* @__PURE__ */ t("svg", { width: e, height: e, viewBox: "0 0 16 16", fill: "currentColor", style: n, "aria-hidden": !0, children: /* @__PURE__ */ t("path", { d: "M13.6 2.4A7 7 0 0 0 1 8h1.5A5.5 5.5 0 0 1 13 4.4V2l3 3-3 3V5.6A5.5 5.5 0 0 1 2.5 8H1a7 7 0 0 0 12.6-5.6z" }) });
}
function At({ size: e = 14, style: n }) {
  return /* @__PURE__ */ t("svg", { width: e, height: e, viewBox: "0 0 16 16", fill: "currentColor", style: n, "aria-hidden": !0, children: /* @__PURE__ */ t("path", { d: "M10 2H2v10h2V4h6zM4 12V4h2v2h2v8H4zm2-6v8h6V6l-2-2h-4zm4 0 2 2h-2z" }) });
}
function Y({ size: e = 14, style: n }) {
  return /* @__PURE__ */ l("svg", { width: e, height: e, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "2", style: { animation: "ap-spin 0.8s linear infinite", ...n }, "aria-hidden": !0, children: [
    /* @__PURE__ */ t("circle", { cx: "8", cy: "8", r: "6", strokeOpacity: "0.25" }),
    /* @__PURE__ */ t("path", { d: "M8 2a6 6 0 0 1 6 6", strokeLinecap: "round" })
  ] });
}
function kt({ size: e = 14, style: n }) {
  return /* @__PURE__ */ t("svg", { width: e, height: e, viewBox: "0 0 16 16", fill: "currentColor", style: n, "aria-hidden": !0, children: /* @__PURE__ */ t("path", { d: "M10 3L5 8l5 5-1.4 1.4L2.2 8l6.4-6.4z" }) });
}
function Mt({ size: e = 14, style: n }) {
  return /* @__PURE__ */ t("svg", { width: e, height: e, viewBox: "0 0 16 16", fill: "currentColor", style: n, "aria-hidden": !0, children: /* @__PURE__ */ t("path", { d: "M6 3l5 5-5 5-1.4-1.4L8.2 8 4.6 4.4z" }) });
}
const St = 45e3, Et = 1400, Lt = 900, Tt = 9e3, Pt = 9e3, Rt = 4e3, _t = 3e3, Le = 14, Te = 1.18, re = { right: 24, bottom: 24 };
function Ut(e) {
  if (typeof window > "u") return re;
  try {
    const n = window.localStorage.getItem(e);
    if (!n) return re;
    const a = JSON.parse(n);
    return {
      right: typeof a.right == "number" ? a.right : re.right,
      bottom: typeof a.bottom == "number" ? a.bottom : re.bottom
    };
  } catch {
    return re;
  }
}
function zt(e, n) {
  try {
    window.localStorage.setItem(e, JSON.stringify(n));
  } catch {
  }
}
function un({ onOpenSettings: e, onDismissSpeech: n, size: a = 96, storageKey: r = "agent-pet:position", hostState: u, currentSpeech: s }) {
  const { pet: h, adapter: p } = be(), d = D(() => ye(h), [h]), [w, g] = v(!1), [b, x] = v(0), [I, C] = v(() => Ut(r)), [M, A] = v(null), B = D(() => p.map(u ?? "idle"), [p, u]), Q = q(B);
  P(() => {
    Q.current = B;
  }, [B]), P(() => {
    B !== "idle" && A((f) => f === "waiting" ? null : f);
  }, [B]);
  const F = M ?? B, [G, V] = v(null), [J, Z] = v(!1), _ = q(null), U = q(null);
  P(() => {
    if (!d) return;
    g(!0);
    const f = window.setTimeout(() => g(!1), 4e3);
    return () => window.clearTimeout(f);
  }, [d == null ? void 0 : d.id]), P(() => {
    s && g(!0);
  }, [s]), P(() => {
    zt(r, I);
  }, [r, I]);
  const O = D(() => d ? [d.greeting, ...ft(d.name)] : [], [d]), le = O.length > 0 ? O[b % O.length] : "", S = ae(() => {
    U.current != null && window.clearTimeout(U.current), U.current = window.setTimeout(() => {
      A((f) => f !== null ? f : Q.current !== "idle" ? null : "waiting"), U.current = null;
    }, St);
  }, []);
  if (P(() => {
    if (d)
      return S(), () => {
        U.current != null && (window.clearTimeout(U.current), U.current = null);
      };
  }, [d == null ? void 0 : d.id, S]), P(() => {
    if (F !== "idle") {
      V(null);
      return;
    }
    const f = d == null ? void 0 : d.atlas;
    if (!f || f.rowsDef.length === 0) return;
    let y, E, k;
    const z = () => {
      const T = mt(f, k);
      if (!T) return;
      k = T.id, V(T.id);
      const H = Et + Math.floor(Math.random() * Lt);
      y = window.setTimeout(() => {
        V(null);
        const ue = Tt + Math.floor(Math.random() * Pt);
        E = window.setTimeout(z, ue);
      }, H);
    }, L = Rt + Math.floor(Math.random() * _t);
    return E = window.setTimeout(z, L), () => {
      y != null && window.clearTimeout(y), E != null && window.clearTimeout(E), V(null);
    };
  }, [F, d == null ? void 0 : d.id, d == null ? void 0 : d.atlas]), !d) return null;
  const ee = (f) => {
    f.button === 0 && (f.currentTarget.setPointerCapture(f.pointerId), _.current = { startX: f.clientX, startY: f.clientY, startRight: I.right, startBottom: I.bottom, moved: !1, direction: null }, S());
  }, X = (f) => {
    const y = _.current;
    if (!y) return;
    const E = f.clientX - y.startX, k = f.clientY - y.startY;
    if (!y.moved && Math.abs(E) + Math.abs(k) < 4) return;
    y.moved = !0, C({
      right: Math.max(8, Math.min(window.innerWidth - a - 24, y.startRight - E)),
      bottom: Math.max(8, Math.min(window.innerHeight - a - 24, y.startBottom - k))
    });
    const z = Math.abs(E), L = Math.abs(k);
    if (z < Le && L < Le) return;
    let T = null;
    z >= L * Te ? T = E > 0 ? "right" : "left" : L >= z * Te && (T = k < 0 ? "up" : "down"), T && T !== y.direction && (y.direction = T, A(T === "right" ? "drag-right" : T === "left" ? "drag-left" : T === "up" ? "drag-up" : "drag-down")), S();
  }, te = (f) => {
    const y = _.current;
    _.current = null;
    try {
      f.currentTarget.releasePointerCapture(f.pointerId);
    } catch {
    }
    y && !y.moved && g((E) => {
      const k = !E;
      return k && x((z) => (z + 1) % Math.max(1, O.length)), k;
    }), A(J ? "hover" : null), S();
  }, ce = {
    position: "fixed",
    right: I.right,
    bottom: I.bottom,
    zIndex: 9999,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 8,
    // @ts-expect-error CSS custom property
    "--pet-accent": d.accent
  }, se = {
    width: a,
    height: a,
    cursor: "grab",
    userSelect: "none",
    borderRadius: "50%",
    // Direct keyframe reference — `var()` for animation-name has uneven
    // support inside shadow DOM, so resolve the keyframe name eagerly.
    animation: d.atlas ? "none" : `ap-${d.animation} 3s ease-in-out infinite`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: Math.round(a * 0.55)
  };
  return /* @__PURE__ */ l("div", { className: "ap-overlay", style: ce, role: "complementary", "aria-label": `${d.name} companion`, children: [
    w && /* @__PURE__ */ l("div", { className: "ap-bubble", role: "status", style: { background: "var(--ap-bubble-bg, #1a1a1a)", border: `1.5px solid ${d.accent}`, borderRadius: 10, padding: "8px 10px", maxWidth: 240, fontSize: 12, color: "var(--ap-bubble-text, #e8e8e8)", boxShadow: `0 2px 12px ${d.accent}33` }, children: [
      /* @__PURE__ */ t("div", { style: { fontWeight: 600, marginBottom: 2, color: d.accent }, children: d.name }),
      /* @__PURE__ */ t("div", { style: { lineHeight: 1.4 }, children: s ? s.text : le }),
      /* @__PURE__ */ l("div", { style: { display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }, children: [
        (s == null ? void 0 : s.link) && /* @__PURE__ */ t(
          "a",
          {
            href: s.link,
            target: "_blank",
            rel: "noopener noreferrer",
            style: {
              display: "flex",
              alignItems: "center",
              gap: 3,
              fontSize: 11,
              color: d.accent,
              textDecoration: "none",
              border: `1px solid ${d.accent}66`,
              borderRadius: 4,
              padding: "2px 6px",
              fontWeight: 600
            },
            children: "Open →"
          }
        ),
        e && /* @__PURE__ */ l("button", { type: "button", onClick: e, style: { display: "flex", alignItems: "center", gap: 4, fontSize: 11, background: "transparent", border: "none", cursor: "pointer", color: "inherit", padding: 0, opacity: 0.7 }, children: [
          /* @__PURE__ */ t(xt, { size: 11 }),
          /* @__PURE__ */ t("span", { children: "Change pet" })
        ] }),
        /* @__PURE__ */ l("button", { type: "button", onClick: () => {
          g(!1), s && (n == null || n());
        }, style: { display: "flex", alignItems: "center", gap: 4, fontSize: 11, background: "transparent", border: "none", cursor: "pointer", color: "inherit", padding: 0, opacity: 0.7 }, children: [
          /* @__PURE__ */ t(oe, { size: 11 }),
          /* @__PURE__ */ t("span", { children: "Dismiss" })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ t(
      "div",
      {
        className: "ap-sprite",
        style: se,
        onPointerDown: ee,
        onPointerMove: X,
        onPointerUp: te,
        onPointerEnter: () => {
          Z(!0), _.current || A("hover"), S();
        },
        onPointerLeave: () => {
          Z(!1), _.current || A(null), S();
        },
        title: d.name,
        "aria-label": `${d.name} pet`,
        "data-pet-state": F,
        "data-pet-ambient": G ?? void 0,
        children: /* @__PURE__ */ t(
          we,
          {
            active: d,
            className: "ap-sprite-face",
            size: a,
            rowId: G ?? pt(F)
          }
        )
      }
    )
  ] });
}
const $ = 8, j = 9, Dt = 192, Ht = 208, Nt = $ * Dt, Bt = j * Ht, Ft = Nt / Bt, de = [
  { index: 0, id: "idle", frames: 6, fps: 6 },
  { index: 1, id: "running-right", frames: 8, fps: 8 },
  { index: 2, id: "running-left", frames: 8, fps: 8 },
  { index: 3, id: "waving", frames: 4, fps: 6 },
  { index: 4, id: "jumping", frames: 5, fps: 7 },
  { index: 5, id: "failed", frames: 8, fps: 7 },
  { index: 6, id: "waiting", frames: 6, fps: 6 },
  { index: 7, id: "running", frames: 6, fps: 8 },
  { index: 8, id: "review", frames: 6, fps: 6 }
], Ot = {
  cols: $,
  rows: j,
  rowsDef: de.map((e) => ({
    index: e.index,
    id: e.id,
    frames: e.frames,
    fps: e.fps
  }))
};
function Wt(e, n) {
  return !Number.isFinite(e) || !Number.isFinite(n) || e <= 0 || n <= 0 ? !1 : Math.abs(e / n - Ft) < 0.06;
}
const $t = /* @__PURE__ */ new Set(["image/png", "image/webp", "image/jpeg", "image/gif"]);
async function Pe(e) {
  if (!e.type.startsWith("image/")) throw new Error("Only image files are supported.");
  if (!$t.has(e.type)) throw new Error("Use a PNG, WebP, JPEG, or GIF spritesheet.");
  const n = await Yt(e), a = await Vt(n);
  return { dataUrl: n, width: a.width, height: a.height };
}
const jt = 96;
async function Gt(e, n) {
  const a = Math.max(1, Math.floor(n.cols ?? $)), r = Math.max(1, Math.floor(n.rows ?? j)), u = Math.max(0, Math.min(r - 1, Math.floor(n.rowIndex))), s = de.find((A) => A.index === u), h = Math.max(1, Math.min(a, Math.floor(n.frames ?? (s == null ? void 0 : s.frames) ?? a))), p = n.maxCellHeight === null ? null : n.maxCellHeight ?? jt, d = await Oe(e), w = Math.floor(d.naturalWidth / a), g = Math.floor(d.naturalHeight / r);
  if (w <= 0 || g <= 0) throw new Error("Atlas image is too small to crop.");
  const b = p && g > p ? p : g, x = b / g, I = Math.max(1, Math.round(w * x)), C = document.createElement("canvas");
  C.width = I * h, C.height = b;
  const M = C.getContext("2d");
  if (!M) throw new Error("Canvas is unavailable in this browser.");
  M.imageSmoothingEnabled = !1;
  for (let A = 0; A < h; A++)
    M.drawImage(d, A * w, u * g, w, g, A * I, 0, I, b);
  return { dataUrl: C.toDataURL("image/png"), width: I * h, height: b, frames: h };
}
const Xt = 80;
async function Re(e, n) {
  const a = (n == null ? void 0 : n.maxCellHeight) === null ? null : (n == null ? void 0 : n.maxCellHeight) ?? Xt, r = await Oe(e), u = Math.floor(r.naturalWidth / $), s = Math.floor(r.naturalHeight / j);
  if (u <= 0 || s <= 0) throw new Error("Atlas image is too small to slice.");
  const h = a && s > a ? a : s, p = h / s, d = Math.max(1, Math.round(u * p)), w = document.createElement("canvas");
  w.width = d * $, w.height = h * j;
  const g = w.getContext("2d");
  if (!g) throw new Error("Canvas is unavailable in this browser.");
  g.imageSmoothingEnabled = !1;
  for (let b = 0; b < j; b++)
    for (let x = 0; x < $; x++)
      g.drawImage(r, x * u, b * s, u, s, x * d, b * h, d, h);
  return { dataUrl: w.toDataURL("image/png"), width: d * $, height: h * j, layout: Ot };
}
function Yt(e) {
  return new Promise((n, a) => {
    const r = new FileReader();
    r.onerror = () => a(r.error ?? new Error("Read failed")), r.onload = () => {
      if (typeof r.result != "string") {
        a(new Error("Could not decode the image."));
        return;
      }
      n(r.result);
    }, r.readAsDataURL(e);
  });
}
function Vt(e) {
  return new Promise((n, a) => {
    const r = new Image();
    r.onload = () => n({ width: r.naturalWidth, height: r.naturalHeight }), r.onerror = () => a(new Error("Could not load that image.")), r.src = e;
  });
}
function Oe(e) {
  return new Promise((n, a) => {
    const r = new Image();
    r.onload = () => n(r), r.onerror = () => a(new Error("Could not load that image.")), r.src = e;
  });
}
const _e = 800 * 1024, Jt = 384, Kt = /* @__PURE__ */ new Set(["image/gif", "image/svg+xml", "image/webp"]);
async function qt(e) {
  if (!e.type.startsWith("image/")) throw new Error("Only image files are supported.");
  if (Kt.has(e.type)) {
    const p = await Ue(e);
    if (De(p) > _e) throw new Error("That image is too large after encoding. Try one under ~800 KB.");
    const d = await ze(p);
    return { dataUrl: p, width: d.width, height: d.height, reencoded: !1 };
  }
  const n = await Ue(e), a = await ze(n), r = Math.min(1, Jt / Math.max(a.width, a.height)), u = Math.max(1, Math.round(a.width * r)), s = Math.max(1, Math.round(a.height * r)), h = await Qt(n, u, s);
  if (De(h) > _e) throw new Error("That image is too large after encoding. Try a smaller source.");
  return { dataUrl: h, width: u, height: s, reencoded: !0 };
}
function Ue(e) {
  return new Promise((n, a) => {
    const r = new FileReader();
    r.onerror = () => a(r.error ?? new Error("Read failed")), r.onload = () => {
      if (typeof r.result != "string") {
        a(new Error("Could not decode the image."));
        return;
      }
      n(r.result);
    }, r.readAsDataURL(e);
  });
}
function ze(e) {
  return new Promise((n, a) => {
    const r = new Image();
    r.onload = () => n({ width: r.naturalWidth, height: r.naturalHeight }), r.onerror = () => a(new Error("Could not load that image.")), r.src = e;
  });
}
function Qt(e, n, a) {
  return new Promise((r, u) => {
    const s = new Image();
    s.onload = () => {
      const h = document.createElement("canvas");
      h.width = n, h.height = a;
      const p = h.getContext("2d");
      if (!p) {
        u(new Error("Canvas is unavailable in this browser."));
        return;
      }
      p.drawImage(s, 0, 0, n, a);
      try {
        r(h.toDataURL("image/png"));
      } catch (d) {
        u(d instanceof Error ? d : new Error("Encode failed"));
      }
    }, s.onerror = () => u(new Error("Could not load that image.")), s.src = e;
  });
}
function De(e) {
  const n = e.indexOf(",");
  return n === -1 ? e.length : Math.floor(e.slice(n + 1).length * 3 / 4);
}
const Zt = ["#c96442", "#2348b8", "#1f7a3a", "#6c3aa6", "#d97a26", "#9c2a25", "#74716b", "#0d0c0a"], He = { adopted: !1, enabled: !0, petId: R, custom: fe() };
function hn() {
  const { pet: e, setPet: n, catalog: a } = be(), r = et(), u = q(null), s = q(null), [h, p] = v(null), [d, w] = v(!1), [g, b] = v(null), [x, I] = v(0), [C, M] = v(!1), [A, B] = v(""), [Q, F] = v(!1), [G, V] = v([]), [J, Z] = v(!1), [_, U] = v(null), [O, le] = v(!1), [S, ee] = v(null), X = D(() => new it(), []), [te, ce] = v(() => typeof window < "u" ? X.load() : []), se = ae(() => ce(X.load()), [X]), f = e.petId === R && e.custom.imageUrl && !e.custom.atlas ? "custom" : "builtIn", [y, E] = v(f);
  P(() => {
    g && E("custom");
  }, [g]);
  const k = ae(async () => {
    Z(!0);
    try {
      const i = await a.fetchList();
      V(i.pets);
    } finally {
      Z(!1);
    }
  }, [a]);
  P(() => {
    y === "community" && k();
  }, [y, k]);
  const z = ae(async () => {
    le(!0), ee(null);
    try {
      const i = await a.sync("all");
      ee(i.error ? { kind: "error", error: i.error } : { kind: "done", wrote: i.wrote, total: i.total }), await k();
    } catch (i) {
      ee({ kind: "error", error: i instanceof Error ? i.message : "Sync failed" });
    } finally {
      le(!1);
    }
  }, [a, k]), L = (i) => {
    const c = e ?? He;
    n({ ...c, ...i, custom: { ...c.custom, ...i.custom ?? {} } });
  }, T = (i) => L({ adopted: !0, enabled: !0, petId: i }), H = (i, c) => {
    const m = e ?? He, N = { ...m.custom, ...i }, W = (c == null ? void 0 : c.focusCustom) && N.imageUrl;
    n({ ...m, adopted: W ? !0 : m.adopted, enabled: W ? !0 : m.enabled, petId: W ? R : m.petId, custom: N });
  };
  async function ue(i) {
    if (i) {
      p(null), w(!0);
      try {
        const c = await nn(i);
        if (c && Wt(c.width, c.height)) {
          b(await Pe(i)), I(0);
          return;
        }
        const m = await qt(i), N = m.width / Math.max(1, m.height) >= 1.6 ? Math.min(pe, Math.max(2, Math.round(m.width / m.height))) : 1;
        H({ imageUrl: m.dataUrl, frames: N, fps: e.custom.fps ?? 6 }, { focusCustom: !0 });
      } catch (c) {
        p(c instanceof Error ? c.message : "Could not load that image.");
      } finally {
        w(!1);
      }
    }
  }
  async function $e(i) {
    if (i) {
      p(null), M(!0);
      try {
        b(await Pe(i)), I(0);
      } catch (c) {
        p(c instanceof Error ? c.message : "Could not load that atlas.");
      } finally {
        M(!1);
      }
    }
  }
  async function je() {
    if (!g) return;
    const i = de.find((c) => c.index === x);
    M(!0);
    try {
      const c = await Gt(g.dataUrl, { rowIndex: x, cols: $, rows: j });
      H({ imageUrl: c.dataUrl, frames: c.frames, fps: (i == null ? void 0 : i.fps) ?? e.custom.fps ?? 6, atlas: void 0 }, { focusCustom: !0 }), b(null);
    } catch (c) {
      p(c instanceof Error ? c.message : "Could not crop that row.");
    } finally {
      M(!1);
    }
  }
  async function Ge() {
    var i;
    if (g) {
      M(!0);
      try {
        const c = await Re(g.dataUrl);
        H({ imageUrl: c.dataUrl, atlas: c.layout, frames: 1, fps: ((i = c.layout.rowsDef[0]) == null ? void 0 : i.fps) ?? e.custom.fps ?? 6 }, { focusCustom: !0 }), b(null);
      } catch (c) {
        p(c instanceof Error ? c.message : "Could not import that atlas.");
      } finally {
        M(!1);
      }
    }
  }
  async function Xe(i) {
    var c;
    U(i.id), p(null);
    try {
      const m = await fetch(i.spritesheetUrl);
      if (!m.ok) throw new Error("Could not download that pet.");
      const N = await m.blob(), W = await tn(N), ne = await Re(W), ke = {
        name: i.displayName || i.id,
        glyph: e.custom.glyph || "🐾",
        accent: e.custom.accent || "#c96442",
        greeting: i.description || `Hi! I am ${i.displayName}.`,
        imageUrl: ne.dataUrl,
        frames: 1,
        fps: ((c = ne.layout.rowsDef[0]) == null ? void 0 : c.fps) ?? 6,
        atlas: ne.layout
      };
      X.add({ id: i.id, adoptedAt: Date.now(), custom: ke }), se(), H(ke, { focusCustom: !0 });
    } catch (m) {
      p(m instanceof Error ? m.message : "Could not adopt that pet.");
    } finally {
      U(null);
    }
  }
  function xe(i) {
    L({ adopted: !0, enabled: !0, petId: i.id, custom: i.custom });
  }
  function Ye(i) {
    X.remove(i), se();
  }
  const ve = D(() => {
    const i = A.trim();
    return [i ? `Hatch a Codex-compatible animated pet for me. Concept: ${i}.` : "Hatch a Codex-compatible animated pet for me.", "", "Use the @hatch-pet skill end-to-end:", "1. Generate the base look with $imagegen.", "2. Generate every row strip (idle, running-right, waving, jumping, failed, waiting, running, review).", "3. Mirror running-left from running-right only when the design is symmetric.", "4. Run the deterministic scripts (extract / compose / validate / contact-sheet / videos).", "5. Package the result with pet.json + spritesheet.webp.", "", "When the spritesheet is saved, tell me the path so I can import it via Settings → Pets → Import Codex sprite."].join(`
`);
  }, [A]);
  async function Ve() {
    try {
      await navigator.clipboard.writeText(ve), F(!0), window.setTimeout(() => F(!1), 1800);
    } catch {
      F(!1);
    }
  }
  const Je = ye({ ...e, adopted: !0 }), Ce = D(() => G.filter((i) => i.bundled), [G]), Ie = D(() => G.filter((i) => !i.bundled), [G]), Ke = {
    builtIn: "Curated pets — click to adopt",
    custom: "Upload your own sprite or atlas",
    community: "Sync pets from the community catalog"
  }, o = en;
  function Ae(i) {
    const c = _ === i.id, m = te.find((ne) => ne.id === i.id), N = !!m, W = N && e.adopted && !!(m != null && m.custom.imageUrl) && m.custom.imageUrl === e.custom.imageUrl;
    return /* @__PURE__ */ l("div", { style: { ...o.card, ...W ? o.cardActive : {} }, children: [
      /* @__PURE__ */ t("div", { style: { ...o.cardThumb, backgroundImage: `url(${i.spritesheetUrl})`, backgroundSize: "800% 900%", backgroundPosition: "0% 0%" }, "aria-hidden": !0 }),
      /* @__PURE__ */ l("div", { style: o.cardMeta, children: [
        /* @__PURE__ */ t("strong", { style: { fontSize: 12 }, children: i.displayName }),
        i.description && /* @__PURE__ */ t("span", { style: { fontSize: 11, opacity: 0.7 }, children: i.description })
      ] }),
      W ? /* @__PURE__ */ l("button", { type: "button", style: { ...o.btn, ...o.btnActive }, disabled: !0, "aria-pressed": !0, children: [
        /* @__PURE__ */ t(ie, { size: 11 }),
        /* @__PURE__ */ t("span", { children: "Active" })
      ] }) : N ? /* @__PURE__ */ l("button", { type: "button", style: o.btn, onClick: () => xe(m), disabled: _ !== null, children: [
        /* @__PURE__ */ t(K, { size: 11 }),
        /* @__PURE__ */ t("span", { children: "Switch" })
      ] }) : /* @__PURE__ */ l("button", { type: "button", style: o.btn, onClick: () => void Xe(i), disabled: c || _ !== null, children: [
        c ? /* @__PURE__ */ t(Y, { size: 11 }) : /* @__PURE__ */ t(Ee, { size: 11 }),
        /* @__PURE__ */ t("span", { children: c ? "Downloading…" : "Adopt" })
      ] })
    ] }, i.id);
  }
  function qe(i) {
    const c = e.adopted && !!i.custom.imageUrl && i.custom.imageUrl === e.custom.imageUrl, m = i.custom.imageUrl;
    return /* @__PURE__ */ l("div", { style: { ...o.card, ...c ? o.cardActive : {} }, children: [
      /* @__PURE__ */ t("div", { style: { ...o.cardThumb, ...m ? { backgroundImage: `url(${m})`, backgroundSize: i.custom.atlas ? "800% 900%" : `${i.custom.frames ?? 1}00% 100%`, backgroundPosition: "0% 0%" } : { background: (i.custom.accent ?? "#c96442") + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 } }, "aria-hidden": !0, children: !m && /* @__PURE__ */ t("span", { children: i.custom.glyph || "🐾" }) }),
      /* @__PURE__ */ t("div", { style: o.cardMeta, children: /* @__PURE__ */ t("strong", { style: { fontSize: 12 }, children: i.custom.name }) }),
      /* @__PURE__ */ l("div", { style: { display: "flex", gap: 4 }, children: [
        c ? /* @__PURE__ */ l("button", { type: "button", style: { ...o.btn, ...o.btnActive, flex: 1 }, disabled: !0, children: [
          /* @__PURE__ */ t(ie, { size: 11 }),
          /* @__PURE__ */ t("span", { children: "Active" })
        ] }) : /* @__PURE__ */ l("button", { type: "button", style: { ...o.btn, flex: 1 }, onClick: () => xe(i), children: [
          /* @__PURE__ */ t(K, { size: 11 }),
          /* @__PURE__ */ t("span", { children: "Switch" })
        ] }),
        /* @__PURE__ */ t("button", { type: "button", style: { ...o.btn, ...o.btnGhost, padding: "4px 7px" }, onClick: () => Ye(i.id), title: "Remove from collection", children: /* @__PURE__ */ t(oe, { size: 11 }) })
      ] })
    ] }, i.id);
  }
  return /* @__PURE__ */ l("section", { style: o.section, children: [
    /* @__PURE__ */ l("div", { style: o.sectionHead, children: [
      /* @__PURE__ */ l("div", { children: [
        /* @__PURE__ */ t("h3", { style: o.h3, children: "Companion Pet" }),
        /* @__PURE__ */ t("p", { style: o.hint, children: "An animated companion that reacts to your agent's state." })
      ] }),
      /* @__PURE__ */ l("button", { type: "button", style: { ...o.btn, ...e.enabled ? o.btnActive : {} }, onClick: () => L({ enabled: !e.enabled, adopted: e.adopted || e.petId !== "" }), disabled: !e.adopted, title: e.enabled ? "Dismiss pet" : "Wake pet", children: [
        e.enabled ? /* @__PURE__ */ t(vt, { size: 13 }) : /* @__PURE__ */ t(K, { size: 13 }),
        /* @__PURE__ */ t("span", { children: e.enabled ? "Dismiss" : "Wake" })
      ] })
    ] }),
    /* @__PURE__ */ l("div", { style: { marginBottom: 12 }, children: [
      /* @__PURE__ */ t("div", { style: o.tabList, role: "tablist", "aria-label": "Pet source", children: ["builtIn", "custom", "community"].map((i) => /* @__PURE__ */ t("button", { type: "button", role: "tab", "aria-selected": y === i, style: { ...o.tab, ...y === i ? o.tabActive : {} }, onClick: () => E(i), children: i === "builtIn" ? "Built-in" : i === "custom" ? "Custom" : "Community" }, i)) }),
      /* @__PURE__ */ t("p", { style: o.hint, children: Ke[y] })
    ] }),
    y === "builtIn" && /* @__PURE__ */ l("div", { children: [
      Ce.length === 0 ? /* @__PURE__ */ t("p", { style: o.hint, children: J ? "Loading…" : "No bundled pets available. Sync from the Community tab to fetch some." }) : /* @__PURE__ */ t("div", { style: o.grid, children: Ce.map(Ae) }),
      h && /* @__PURE__ */ t("p", { style: { ...o.hint, color: "#e05555" }, children: h })
    ] }),
    y === "custom" && /* @__PURE__ */ l("div", { children: [
      /* @__PURE__ */ l("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }, children: [
        /* @__PURE__ */ l("div", { children: [
          /* @__PURE__ */ t("strong", { style: { fontSize: 13 }, children: "Your pet" }),
          /* @__PURE__ */ t("p", { style: o.hint, children: "Upload a sprite, set the name and accent colour." })
        ] }),
        /* @__PURE__ */ l("button", { type: "button", style: { ...o.btn, ...e.adopted && e.petId === R ? o.btnActive : {} }, onClick: () => T(R), children: [
          e.adopted && e.petId === R ? /* @__PURE__ */ t(ie, { size: 11 }) : /* @__PURE__ */ t(K, { size: 11 }),
          /* @__PURE__ */ t("span", { children: e.adopted && e.petId === R ? "Active" : "Use this pet" })
        ] })
      ] }),
      /* @__PURE__ */ l("div", { style: { ...o.preview, borderColor: e.custom.accent }, children: [
        /* @__PURE__ */ t("span", { style: { width: 48, height: 48, display: "flex", alignItems: "center", justifyContent: "center" }, children: /* @__PURE__ */ t(we, { active: Je, size: 48 }) }),
        /* @__PURE__ */ l("div", { style: { marginLeft: 10 }, children: [
          /* @__PURE__ */ t("strong", { style: { fontSize: 13, color: e.custom.accent }, children: e.custom.name || "Buddy" }),
          /* @__PURE__ */ t("p", { style: { ...o.hint, marginTop: 2 }, children: e.custom.greeting || "Hi! I am here whenever you need me." })
        ] })
      ] }),
      /* @__PURE__ */ t("input", { ref: u, type: "file", accept: "image/png,image/jpeg,image/webp,image/gif,image/svg+xml", style: { display: "none" }, onChange: (i) => {
        var c;
        ue((c = i.target.files) == null ? void 0 : c[0]), i.target.value = "";
      } }),
      /* @__PURE__ */ t("input", { ref: s, type: "file", accept: "image/png,image/webp,image/jpeg,image/gif", style: { display: "none" }, onChange: (i) => {
        var c;
        $e((c = i.target.files) == null ? void 0 : c[0]), i.target.value = "";
      } }),
      /* @__PURE__ */ l("div", { style: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }, children: [
        /* @__PURE__ */ l("button", { type: "button", style: o.btn, onClick: () => {
          var i;
          return (i = u.current) == null ? void 0 : i.click();
        }, disabled: d, children: [
          d ? /* @__PURE__ */ t(Y, { size: 11 }) : /* @__PURE__ */ t(Ct, { size: 11 }),
          /* @__PURE__ */ t("span", { children: e.custom.imageUrl ? "Replace sprite" : "Upload sprite" })
        ] }),
        /* @__PURE__ */ l("button", { type: "button", style: { ...o.btn, ...o.btnGhost }, onClick: () => {
          var i;
          return (i = s.current) == null ? void 0 : i.click();
        }, disabled: C, title: "Import a Codex 8×9 sprite atlas", children: [
          C ? /* @__PURE__ */ t(Y, { size: 11 }) : /* @__PURE__ */ t(K, { size: 11 }),
          /* @__PURE__ */ t("span", { children: "Import Codex atlas" })
        ] }),
        e.custom.imageUrl && /* @__PURE__ */ l("button", { type: "button", style: { ...o.btn, ...o.btnGhost }, onClick: () => H({ imageUrl: void 0, frames: 1, atlas: void 0 }), children: [
          /* @__PURE__ */ t(oe, { size: 11 }),
          /* @__PURE__ */ t("span", { children: "Remove" })
        ] })
      ] }),
      e.custom.imageUrl && e.custom.atlas && /* @__PURE__ */ t("p", { style: { ...o.hint, color: "#4ec9e0" }, children: "Full atlas active — 9 animation rows." }),
      e.custom.imageUrl && !e.custom.atlas && /* @__PURE__ */ l("div", { style: { display: "flex", gap: 16, marginTop: 6 }, children: [
        /* @__PURE__ */ l("label", { style: o.field, children: [
          /* @__PURE__ */ t("span", { style: o.fieldLabel, children: "Frames" }),
          /* @__PURE__ */ t("input", { type: "number", min: Be, max: pe, step: 1, value: e.custom.frames ?? 1, onChange: (i) => {
            const c = parseInt(i.target.value, 10);
            Number.isFinite(c) && H({ frames: c });
          }, style: o.input }),
          /* @__PURE__ */ t("p", { style: o.hint, children: "Horizontal cells in the sprite strip" })
        ] }),
        /* @__PURE__ */ l("label", { style: o.field, children: [
          /* @__PURE__ */ t("span", { style: o.fieldLabel, children: "FPS" }),
          /* @__PURE__ */ t("input", { type: "number", min: ge, max: me, step: 1, value: e.custom.fps ?? 6, onChange: (i) => {
            const c = parseInt(i.target.value, 10);
            Number.isFinite(c) && H({ fps: c });
          }, style: o.input }),
          /* @__PURE__ */ t("p", { style: o.hint, children: "Playback speed" })
        ] })
      ] }),
      h && /* @__PURE__ */ t("p", { style: { ...o.hint, color: "#e05555", marginTop: 4 }, children: h }),
      g && /* @__PURE__ */ l("div", { style: o.atlasPicker, children: [
        /* @__PURE__ */ l("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }, children: [
          /* @__PURE__ */ l("div", { children: [
            /* @__PURE__ */ t("strong", { style: { fontSize: 13 }, children: "Atlas row picker" }),
            /* @__PURE__ */ t("p", { style: o.hint, children: "Choose one row or adopt the full atlas for interactive animations." })
          ] }),
          /* @__PURE__ */ l("button", { type: "button", style: { ...o.btn, ...o.btnGhost }, onClick: () => b(null), disabled: C, children: [
            /* @__PURE__ */ t(oe, { size: 11 }),
            /* @__PURE__ */ t("span", { children: "Cancel" })
          ] })
        ] }),
        /* @__PURE__ */ t("div", { style: { width: "100%", height: 80, backgroundImage: `url(${g.dataUrl})`, backgroundSize: "100% auto", backgroundRepeat: "no-repeat", borderRadius: 6, marginBottom: 8 }, "aria-hidden": !0 }),
        /* @__PURE__ */ t("div", { style: { display: "flex", flexDirection: "column", gap: 2 }, role: "radiogroup", "aria-label": "Animation rows", children: de.map((i) => {
          const c = i.index === x;
          return /* @__PURE__ */ l("button", { type: "button", role: "radio", "aria-checked": c, style: { ...o.atlasRow, ...c ? o.atlasRowActive : {} }, onClick: () => I(i.index), disabled: C, children: [
            /* @__PURE__ */ t("span", { style: { flex: 1, textAlign: "left", textTransform: "capitalize" }, children: i.id.replace(/-/g, " ") }),
            /* @__PURE__ */ l("span", { style: { opacity: 0.6, fontSize: 11 }, children: [
              i.frames,
              " frames · ",
              i.fps,
              " fps"
            ] })
          ] }, i.id);
        }) }),
        /* @__PURE__ */ l("div", { style: { display: "flex", gap: 6, marginTop: 8 }, children: [
          /* @__PURE__ */ l("button", { type: "button", style: o.btn, onClick: () => void Ge(), disabled: C, title: "Keep all 9 rows for interactive animations", children: [
            C ? /* @__PURE__ */ t(Y, { size: 11 }) : /* @__PURE__ */ t(K, { size: 11 }),
            /* @__PURE__ */ t("span", { children: "Use full atlas" })
          ] }),
          /* @__PURE__ */ l("button", { type: "button", style: { ...o.btn, ...o.btnGhost }, onClick: () => void je(), disabled: C, title: "Crop and use just this row", children: [
            C ? /* @__PURE__ */ t(Y, { size: 11 }) : /* @__PURE__ */ t(ie, { size: 11 }),
            /* @__PURE__ */ t("span", { children: "Use this row" })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ l("div", { style: { display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }, children: [
        /* @__PURE__ */ l("label", { style: o.field, children: [
          /* @__PURE__ */ t("span", { style: o.fieldLabel, children: "Name" }),
          /* @__PURE__ */ t("input", { type: "text", maxLength: 32, value: e.custom.name, placeholder: "Buddy", onChange: (i) => L({ custom: { ...e.custom, name: i.target.value } }), style: o.input })
        ] }),
        /* @__PURE__ */ l("label", { style: o.field, htmlFor: r, children: [
          /* @__PURE__ */ t("span", { style: o.fieldLabel, children: "Glyph" }),
          /* @__PURE__ */ t("input", { id: r, type: "text", maxLength: 4, value: e.custom.glyph, placeholder: "🦄", onChange: (i) => L({ custom: { ...e.custom, glyph: i.target.value } }), style: { ...o.input, width: 60 } }),
          /* @__PURE__ */ t("p", { style: o.hint, children: "Emoji or short text shown when no sprite is uploaded" })
        ] }),
        /* @__PURE__ */ l("label", { style: o.field, children: [
          /* @__PURE__ */ t("span", { style: o.fieldLabel, children: "Greeting" }),
          /* @__PURE__ */ t("input", { type: "text", maxLength: 120, value: e.custom.greeting, placeholder: "Hi! I am here whenever you need me.", onChange: (i) => L({ custom: { ...e.custom, greeting: i.target.value } }), style: o.input })
        ] }),
        /* @__PURE__ */ l("div", { style: o.field, children: [
          /* @__PURE__ */ t("span", { style: o.fieldLabel, children: "Accent colour" }),
          /* @__PURE__ */ l("div", { style: { display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }, role: "radiogroup", "aria-label": "Accent colour", children: [
            Zt.map((i) => {
              const c = e.custom.accent.toLowerCase() === i.toLowerCase();
              return /* @__PURE__ */ t("button", { type: "button", role: "radio", "aria-checked": c, style: { width: 22, height: 22, borderRadius: "50%", background: i, border: c ? "2px solid white" : "2px solid transparent", cursor: "pointer", outline: c ? `2px solid ${i}` : "none", outlineOffset: 1 }, onClick: () => L({ custom: { ...e.custom, accent: i } }), title: i }, i);
            }),
            /* @__PURE__ */ t("input", { type: "color", "aria-label": "Custom colour", value: e.custom.accent, onChange: (i) => L({ custom: { ...e.custom, accent: i.target.value } }), style: { width: 28, height: 22, border: "none", background: "none", cursor: "pointer", padding: 0 } })
          ] })
        ] })
      ] })
    ] }),
    y === "community" && /* @__PURE__ */ l("div", { children: [
      te.length > 0 && /* @__PURE__ */ l("div", { style: { marginBottom: 20 }, children: [
        /* @__PURE__ */ t("strong", { style: { fontSize: 13 }, children: "My pets" }),
        /* @__PURE__ */ t("p", { style: { ...o.hint, marginBottom: 8 }, children: "Your downloaded collection — click Switch to activate." }),
        /* @__PURE__ */ t("div", { style: o.grid, children: te.map(qe) })
      ] }),
      /* @__PURE__ */ l("div", { style: { marginBottom: 16 }, children: [
        /* @__PURE__ */ l("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }, children: [
          /* @__PURE__ */ l("div", { children: [
            /* @__PURE__ */ t("strong", { style: { fontSize: 13 }, children: "Community catalog" }),
            /* @__PURE__ */ t("p", { style: o.hint, children: "Pets from Codex Pet Share and j20 Hatchery." })
          ] }),
          /* @__PURE__ */ l("div", { style: { display: "flex", gap: 6 }, children: [
            /* @__PURE__ */ l("button", { type: "button", style: o.btn, onClick: () => void z(), disabled: O, title: "Download latest pets from the community catalogs", children: [
              O ? /* @__PURE__ */ t(Y, { size: 11 }) : /* @__PURE__ */ t(Ee, { size: 11 }),
              /* @__PURE__ */ t("span", { children: O ? "Syncing…" : "Sync catalog" })
            ] }),
            /* @__PURE__ */ l("button", { type: "button", style: { ...o.btn, ...o.btnGhost }, onClick: () => void k(), disabled: J, children: [
              J ? /* @__PURE__ */ t(Y, { size: 11 }) : /* @__PURE__ */ t(It, { size: 11 }),
              /* @__PURE__ */ t("span", { children: "Refresh" })
            ] })
          ] })
        ] }),
        S && /* @__PURE__ */ t("p", { style: { ...o.hint, color: S.kind === "error" ? "#e05555" : "#4ec9b0" }, role: "status", children: S.kind === "done" ? `Synced ${S.wrote} new pets (${S.total} total).` : `Sync failed: ${S.error}` }),
        Ie.length === 0 ? /* @__PURE__ */ t("p", { style: o.hint, children: J ? "Loading…" : 'No community pets yet. Click "Sync catalog" to fetch some.' }) : /* @__PURE__ */ t("div", { style: o.grid, children: Ie.map(Ae) })
      ] }),
      /* @__PURE__ */ l("div", { style: { borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 14 }, children: [
        /* @__PURE__ */ t("strong", { style: { fontSize: 13 }, children: "Hatch with AI" }),
        /* @__PURE__ */ t("p", { style: o.hint, children: "Describe a pet concept and paste the generated prompt into your AI chat." }),
        /* @__PURE__ */ l("label", { style: { ...o.field, marginTop: 8 }, children: [
          /* @__PURE__ */ t("span", { style: o.fieldLabel, children: "Concept" }),
          /* @__PURE__ */ t("input", { type: "text", maxLength: 140, value: A, placeholder: "a sleepy capybara in a top hat", onChange: (i) => B(i.target.value), style: o.input })
        ] }),
        /* @__PURE__ */ t("pre", { style: { background: "rgba(0,0,0,0.3)", borderRadius: 6, padding: "10px 12px", fontSize: 11, lineHeight: 1.5, overflowX: "auto", marginTop: 8, whiteSpace: "pre-wrap", wordBreak: "break-word" }, "aria-live": "polite", children: ve }),
        /* @__PURE__ */ t("div", { style: { display: "flex", gap: 6, marginTop: 8 }, children: /* @__PURE__ */ l("button", { type: "button", style: o.btn, onClick: () => void Ve(), children: [
          Q ? /* @__PURE__ */ t(ie, { size: 11 }) : /* @__PURE__ */ t(At, { size: 11 }),
          /* @__PURE__ */ t("span", { children: Q ? "Copied!" : "Copy prompt" })
        ] }) })
      ] })
    ] })
  ] });
}
const en = {
  section: { display: "flex", flexDirection: "column", gap: 12 },
  sectionHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  h3: { margin: 0, fontSize: 14, fontWeight: 600 },
  hint: { margin: 0, fontSize: 11, opacity: 0.6, lineHeight: 1.4 },
  tabList: { display: "flex", gap: 2, background: "rgba(255,255,255,0.06)", borderRadius: 8, padding: 2, marginBottom: 6, width: "fit-content" },
  tab: { padding: "4px 12px", borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", fontSize: 12, color: "inherit", opacity: 0.7 },
  tabActive: { background: "rgba(255,255,255,0.12)", opacity: 1 },
  btn: { display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.08)", cursor: "pointer", fontSize: 12, color: "inherit", whiteSpace: "nowrap" },
  btnActive: { background: "rgba(255,255,255,0.18)", borderColor: "rgba(255,255,255,0.3)" },
  btnGhost: { background: "transparent", borderColor: "rgba(255,255,255,0.1)" },
  field: { display: "flex", flexDirection: "column", gap: 4 },
  fieldLabel: { fontSize: 11, opacity: 0.7, fontWeight: 500 },
  input: { padding: "5px 8px", borderRadius: 5, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)", color: "inherit", fontSize: 12, width: "100%", boxSizing: "border-box" },
  preview: { display: "flex", alignItems: "center", padding: "10px 12px", borderRadius: 8, border: "1.5px solid", background: "rgba(255,255,255,0.04)", marginBottom: 12 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 },
  card: { display: "flex", flexDirection: "column", gap: 6, padding: 10, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", cursor: "default" },
  cardActive: { borderColor: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.08)" },
  cardThumb: { width: "100%", aspectRatio: "1", borderRadius: 6, backgroundRepeat: "no-repeat" },
  cardMeta: { display: "flex", flexDirection: "column", gap: 2 },
  atlasPicker: { background: "rgba(255,255,255,0.04)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", padding: 12, marginTop: 10 },
  atlasRow: { display: "flex", alignItems: "center", padding: "5px 8px", borderRadius: 5, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", cursor: "pointer", fontSize: 12, color: "inherit", gap: 8 },
  atlasRowActive: { background: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.25)" }
};
function tn(e) {
  return new Promise((n, a) => {
    const r = new FileReader();
    r.onerror = () => a(r.error ?? new Error("Read failed")), r.onload = () => {
      if (typeof r.result != "string") {
        a(new Error("Could not read pet sprite."));
        return;
      }
      n(r.result);
    }, r.readAsDataURL(e);
  });
}
async function nn(e) {
  try {
    const n = URL.createObjectURL(e);
    try {
      return await new Promise((a, r) => {
        const u = new Image();
        u.onload = () => a({ width: u.naturalWidth, height: u.naturalHeight }), u.onerror = () => r(new Error("probe failed")), u.src = n;
      });
    } finally {
      URL.revokeObjectURL(n);
    }
  } catch {
    return null;
  }
}
const We = "agent-pet:rail-collapsed";
function rn() {
  if (typeof window > "u") return !1;
  try {
    return window.localStorage.getItem(We) === "1";
  } catch {
    return !1;
  }
}
function pn({ onOpenPetSettings: e, onHide: n }) {
  const { pet: a, setPet: r } = be(), [u, s] = v(() => rn());
  P(() => {
    try {
      window.localStorage.setItem(We, u ? "1" : "0");
    } catch {
    }
  }, [u]);
  const h = a.adopted ? a.petId : null, p = { ...a, custom: a.custom ?? fe() }, d = (b) => r({ ...a, adopted: !0, enabled: !0, petId: b }), w = () => r({ ...a, enabled: !a.enabled }), g = {
    display: "flex",
    flexDirection: "column",
    background: "rgba(255,255,255,0.03)",
    borderLeft: "1px solid rgba(255,255,255,0.08)",
    transition: "width 0.2s ease",
    width: u ? 40 : 180,
    minWidth: u ? 40 : 180,
    overflow: "hidden",
    flexShrink: 0
  };
  return u ? /* @__PURE__ */ t("aside", { style: g, "aria-label": "Pet companions", children: /* @__PURE__ */ l("button", { type: "button", onClick: () => s(!1), title: "Expand pet rail", style: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, padding: "12px 0", background: "transparent", border: "none", cursor: "pointer", color: "inherit", width: "100%" }, children: [
    /* @__PURE__ */ t("span", { "aria-hidden": !0, children: "🐾" }),
    /* @__PURE__ */ t(kt, { size: 12 })
  ] }) }) : /* @__PURE__ */ l("aside", { style: g, "aria-label": "Pet companions", children: [
    /* @__PURE__ */ l("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)" }, children: [
      /* @__PURE__ */ l("div", { style: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600 }, children: [
        /* @__PURE__ */ t("span", { "aria-hidden": !0, children: "🐾" }),
        /* @__PURE__ */ t("span", { children: "Pets" })
      ] }),
      /* @__PURE__ */ l("div", { style: { display: "flex", gap: 2 }, children: [
        /* @__PURE__ */ t("button", { type: "button", onClick: () => s(!0), title: "Collapse", style: Ne, children: /* @__PURE__ */ t(Mt, { size: 12 }) }),
        n && /* @__PURE__ */ t("button", { type: "button", onClick: n, title: "Hide rail", style: Ne, children: /* @__PURE__ */ t(oe, { size: 12 }) })
      ] })
    ] }),
    /* @__PURE__ */ t("div", { style: { padding: "6px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)" }, children: a.adopted ? /* @__PURE__ */ t("button", { type: "button", onClick: w, style: { display: "flex", alignItems: "center", gap: 5, fontSize: 11, background: "transparent", border: "none", cursor: "pointer", color: "inherit", padding: 0, opacity: 0.75 }, children: /* @__PURE__ */ t("span", { children: a.enabled ? "👁 Dismiss" : "✨ Wake" }) }) : /* @__PURE__ */ t("span", { style: { fontSize: 11, opacity: 0.5 }, children: "Adopt a pet to get started" }) }),
    /* @__PURE__ */ l("button", { type: "button", onClick: () => d(R), "aria-pressed": h === R, style: { ...an, ...h === R ? on : {}, borderColor: p.custom.accent }, children: [
      /* @__PURE__ */ t("span", { style: { width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }, children: /* @__PURE__ */ t(we, { active: ye({ ...p, adopted: !0 }), size: 24 }) }),
      /* @__PURE__ */ l("span", { style: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1, minWidth: 0 }, children: [
        /* @__PURE__ */ t("span", { style: { fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }, children: p.custom.name || "Custom" }),
        /* @__PURE__ */ t("span", { style: { fontSize: 10, opacity: 0.5 }, children: "Your pet" })
      ] })
    ] }),
    e && /* @__PURE__ */ l("button", { type: "button", onClick: e, style: { display: "flex", alignItems: "center", gap: 5, padding: "8px 10px", marginTop: "auto", background: "transparent", border: "none", borderTop: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", fontSize: 11, color: "inherit", opacity: 0.7, width: "100%" }, children: [
      /* @__PURE__ */ t("span", { children: "✨" }),
      /* @__PURE__ */ t("span", { children: "Customize pet" })
    ] })
  ] });
}
const Ne = { background: "transparent", border: "none", cursor: "pointer", color: "inherit", padding: 3, display: "flex", alignItems: "center", opacity: 0.6, borderRadius: 4 }, an = { display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "transparent", border: "1px solid transparent", cursor: "pointer", color: "inherit", width: "100%", textAlign: "left" }, on = { background: "rgba(255,255,255,0.07)", borderColor: "rgba(255,255,255,0.12)" };
export {
  Ft as CODEX_ATLAS_ASPECT,
  $ as CODEX_ATLAS_COLS,
  Bt as CODEX_ATLAS_HEIGHT,
  Ot as CODEX_ATLAS_LAYOUT,
  j as CODEX_ATLAS_ROWS,
  de as CODEX_ATLAS_ROWS_DEF,
  Nt as CODEX_ATLAS_WIDTH,
  Ht as CODEX_CELL_HEIGHT,
  Dt as CODEX_CELL_WIDTH,
  R as CUSTOM_PET_ID,
  ot as DEFAULT_PET_CONFIG,
  at as DefaultCatalogClient,
  me as FPS_MAX,
  ge as FPS_MIN,
  pe as FRAMES_MAX,
  Be as FRAMES_MIN,
  it as LocalStoragePetLibrary,
  nt as LocalStoragePetStore,
  he as PET_CONFIG_CHANGED,
  un as PetOverlay,
  cn as PetProvider,
  pn as PetRail,
  hn as PetSettings,
  we as PetSpriteFace,
  ft as ambientLines,
  Gt as cropAtlasRow,
  fe as defaultCustomPet,
  bt as defaultPetAdapter,
  Pe as loadAtlasImageFromFile,
  qt as loadPetImageFromFile,
  Wt as looksLikeCodexAtlas,
  mt as pickAmbientRow,
  dn as pickAtlasRow,
  pt as preferredRowId,
  Re as prepareCodexAtlas,
  ye as resolveActivePet,
  be as usePetContext
};
