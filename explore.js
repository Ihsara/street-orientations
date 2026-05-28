// The filterable wall: order-score dot strip + filter bar + responsive rose grid.
// All client-side over data.json. Reuses helpers from app.js.
(function(){
  const root = document.getElementById("explore");
  const state = { country:"All", classes:new Set(), sort:"order", q:"", subset:"all" };
  let ALL = [];

  // Country palette for the dot strip — matches .strip-legend .fi/.vn swatches.
  const COUNTRY_COLOR = { Finland: "#3a6b5e", Vietnam: "#b9602a" };

  const norm = s => normText(s);

  // ----- filtering / sorting -----
  function filtered(){
    let cs = ALL.slice();
    if(state.country !== "All") cs = cs.filter(c=>c.country===state.country);
    if(state.classes.size) cs = cs.filter(c=>state.classes.has(c.country+"|"+c.class_label));
    if(state.q){ const q=norm(state.q); cs = cs.filter(c=>norm(c.name).includes(q)); }
    // For "order" sort, push cities with a null score for this subset to the end
    // (they have no edges of this rank in the disk).
    const orderCmp = (a,b)=>{
      const sa = a.order_score[state.subset], sb = b.order_score[state.subset];
      if(sa === null && sb === null) return 0;
      if(sa === null) return 1;
      if(sb === null) return -1;
      return sa - sb;
    };
    const cmp = {
      order: orderCmp,
      population: (a,b)=>a.pop_rank-b.pop_rank,
      km: (a,b)=>b.total_km[state.subset]-a.total_km[state.subset],
      name: (a,b)=>a.name.localeCompare(b.name),
    }[state.sort];
    return cs.sort(cmp);
  }

  // ----- order-score dot strip -----
  // Horizontal axis = order score in the active subset. Finland top lane,
  // Vietnam bottom; dots colored by country (not by score — the axis IS the
  // score). Hover -> rose preview.
  function renderStrip(cs){
    const wrap = root.querySelector("#strip");
    const scores = ALL
      .map(c=>c.order_score[state.subset])
      .filter(s=>s!==null);
    const lo = scores.length ? Math.min(...scores) : 0;
    const hi = scores.length ? Math.max(...scores) : 1;
    const pad = (hi-lo)*0.06 || 0.01;
    const min = lo-pad, max = hi+pad;
    const x = s => ((s-min)/(max-min))*100;
    wrap.innerHTML = `
      <div class="strip-axis"><span>${min.toFixed(2)} · more grid</span><span>more organic · ${max.toFixed(2)}</span></div>
      <div class="strip-lanes">
        <div class="lane" data-lane="Finland"></div>
        <div class="lane" data-lane="Vietnam"></div>
      </div>
      <div class="strip-legend"><span class="k fi">● Finland</span><span class="k vn">● Vietnam</span></div>
      <div class="strip-pop" id="strippop" hidden></div>`;
    const visible = new Set(cs.map(c=>c.name));
    for(const c of ALL){
      const lane = wrap.querySelector(`.lane[data-lane="${c.country}"]`);
      if(!lane) continue;
      const score = c.order_score[state.subset];
      const empty = score === null;
      const dot = document.createElement("button");
      dot.className = "dot"
        + (visible.has(c.name) ? "" : " dim")
        + (empty ? " no-data" : "");
      // Empty cities pin to the axis minimum so they're still hoverable.
      dot.style.left = (empty ? 0 : x(score)) + "%";
      dot.style.background = COUNTRY_COLOR[c.country] || "#888";
      dot.setAttribute("aria-label",
        empty
          ? `${c.name}: no ${state.subset} edges in 3 km radius`
          : `${c.name}: ${score.toFixed(3)}`);
      dot.addEventListener("mouseenter", ()=>showPop(c, dot));
      dot.addEventListener("focus", ()=>showPop(c, dot));
      dot.addEventListener("mouseleave", hidePop);
      dot.addEventListener("blur", hidePop);
      lane.appendChild(dot);
    }
  }
  function showPop(c, dot){
    const pop = root.querySelector("#strippop");
    const score = c.order_score[state.subset];
    const empty = score === null;
    pop.hidden = false;
    pop.innerHTML = `<canvas width="120" height="120"></canvas>
      <div class="pp-name">${c.name}</div>
      <div class="pp-sc">${empty ? `no ${state.subset} edges` : score.toFixed(3)} · ${c.country}</div>`;
    const r = dot.getBoundingClientRect();
    const pr = root.getBoundingClientRect();
    pop.style.left = (r.left - pr.left) + "px";
    pop.style.top  = (r.top  - pr.top) + "px";
    const col = empty ? "#cdc6b4" : scoreColor(score);
    drawRose(pop.querySelector("canvas"), c.dist[state.subset], col, 120);
  }
  function hidePop(){ const pop=root.querySelector("#strippop"); if(pop) pop.hidden=true; }

  // ----- grid -----
  function renderGrid(cs){
    const grid = root.querySelector("#egrid");
    grid.innerHTML = "";
    cs.forEach((c,i)=>{
      const fig = cityCard(c, {rank:i+1, detail:false, subset:state.subset});
      const badge = document.createElement("div");
      badge.className = "stat badge";
      const empty = c.order_score[state.subset] === null;
      badge.textContent = empty
        ? `${c.class_label} · no ${state.subset} edges`
        : `${c.class_label} · streets ${dominantAxis(c.dist[state.subset])}`;
      fig.appendChild(badge);
      grid.appendChild(fig);
    });
    root.querySelector("#count").textContent =
      `Showing ${cs.length} of ${ALL.length}` +
      (state.country!=="All" ? ` · ${state.country}` : "") +
      (state.classes.size ? ` · ${[...state.classes].map(s=>s.split("|")[1]).join(", ")}` : "") +
      ` · edges: ${state.subset}` +
      ` · sorted by ${state.sort}`;
  }

  function rerender(){ const cs=filtered(); renderStrip(cs); renderGrid(cs); }

  // ----- controls -----
  function buildControls(){
    // country segmented control
    root.querySelectorAll("[data-country]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        state.country = btn.dataset.country;
        root.querySelectorAll("[data-country]").forEach(b=>b.classList.toggle("on", b===btn));
        if(state.country!=="All"){
          for(const key of [...state.classes]) if(!key.startsWith(state.country+"|")) state.classes.delete(key);
        }
        syncChips(); rerender();
      });
    });
    // edges segmented control
    root.querySelectorAll("[data-subset]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        state.subset = btn.dataset.subset;
        root.querySelectorAll("[data-subset]").forEach(b=>b.classList.toggle("on", b===btn));
        rerender();
      });
    });
    // class chips (built from data, grouped by country)
    const chipWrap = root.querySelector("#chips");
    const seen = [];
    for(const c of ALL){ const key=c.country+"|"+c.class_label; if(!seen.includes(key)) seen.push(key); }
    for(const key of seen){
      const [country,label] = key.split("|");
      const chip = document.createElement("button");
      chip.className = "chip"; chip.dataset.key = key;
      chip.textContent = `${country==="Finland"?"🇫🇮":"🇻🇳"} ${label}`;
      chip.addEventListener("click", ()=>{
        if(state.classes.has(key)) state.classes.delete(key);
        else state.classes.add(key);
        chip.classList.toggle("on");
        rerender();
      });
      chipWrap.appendChild(chip);
    }
    // sort
    root.querySelector("#sort").addEventListener("change", e=>{ state.sort=e.target.value; rerender(); });
    // search
    root.querySelector("#search").addEventListener("input", e=>{ state.q=e.target.value; rerender(); });
  }
  function syncChips(){
    root.querySelectorAll(".chip").forEach(ch=>{
      ch.classList.toggle("on", state.classes.has(ch.dataset.key));
    });
  }

  loadData().then(d=>{
    ALL = d.cities;
    document.getElementById("srcline").textContent =
      `Data: OpenStreetMap drive networks, ${d.radius_km} km radius · ${ALL.length} cities · `;
    if(d.classification_note){
      const n=document.getElementById("classnote"); if(n) n.textContent=d.classification_note;
    }
    buildControls();
    root.querySelector('[data-country="All"]').classList.add("on");
    root.querySelector('[data-subset="all"]').classList.add("on");
    rerender();
  }).catch(e=>showLoadError(root.querySelector("#egrid"), e));
})();
