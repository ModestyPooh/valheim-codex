/* Valheim Codex – list and detail pages */
"use strict";
(function () {
const X = window.__codex;
const { noteBox, isBoss, ROUTES, IX, S, BIOMES, BKEY, BKEYNAME, CATS, CATNAME, DTYPES, DNAME, PIECE_CAT, esc, fmt, pct, tname, tb, visible, secs,
  itemLink, mobLink, pieceLink, stationLink, costList, cmd, dmgMods, itemIcon, mobIcon, pieceIcon, LS } = X;
let D;
const fresh = () => (D = X.D());
const UI = { cat: LS.get("cat", "weapon"), itier: "all", ifilt: "", sort: { k: "ti", d: 1 }, stars: 0, pcat: "all", pfilt: "", mfilt: "" };
const SRC_KIND = { drop: "Drop", pick: "Pick", grow: "Grow", mine: "Mine", tree: "Chop", break: "Break", chest: "Chest", conv: "Made", trader: "Buy", note: "Info" };

// ---------------------------------------------------------------- stat helpers
function qDmg(it, q) {
  const out = {};
  for (const [k, v] of Object.entries(it.dmg ? it.dmg.b || {} : {})) out[k] = v + ((it.dmg.pl || {})[k] || 0) * (q - 1);
  return out;
}
function dmgText(d, opt) {
  const e = Object.entries(d).filter(([k, v]) => v && (opt && opt.all || (k !== "chop" && k !== "pickaxe")));
  return e.length ? e.map(([k, v]) => `<span class="nowrap">${fmt(v)} <span class="dim">${esc(DNAME[k] || k)}</span></span>`).join(" · ") : "–";
}
function keyStat(it) {
  if (it.c === "weapon" || it.c === "ammo") { const d = qDmg(it, 1); return Object.entries(d).filter(([k]) => k !== "chop" && k !== "pickaxe").reduce((a, [, v]) => a + v, 0); }
  if (it.c === "armor" || it.c === "trinket") return it.arm ? it.arm[0] : 0;
  if (it.c === "shield") return it.blk ? it.blk[0] : 0;
  if (it.food) return it.food.health + it.food.stamina + (it.food.eitr || 0);
  return 0;
}
function keyStatText(it) {
  if ((it.c === "weapon" || it.c === "ammo" || it.c === "tool") && it.dmg) return dmgText(qDmg(it, 1), { all: it.c === "tool" });
  if (it.arm && (it.c === "armor" || it.c === "trinket")) return `${it.arm[0]} armor`;
  if (it.blk) return `${it.blk[0]} block · ×${it.blk[2]} parry`;
  if (it.food) return `<span style="color:#ff9a8a">${it.food.health}</span> / <span style="color:#ffd66b">${it.food.stamina}</span>${it.food.eitr ? ` / <span style="color:#a9a0ff">${it.food.eitr}</span>` : ""} <span class="faint">· ${secs(it.food.duration)}</span>`;
  return "";
}
const pretty = s => String(s).replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, c => c.toUpperCase());
function bossOfKey(key) {
  if (!key) return null;
  for (const [cid, c] of Object.entries(D.creatures)) if (c.key === key) return cid;
  return null;
}
function keyText(key) {
  if (!key) return "";
  const b = bossOfKey(key);
  return b ? `after ${mobLink(b)}` : `needs <code>${esc(key)}</code>`;
}
function seBlock(seId) {
  const se = D.se[seId];
  if (!se) return `<code>${esc(seId)}</code>`;
  const st = Object.entries(se.st || {}).filter(([k, v]) => v && v !== 1 && !/Interval$|IsFraction$/.test(k))
    .map(([k, v]) => `<span class="tag">${esc(pretty(k))}: ${typeof v === "number" ? fmt(v) : esc(typeof v === "object" ? JSON.stringify(v) : v)}</span>`).join(" ");
  return `<b>${esc(se.n || seId)}</b>${se.dur ? ` <span class="dim">(${secs(se.dur)})</span>` : ""}${se.tt ? `<div class="dim">${esc(se.tt)}</div>` : ""}${st ? `<div style="margin-top:3px">${st}</div>` : ""}`;
}
function sortable(rows, cols, key, rerender) {
  // rows: array of objects; cols: [{k,label,n,get,html}]
  const s = UI.sort[key] || { k: cols[0].k, d: 1 };
  const col = cols.find(c => c.k === s.k) || cols[0];
  rows.sort((a, b) => {
    const va = col.get(a), vb = col.get(b);
    if (va == null && vb == null) return 0; if (va == null) return 1; if (vb == null) return -1;
    return (typeof va === "string" ? va.localeCompare(vb) : va - vb) * s.d;
  });
  return `<div class="tw"><table data-sort="${key}"><tr>${cols.map(c => `<th class="sort${c.n ? " n" : ""}" data-k="${c.k}">${esc(c.label)}${s.k === c.k ? (s.d > 0 ? " ▲" : " ▼") : ""}</th>`).join("")}</tr>
    ${rows.map(r => `<tr>${cols.map(c => `<td class="${c.n ? "n" : ""}">${c.html(r)}</td>`).join("")}</tr>`).join("")}</table></div>`;
}
document.addEventListener("click", e => {
  const th = e.target.closest("th.sort"); if (!th) return;
  const key = th.closest("table").dataset.sort, k = th.dataset.k;
  const cur = UI.sort[key] || {};
  UI.sort[key] = { k, d: cur.k === k ? -cur.d : 1 };
  X.route.keepScroll = true; X.route();
});

// ---------------------------------------------------------------- items list
ROUTES.items = function (arg) {
  fresh();
  if (arg && CATNAME[arg]) UI.cat = arg;
  const cat = UI.cat;
  const chips = [["all", "All"]].concat(CATS).map(([k, n]) => `<span class="chip${cat === k ? " on" : ""}" data-cat="${k}">${esc(n)}</span>`).join("");
  const q = UI.ifilt.toLowerCase();
  let rows = Object.entries(D.items).map(([id, it]) => ({ id, it }))
    .filter(r => (cat === "all" || r.it.c === cat) && visible(r.it.ti) && (S.showUnused || !r.it.uo)
      && (UI.itier === "all" || String(r.it.ti) === UI.itier) && (!q || (r.it.n + " " + r.id).toLowerCase().includes(q)));
  const cols = [
    { k: "n", label: "Item", get: r => r.it.n, html: r => itemLink(r.id, { size: "" }) + (r.it.uo ? ` <span class="tag uo">unobtainable</span>` : "") },
    { k: "s", label: "Type", get: r => r.it.s || "", html: r => `<span class="dim">${esc(r.it.s || CATNAME[r.it.c])}</span>` },
    { k: "ti", label: "Biome", get: r => r.it.ti ?? 99, html: r => tb(r.it.ti) },
    { k: "ks", label: "Stats", get: r => keyStat(r.it), html: r => keyStatText(r.it) },
    { k: "w", label: "Weight", n: 1, get: r => r.it.w, html: r => fmt(r.it.w) },
    { k: "id", label: "Prefab", get: r => r.id, html: r => `<code class="faint">${esc(r.id)}</code>` },
  ];
  UI.sort.items = UI.sort.items || { k: "ti", d: 1 };
  return `<h1>Items</h1><div class="chips" id="catchips">${chips}</div>
    <div class="listtools"><input id="ifilt" placeholder="Filter…" value="${esc(UI.ifilt)}">
    <select id="itier"><option value="all">All biomes up to ${esc(BIOMES[S.reach].n)}</option>${BIOMES.filter(b => b.t <= S.reach).map(b => `<option value="${b.t}"${UI.itier === String(b.t) ? " selected" : ""}>${esc(b.n)} only</option>`).join("")}</select>
    <label class="toggle"><input type="checkbox" id="unused"${S.showUnused ? " checked" : ""}> Show unused/dev items</label>
    <span class="count">${rows.length} items</span></div>${sortable(rows, cols, "items")}`;
};
ROUTES.items.after = function () {
  document.querySelectorAll("#catchips .chip").forEach(c => c.onclick = () => { UI.cat = c.dataset.cat; LS.set("cat", UI.cat); X.route.keepScroll = true; X.route(); });
  const f = document.getElementById("ifilt");
  f.oninput = () => { UI.ifilt = f.value; X.route.keepScroll = true; X.route(); const g = document.getElementById("ifilt"); g.focus(); g.setSelectionRange(g.value.length, g.value.length); };
  document.getElementById("itier").onchange = e => { UI.itier = e.target.value; X.route.keepScroll = true; X.route(); };
  document.getElementById("unused").onchange = e => { S.showUnused = e.target.checked; LS.set("unused", S.showUnused); X.route.keepScroll = true; X.route(); };
};

// ---------------------------------------------------------------- item detail
ROUTES.item = function (id) {
  fresh();
  const it = D.items[id];
  if (!it) return `<div class="note warnnote">No item called <code>${esc(id)}</code>.</div>`;
  const recs = D.recipes[id] || [];
  const mq = it.mq || 1;
  const spoiler = !visible(it.ti) ? `<div class="note warnnote">Spoiler: this is from ${esc(tname(it.ti))}, past where you've set "I've reached".</div>` : "";
  let h = `${spoiler}<div class="dh">${itemIcon(id, "l")}<div class="ttl"><h1 class="t${it.ti ?? ""}">${esc(it.n)}</h1>
    <div class="meta">${tb(it.ti)}<span class="tag">${esc(it.s || CATNAME[it.c] || it.c)}</span>${it.sk ? `<span class="tag">Skill: ${esc(it.sk)}</span>` : ""}${it.uo ? `<span class="tag uo">No known source</span>` : ""}</div>
    ${it.d ? `<div class="desc">${esc(it.d)}</div>` : ""}
    <div class="cmd"><span class="small">Prefab</span> ${cmd(id)} <span class="small">Spawn</span> ${cmd(`spawn ${id} ${it.st > 1 ? Math.min(it.st, 50) : 1}${mq > 1 ? " " + mq : ""}`)}</div></div></div>`;

  // ---- stats
  const kv = [];
  kv.push(["Weight", fmt(it.w)]);
  if (it.st > 1) kv.push(["Stack size", it.st]);
  if (mq > 1) kv.push(["Max quality", mq]);
  if (it.sta) kv.push(["Stamina use", it.sta.filter(x => x).map(fmt).join(" / ") + (it.sta.length > 1 ? ` <span class="faint">(primary / secondary)</span>` : "")]);
  if (it.eitr) kv.push(["Eitr use", Array.isArray(it.eitr) ? it.eitr.filter(x => x).map(fmt).join(" / ") : fmt(it.eitr)]);
  if (it.dmg && it.dmg.bs) kv.push(["Backstab", "×" + it.dmg.bs]);
  if (it.tt != null && (it.c === "tool" || it.c === "weapon")) kv.push(["Tool tier", it.tt]);
  if (it.val) kv.push(["Value", `${it.val} coins`]);
  for (const [k, v] of Object.entries(it.mod || {})) if (v) kv.push([pretty(k.replace(/Modifier$/, "")), (v > 0 ? "+" : "") + Math.round(v * 100) + "%"]);
  if (it.dmod && Object.keys(it.dmod).length) kv.push(["Resistances", dmgMods(it.dmod, { all: true })]);
  if (it.food) {
    kv.push(["Health", `<b style="color:#ff9a8a">${it.food.health}</b>`]); kv.push(["Stamina", `<b style="color:#ffd66b">${it.food.stamina}</b>`]);
    if (it.food.eitr) kv.push(["Eitr", `<b style="color:#a9a0ff">${it.food.eitr}</b>`]);
    kv.push(["Duration", secs(it.food.duration)]); if (it.food.regen) kv.push(["Healing", `${it.food.regen} HP/tick`]);
  }
  const seRows = Object.entries(it.se || {}).map(([when, sid]) => [{ equip: "While equipped", consume: "When used", attack: "On hit", set: "Set bonus" }[when] || pretty(when), seBlock(sid)]);
  h += `<div class="cols"><div><h2>Stats</h2><dl class="kv">${kv.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join("")}${seRows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join("")}</dl>`;

  // quality table
  const rec0 = recs[0];
  const slFor = q => rec0 && rec0.lv[q - 1] ? rec0.lv[q - 1].sl : null;
  if (mq > 1 || it.dmg || it.arm || it.blk) {
    const showDmg = it.dmg && ["weapon", "ammo", "tool", "shield"].includes(it.c) && Object.values(it.dmg.b || {}).some(v => v);
    const rows = [];
    for (let q = 1; q <= mq; q++) {
      const cells = [`Q${q}`];
      if (showDmg) cells.push(dmgText(qDmg(it, q), { all: it.c === "tool" }));
      if (it.arm) cells.push(fmt(it.arm[0] + it.arm[1] * (q - 1)));
      if (it.blk) cells.push(fmt(it.blk[0] + it.blk[1] * (q - 1)));
      if (it.dur) cells.push(fmt(it.dur[0] + it.dur[1] * (q - 1)));
      if (rec0) cells.push(slFor(q) != null ? `${esc(rec0.sn || "")} ${slFor(q)}` : "–");
      rows.push(cells);
    }
    const heads = ["Quality"].concat(showDmg ? ["Damage"] : [], it.arm ? ["Armor"] : [], it.blk ? ["Block"] : [], it.dur ? ["Durability"] : [], rec0 ? ["Station level"] : []);
    if (heads.length > 1) h += `<h3>By quality</h3><div class="tw"><table><tr>${heads.map(x => `<th>${x}</th>`).join("")}</tr>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</table></div>`;
  }
  h += `</div><div>`;

  // ---- recipe
  h += `<h2>Recipe</h2>`;
  if (!recs.length) h += `<p class="empty">Can't be crafted.</p>`;
  recs.forEach(r => {
    h += `<div class="card" style="margin-bottom:8px"><div>${stationLink(r.st, r.sl)} ${r.amt > 1 ? `<span class="tag">makes ${r.amt}</span>` : ""} <code class="faint">${esc(r.id)}</code></div>`;
    if (r.up) h += `<div class="note">This recipe only upgrades. The item itself is made another way (see "How to get" below).</div>`;
    const tot = {}, totU = {};
    h += `<div class="tw"><table><tr><th>Q</th><th>Station</th><th>Cost</th></tr>`;
    r.lv.forEach(lv => {
      if (!(r.up && lv.q === 1)) { lv.c.forEach(([c, n]) => tot[c] = (tot[c] || 0) + n); (lv.u || []).forEach(([c, n]) => totU[c] = (totU[c] || 0) + n); }
      h += `<tr><td>${lv.q === 1 ? "Craft" : "Q" + lv.q}</td><td class="dim">lvl ${lv.sl}</td><td>${costList(lv.c)}${(lv.u || []).length ? `<div class="small" style="margin-top:3px">Upgrade with: ${(lv.u || []).map(([u, n]) => itemLink(u, { n })).join(" ")}</div>` : ""}</td></tr>`;
    });
    if (r.lv.length > 1) h += `<tr><td><b>Total</b></td><td class="dim">to Q${r.lv.length}</td><td>${costList(Object.entries(tot))}${Object.keys(totU).length ? `<div class="small">Plus: ${Object.entries(totU).map(([u, n]) => itemLink(u, { n })).join(" ")}</div>` : ""}</td></tr>`;
    h += `</table></div></div>`;
  });
  h += `</div></div>`;

  // ---- how to get
  const srcAll = D.src[id] || [];
  const srcTier = s => s.k === "drop" ? (D.creatures[s.id] ? D.creatures[s.id].ti : null) : s.k === "conv" ? (D.pieces[s.id] ? D.pieces[s.id].ti : null) : s.ti;
  const src = srcAll.filter(s => visible(srcTier(s)));
  const srcHidden = srcAll.length - src.length;
  h += `<h2>How to get</h2>` + noteBox("item/" + id);
  if (!srcAll.length && !recs.length) h += `<p class="empty">No known source.</p>`;
  else if (!srcAll.length) h += `<p class="dim">Crafted (see recipe above).</p>`;
  else if (!src.length) h += `<p class="dim">Only found in biomes you haven't reached yet.</p>`;
  else h += `<div class="src">${src.map(srcRow).join("")}</div>`;
  if (srcHidden && src.length) h += `<div class="hiddenmore">+ ${srcHidden} more source${srcHidden > 1 ? "s" : ""} in biomes you haven't reached yet</div>`;

  // ---- used in
  const usedAll = (IX.usedIn[id] || []).filter(i => D.items[i] && (S.showUnused || !D.items[i].uo));
  const used = usedAll.filter(i => visible(D.items[i].ti));
  const upg = (IX.upgraderFor[id] || []).filter(i => D.items[i] && visible(D.items[i].ti));
  const pcsAll = (IX.pieceUses[id] || []);
  const pcs = pcsAll.filter(p => visible(D.pieces[p].ti));
  const cv = (IX.convIn[id] || []).filter(c => !D.pieces[c] || visible(D.pieces[c].ti));
  const usedHidden = (usedAll.length - used.length) + (pcsAll.length - pcs.length);
  h += `<h2>Used in</h2>`;
  if (!used.length && !pcs.length && !cv.length && !upg.length) h += usedHidden ? `<p class="dim">Only used in things from biomes you haven't reached yet.</p>` : `<p class="empty">Not used in any recipe.</p>`;
  if (used.length) h += `<h3>Crafting (${used.length})</h3><div class="grid sm">${used.sort((a, b) => (D.items[a].ti ?? 9) - (D.items[b].ti ?? 9)).map(i => `<div class="card row">${itemLink(i, { size: "" })}</div>`).join("")}</div>`;
  if (upg.length) h += `<h3>Upgrades (${upg.length})</h3><div class="grid sm">${upg.map(i => `<div class="card row">${itemLink(i, { size: "" })}</div>`).join("")}</div>`;
  if (cv.length) h += `<h3>Production</h3><div class="src">${cv.map(cid => { const c = D.conv[cid]; const rows = (c.l || []).filter(x => x[0] === id); return rows.length ? rows.map(x => `<div class="r">${pieceLink(cid)} turns it into ${itemLink(x[1])}</div>`).join("") : `<div class="r">${pieceLink(cid)} <span class="dim">${c.inc ? "(incinerator input)" : "(fuel/input)"}</span></div>`; }).join("")}</div>`;
  if (pcs.length) h += `<h3>Building pieces (${pcs.length})</h3><div class="grid sm">${pcs.slice(0, 80).map(p => `<div class="card row">${pieceLink(p, { size: "" })}</div>`).join("")}</div>`;
  if (usedHidden && (used.length || pcs.length)) h += `<div class="hiddenmore">+ ${usedHidden} more in biomes you haven't reached yet</div>`;
  return h;
};
ROUTES.item.tierOf = id => { fresh(); return D.items[id] ? D.items[id].ti : null; };
function srcRow(s) {
  const kind = `<span class="kind">${SRC_KIND[s.k] || s.k}</span>`;
  const where = (s.pl ? `<span class="dim">${esc(s.pl)}</span>` : "") + (s.b && s.b.length ? ` <span class="faint">${s.b.map(b => BKEYNAME[b] || b).join(", ")}</span>` : "");
  const amt = (a, b) => a == null ? "" : `<b>${a === b || b == null ? a : a + "–" + b}</b>`;
  switch (s.k) {
    case "drop": {
      const c = D.creatures[s.id];
      return `<div class="r">${kind}${mobLink(s.id)} ${amt(s.min, s.max)} <span class="dim">${pct(s.ch)}</span>${s.lm ? ` <span class="tag" title="More stars = more drops (×2 at ★, ×4 at ★★, amount and chance)">scales with ★</span>` : ""} ${c ? tb(c.ti) : ""}</div>`;
    }
    case "pick": return `<div class="r">${kind}<span>${esc(s.n)}</span> ${amt(s.amt)} ${where}${s.rs ? ` <span class="faint">respawns ${s.rs >= 60 ? Math.round(s.rs / 60 * 10) / 10 + "h" : s.rs + "m"}</span>` : ""} ${s.ti != null ? tb(s.ti) : ""} <code class="faint">${esc(s.id)}</code></div>`;
    case "grow": return `<div class="r">${kind}Plant ${(s.with || []).map(w => itemLink(w)).join(" or ")} → ${esc(s.n)} ${amt(s.amt)} <span class="faint">grows in ${(s.b || []).map(b => BKEYNAME[b] || b).join(", ") || "?"}</span></div>`;
    case "mine": case "tree": case "break": case "chest":
      return `<div class="r">${kind}<span>${esc(s.n)}</span> ${amt(s.min, s.max)} ${where} ${s.ti != null ? tb(s.ti) : ""} <code class="faint">${esc(s.id)}</code></div>`;
    case "conv": return `<div class="r">${kind}${pieceLink(s.id)}${s.from ? ` from ${itemLink(s.from)}` : ""}</div>`;
    case "note": return `<div class="r">${kind}<span>${esc(s.n)}</span> ${s.pl ? `<span class="dim">${esc(s.pl)}</span>` : ""} ${s.ti != null ? tb(s.ti) : ""}</div>`;
    case "trader": return `<div class="r">${kind}<a href="#traders">${esc(s.n)}</a> <b>${s.price}</b> coins${s.stack > 1 ? ` for ${s.stack}` : ""} <span class="dim">${esc(s.pl || "")}</span>${s.req ? ` <span class="tag">needs ${esc(s.req)}</span>` : ""} ${tb(s.ti)}</div>`;
  }
  return `<div class="r">${kind}${esc(s.id)}</div>`;
}

// ---------------------------------------------------------------- bestiary
ROUTES.mobs = function () {
  fresh();
  const q = UI.mfilt.toLowerCase();
  let h = `<h1>Bestiary</h1><div class="listtools"><input id="mfilt" placeholder="Filter…" value="${esc(UI.mfilt)}"><span class="count">${Object.keys(D.creatures).length} creatures</span></div>`;
  const groups = {};
  for (const [cid, c] of Object.entries(D.creatures)) {
    if (!visible(c.ti)) continue;
    if (q && !(c.n + " " + cid).toLowerCase().includes(q)) continue;
    (groups[c.ti ?? "x"] = groups[c.ti ?? "x"] || []).push([cid, c]);
  }
  for (const t of Object.keys(groups).sort()) {
    const list = groups[t].sort((a, b) => (isBoss(b[1]) - isBoss(a[1])) || (b[1].mini - a[1].mini) || (a[1].hp - b[1].hp));
    h += `<h2 class="${t === "x" ? "" : "t" + t}">${esc(t === "x" ? "Other" : BIOMES[t].n)}</h2><div class="tw"><table><tr><th>Creature</th><th class="n">HP</th><th>Weak / resistant</th><th>Faction</th></tr>
      ${list.map(([cid, c]) => `<tr><td>${mobLink(cid, { size: "" })} ${isBoss(c) ? `<span class="tag boss">Boss</span>` : c.mini || c.boss ? `<span class="tag mini">Named</span>` : ""}</td><td class="n">${fmt(c.hp)}</td><td>${dmgMods(c.mods)}${(c.weak || []).length ? ` <span class="tag" title="Has a weak spot">weak spot</span>` : ""}</td><td class="dim small">${esc(c.fl || c.f || "")}</td></tr>`).join("")}</table></div>`;
  }
  return h;
};
ROUTES.mobs.after = function () {
  const f = document.getElementById("mfilt");
  f.oninput = () => { UI.mfilt = f.value; X.route.keepScroll = true; X.route(); const g = document.getElementById("mfilt"); g.focus(); g.setSelectionRange(g.value.length, g.value.length); };
};

function bestWeapons(c, limitTier) {
  const mods = c.mods || {};
  const score = (it) => {
    const q = it.mq || 1; const d = qDmg(it, q); let t = 0;
    for (const [k, v] of Object.entries(d)) {
      if (!v || k === "damage") continue; // "damage" = butcher knife vs tamed animals
      const m = mods[k] == null ? 1 : mods[k];
      if ((k === "chop" || k === "pickaxe") && m <= 1) continue;
      t += v * m;
    }
    return t;
  };
  const pick = cat => Object.entries(D.items).filter(([, it]) => it.c === cat && !it.uo && it.dmg && it.ti != null && it.ti <= limitTier && it.sk)
    .map(([id, it]) => ({ id, it, sc: score(it) })).filter(x => x.sc > 0).sort((a, b) => b.sc - a.sc).slice(0, 6);
  return { weapons: pick("weapon"), ammo: pick("ammo") };
}
ROUTES.mob = function (cid) {
  fresh();
  const c = D.creatures[cid];
  if (!c) return `<div class="note warnnote">No creature called <code>${esc(cid)}</code>.</div>`;
  const boss = isBoss(c);
  const stars = boss ? 0 : UI.stars;
  const mult = Math.pow(2, stars);
  const spoiler = !visible(c.ti) ? `<div class="note warnnote">Spoiler: this creature is from ${esc(tname(c.ti))}.</div>` : "";
  let h = `${spoiler}<div class="dh">${mobIcon(cid, "l")}<div class="ttl"><h1 style="${c.mini ? "color:var(--orange)" : ""}">${esc(c.n)}</h1>
    <div class="meta">${tb(c.ti)}${boss ? `<span class="tag boss">Boss</span>` : c.mini || c.boss ? `<span class="tag mini">Named</span>` : ""}${boss && (c.fl || c.f) === "Boss" ? "" : `<span class="tag">${esc(c.fl || c.f || "")}</span>`}</div>
    <div class="cmd"><span class="small">Prefab</span> ${cmd(cid)} <span class="small">Spawn</span> ${cmd(`spawn ${cid} 1 ${stars + 1}`)}</div></div></div>`;
  if (!boss) h += `<div style="margin:10px 0"><span class="small">Stars:</span> <span class="stars">${[0, 1, 2].map(s => `<span class="chip${s === stars ? " on" : ""}" data-star="${s}">${s ? "★".repeat(s) : "0"}</span>`).join("")}</span></div>`;
  const hp = c.hp * (stars + 1);
  h += noteBox("mob/" + cid);
  h += `<div class="cols"><div><h2>Combat</h2><dl class="kv"><dt>Health</dt><dd><b>${fmt(hp)}</b>${stars ? ` <span class="faint">(${fmt(c.hp)} × ${stars + 1})</span>` : ""}</dd>
    <dt>Damage taken</dt><dd>${dmgMods(c.mods)}</dd>
    ${c.stag != null ? `<dt>Stagger</dt><dd>${fmt(c.stag)} <span class="faint">(stagger damage factor)</span></dd>` : ""}
    ${c.key ? `<dt>Kill sets</dt><dd><code>${esc(c.key)}</code></dd>` : ""}
    ${(c.ev || []).length ? `<dt>Raids</dt><dd>${c.ev.map(e => `<span class="tag">${esc(e)}</span>`).join(" ")}</dd>` : ""}</dl>`;
  if ((c.weak || []).length) {
    h += `<h3>Weak spots</h3><div class="note">Hits on these body parts use these values <b>instead of</b> the normal ones above.</div>
      <div class="tw"><table><tr><th>Body part</th><th>Damage taken there</th></tr>${c.weak.map(w => `<tr><td>${esc(prettyPart(w.p))}</td><td>${dmgMods(w.m, { all: true })}</td></tr>`).join("")}</table></div>`;
  }
  const best = bestWeapons(c, Math.min(S.reach, c.ti ?? 7));
  h += `<h3>Best weapons by this point</h3><div class="small">Top damage against this creature at max quality, counting its weaknesses, from gear up to ${esc(tname(Math.min(S.reach, c.ti ?? 7)))}.</div>`;
  h += best.weapons.length ? `<div class="src">${best.weapons.map(x => `<div class="r">${itemLink(x.id)} <span class="dim">≈${Math.round(x.sc)} effective</span> <span class="faint">${esc(x.it.s || "")}</span></div>`).join("")}</div>` : `<p class="empty">—</p>`;
  if (best.ammo.length) h += `<h3>Best ammo</h3><div class="src">${best.ammo.map(x => `<div class="r">${itemLink(x.id)} <span class="dim">≈${Math.round(x.sc)} effective</span></div>`).join("")}</div>`;
  h += `</div><div>`;

  // drops
  h += `<h2>Drops${stars ? ` at ${"★".repeat(stars)}` : ""}</h2>`;
  if (!(c.drops || []).length) h += `<p class="empty">Drops nothing.</p>`;
  else h += `<div class="tw"><table><tr><th>Item</th><th class="n">Amount</th><th class="n">Chance</th><th></th></tr>${c.drops.map(([iid, mn, mx, ch, lm, opp]) => {
    const m = lm ? mult : 1;
    const a = mn * m, b = mx * m;
    return `<tr><td>${itemLink(iid)}</td><td class="n">${a === b ? a : a + "–" + b}</td><td class="n">${pct(Math.min(1, ch * m))}</td><td>${lm ? `<span class="tag" title="Amount and chance double per star">★ scales</span>` : ""}${opp ? ` <span class="tag" title="Each nearby player gets one">one per player</span>` : ""}</td></tr>`;
  }).join("")}</table></div>`;
  // attacks
  if ((c.att || []).length) {
    h += `<h2>Attacks</h2><div class="tw"><table><tr><th>Attack</th><th>Damage</th><th class="n">Range</th><th class="n">Cooldown</th></tr>${c.att.map(a => `<tr><td>${esc(pretty(a.n))}</td><td>${dmgText(Object.fromEntries(Object.entries(a.dmg).map(([k, v]) => [k, v * (stars ? 1 + 0.5 * stars : 1)])))}</td><td class="n">${fmt(a.r)}</td><td class="n">${a.cd ? secs(a.cd) : "–"}</td></tr>`).join("")}</table></div>
      ${stars ? `<div class="small">Starred creatures hit 50% harder per star.</div>` : ""}`;
  }
  // taming
  if (c.tame) {
    h += `<h2>Taming</h2><dl class="kv"><dt>Eats</dt><dd><div class="cost">${c.tame.foods.map(f => itemLink(f)).join("")}</div></dd>
      ${c.tame.time ? `<dt>Time to tame</dt><dd>${secs(c.tame.time)}</dd>` : ""}${c.tame.saddle ? `<dt>Saddle</dt><dd>${itemLink(c.tame.saddle)}</dd>` : ""}
      ${c.breed ? `<dt>Breeds</dt><dd>${c.breed.off && D.creatures[c.breed.off] ? mobLink(c.breed.off) : esc(c.breed.off || "yes")}${c.breed.max ? ` <span class="faint">(stops at ${c.breed.max} nearby)</span>` : ""}</dd>` : ""}</dl>`;
  }
  h += `</div></div>`;
  // spawns
  h += `<h2>Where it spawns</h2>`;
  const spAll = (c.sp || []).map(x => Object.assign({}, x, { b: x.b.filter(b => visible(BKEY[b])) }));
  const sp = spAll.filter(x => x.b.length);
  if (!sp.length && spAll.length) h += `<p class="dim">Only spawns naturally in biomes you haven't reached yet.</p>`;
  else if (!sp.length) h += `<p class="dim">No natural world spawns. It comes from locations, spawners, dungeons or events.</p>`;
  else h += `<div class="tw"><table><tr><th>Biome</th><th>When</th><th>Stars</th><th class="n">Max</th><th>Condition</th></tr>${sp.map(s => `<tr><td>${s.b.map(b => `<a class="t${BKEY[b]}" href="#biome/${BKEY[b]}">${esc(BKEYNAME[b] || b)}</a>`).join(", ")}</td>
    <td>${s.d && s.n ? "Day & night" : s.n ? "Night" : "Day"}</td><td>${s.lv ? (s.lv[1] > 1 ? `up to ${"★".repeat(s.lv[1] - 1)}` : "none") : ""}</td><td class="n">${s.max ?? ""}</td>
    <td>${[s.key ? keyText(s.key) : "", s.ev ? `event <code>${esc(s.ev)}</code>` : "", (s.env || []).length ? `weather: ${s.env.map(esc).join(", ")}` : "", s.alt && s.alt[0] != null && s.alt[0] > -1000 ? `altitude ≥ ${s.alt[0]}` : ""].filter(Boolean).join(" · ") || `<span class="faint">—</span>`}</td></tr>`).join("")}</table></div>`;
  // variants
  const varsShown = (c.vars || []).filter(v => visible(v.ti));
  if (c.vars) {
    h += `<h2>Versions</h2><div class="small">The game has a separate version of this creature for each place it shows up.</div><div class="tw"><table><tr><th>Prefab</th><th class="n">HP</th><th>Tier</th><th>Spawns in</th><th>Notes</th></tr>
      ${varsShown.map(v => `<tr><td>${cmd(v.id)}</td><td class="n">${fmt(v.hp)}</td><td>${tb(v.ti)}</td><td class="dim">${(v.b || []).filter(b => visible(BKEY[b])).map(b => BKEYNAME[b] || b).join(", ") || "spawners / locations"}${v.key ? ` <span class="tag">after a boss</span>` : ""}</td><td class="dim">${esc(v.note || "")}</td></tr>`).join("")}</table></div>`;
    if (varsShown.length < c.vars.length) h += `<div class="hiddenmore">+ ${c.vars.length - varsShown.length} more version${c.vars.length - varsShown.length > 1 ? "s" : ""} in biomes you haven't reached yet</div>`;
  } else if ((c.var || []).length > 1) {
    h += `<h2>Other prefabs</h2><div class="cmd">${c.var.filter(v => v !== cid).map(v => cmd(v)).join(" ")}</div>`;
  }
  return h;
};
ROUTES.mob.tierOf = cid => { fresh(); return D.creatures[cid] ? D.creatures[cid].ti : null; };
ROUTES.mob.after = function () {
  document.querySelectorAll("[data-star]").forEach(c => c.onclick = () => { UI.stars = +c.dataset.star; X.route.keepScroll = true; X.route(); });
};
function prettyPart(p) {
  const s = String(p).replace(/^weak_?spot_?/i, "");
  return { ass: "Back end", head: "Head", Head: "Head", HEAD: "Head" }[s] || pretty(s.toLowerCase());
}

// ---------------------------------------------------------------- building pieces
ROUTES.pieces = function (arg) {
  fresh();
  const tierArg = arg !== "" && arg != null && !isNaN(+arg) ? +arg : null;
  const all = Object.entries(D.pieces).filter(([, p]) => p.tool && p.tool !== "Feaster" && visible(p.ti) && (tierArg == null || p.ti === tierArg));
  const cats = {};
  all.forEach(([, p]) => { const k = (p.tool === "Hammer" ? "" : p.tool + ": ") + (PIECE_CAT[p.cat] || p.cat || "Other"); cats[k] = (cats[k] || 0) + 1; });
  if (UI.pcat !== "all" && !cats[UI.pcat]) UI.pcat = "all";
  const q = UI.pfilt.toLowerCase();
  const rows = all.filter(([pid, p]) => (UI.pcat === "all" || ((p.tool === "Hammer" ? "" : p.tool + ": ") + (PIECE_CAT[p.cat] || p.cat || "Other")) === UI.pcat) && (!q || (p.n + " " + pid).toLowerCase().includes(q)))
    .map(([pid, p]) => ({ pid, p }));
  const cols = [
    { k: "n", label: "Piece", get: r => r.p.n, html: r => pieceLink(r.pid, { size: "" }) },
    { k: "c", label: "Category", get: r => PIECE_CAT[r.p.cat] || r.p.cat || "", html: r => `<span class="dim">${esc(PIECE_CAT[r.p.cat] || r.p.cat || "")}</span>` },
    { k: "ti", label: "Biome", get: r => r.p.ti ?? 99, html: r => tb(r.p.ti) },
    { k: "res", label: "Cost", get: r => (r.p.res || []).length, html: r => costList(r.p.res) },
    { k: "cf", label: "Comfort", n: 1, get: r => r.p.cf ? r.p.cf[0] : null, html: r => r.p.cf ? `${r.p.cf[0]} <span class="faint">${esc(r.p.cf[1] || "")}</span>` : "" },
    { k: "id", label: "Prefab", get: r => r.pid, html: r => `<code class="faint">${esc(r.pid)}</code>` },
  ];
  UI.sort.pieces = UI.sort.pieces || { k: "ti", d: 1 };
  return `<h1>Building pieces${tierArg != null ? ` – ${esc(BIOMES[tierArg].n)}` : ""}</h1>
    ${tierArg != null ? `<p><a href="#pieces">Show all biomes</a></p>` : `<div class="chips">${BIOMES.filter(b => b.t <= S.reach).map(b => `<a class="chip t${b.t}" href="#pieces/${b.t}">${esc(b.n)}</a>`).join("")}</div>`}
    <div class="chips" id="pcats"><span class="chip${UI.pcat === "all" ? " on" : ""}" data-pc="all">All (${all.length})</span>${Object.entries(cats).sort().map(([k, n]) => `<span class="chip${UI.pcat === k ? " on" : ""}" data-pc="${esc(k)}">${esc(k)} (${n})</span>`).join("")}</div>
    <div class="listtools"><input id="pfilt" placeholder="Filter…" value="${esc(UI.pfilt)}"><span class="count">${rows.length} pieces</span></div>${sortable(rows, cols, "pieces")}`;
};
ROUTES.pieces.after = function () {
  document.querySelectorAll("#pcats .chip").forEach(c => c.onclick = () => { UI.pcat = c.dataset.pc; X.route.keepScroll = true; X.route(); });
  const f = document.getElementById("pfilt");
  f.oninput = () => { UI.pfilt = f.value; X.route.keepScroll = true; X.route(); const g = document.getElementById("pfilt"); g.focus(); g.setSelectionRange(g.value.length, g.value.length); };
};
ROUTES.piece = function (pid) {
  fresh();
  const p = D.pieces[pid];
  const cv = D.conv[pid];
  if (!p && !cv) return `<div class="note warnnote">No piece called <code>${esc(pid)}</code>.</div>`;
  const P = p || { n: cv.n };
  let h = `<div class="dh">${pieceIcon(pid, "l")}<div class="ttl"><h1 class="t${P.ti ?? ""}">${esc(P.n)}</h1>
    <div class="meta">${tb(P.ti)}${P.sea ? `<a class="tag sea" href="#seasonal">${esc(P.sea)} event only</a>` : ""}${P.cat ? `<span class="tag">${esc(PIECE_CAT[P.cat] || P.cat)}</span>` : ""}${P.tool ? `<span class="tag">${esc(P.tool)}</span>` : ""}</div>
    ${P.d ? `<div class="desc">${esc(P.d)}</div>` : ""}<div class="cmd"><span class="small">Prefab</span> ${cmd(pid)}</div></div></div>`;
  h += noteBox("piece/" + pid);
  h += `<div class="cols"><div><h2>Build</h2><dl class="kv"><dt>Cost</dt><dd>${costList(P.res)}</dd><dt>Needs</dt><dd>${stationLink(P.st)}</dd>
    ${P.cf ? `<dt>Comfort</dt><dd>${P.cf[0]} <span class="faint">(${esc(P.cf[1] || "")} group – only the best piece in each group counts)</span></dd>` : ""}
    ${P.hp ? `<dt>Health</dt><dd>${fmt(P.hp)}</dd>` : ""}
    ${P.plant ? `<dt>Plant</dt><dd>${esc(typeof P.plant === "object" ? JSON.stringify(P.plant) : P.plant)}</dd>` : ""}
    ${P.biome ? `<dt>Biomes</dt><dd>${esc([].concat(P.biome).map(b => BKEYNAME[b] || b).join(", "))}</dd>` : ""}</dl>`;
  const parents = Object.entries(D.pieces).filter(([, q]) => q.cs && (q.cs.ext || []).includes(pid));
  if (parents.length) h += `<h3>Upgrade for</h3><div class="cost">${parents.map(([q]) => pieceLink(q)).join("")}</div>`;
  if (P.cs) {
    const exts = (P.cs.ext || []).map((e, i) => [e, i]);
    const extShown = exts.filter(([e]) => !D.pieces[e] || visible(D.pieces[e].ti));
    h += `<h3>Station levels</h3><div class="small">Max level ${P.cs.max}. Each upgrade below adds one level when built nearby.</div><div class="src">${extShown.map(([e, i]) => `<div class="r"><span class="kind">Level ${i + 2}</span>${D.pieces[e] ? pieceLink(e) + " " + costList(D.pieces[e].res) : `<code>${esc(e)}</code>`}</div>`).join("")}</div>`;
    if (extShown.length < exts.length) h += `<div class="hiddenmore">+ ${exts.length - extShown.length} more upgrade${exts.length - extShown.length > 1 ? "s" : ""} in biomes you haven't reached yet</div>`;
  }
  h += `</div><div>`;
  if (cv) {
    h += `<h2>Production</h2><dl class="kv">${cv.fuel ? `<dt>Fuel</dt><dd>${itemLink(cv.fuel)}${cv.fpp ? ` <span class="faint">${cv.fpp} per item</span>` : ""}</dd>` : ""}
      ${cv.t ? `<dt>Time</dt><dd>${secs(cv.t)} per item</dd>` : ""}${cv.max ? `<dt>Holds</dt><dd>${cv.max} items${cv.mf ? `, ${cv.mf} fuel` : ""}</dd>` : ""}</dl>`;
    const cvl = (cv.l || []).filter(x => visible((D.items[x[0]] || {}).ti) && visible((D.items[x[1]] || {}).ti));
    if (cvl.length) h += `<div class="tw"><table><tr><th>Put in</th><th>Get out</th>${cv.l.some(x => x[2]) ? `<th class="n">Makes</th>` : ""}</tr>${cvl.map(x => `<tr><td>${itemLink(x[0])}</td><td>${itemLink(x[1])}</td>${cv.l.some(y => y[2]) ? `<td class="n">${x[2] || 1}</td>` : ""}</tr>`).join("")}</table></div>`;
    if ((cv.l || []).length > cvl.length) h += `<div class="hiddenmore">+ ${cv.l.length - cvl.length} more in biomes you haven't reached yet</div>`;
    if (cv.out) h += `<p>Produces ${itemLink(cv.out)} over time.</p>`;
    if ((cv.inc || []).length) h += `<h3>Accepts</h3><div class="cost">${cv.inc.map(x => itemLink(Array.isArray(x) ? x[0] : x)).join("")}</div>`;
  }
  const crafted = (IX.craftedAt[pid] || []).filter(i => D.items[i] && (S.showUnused || !D.items[i].uo) && visible(D.items[i].ti));
  if (crafted.length) {
    const byLvl = {};
    crafted.forEach(i => { const r = D.recipes[i].find(r => r.st === pid); const l = r ? r.sl : 1; (byLvl[l] = byLvl[l] || []).push(i); });
    h += `<h2>Crafted here (${crafted.length})</h2>`;
    for (const l of Object.keys(byLvl).sort((a, b) => a - b)) h += `<h3>Level ${l}</h3><div class="grid sm">${byLvl[l].sort((a, b) => D.items[a].n.localeCompare(D.items[b].n)).map(i => `<div class="card row">${itemLink(i, { size: "" })}</div>`).join("")}</div>`;
  }
  h += `</div></div>`;
  return h;
};

ROUTES.piece.tierOf = pid => { fresh(); return D.pieces[pid] ? D.pieces[pid].ti : null; };

// ---------------------------------------------------------------- stations
ROUTES.stations = function () {
  fresh();
  const list = Object.entries(D.pieces).filter(([pid, p]) => p.tool === "Hammer" && (p.cs || D.conv[pid] || (IX.craftedAt[pid] || []).length) && visible(p.ti))
    .sort((a, b) => (a[1].ti ?? 9) - (b[1].ti ?? 9) || a[1].n.localeCompare(b[1].n));
  return `<h1>Stations</h1><p class="dim">Crafting stations, their upgrades, and production buildings like smelters and kilns.</p>
    <div class="tw"><table><tr><th>Station</th><th>Biome</th><th>Cost</th><th>What it does</th></tr>${list.map(([pid, p]) => {
      const n = (IX.craftedAt[pid] || []).length, cv = D.conv[pid];
      return `<tr><td>${pieceLink(pid, { size: "" })}</td><td>${tb(p.ti)}</td><td>${costList(p.res)}</td><td class="dim">${[n ? `crafts ${n} items` : "", p.cs ? `max level ${p.cs.max}` : "", cv && cv.l ? `${cv.l.length} conversions` : "", cv && cv.out ? `produces ${esc(D.items[cv.out] ? D.items[cv.out].n : cv.out)}` : ""].filter(Boolean).join(" · ")}</td></tr>`;
    }).join("")}</table></div>`;
};

// ---------------------------------------------------------------- traders
ROUTES.traders = function () {
  fresh();
  const tr = D.traders || {};
  if (!Object.keys(tr).length) return `<h1>Traders</h1><p class="empty">No trader data.</p>`;
  return `<h1>Traders</h1><div class="note">Prices and unlocks for vanilla Valheim.</div>` +
    Object.entries(tr).map(([tid, t]) => `<h2>${esc(t.n)} <span class="small">${esc(t.b)}</span></h2><div class="tw"><table><tr><th>Item</th><th class="n">Price</th><th class="n">Amount</th><th>Unlocks after</th></tr>
      ${t.stock.filter(([iid]) => { const s = (D.src[iid] || []).find(x => x.k === "trader" && x.id === tid); return !s || visible(s.ti); })
        .map(([iid, price, stack, req]) => `<tr><td>${itemLink(iid)}</td><td class="n">${price}</td><td class="n">${stack}</td><td class="dim">${esc(req || "–")}</td></tr>`).join("")}</table></div>`).join("");
};
})();
