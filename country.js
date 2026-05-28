// Builds a single-country page from data.json. All narrative is derived from the
// data itself (rankings, scores, rose shape) — no external/historical claims.
(function(){
  const page = document.getElementById("page");
  const country = page.dataset.country;
  const other = page.dataset.other;
  const slug = s => s.toLowerCase().replace(/[^a-z]/g,"");

  // dominantAxis() is shared — defined in app.js, which loads before this file.

  loadData().then(d=>{
    const cs = d.cities.filter(c=>c.country===country).sort((a,b)=>a.order_score-b.order_score);
    const others = d.cities.filter(c=>c.country===other);
    if(!cs.length){ page.innerHTML='<p class="loading">No cities for '+country+' in data.json.</p>'; return; }

    const mean = a => a.reduce((s,x)=>s+x,0)/a.length;
    const meanScore = mean(cs.map(c=>c.order_score));
    const meanOther = others.length ? mean(others.map(c=>c.order_score)) : null;
    const totalKm = cs.reduce((s,c)=>s+(c.total_km||0),0);
    const totalEdges = cs.reduce((s,c)=>s+(c.edges||0),0);
    const mostGrid = cs[0];                 // lowest score
    const leastGrid = cs[cs.length-1];      // highest score

    document.getElementById("srcline").textContent =
      `Data: OpenStreetMap drive networks, 3 km radius · ${country}, ${cs.length} cities · `;
    document.getElementById("standfirst").innerHTML =
      `${cs.length} ${country === "Finland" ? "Finnish" : "Vietnamese"} cities as 3&nbsp;km disks around their historic centres, ` +
      `ordered from <b>most grid-like</b> to <b>least</b>. Lower order score = streets cluster on fewer axes.`;

    page.innerHTML="";

    // ---- at-a-glance summary ----
    const glance=document.createElement("section");
    glance.className="glance";
    const tint = meanOther==null ? "" : (meanScore < meanOther ? "tint-lo" : "tint-hi");
    glance.innerHTML=`
      <div class="figure"><span class="num ${tint}">${meanScore.toFixed(3)}</span><span class="cap">mean order score</span></div>
      <div class="figure"><span class="num">${Math.round(totalKm).toLocaleString()}</span><span class="cap">km of street mapped</span></div>
      <div class="figure"><span class="num">${mostGrid.order_score.toFixed(3)}</span><span class="cap">most grid-like · <b>${mostGrid.name}</b></span></div>
      <div class="figure"><span class="num">${leastGrid.order_score.toFixed(3)}</span><span class="cap">least grid-like · <b>${leastGrid.name}</b></span></div>`;
    page.appendChild(glance);

    // ---- factual narrative (data-derived only) ----
    const spread = leastGrid.order_score - mostGrid.order_score;
    const prose=document.createElement("section");
    prose.className="prose";
    let cmp = "";
    if(meanOther!=null){
      const diff = Math.abs(meanScore-meanOther);
      const rel = meanScore < meanOther ? "more grid-like (lower)" : "less grid-like (higher)";
      cmp = ` On average ${country}'s cities score <b>${meanScore.toFixed(3)}</b>, ${rel} than ${other}'s <b>${meanOther.toFixed(3)}</b> — a gap of ${diff.toFixed(3)}.`;
    }
    prose.innerHTML=`
      <p>Across these ${cs.length} cities the order score runs from <b>${mostGrid.order_score.toFixed(3)}</b>
      (${mostGrid.name}, the most grid-like here) to <b>${leastGrid.order_score.toFixed(3)}</b>
      (${leastGrid.name}, the least), a spread of ${spread.toFixed(3)}.${cmp}</p>
      <p>In each rose below, the longer arms mark the directions most of that city's streets run.
      Read the shape, not just the number: two strong perpendicular arms is a grid; an even ring is organic growth.</p>`;
    page.appendChild(prose);

    // ---- ranked detail roses ----
    const sec=document.createElement("section");
    sec.className="plate";
    sec.innerHTML=`
      <div class="plate-head">
        <h2>${country} · ${cs.length} cities</h2>
        <span class="meta">${totalEdges.toLocaleString()} edges · ${Math.round(totalKm).toLocaleString()} km</span>
      </div>
      <div class="roses detail"></div>`;
    const grid=sec.querySelector(".roses");
    cs.forEach((c,i)=>{
      const fig=cityCard(c,{rank:i+1, detail:true});
      // append a factual "streets mostly run <axis>" line under the stats
      const axis=document.createElement("div");
      axis.className="stat";
      axis.textContent=`streets mostly run ${dominantAxis(c.dist)}`;
      fig.appendChild(axis);
      grid.appendChild(fig);
    });
    page.appendChild(sec);

    // ---- compare hook ----
    const cmpBox=document.createElement("section");
    cmpBox.className="compare";
    let line = `See how <b>${other}</b>'s cities compare.`;
    if(meanOther!=null){
      line = meanScore < meanOther
        ? `${country}'s cities are <b>more grid-like</b> on average than ${other}'s. See the contrast →`
        : `${country}'s cities are <b>less grid-like</b> on average than ${other}'s. See the contrast →`;
    }
    cmpBox.innerHTML=`
      <div class="txt">${line}</div>
      <a class="btn" href="${slug(other)}.html">${other} →</a>
      <a class="btn" href="index.html" style="background:transparent;color:var(--ink-soft);border:1px solid var(--rule)">Both side by side</a>`;
    page.appendChild(cmpBox);

    // ---- method note ----
    const note=document.createElement("aside");
    note.className="note";
    note.innerHTML=`
      <h3>How to read this</h3>
      <p>A bin's <b>radius</b> grows with the total length of road pointing that way (counted both
      ways, so every rose is symmetric). The <b>order score</b> is the streets' directional entropy
      normalised so <code>0</code> is a perfect grid and <code>1</code> is perfectly uniform.</p>
      <p>Scores here sit in a narrow band near the disordered end — at a 3&nbsp;km radius across the
      full driving network the differences are real but subtle, so the rose's <em>shape</em> often
      tells you more than the third decimal place.</p>`;
    page.appendChild(note);

  }).catch(e=>showLoadError(page, e));
})();
