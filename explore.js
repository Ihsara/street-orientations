// The filterable wall: order-score dot strip + filter bar + responsive rose grid.
// All client-side over data.json. Reuses helpers from app.js.
(function(){
  const root = document.getElementById("explore");
  const state = { country:"All", classes:new Set(), sort:"order", q:"" };
  let ALL = [];

  const norm = s => normText(s);

  // ----- filtering / sorting -----
  function filtered(){
    let cs = ALL.slice();
    if(state.country !== "All") cs = cs.filter(c=>c.country===state.country);
    if(state.classes.size) cs = cs.filter(c=>state.classes.has(c.country+"|"+c.class_label));
    if(state.q){ const q=norm(state.q); cs = cs.filter(c=>norm(c.name).includes(q)); }
    const cmp = {
      order: (a,b)=>a.order_score-b.order_score,
      population: (a,b)=>a.pop_rank-b.pop_rank,
      km: (a,b)=>b.total_km-a.total_km,
      name: (a,b)=>a.name.localeCompare(b.name),
    }[state.sort];
    return cs.sort(cmp);
  }

  // ----- order-score dot strip -----
  // One horizontal axis = order score. Finland rides the top lane, Vietnam the
  // bottom; population is deliberately NOT an axis. Hover a dot -> rose preview.
  function renderStrip(cs){
    const wrap = root.querySelector("#strip");
    const scores = ALL.map(c=>c.order_score);
    const lo = Math.min(...scores), hi = Math.max(...scores);
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
      const dot = document.createElement("button");
      dot.className = "dot" + (visible.has(c.name) ? "" : " dim");
      dot.style.left = x(c.order_score) + "%";
      dot.style.background = scoreColor(c.order_score);
      dot.setAttribute("aria-label", `${c.name}: ${c.order_score.toFixed(3)}`);
      dot.addEventListener("mouseenter", ()=>showPop(c, dot));
      dot.addEventListener("focus", ()=>showPop(c, dot));
      dot.addEventListener("mouseleave", hidePop);
      dot.addEventListener("blur", hidePop);
      lane.appendChild(dot);
    }
  }
  function showPop(c, dot){
    const pop = root.querySelector("#strippop");
    pop.hidden = false;
    pop.innerHTML = `<canvas width="120" height="120"></canvas>
      <div class="pp-name">${c.name}</div>
      <div class="pp-sc">${c.order_score.toFixed(3)} · ${c.country}</div>`;
    const r = dot.getBoundingClientRect();
    const pr = root.getBoundingClientRect();
    pop.style.left = (r.left - pr.left) + "px";
    pop.style.top  = (r.top  - pr.top) + "px";
    drawRose(pop.querySelector("canvas"), c.dist, scoreColor(c.order_score), 120);
  }
  function hidePop(){ const pop=root.querySelector("#strippop"); if(pop) pop.hidden=true; }

  // ----- grid -----
  function renderGrid(cs){
    const grid = root.querySelector("#egrid");
    grid.innerHTML = "";
    cs.forEach((c,i)=>{
      const fig = cityCard(c, {rank:i+1, detail:false});
      const badge = document.createElement("div");
      badge.className = "stat badge";
      badge.textContent = `${c.class_label} · streets ${dominantAxis(c.dist)}`;
      fig.appendChild(badge);
      grid.appendChild(fig);
    });
    root.querySelector("#count").textContent =
      `Showing ${cs.length} of ${ALL.length}` +
      (state.country!=="All" ? ` · ${state.country}` : "") +
      (state.classes.size ? ` · ${[...state.classes].map(s=>s.split("|")[1]).join(", ")}` : "") +
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
        // clear class chips that don't belong to the chosen country
        if(state.country!=="All"){
          for(const key of [...state.classes]) if(!key.startsWith(state.country+"|")) state.classes.delete(key);
        }
        syncChips(); rerender();
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
    rerender();
  }).catch(e=>showLoadError(root.querySelector("#egrid"), e));
})();
