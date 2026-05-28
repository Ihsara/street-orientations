// Shared rendering for the street-orientation pages. No build step, no deps.
// Compass convention: bin i centred on i*10°, North up, clockwise — identical
// to the matplotlib version that made the PNG.
const NS = 36;
const TAU = Math.PI * 2;

// Map order score (0..1) onto the grid→chaos diverging colour (matches the legend).
function scoreColor(s){
  const grid  = [58,107,94];   // #3a6b5e
  const paper = [205,198,180];
  const chaos = [185,96,42];   // #b9602a
  let a,b,t;
  if(s < 0.5){ a=grid; b=paper; t=s/0.5; }
  else       { a=paper; b=chaos; t=(s-0.5)/0.5; }
  const m=i=>Math.round(a[i]+(b[i]-a[i])*t);
  return `rgb(${m(0)},${m(1)},${m(2)})`;
}

const fmt = n => Number(n).toLocaleString();

// Draw one length-weighted rose onto a canvas. maxPx sets the device-pixel size.
function drawRose(canvas, dist, color, maxPx=188){
  const dpr = Math.min(window.devicePixelRatio||1, 2);
  const size = maxPx;
  canvas.width = size*dpr; canvas.height = size*dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr,dpr);
  const cx=size/2, cy=size/2, R=size*0.42;
  const maxw = Math.max(...dist, 1e-9);

  ctx.strokeStyle="rgba(27,27,27,0.14)"; ctx.lineWidth=1;
  for(const f of [0.5,1.0]){ ctx.beginPath(); ctx.arc(cx,cy,R*f,0,TAU); ctx.stroke(); }
  ctx.strokeStyle="rgba(27,27,27,0.22)";
  for(let k=0;k<4;k++){
    const ang=-Math.PI/2 + k*Math.PI/2;
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+Math.cos(ang)*R, cy+Math.sin(ang)*R); ctx.stroke();
  }

  const bin = TAU/NS;
  for(let i=0;i<NS;i++){
    const r = R*Math.sqrt(dist[i]/maxw);   // sqrt → area-proportional
    if(r<=0) continue;
    const centre = -Math.PI/2 + (i*bin);   // 0 at North, clockwise
    const a0 = centre - bin/2, a1 = centre + bin/2;
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,r,a0,a1); ctx.closePath();
    ctx.fillStyle=color; ctx.globalAlpha=0.9; ctx.fill(); ctx.globalAlpha=1;
    ctx.strokeStyle="#f4f1ea"; ctx.lineWidth=0.6; ctx.stroke();
  }

  ctx.fillStyle="#534f46";
  ctx.font="500 11px 'Spline Sans Mono', monospace";
  ctx.textAlign="center"; ctx.textBaseline="middle";
  const off=R+11;
  ctx.fillText("N",cx,cy-off); ctx.fillText("S",cx,cy+off);
  ctx.fillText("E",cx+off,cy); ctx.fillText("W",cx-off,cy);
}

// Build a <figure> for one city. opts.rank (1-based) and opts.detail (bigger) optional.
function cityCard(c, opts={}){
  const fig=document.createElement("figure");
  fig.className="rose";
  fig.tabIndex=0;
  const col=scoreColor(c.order_score);
  const rankLine = opts.rank ? `<div class="rank">#${opts.rank} most grid-like</div>` : "";
  fig.innerHTML=`
    ${rankLine}
    <canvas role="img" aria-label="${c.name}: order score ${c.order_score.toFixed(2)}"></canvas>
    <figcaption class="city">${c.name}</figcaption>
    <div class="score"><span class="dot" style="background:${col}"></span><span class="val">${c.order_score.toFixed(3)}</span> order</div>
    <div class="stat">${fmt(c.edges)} edges · ${fmt(c.total_km)} km</div>`;
  // draw after insertion so the canvas has a context
  queueMicrotask(()=>drawRose(fig.querySelector("canvas"), c.dist, col, opts.detail?240:188));
  return fig;
}

// Load data.json once; returns the parsed object or throws.
async function loadData(){
  const r = await fetch("data.json");
  if(!r.ok) throw new Error("HTTP "+r.status);
  return r.json();
}

function showLoadError(container, e){
  container.innerHTML =
    `<p class="loading">Couldn't load <code>data.json</code> (${e.message}). Serve this folder over HTTP, e.g. <code>python -m http.server</code>, rather than opening the file directly.</p>`;
}

// Dominant street axis as a two-ended compass label (e.g. "NE–SW"). Roses are
// symmetric, so fold each bin with its opposite (i and i+18) and report the axis.
const DIRS8 = ["N","NE","E","SE","S","SW","W","NW"];
function dominantAxis(dist){
  let best=0, bestLen=-1;
  for(let i=0;i<18;i++){
    const len = dist[i] + dist[i+18];
    if(len>bestLen){ bestLen=len; best=i; }
  }
  let k = Math.round((best*10)/45) % 8;
  if(k >= 4) k -= 4;
  return `${DIRS8[k]}–${DIRS8[k+4]}`;
}

// Normalize a string for diacritic-insensitive substring search ("Hué" -> "hue").
function normText(s){
  return s.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();
}
