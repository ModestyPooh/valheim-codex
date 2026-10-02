/* Valheim Codex – extras: food combos, shopping list, places, bestiary tips */
"use strict";
(function () {
const X = window.__codex;
const { ROUTES, IX, S, BIOMES, esc, fmt, tname, tb, visible, secs, itemLink, mobLink, pieceLink, stationLink, costList, itemIcon, noteBox, LS, toast } = X;
let D;
const fresh = () => (D = X.D());

// ================================================================= FOOD
const FS = { tier: null, sort: "total" };
let COOK_IN = null;
function cookInputs() {
  if (COOK_IN && COOK_IN.d === D) return COOK_IN.s;
  const s = new Set();
  for (const cid of ["piece_cookingstation", "piece_cookingstation_iron", "piece_oven"]) for (const x of ((D.conv[cid] || {}).l || [])) s.add(x[0]);
  s.add("FishAnglerRaw");
  COOK_IN = { d: D, s }; return s;
}
function foods() {
  const raw = cookInputs();
  return Object.entries(D.items).filter(([id, it]) => it.food && !it.uo && !raw.has(id) && (it.food.health + it.food.stamina + (it.food.eitr || 0)) > 0)
    .map(([id, it]) => ({ id, name: it.n, tier: it.ti ?? 0, hp: it.food.health, st: it.food.stamina, ei: it.food.eitr || 0,
      dur: Math.round((it.food.duration || 0) / 60), heal: it.food.regen || 0, feast: /^Feast/.test(id) }));
}
function foodType(f) {
  if (f.feast) return "feast";
  const m = Math.max(f.hp, f.st, f.ei);
  if (f.ei === m && f.ei > f.hp) return "ei";
  if (f.hp === f.st || (f.ei && f.ei === f.hp)) return "bal";
  return f.hp > f.st ? "hp" : "st";
}
const STYLES = [
  { key: "tank", name: "Tank", color: "#c4473a", slots: ["hp", "hp", "hp"], good: ["Holding aggro and taking hits", "Boss fights with a tower shield"], down: ["Low stamina for dodging and sprinting", "No eitr: no magic"] },
  { key: "warrior", name: "Warrior", color: "#b7653b", slots: ["hp", "hp", "st"], good: ["Melee with one- or two-handed weapons", "Survives mistakes while keeping some stamina for swings"], down: ["No eitr: no magic"] },
  { key: "rogue", name: "Rogue / Archer", color: "#4f9a6b", slots: ["hp", "st", "st"], good: ["Bows, crossbows, daggers and dodge-heavy fighting", "Lots of stamina for rolls and drawing bows"], down: ["Lower health: avoid getting surrounded", "No eitr: no magic"] },
  { key: "runner", name: "Runner", color: "#d6a648", slots: ["st", "st", "st"], good: ["Exploring, sailing and hunting", "Chopping, mining and farming"], down: ["Very low health", "No eitr: no magic"] },
  { key: "paladin", name: "Paladin", color: "#c9b25a", slots: ["hp", "st", "ei"], good: ["Melee plus support magic (Staff of Protection, healing)", "An all-rounder for mixed fights"], down: ["Not the best at any one thing"] },
  { key: "battlemage", name: "Battle Mage", color: "#7c63c9", slots: ["hp", "ei", "ei"], good: ["Elemental and blood magic that can survive a hit", "Staves with a sword or shield as backup"], down: ["Low stamina: dodging and melee are limited"] },
  { key: "glasscannon", name: "Glass-Cannon Mage", color: "#4a78c9", slots: ["ei", "ei", "ei"], good: ["Maximum spell damage and summons from a safe distance"], down: ["Very low health and stamina"] },
  { key: "banquet", name: "Banquet", color: "#b8862f", slots: ["feast", "feast", "feast"], good: ["Long trips and building sessions: feasts last far longer than normal food", "One cook feeds the group: every feast has several servings"], down: ["Lower peaks than a specialised combo", "Each feast needs its biome's Bog Witch spice first"] },
  { key: "balanced", name: "Balanced", color: "#7d8a63", slots: ["any", "any", "any"], score: f => f.hp + f.st, good: ["Building, travelling and relaxed play", "Even health and stamina for mixed tasks"], down: ["Lower peaks than a specialised combo"] },
];
const SLOTKEY = { hp: f => f.hp, st: f => f.st, ei: f => f.ei };
const SLOTLABEL = { hp: "health food", st: "stamina food", ei: "eitr food", any: "food" };
function rankFor(slot, pool, style) {
  const key = slot === "any" ? style.score : SLOTKEY[slot];
  const cmp = (a, b) => key(b) - key(a) || b.heal - a.heal || b.dur - a.dur;
  if (slot === "any") return pool.slice().sort(cmp);
  const typed = pool.filter(f => foodType(f) === slot).sort(cmp);
  if (slot === "ei") return typed;
  return typed.concat(pool.filter(f => foodType(f) !== slot && key(f) > 0).sort(cmp));
}
function bestCombo(style, tier, all) {
  const pool = all.filter(f => f.tier <= tier);
  if (style.key === "banquet") {
    const feasts = pool.filter(f => f.feast).sort((a, b) => (b.hp + b.st + b.ei) - (a.hp + a.st + a.ei) || b.tier - a.tier);
    if (feasts.length < 3) return { missing: "feast", have: feasts };
    return { picks: feasts.slice(0, 3).map((f, i) => ({ food: f, slot: "feast", alt: feasts[3 + i] })) };
  }
  if (style.key === "balanced") {
    const nf = pool.filter(f => !f.feast);
    let best = null, bs = -1;
    for (let i = 0; i < nf.length; i++) for (let j = i + 1; j < nf.length; j++) for (let k = j + 1; k < nf.length; k++) {
      const a = nf[i], b = nf[j], c = nf[k]; const hp = a.hp + b.hp + c.hp, st = a.st + b.st + c.st;
      const sc = Math.min(hp, st) * 1000 + hp + st;
      if (sc > bs) { bs = sc; best = [a, b, c]; }
    }
    if (!best) return { missing: "any" };
    const used = new Set(best.map(f => f.id));
    const alts = nf.filter(f => !used.has(f.id)).sort((x, y) => (y.hp + y.st) - (x.hp + x.st));
    return { picks: best.map(f => { const alt = alts.find(a => !used.has(a.id) && foodType(a) === foodType(f)) || alts.find(a => !used.has(a.id)); if (alt) used.add(alt.id); return { food: f, slot: "any", alt }; }) };
  }
  const used = new Set(), picks = [];
  const nf = pool.filter(f => !f.feast);
  for (const slot of style.slots) {
    const list = rankFor(slot, nf, style).filter(f => !used.has(f.id));
    if (!list.length) return { missing: slot };
    picks.push({ food: list[0], slot }); used.add(list[0].id);
  }
  for (const p of picks) { p.alt = rankFor(p.slot, nf, style).filter(f => !used.has(f.id))[0]; if (p.alt) used.add(p.alt.id); }
  return { picks };
}
function foodLink(f) { return itemLink(f.id); }
ROUTES.food = function () {
  fresh();
  const all = foods();
  const t = Math.min(FS.tier == null ? S.reach : FS.tier, S.reach);
  let h = `<h1>Food & feasts</h1>
    <div class="note">Pick the furthest biome you've reached. Each card shows the best 3 foods for that playstyle from everything you can make by then. You can eat 3 different foods at once.</div>
    <div class="chips" id="ftier">${BIOMES.filter(b => b.t <= S.reach).map(b => `<span class="chip t${b.t}${b.t === t ? " on" : ""}" data-ft="${b.t}">${esc(b.n)}</span>`).join("")}</div>
    <div class="combos">`;
  for (const st of STYLES) {
    const c = bestCombo(st, t, all);
    const sub = st.key === "banquet" ? "3 feasts · long-lasting" : st.key === "balanced" ? "Even health & stamina" : st.slots.map(x => ({ hp: "Health", st: "Stamina", ei: "Eitr" })[x]).join(" · ");
    h += `<div class="combo" style="--cc:${st.color}"><div class="chd">${esc(st.name)}<span>${esc(sub)}</span></div><div class="cbody">`;
    if (c.missing === "feast") { h += `<p class="small">Needs 3 feasts; you can make ${c.have.length} by here${c.have.length ? ": " + c.have.map(f => esc(f.name)).join(", ") : ""}.</p></div></div>`; continue; }
    if (c.missing) { h += `<p class="small">Needs an ${SLOTLABEL[c.missing]}: eitr foods start in the <b>Mistlands</b>.</p></div></div>`; continue; }
    const tot = c.picks.reduce((a, p) => ({ hp: a.hp + p.food.hp, st: a.st + p.food.st, ei: a.ei + p.food.ei }), { hp: 0, st: 0, ei: 0 });
    const minDur = Math.min(...c.picks.map(p => p.food.dur));
    h += `<div class="ctot"><span class="th">❤ ${tot.hp}</span><span class="ts">⚡ ${tot.st}</span><span class="te">✦ ${tot.ei}</span></div>`;
    h += c.picks.map(p => `<div class="cfood">${foodLink(p.food)}<span class="cf-s">${p.food.hp} / ${p.food.st}${p.food.ei ? " / " + p.food.ei : ""}</span>${p.alt ? `<span class="cf-a">or ${itemLink(p.alt.id)}</span>` : ""}</div>`).join("");
    h += `<div class="small" style="margin-top:6px">Shortest lasts ${minDur} min · health / stamina / eitr</div>
      <div class="cgd"><b>Good for:</b> ${st.good.map(esc).join("; ")}.</div><div class="cgd"><b>Downsides:</b> ${st.down.map(esc).join("; ")}.</div>
      <button class="btn small" data-addcombo="${c.picks.map(p => p.food.id).join(",")}" title="Add these 3 to your shopping list">+ Shopping list</button></div></div>`;
  }
  h += `</div><p class="small">Stamina and eitr totals add to your base 50 stamina and 0 eitr.</p>`;
  // all foods table
  const sorts = { total: f => f.hp + f.st + f.ei, hp: f => f.hp, st: f => f.st, ei: f => f.ei, dur: f => f.dur, heal: f => f.heal };
  const list = all.filter(f => f.tier <= S.reach).sort((a, b) => sorts[FS.sort](b) - sorts[FS.sort](a) || a.tier - b.tier);
  h += `<h2>All foods</h2><div class="chips" id="fsort"><span class="small" style="align-self:center">Sort by</span>${[["total", "Total"], ["hp", "Health"], ["st", "Stamina"], ["ei", "Eitr"], ["dur", "Duration"], ["heal", "Healing"]].map(([k, n]) => `<span class="chip${FS.sort === k ? " on" : ""}" data-fs="${k}">${n}</span>`).join("")}</div>
    <div class="tw"><table><tr><th>Food</th><th>Biome</th><th class="n">Health</th><th class="n">Stamina</th><th class="n">Eitr</th><th class="n">Minutes</th><th class="n">Healing</th></tr>
    ${list.map(f => `<tr><td>${foodLink(f)}${f.feast ? ` <span class="tag">feast</span>` : ""}</td><td>${tb(f.tier)}</td><td class="n" style="color:#ff9a8a">${f.hp}</td><td class="n" style="color:#ffd66b">${f.st}</td><td class="n" style="color:#a9a0ff">${f.ei || ""}</td><td class="n">${f.dur}</td><td class="n">${f.heal}</td></tr>`).join("")}</table></div>`;
  return h;
};
ROUTES.food.after = function () {
  document.querySelectorAll("[data-ft]").forEach(c => c.onclick = () => { FS.tier = +c.dataset.ft; X.route.keepScroll = true; X.route(); });
  document.querySelectorAll("[data-fs]").forEach(c => c.onclick = () => { FS.sort = c.dataset.fs; X.route.keepScroll = true; X.route(); });
};

// ================================================================= SHOPPING LIST
let LIST = LS.get("list", []);
let RAW = LS.get("listraw", false);
const saveList = () => { LS.set("list", LIST); updateCount(); };
function updateCount() { const el = document.getElementById("listcount"); if (el) el.textContent = LIST.length ? `(${LIST.reduce((a, e) => a + e.n, 0)})` : ""; }
function addToList(id, q, n) {
  const e = LIST.find(x => x.id === id && x.q === q);
  if (e) e.n += n || 1; else LIST.push({ id, q, n: n || 1 });
  saveList(); toast(`Added ${D.items[id] ? D.items[id].n : id}${q > 1 ? " (Q" + q + ")" : ""} to your shopping list`);
}
function mainRecipe(id) { const rs = D.recipes[id] || []; return rs.find(r => r.st && !r.up) || rs.find(r => !r.up) || rs[0]; }
function costTo(id, q) {
  const r = mainRecipe(id); const out = {};
  if (!r) return { out, r: null };
  r.lv.slice(0, q).forEach((lv, i) => {
    if (r.up && i === 0) return;
    lv.c.forEach(([c, n]) => out[c] = (out[c] || 0) + n);
    (lv.u || []).forEach(([c, n]) => out[c] = (out[c] || 0) + n);
  });
  return { out, r };
}
const NATURAL = new Set(["drop", "pick", "mine", "tree", "grow"]);
const isNatural = id => (D.src[id] || []).some(s => NATURAL.has(s.k));
function convFor(id) {
  const opts = [];
  for (const [cid, c] of Object.entries(D.conv)) for (const x of c.l || []) if (x[1] === id) opts.push({ cid, from: x[0], cnt: x[2] || 1 });
  const nsrc = id => (D.src[id] || []).filter(s => NATURAL.has(s.k)).length;
  opts.sort((a, b) => (isNatural(b.from) - isNatural(a.from)) || ((D.items[a.from] || {}).ti ?? 9) - ((D.items[b.from] || {}).ti ?? 9) || nsrc(b.from) - nsrc(a.from));
  return opts[0];
}
function toRaw(totals) {
  const acc = {};
  const walk = (id, n, depth, seen) => {
    if (depth > 10 || seen.has(id)) { acc[id] = (acc[id] || 0) + n; return; }
    const r = mainRecipe(id);
    if (r && !r.up && !isNatural(id) && r.lv[0] && r.lv[0].c.length) {
      const s2 = new Set(seen); s2.add(id);
      for (const [c, k] of r.lv[0].c) walk(c, k * n / (r.amt || 1), depth + 1, s2);
      return;
    }
    if (!isNatural(id)) {
      const cv = convFor(id);
      if (cv) { const s2 = new Set(seen); s2.add(id); walk(cv.from, n / cv.cnt, depth + 1, s2); return; }
    }
    acc[id] = (acc[id] || 0) + n;
  };
  for (const [id, n] of Object.entries(totals)) {
    // the item's own recipe levels are already in totals; expand each ingredient
    walk(id, n, 0, new Set());
  }
  return acc;
}
ROUTES.list = function () {
  fresh();
  if (!LIST.length) return `<h1>Shopping list</h1><p class="empty">Your list is empty. Use the <b>+ Shopping list</b> button on any item page (or on the food combo cards) to add things.</p>`;
  const totals = {}; const stations = {};
  for (const e of LIST) {
    const { out, r } = costTo(e.id, e.q);
    if (!r) { totals[e.id] = (totals[e.id] || 0) + e.n; continue; }
    for (const [c, n] of Object.entries(out)) totals[c] = (totals[c] || 0) + n * e.n;
    const lvl = Math.max(...r.lv.slice(0, e.q).map(l => l.sl || 1));
    if (r.st) stations[r.st] = Math.max(stations[r.st] || 0, lvl);
  }
  const show = RAW ? toRaw(totals) : totals;
  const rows = Object.entries(show).map(([id, n]) => [id, Math.ceil(n - 1e-9)]).sort((a, b) => ((D.items[a[0]] || {}).ti ?? 9) - ((D.items[b[0]] || {}).ti ?? 9) || b[1] - a[1]);
  let h = `<h1>Shopping list</h1><div class="tw"><table><tr><th>Item</th><th>Quality</th><th class="n">How many</th><th></th></tr>
    ${LIST.map((e, i) => { const it = D.items[e.id] || {}; const mq = it.mq || 1;
      return `<tr><td>${itemLink(e.id, { size: "" })}</td><td>${mq > 1 ? `<select data-lq="${i}">${Array.from({ length: mq }, (_, k) => `<option value="${k + 1}"${k + 1 === e.q ? " selected" : ""}>Q${k + 1}</option>`).join("")}</select>` : `<span class="faint">–</span>`}</td>
        <td class="n"><button class="btn" data-ln="${i}" data-d="-1">−</button> <b>${e.n}</b> <button class="btn" data-ln="${i}" data-d="1">+</button></td><td><button class="btn" data-lrm="${i}" title="Remove">✕</button></td></tr>`; }).join("")}</table></div>
    <div class="listtools" style="margin-top:12px"><label class="toggle"><input type="checkbox" id="lraw"${RAW ? " checked" : ""}> Break down to raw materials</label>
    <button class="btn" id="lcopy">Copy as text</button><button class="btn" id="lclear">Clear list</button></div>
    <h2>You need${RAW ? " (raw materials)" : ""}</h2><div class="grid sm">${rows.map(([id, n]) => `<div class="card row">${itemLink(id, { size: "", n })}</div>`).join("")}</div>
    ${Object.keys(stations).length ? `<h2>Stations</h2><div class="cost">${Object.entries(stations).map(([st, l]) => stationLink(st, l)).join("")}</div>` : ""}
    <p class="small">Quality means "craft it and upgrade it up to that quality", so Q3 includes the cost of Q1 and Q2. Raw breakdown follows recipes and smelting back to things you gather.</p>`;
  ROUTES.list._text = rows.map(([id, n]) => `${n}× ${D.items[id] ? D.items[id].n : id}`).join("\n");
  return h;
};
ROUTES.list.after = function () {
  const rr = () => { X.route.keepScroll = true; X.route(); };
  document.querySelectorAll("[data-lq]").forEach(s => s.onchange = () => { LIST[+s.dataset.lq].q = +s.value; saveList(); rr(); });
  document.querySelectorAll("[data-ln]").forEach(b => b.onclick = () => { const e = LIST[+b.dataset.ln]; e.n = Math.max(1, e.n + +b.dataset.d); saveList(); rr(); });
  document.querySelectorAll("[data-lrm]").forEach(b => b.onclick = () => { LIST.splice(+b.dataset.lrm, 1); saveList(); rr(); });
  const raw = document.getElementById("lraw"); if (raw) raw.onchange = () => { RAW = raw.checked; LS.set("listraw", RAW); rr(); };
  const cl = document.getElementById("lclear"); if (cl) cl.onclick = () => { LIST = []; saveList(); rr(); };
  const cp = document.getElementById("lcopy"); if (cp) cp.onclick = () => {
    const t = "Shopping list:\n" + ROUTES.list._text;
    if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(t).then(() => toast("Shopping list copied")); return; }
    const ta = document.createElement("textarea"); ta.value = t; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); toast("Shopping list copied"); } catch (e) { }
    ta.remove();
  };
};
document.addEventListener("click", e => {
  const b = e.target.closest("[data-addlist]");
  if (b) { fresh(); const sel = document.getElementById("addq"); addToList(b.dataset.addlist, sel ? +sel.value : 1, 1); }
  const c = e.target.closest("[data-addcombo]");
  if (c) { fresh(); c.dataset.addcombo.split(",").forEach(id => { const e2 = LIST.find(x => x.id === id && x.q === 1); if (e2) e2.n++; else LIST.push({ id, q: 1, n: 1 }); }); saveList(); toast("Added the 3 foods to your shopping list"); }
});

// add the "+ Shopping list" control and a portal line to item pages
const itemRoute = ROUTES.item;
ROUTES.item = function (id) {
  let h = itemRoute(id);
  fresh();
  const it = D.items[id];
  if (!it) return h;
  const craftable = !!mainRecipe(id);
  const mq = it.mq || 1;
  const ctl = `<div class="cmd" style="margin-top:10px">${craftable && mq > 1 ? `<select id="addq">${Array.from({ length: mq }, (_, k) => `<option value="${k + 1}">Q${k + 1}</option>`).join("")}</select>` : ""}<button class="btn" data-addlist="${esc(id)}">+ Shopping list</button></div>`;
  h = h.replace(/(<div class="cmd"><span class="small">Prefab<\/span>[\s\S]*?<\/div>)/, `$1${ctl}`);
  if (it.tp === 0) h = h.replace(`<dt>Weight</dt>`, `<dt>Portals</dt><dd><span class="dm im">Can't go through portals</span></dd><dt>Weight</dt>`);
  return h;
};
ROUTES.item.tierOf = itemRoute.tierOf;
ROUTES.item.after = itemRoute.after;

// ================================================================= PLACES
const PLACE_ICON = { Dungeon: "⛫", Location: "⌖", Event: "⚡" };
function placeCard(pid, p) {
  return `<a class="card full" href="#place/${encodeURIComponent(pid)}" style="display:block;color:inherit"><div class="small">${esc(p.type || "")}</div><b class="t${p.tier}">${esc(p.name)}</b><div class="sub">${esc(p.text || "")}</div></a>`;
}
ROUTES.places = function () {
  fresh();
  const pl = Object.entries(D.places || {}).filter(([, p]) => visible(p.tier)).sort((a, b) => a[1].tier - b[1].tier || a[1].name.localeCompare(b[1].name));
  let h = `<h1>Places</h1><p class="dim">Dungeons, locations and events, with what you'll find there.</p>`;
  if (!pl.length) return h + `<p class="empty">No places for the biomes you've reached yet.</p>`;
  const byT = {};
  pl.forEach(x => (byT[x[1].tier] = byT[x[1].tier] || []).push(x));
  for (const t of Object.keys(byT)) h += `<h2 class="t${t}">${esc(BIOMES[t].n)}</h2><div class="grid">${byT[t].map(([pid, p]) => placeCard(pid, p)).join("")}</div>`;
  return h;
};
ROUTES.place = function (pid) {
  fresh();
  const p = (D.places || {})[pid];
  if (!p) return `<div class="note warnnote">No place called <code>${esc(pid)}</code>.</div>`;
  return `<div class="banner t${p.tier}"><div class="exp">${esc(p.type || "Place")} · ${esc(BIOMES[p.tier].n)}</div><h1>${esc(p.name)}</h1><div class="txt">${esc(p.text || "")}</div></div>
    ${noteBox("place/" + pid)}
    ${(p.tips || []).length ? `<h2>Tips</h2><ul class="tips">${p.tips.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
    ${(p.items || []).length ? `<h2>Found here</h2><div class="grid sm">${p.items.filter(i => D.items[i]).map(i => `<div class="card row">${itemLink(i, { size: "" })}</div>`).join("")}</div>` : ""}
    ${(p.mobs || []).length ? `<h2>Creatures</h2><div class="grid sm">${p.mobs.filter(m => D.creatures[m]).map(m => `<div class="card row">${mobLink(m, { size: "" })}</div>`).join("")}</div>` : ""}`;
};
ROUTES.place.tierOf = pid => { fresh(); const p = (D.places || {})[pid]; return p ? p.tier : null; };

// biome pages get a Places section
const biomeRoute = ROUTES.biome;
ROUTES.biome = function (arg) {
  let h = biomeRoute(arg);
  fresh();
  const t = +arg;
  const pl = Object.entries(D.places || {}).filter(([, p]) => p.tier === t);
  if (pl.length) {
    const sec = `<h2>Places</h2><div class="grid">${pl.map(([pid, p]) => placeCard(pid, p)).join("")}</div>`;
    h = h.replace(/(<h2>Creatures<\/h2>)/, sec + "$1");
  }
  return h;
};
ROUTES.biome.tierOf = biomeRoute.tierOf;

// ================================================================= BESTIARY TIPS
const mobsRoute = ROUTES.mobs;
ROUTES.mobs = function (arg) {
  let h = mobsRoute(arg);
  const box = `<div class="note"><b>Critical hits?</b> Valheim has no random crits. Your "crits" are:
    <b>sneak attacks</b> (hitting an enemy that hasn't noticed you multiplies the damage; knives get the biggest bonus),
    <b>staggered enemies</b> (they take double damage after you parry them or break their stagger bar) and
    <b>weak spots</b>: body parts with their own, lower resistances. Creatures with one are marked <span class="tag">weak spot</span> below.</div>
    <div class="note">×1.5 or ×2 means it takes extra damage, ×0.5 or ×0.25 means less, ×0 means immune. Starred creatures have more health (×2 at ★, ×3 at ★★) and more drops; open a creature to see its numbers per star.</div>`;
  return h.replace(/(<h1>Bestiary<\/h1>)/, "$1" + box);
};
ROUTES.mobs.after = mobsRoute.after;

window.addEventListener("DOMContentLoaded", () => setTimeout(updateCount, 0));
})();
