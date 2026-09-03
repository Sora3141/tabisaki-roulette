const SVGNS = "http://www.w3.org/2000/svg";
const svg = document.getElementById("map");
svg.setAttribute("viewBox", `0 0 ${MAP.W} ${MAP.H}`);

function el(name, attrs, parent){
  const n = document.createElementNS(SVGNS, name);
  for(const k in attrs) n.setAttribute(k, attrs[k]);
  (parent || svg).appendChild(n);
  return n;
}

// 都道府県
const gPref = el("g", {});
const prefEls = {};
for(const pid in MAP.paths){
  if(!MAP.paths[pid]) continue;
  const p = el("path", {d: MAP.paths[pid], class: "pref"}, gPref);
  const tt = document.createElementNS(SVGNS, "title");
  tt.textContent = MAP.prefNames[pid];
  p.appendChild(tt);
  prefEls[pid] = p;
}

// 沖縄インセット枠
(function(){
  const p = prefEls[47];
  if(!p) return;
  requestAnimationFrame(() => {
    const b = p.getBBox();
    const pad = 14;
    el("rect", {
      x: b.x - pad, y: b.y - pad,
      width: b.width + pad*2, height: b.height + pad*2,
      rx: 6, class: "inset-frame"
    }, gPref);
    const t = el("text", {
      x: b.x - pad + 8, y: b.y - pad - 8, class: "inset-label"
    }, gPref);
    t.textContent = "沖縄県";
  });
})();

// 小笠原諸島インセット枠（位置は北へ寄せて表示）
if(MAP.oga){
  const [ox, oy, ow, oh] = MAP.oga;
  const pad = 14;
  el("rect", {
    x: ox - pad, y: oy - pad,
    width: ow + pad*2, height: oh + pad*2,
    rx: 6, class: "inset-frame"
  }, gPref);
  const t = el("text", {
    x: ox - pad + 8, y: oy - pad - 8, class: "inset-label"
  }, gPref);
  t.textContent = "小笠原諸島";
}

// 市区の形状レイヤー（抽選時に光る）
const gCity = el("g", {});
for(const c of MAP.cities){
  if(MAP.shapes[c.id]){
    c.el = el("path", {d: MAP.shapes[c.id], class: "city"}, gCity);
  }
}

// 演出レイヤー（パルスリング・駅マーカー用）
const gFx = el("g", {});
const spot = el("g", {class: "spot"}, gFx);
el("circle", {r: 10, class: "spot-halo"}, spot);
el("circle", {r: 6.5, class: "spot-ring"}, spot);
el("circle", {r: 2.4, class: "spot-core"}, spot);
spot.style.visibility = "hidden";

const defs = el("defs", {});
// 訪問済み県の斜線パターン
const pat = el("pattern", {
  id: "hatch", width: 5, height: 5,
  patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)"
}, defs);
el("rect", {width: 5, height: 5, fill: "#eef3ec"}, pat);
el("line", {x1: 0, y1: 0, x2: 0, y2: 5, stroke: "#ccdac9", "stroke-width": 1.4}, pat);

// ---------- ルーレット ----------
const cities = MAP.cities;
const btn = document.getElementById("spin");
const tanzaku = document.getElementById("tanzaku");
const tzIdle = document.getElementById("tzIdle");
const tzInner = document.getElementById("tzInner");
const tzPref = document.getElementById("tzPref");
const tzCity = document.getElementById("tzCity");
const gmap = document.getElementById("gmap");
const ekisign = document.getElementById("ekisign");
const ekiPref = document.getElementById("ekiPref");
const ekiKana = document.getElementById("ekiKana");
const ekiKanji = document.getElementById("ekiKanji");
const ekiRomaji = document.getElementById("ekiRomaji");
const statsBox = document.getElementById("stats");
const statPop = document.getElementById("statPop");
const statArea = document.getElementById("statArea");
const statDens = document.getElementById("statDens");
const historyBox = document.getElementById("historyBox");
const historyList = document.getElementById("historyList");
const editBtn = document.getElementById("editBtn");
const editHint = document.getElementById("editHint");
const poolInfo = document.getElementById("poolInfo");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

let hotPref = null;
let pulses = [];
let state = "idle";   // idle | running | stopping
let editing = false;

function prefName(c){ return MAP.prefNames[c.p]; }

// ---------- 行った県（訪問済み）の管理 ----------
const STORE_KEY = "tabisaki-visited";
const visited = new Set();
try{
  for(const p of JSON.parse(localStorage.getItem(STORE_KEY)) || []) visited.add(+p);
}catch(e){}

function saveVisited(){
  try{ localStorage.setItem(STORE_KEY, JSON.stringify([...visited])); }catch(e){}
}

function applyVisited(pid){
  const on = visited.has(pid);
  if(prefEls[pid]) prefEls[pid].classList.toggle("visited", on);
}

// ---------- 範囲（地方・都道府県）の選択 ----------
const regionSel = document.getElementById("regionSel");
const prefSel = document.getElementById("prefSel");
const REGIONS = [
  ["hokkaido", "北海道地方", [1]],
  ["tohoku", "東北", [2,3,4,5,6,7]],
  ["kanto", "関東", [8,9,10,11,12,13,14]],
  ["chubu", "中部", [15,16,17,18,19,20,21,22,23]],
  ["kinki", "近畿", [24,25,26,27,28,29,30]],
  ["chugoku", "中国", [31,32,33,34,35]],
  ["shikoku", "四国", [36,37,38,39]],
  ["kyushu", "九州・沖縄", [40,41,42,43,44,45,46,47]],
];
const ALL_PIDS = Object.keys(MAP.prefNames).map(Number).sort((a,b)=>a-b);

function addOpt(sel, value, label){
  const o = document.createElement("option");
  o.value = value; o.textContent = label;
  sel.appendChild(o);
}
addOpt(regionSel, "", "全国");
for(const [key, label] of REGIONS) addOpt(regionSel, key, label);

function fillPrefSel(){
  const r = REGIONS.find(r => r[0] === regionSel.value);
  prefSel.innerHTML = "";
  addOpt(prefSel, "", "都道府県: 指定なし");
  for(const pid of (r ? r[2] : ALL_PIDS)) addOpt(prefSel, pid, MAP.prefNames[pid]);
}
fillPrefSel();

function currentScopePids(){
  const pv = +prefSel.value;
  if(pv) return [pv];
  const r = REGIONS.find(r => r[0] === regionSel.value);
  return r ? r[2] : null;   // null = 全国
}

function vbForPids(pids){
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for(const pid of pids){
    const pe = prefEls[pid];
    if(!pe) continue;
    const b = pe.getBBox();
    x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height);
  }
  if(x0 > x1) return fullVB();
  const w = x1 - x0, h = y1 - y0;
  const cx = x0 + w/2, cy = y0 + h/2;
  const aspect = MAP.W / MAP.H;
  let vw = Math.max(w * 1.15, 60), vh = Math.max(h * 1.15, 60);
  if(vw / vh > aspect) vh = vw / aspect; else vw = vh * aspect;
  return [cx - vw/2, cy - vh/2, vw, vh];
}

function scopeVB(){
  const pids = currentScopePids();
  if(!pids) return fullVB();
  return vbForPids(pids);
}

function resetTanzaku(){
  ekisign.hidden = true;
  tanzaku.hidden = false;
  tzInner.hidden = true;
  tzIdle.hidden = false;
  tanzaku.className = "tanzaku";
}

function applyScope(){
  clearResultFx();
  resetTanzaku();
  if(!editing) animateVB(scopeVB(), 700);
  updatePoolInfo();
}
regionSel.addEventListener("change", () => { fillPrefSel(); applyScope(); });
prefSel.addEventListener("change", applyScope);

// ---------- 抽選対象（市区町村 / 駅） ----------
const targetCityBtn = document.getElementById("targetCity");
const targetStaBtn = document.getElementById("targetSta");
let target = "city";   // city | station
try{
  if(localStorage.getItem("tabisaki-target") === "station") target = "station";
}catch(e){}
function applyTargetUI(){
  targetCityBtn.classList.toggle("active", target === "city");
  targetStaBtn.classList.toggle("active", target === "station");
}
function isStation(c){ return c.l !== undefined; }

const KMAP = {"きゃ":"kya","きゅ":"kyu","きょ":"kyo","しゃ":"sha","しゅ":"shu","しょ":"sho","ちゃ":"cha","ちゅ":"chu","ちょ":"cho","にゃ":"nya","にゅ":"nyu","にょ":"nyo","ひゃ":"hya","ひゅ":"hyu","ひょ":"hyo","みゃ":"mya","みゅ":"myu","みょ":"myo","りゃ":"rya","りゅ":"ryu","りょ":"ryo","ぎゃ":"gya","ぎゅ":"gyu","ぎょ":"gyo","じゃ":"ja","じゅ":"ju","じょ":"jo","びゃ":"bya","びゅ":"byu","びょ":"byo","ぴゃ":"pya","ぴゅ":"pyu","ぴょ":"pyo","ふぁ":"fa","ふぃ":"fi","ふぇ":"fe","ふぉ":"fo","うぃ":"wi","うぇ":"we","ゔぁ":"va","ゔぃ":"vi","ゔぇ":"ve","ゔぉ":"vo","でぃ":"di","てぃ":"ti",
"あ":"a","い":"i","う":"u","え":"e","お":"o","か":"ka","き":"ki","く":"ku","け":"ke","こ":"ko","さ":"sa","し":"shi","す":"su","せ":"se","そ":"so","た":"ta","ち":"chi","つ":"tsu","て":"te","と":"to","な":"na","に":"ni","ぬ":"nu","ね":"ne","の":"no","は":"ha","ひ":"hi","ふ":"fu","へ":"he","ほ":"ho","ま":"ma","み":"mi","む":"mu","め":"me","も":"mo","や":"ya","ゆ":"yu","よ":"yo","ら":"ra","り":"ri","る":"ru","れ":"re","ろ":"ro","わ":"wa","を":"o","ん":"n","が":"ga","ぎ":"gi","ぐ":"gu","げ":"ge","ご":"go","ざ":"za","じ":"ji","ず":"zu","ぜ":"ze","ぞ":"zo","だ":"da","ぢ":"ji","づ":"zu","で":"de","ど":"do","ば":"ba","び":"bi","ぶ":"bu","べ":"be","ぼ":"bo","ぱ":"pa","ぴ":"pi","ぷ":"pu","ぺ":"pe","ぽ":"po","ゔ":"vu","ぁ":"a","ぃ":"i","ぅ":"u","ぇ":"e","ぉ":"o","ゎ":"wa","ー":""};
function toRomaji(kana){
  let out = "";
  for(let i = 0; i < kana.length; i++){
    const two = kana.slice(i, i + 2);
    if(KMAP[two] !== undefined){ out += KMAP[two]; i++; continue; }
    const ch = kana[i];
    if(ch === "っ"){
      const nxt = KMAP[kana.slice(i + 1, i + 3)] ?? KMAP[kana[i + 1]] ?? "";
      if(nxt) out += nxt[0] === "c" ? "t" : nxt[0];
      continue;
    }
    out += KMAP[ch] ?? "";
  }
  out = out.replace(/n([bmp])/g, "m$1")
           .replace(/ou/g, "ō").replace(/oo/g, "ō").replace(/uu/g, "ū");
  return out ? out.charAt(0).toUpperCase() + out.slice(1) : "";
}
function stationDisp(c){
  const hasSuffix = /(駅|駅前|停留場)$/.test(c.n);
  return {
    n: hasSuffix ? c.n : c.n + "駅",
    k: c.k ? (hasSuffix ? c.k : c.k + "えき") : "",
  };
}
function dispOf(c){
  return isStation(c) ? stationDisp(c) : { n: c.n, k: c.k };
}

function pool(){
  const pids = currentScopePids();
  const inScope = pids ? new Set(pids) : null;
  const src = target === "station" ? MAP.stations : cities;
  return src.filter(c => (!inScope || inScope.has(c.p)) && !visited.has(c.p));
}

function updatePoolInfo(){
  const n = pool().length;
  const unit = target === "station" ? "駅" : "市区町村";
  poolInfo.textContent = visited.size
    ? `対象 ${n}${unit}（行った ${visited.size}県を除外中）`
    : `対象 ${n}${unit}`;
  if(state === "idle") btn.disabled = n === 0;
  const idle = document.getElementById("tzIdle");
  if(!idle.hidden) idle.textContent = n === 0 ? "全県制覇！" : "どこへ行く？";
}

for(const pid in prefEls){
  prefEls[pid].addEventListener("click", () => {
    if(!editing || state !== "idle") return;
    const id = +pid;
    visited.has(id) ? visited.delete(id) : visited.add(id);
    applyVisited(id);
    saveVisited();
    updatePoolInfo();
  });
}

editBtn.addEventListener("click", () => {
  editing = !editing;
  animateVB(editing ? fullVB() : scopeVB(), 650);
  svg.classList.toggle("editing", editing);
  editBtn.classList.toggle("active", editing);
  editBtn.textContent = editing ? "塗り終わった（閉じる）" : "行った県を塗って除外する";
  editHint.hidden = !editing;
});

// ---------- ズーム ----------
// 全国表示: ヘッダー・操作パネル・フッターに被らない「安全領域」に日本列島を収める
function fullVB(){
  const vw = innerWidth, vh = innerHeight;
  let L = 16, R = vw - 16, T = 110, B = vh - 16;
  try{
    // スクロール位置に左右されないよう、ページ先頭基準（ドキュメント座標）で計算する
    const header = document.querySelector("header").getBoundingClientRect();
    const panel = document.querySelector(".panel").getBoundingClientRect();
    const footer = document.querySelector("footer").getBoundingClientRect();
    T = Math.max(40, Math.min(vh * 0.4, header.bottom + scrollY + 8));
    if(vw / Math.max(vh, 1) > 1.05){
      R = Math.min(R, panel.left + scrollX - 16);
      const fb = footer.top + scrollY - 8;
      if(fb > T + 100) B = Math.min(B, fb);
    }else{
      // スマホのパネルは画面下固定のボトムシートなので、ビューポート座標のまま使う
      const pt = panel.top - 10;
      if(pt > T + 100) B = Math.min(B, pt);
    }
  }catch(e){}
  if(R - L < 100){ L = 16; R = vw - 16; }
  if(B - T < 100){ T = 40; B = vh - 16; }
  const s = Math.min((R - L) / MAP.W, (B - T) / MAP.H);
  if(!isFinite(s) || s <= 0) return [0, 0, MAP.W, MAP.H];
  // 横方向の余白は右寄りに配分（パネルとの間の空白を詰める）
  const slack = (R - L) - MAP.W * s;
  const cx = slack > 0 ? R - MAP.W * s / 2 - slack * 0.25 : (L + R) / 2;
  const cy = (T + B) / 2;
  return [MAP.W / 2 - cx / s, MAP.H / 2 - cy / s, vw / s, vh / s];
}
let vbAnim = null;
function setVB(v){ svg.setAttribute("viewBox", v.join(" ")); updateSpotScale(); }

// 駅マーカーは現在のズーム率に合わせて画面上のサイズを一定に保つ
function currentZoom(){ return svg.viewBox.baseVal.height / MAP.H; }
function updateSpotScale(){
  if(spot.style.visibility !== "visible") return;
  spot.setAttribute("transform",
    `translate(${spot.dataset.x} ${spot.dataset.y}) scale(${currentZoom()})`);
}
function placeSpot(x, y){
  spot.dataset.x = x;
  spot.dataset.y = y;
  spot.style.visibility = "visible";
  updateSpotScale();
}
function scalePulses(c, z){
  for(const p of pulses){
    p.setAttribute("transform",
      `translate(${c.x} ${c.y}) scale(${z}) translate(${-c.x} ${-c.y})`);
  }
}
function animateVB(to, dur){
  cancelAnimationFrame(vbAnim);
  if(reduced || dur <= 0){ setVB(to); return; }
  const from = svg.getAttribute("viewBox").split(" ").map(Number);
  const t0 = performance.now();
  const ease = t => t < .5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2) / 2;
  (function step(now){
    const p = Math.min((now - t0) / dur, 1);
    const e = ease(p);
    setVB(from.map((f, i) => f + (to[i] - f) * e));
    if(p < 1) vbAnim = requestAnimationFrame(step);
  })(t0);
}
function zoomToCity(c){
  let x = c.x - 8, y = c.y - 8, w = 16, h = 16;
  if(c.el){
    const b = c.el.getBBox();
    if(b.width > 0){ x = b.x; y = b.y; w = b.width; h = b.height; }
  }
  const aspect = MAP.W / MAP.H;
  let vw = Math.max(w * 3, 120);
  let vh = Math.max(h * 3, 120);
  if(vw / vh > aspect) vh = vw / aspect; else vw = vh * aspect;
  const cx = x + w / 2, cy = y + h / 2;
  animateVB([cx - vw / 2, cy - vh / 2, vw, vh], 1100);
  // パルスの見た目サイズをズーム率に合わせて維持
  scalePulses(c, vh / MAP.H);
}

let curCity = null;
function moveSpot(c){
  // 直前の市区町村の形を消して、パッと切り替える
  if(curCity && curCity !== c && curCity.el){
    curCity.el.classList.remove("on");
  }
  if(c.el){
    c.el.classList.add("on");
    spot.style.visibility = "hidden";
  }else{
    placeSpot(c.x, c.y);
  }
  curCity = c;
  if(hotPref) hotPref.classList.remove("hot");
  hotPref = prefEls[c.p] || null;
  if(hotPref) hotPref.classList.add("hot");
}

function showName(c, state){
  if(isStation(c)){
    // 駅名標スタイル（駅の看板）
    tanzaku.hidden = true;
    ekisign.hidden = false;
    ekiPref.textContent = prefName(c);
    ekiKana.textContent = c.k || "";
    ekiKanji.textContent = c.n;
    ekiKanji.className = "eki-kanji" +
      (c.n.length >= 9 ? " len9" : c.n.length >= 6 ? " len6" : "");
    ekiRomaji.textContent = toRomaji(c.k || "");
    ekisign.className = "ekisign " + state;
    return;
  }
  ekisign.hidden = true;
  tanzaku.hidden = false;
  const d = dispOf(c);
  tzIdle.hidden = true;
  tzInner.hidden = false;
  tzPref.textContent = prefName(c);
  tzCity.innerHTML = "";
  const ruby = document.createElement("ruby");
  ruby.append(d.n);
  const rt = document.createElement("rt");
  rt.textContent = d.k || "";
  ruby.appendChild(rt);
  tzCity.appendChild(ruby);
  tanzaku.className = "tanzaku " + state;
}

function clearResultFx(){
  for(const p of pulses) p.remove();
  pulses = [];
  for(const pid in prefEls) prefEls[pid].classList.remove("lit", "flash");
  if(curCity && curCity.el){
    curCity.el.classList.remove("on");
    curCity = null;
  }
  gmap.classList.remove("show");
  statsBox.classList.remove("show");
  spot.style.visibility = "hidden";
}

function finish(c){
  moveSpot(c);
  if(hotPref) hotPref.classList.remove("hot");
  const litEl = prefEls[c.p];
  if(litEl) litEl.classList.add("lit");
  for(const cls of ["pulse", "pulse p2"]){
    const p = el("circle", {cx: c.x, cy: c.y, class: cls}, gFx);
    pulses.push(p);
  }
  scalePulses(c, currentZoom());
  showName(c, "done");
  gmap.href = "https://www.google.com/maps/search/" +
    encodeURIComponent(prefName(c) + " " + dispOf(c).n);
  gmap.classList.add("show");
  if(isStation(c)) showStatsStation(c); else showStats(c);
  addHistory(c);
  state = "idle";
  regionSel.disabled = prefSel.disabled = false;
  modeDirectBtn.disabled = modeStagedBtn.disabled = false;
  targetCityBtn.disabled = targetStaBtn.disabled = false;
  btn.textContent = "もう一度スタート";
  updatePoolInfo();
  setTimeout(() => {
    if(state === "idle" && curCity === c) zoomToCity(c);
  }, 350);
}

const statCells = statsBox.querySelectorAll("div");
function showStatsStation(st){
  statsBox.classList.add("single");
  statCells[1].style.display = "none";
  statCells[2].style.display = "none";
  statCells[0].querySelector("dt").textContent = "路線";
  statPop.textContent = st.l || "—";
  statsBox.classList.add("show");
}

function showStats(c){
  statsBox.classList.remove("single");
  statCells[1].style.display = "";
  statCells[2].style.display = "";
  statCells[0].querySelector("dt").textContent = "人口";
  if(c.pop == null && c.ar == null){ statsBox.classList.remove("show"); return; }
  statPop.textContent = c.pop != null ? c.pop.toLocaleString("ja-JP") + "人" : "—";
  statArea.textContent = c.ar != null
    ? c.ar.toLocaleString("ja-JP", {maximumFractionDigits: 2}) + "km²" : "—";
  statDens.textContent = (c.pop != null && c.ar > 0)
    ? Math.round(c.pop / c.ar).toLocaleString("ja-JP") + "人/km²" : "—";
  statsBox.classList.add("show");
}

function addHistory(c){
  historyBox.hidden = false;
  const li = document.createElement("li");
  li.innerHTML = `<span>${prefName(c)}</span><b>${dispOf(c).n}</b>`;
  historyList.prepend(li);
  while(historyList.children.length > 5) historyList.lastChild.remove();
}

// ---------- 演出モード ----------
const modeDirectBtn = document.getElementById("modeDirect");
const modeStagedBtn = document.getElementById("modeStaged");
let mode = "direct";   // direct = 一気に / staged = 都道府県 → 市区町村
try{
  if(localStorage.getItem("tabisaki-mode") === "staged") mode = "staged";
}catch(e){}
function applyModeUI(){
  modeDirectBtn.classList.toggle("active", mode === "direct");
  modeStagedBtn.classList.toggle("active", mode === "staged");
}
function setMode(m){
  if(state !== "idle") return;
  mode = m;
  applyModeUI();
  try{ localStorage.setItem("tabisaki-mode", m); }catch(e){}
}
modeDirectBtn.addEventListener("click", () => setMode("direct"));
modeStagedBtn.addEventListener("click", () => setMode("staged"));
applyModeUI();

function setTarget(t){
  if(state !== "idle") return;
  target = t;
  applyTargetUI();
  try{ localStorage.setItem("tabisaki-target", t); }catch(e){}
  clearResultFx();
  resetTanzaku();
  updatePoolInfo();
}
targetCityBtn.addEventListener("click", () => setTarget("city"));
targetStaBtn.addEventListener("click", () => setTarget("station"));
applyTargetUI();

// ---------- ルーレット本体 ----------
// スタート → 高速で回り続ける → ストップで減速して停止
let stopAt = 0;

function pickRandom(list, exclude){
  let v;
  do { v = list[(Math.random() * list.length) | 0]; }
  while (exclude !== null && v === exclude && list.length > 1);
  return v;
}

// 汎用スピナー: items から高速に選び続け、ストップ後に減速して onDone(最後の候補)
function runSpin(items, renderTick, onDone){
  state = "running";
  btn.disabled = false;
  btn.textContent = "ストップ";
  const MIN_IV = 45, MAX_IV = 560, DECEL = 2800, LINGER = 500;
  let nextAt = 0, prev = null;
  (function frame(now){
    if(state === "running"){
      if(now >= nextAt){
        nextAt = now + MIN_IV;
        prev = pickRandom(items, prev);
        renderTick(prev);
      }
    }else{ // stopping: 減速して、最後に表示された候補がそのまま結果になる
      const t = now - stopAt;
      if(t >= DECEL + LINGER){ onDone(prev); return; }
      if(t < DECEL && now >= nextAt){
        const p = t / DECEL;
        nextAt = now + MIN_IV + (MAX_IV - MIN_IV) * p * p * p;
        prev = pickRandom(items, prev);
        renderTick(prev);
      }
    }
    requestAnimationFrame(frame);
  })(performance.now());
}

// 都道府県ステージの点灯
let flashEl = null;
function flashPref(pid){
  if(flashEl) flashEl.classList.remove("flash");
  flashEl = prefEls[pid] || null;
  if(flashEl) flashEl.classList.add("flash");
}

function showPrefName(pid, state){
  ekisign.hidden = true;
  tanzaku.hidden = false;
  tzIdle.hidden = true;
  tzInner.hidden = false;
  tzPref.textContent = "";
  tzCity.textContent = MAP.prefNames[pid];
  tanzaku.className = "tanzaku " + state;
}

function spinCities(list){
  runSpin(
    list,
    c => { moveSpot(c); showName(c, "spinning"); },
    c => finish(c)
  );
}

function start(){
  const list = pool();
  if(state !== "idle" || list.length === 0) return;
  clearResultFx();
  regionSel.disabled = prefSel.disabled = true;
  modeDirectBtn.disabled = modeStagedBtn.disabled = true;
  targetCityBtn.disabled = targetStaBtn.disabled = true;

  if(reduced){ finish(pickRandom(list, null)); return; }

  animateVB(scopeVB(), 650);
  const prefCands = [...new Set(list.map(c => c.p))];

  if(mode === "staged" && prefCands.length > 1){
    // ステージ1: 都道府県ルーレット
    runSpin(
      prefCands,
      pid => { flashPref(pid); showPrefName(pid, "spinning"); },
      pid => {
        // 都道府県が決定 → ズームして市区町村ルーレットへ
        state = "transition";
        btn.disabled = true;
        btn.textContent = "抽選中…";
        if(flashEl){ flashEl.classList.remove("flash"); flashEl = null; }
        const pe = prefEls[pid];
        if(pe) pe.classList.add("lit");
        showPrefName(pid, "spinning");
        animateVB(vbForPids([pid]), 950);
        setTimeout(() => {
          spinCities(list.filter(c => c.p === pid));
        }, 1100);
      }
    );
  }else{
    spinCities(list);
  }
}

function requestStop(){
  state = "stopping";
  stopAt = performance.now();
  btn.disabled = true;
  btn.textContent = "抽選中…";
}

btn.addEventListener("click", () => {
  if(state === "idle") start();
  else if(state === "running") requestStop();
});

// 保存済みの「行った県」を復元
for(const id of visited) applyVisited(id);
updatePoolInfo();
requestAnimationFrame(() => setVB(scopeVB()));
addEventListener("resize", () => {
  if(state === "idle" && !curCity) setVB(scopeVB());
});
