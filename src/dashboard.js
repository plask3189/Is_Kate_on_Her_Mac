const API_BASE = "";
let pollInterval = null;

async function fetchData() {
  try {
    const res = await fetch(API_BASE + '/api/data');
    if (!res.ok) throw new Error('No data');
    return await res.json();
  } catch { return null; }
}

async function init() {
  const payload = await fetchData();
  const app = document.getElementById('app');
  if (!payload || !payload.entries.length) {
    app.innerHTML = '<div class="loading-state"><p class="error-msg">No activity data found. Start the tracker and check back.</p></div>';
    document.getElementById('fileLabel').textContent = 'no data';
    setTimeout(init, 10000);
    return;
  }
  document.getElementById('fileLabel').textContent = payload.filename;
  render(payload.entries);
  if (!pollInterval) {
    pollInterval = setInterval(async () => {
      const fresh = await fetchData();
      if (fresh && fresh.entries.length) {
        document.getElementById('fileLabel').textContent = fresh.filename;
        render(fresh.entries);
      }
    }, 30000);
  }
}

function render(raw) {
  const data = raw.map(d => ({ ...d, _t: new Date(d.timestamp) })).sort((a, b) => a._t - b._t);
  //console.log(data)
  let totC = 0, totK = 0, totM = 0;
  for (const d of data) {totM += d.mouse_movements; }
  const totAll = totM;

  // Average active hours per day
  const dayHours = {};
  for (const d of data) {
    const dk = d._t.toISOString().slice(0, 10);
    if (!dayHours[dk]) dayHours[dk] = new Set();
    if (d.mouse_movements > 0) dayHours[dk].add(d._t.getHours());
  }
  const dayKeys = Object.keys(dayHours);
  const totalActiveHours = dayKeys.reduce((sum, dk) => sum + dayHours[dk].size, 0);
  const avgHoursPerDay = dayKeys.length ? (totalActiveHours / dayKeys.length).toFixed(1) : '0';
  const spanMin = Math.max(1, Math.round((data[data.length-1]._t - data[0]._t) / 60000));
  const spanLbl = spanMin >= 60 ? (spanMin/60).toFixed(1)+'h' : spanMin+'min';

  // Median start time per weekday (Mon–Fri)
  const perDateMed = {};
  for (const d of data) {
    const dk = d._t.toISOString().slice(0, 10);
    if (!perDateMed[dk]) perDateMed[dk] = { wd: d._t.getDay(), hours: new Set() };
    if (d.mouse_movements > 0) perDateMed[dk].hours.add(d._t.getHours());
  }
  const startsByWd = [[], [], [], [], [], [], []];
  for (const { wd, hours } of Object.values(perDateMed)) {
    if (hours.size > 0) startsByWd[wd].push(Math.min(...hours));
  }
  function medianOf(arr) {
    if (!arr.length) return null;
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m-1] + s[m]) / 2;
  }
  function fmtHour(h) {
    if (h === null) return '—';
    const hr = Math.floor(h);
    const mins = Math.round((h % 1) * 60);
    const ampm = hr >= 12 ? 'pm' : 'am';
    const h12 = hr % 12 || 12;
    return mins > 0 ? `${h12}:${String(mins).padStart(2,'0')}${ampm}` : `${h12}${ampm}`;
  }
  const wdNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const medianStarts = [1,2,3,4,5].map(wd => fmtHour(medianOf(startsByWd[wd])));

  // Total active hours for the previous 5 full weekdays (Mon–Fri)
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const prev5Weekdays = [];
  const cursor = new Date(today); cursor.setDate(cursor.getDate() - 1);
  while (prev5Weekdays.length < 5) {
    const wd = cursor.getDay();
    if (wd !== 0 && wd !== 6) prev5Weekdays.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() - 1);
  }
  const prev5TotalHours = prev5Weekdays.reduce((sum, dk) => sum + (dayHours[dk] ? dayHours[dk].size : 0), 0);
  const avgHoursPerWeekday = (prev5TotalHours / 5).toFixed(1);

  document.getElementById('app').innerHTML = `
    <div class="hero-row anim">
      <div class="hero">
        <div class="hero-label"> Average Active Hours on Weekdays </div>
        <div class="hero-value">${avgHoursPerWeekday} hrs/day</div>
        <div class="hero-sub">
          <span class="green">${(totAll/spanMin).toFixed(0)} events/min</span>
          <span class="dim">over ${spanLbl}</span>
        </div>
      </div>
      <div class="hero">
        <div class="hero-label">Last 5 Weekdays — Total Active Hours</div>
        <div class="hero-value">${prev5TotalHours} hrs</div>
        <div class="hero-sub">
          <span class="dim">${prev5Weekdays[prev5Weekdays.length-1]} – ${prev5Weekdays[0]}</span>
        </div>
      </div>
      <div class="hero">
        <div class="hero-label">Median Start Time by Weekday</div>
        <div class="median-starts">
          ${wdNames.map((lb, i) => `
            <div class="ms-item">
              <div class="ms-time">${medianStarts[i]}</div>
              <div class="ms-day">${lb}</div>
            </div>`).join('')}
        </div>
      </div>
    </div>

    <div class="section anim" style="animation-delay:0.24s">
      <div class="section-header"><span class="section-title">Hourly Heatmap</span></div>
      <div class="chart-card heatmap-card"><div class="heatmap-container"><div class="heatmap-grid" id="heatmap"></div></div></div>
    </div>
        <div class="section anim" style="animation-delay:0.18s">
        <div class="section-header"><span class="section-title">Average Active Hours by Day of Week</span></div>
        <div class="chart-card"><div class="weekday-bars" id="weekdayBars"></div></div>
    </div>`;

  buildWeekdayBars(data);
  buildHeatmap(data);
}

function buildWeekdayBars(data) {
  // For each calendar date, collect the set of active hours, then group by weekday.
  const perDate = {};
  for (const d of data) {
    const dk = d._t.toISOString().slice(0, 10);
    if (!perDate[dk]) perDate[dk] = { wd: d._t.getDay(), hours: new Set() };
    if (d.mouse_movements > 0) {
      perDate[dk].hours.add(d._t.getHours());
    }
  }

  const sums = Array(7).fill(0);
  const counts = Array(7).fill(0);
  for (const { wd, hours } of Object.values(perDate)) {
    sums[wd] += hours.size;
    counts[wd] += 1;
  }
  const avgs = sums.map((s, i) => counts[i] ? s / counts[i] : 0);

  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const mx = Math.max(1, ...avgs);
  const el = document.getElementById('weekdayBars');
  el.innerHTML = labels.map((lb, i) => {
    const v = avgs[i];
    const pct = (v / mx) * 100;
    return `
      <div class="wb-col">
        <div class="wb-bar-wrap">
          <div class="wb-value">${v.toFixed(1)}</div>
          <div class="wb-bar" style="height:${pct}%"></div>
        </div>
        <div class="wb-label">${lb}</div>
      </div>`;
  }).join('');
}

function buildHeatmap(data) {
  const el = document.getElementById('heatmap');
  const map = {};
  const daySet = new Set();
  const dayHoursSet = {};

  data.forEach(d => {
    if (d._t.getDay() === 0 || d._t.getDay() === 6) return;
    const dk = d._t.toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric'});
    const h = d._t.getHours();
    map[dk+'|'+h] = (map[dk+'|'+h]||0) + d.mouse_movements;
    daySet.add(dk);
    if (!dayHoursSet[dk]) dayHoursSet[dk] = new Set();
    if (d.mouse_movements > 0) dayHoursSet[dk].add(h);
  });

  const dayDate = {};
  data.forEach(d => {
    const dk = d._t.toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric'});
    if (!dayDate[dk]) dayDate[dk] = d._t;
  });
  const days = [...daySet].sort((a, b) => dayDate[b] - dayDate[a]);
  const mx = Math.max(1, ...Object.values(map));
  const maxHrs = Math.max(1, ...days.map(dk => dayHoursSet[dk] ? dayHoursSet[dk].size : 0));
  const N = days.length;

  // Explicit rows let the spanning SVG use grid-row: 2 / -1
  el.style.gridTemplateRows = `auto repeat(${N}, 1fr)`;

  const frag = document.createDocumentFragment();

  // Header row
  frag.appendChild(document.createElement('div'));
  for (let h = 0; h < 24; h++) {
    const hd = document.createElement('div');
    hd.className = 'hm-header';
    hd.textContent = String(h).padStart(2, '0');
    frag.appendChild(hd);
  }
  frag.appendChild(document.createElement('div'));
  const rHdr = document.createElement('div');
  rHdr.className = 'rp-col-hdr';
  rHdr.textContent = 'active hrs';
  frag.appendChild(rHdr);

  // Day rows — no cell in column 27; the SVG spans it
  days.forEach((day, i) => {
    const age = N > 1 ? i / (N - 1) : 0;
    const r = Math.round(0 + age * 30);
    const g = Math.round(200 - age * 140);
    const b = Math.round(5 + age * 215);
    const lb = document.createElement('div');
    lb.className = 'hm-label'; lb.textContent = day;
    frag.appendChild(lb);
    for (let h = 0; h < 24; h++) {
      const v = map[day+'|'+h] || 0;
      const cell = document.createElement('div');
      cell.className = 'hm-cell';
      cell.setAttribute('data-tip', `${day} ${h}:00 — ${v} events`);
      if (v > 0) {
        const intensity = v / mx;
        cell.style.backgroundColor = `rgba(${r},${g},${b},${0.1+intensity*0.8})`;
        if (intensity > 0.7) cell.style.boxShadow = `0 0 6px rgba(${r},${g},${b},${intensity*0.3})`;
      }
      frag.appendChild(cell);
    }
    frag.appendChild(document.createElement('div')); // gap col
  });

  // Single SVG spanning all day rows for the smooth ridge plot
  const pts = days.map((dk, i) => {
    const hrs = dayHoursSet[dk] ? dayHoursSet[dk].size : 0;
    return [(hrs / maxHrs) * 96, i + 0.5];
  });

  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 100 ${N}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.style.cssText = `grid-column:27;grid-row:2/-1;width:100%;height:100%;overflow:visible;`;

  const defs = document.createElementNS(ns, 'defs');
  const mkGrad = (id, a1, a2) => {
    const g = document.createElementNS(ns, 'linearGradient');
    g.id = id;
    g.setAttribute('gradientUnits', 'userSpaceOnUse');
    g.setAttribute('x1', '0'); g.setAttribute('y1', '0');
    g.setAttribute('x2', '0'); g.setAttribute('y2', String(N));
    [[`0%`, `rgba(0,200,5,${a1})`], [`100%`, `rgba(30,60,220,${a2})`]].forEach(([off, col]) => {
      const s = document.createElementNS(ns, 'stop');
      s.setAttribute('offset', off); s.setAttribute('stop-color', col);
      g.appendChild(s);
    });
    return g;
  };
  defs.appendChild(mkGrad('ridgeFill', 0.22, 0.22));
  defs.appendChild(mkGrad('ridgeStroke', 0.9, 0.9));
  svg.appendChild(defs);

  // Catmull-Rom → cubic bezier; close=true wraps back to x=0 for a filled area
  function crPath(pts, close) {
    if (!pts.length) return '';
    if (pts.length === 1) return close
      ? `M0 ${pts[0][1]}L${pts[0][0]} ${pts[0][1]}L0 ${pts[0][1]}Z`
      : `M${pts[0][0]} ${pts[0][1]}`;
    const d = close
      ? [`M0 ${pts[0][1]}L${pts[0][0].toFixed(2)} ${pts[0][1]}`]
      : [`M${pts[0][0].toFixed(2)} ${pts[0][1]}`];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const c1x = p1[0] + (p2[0] - p0[0]) / 6;
      const c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6;
      const c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d.push(`C${c1x.toFixed(2)} ${c1y.toFixed(2)},${c2x.toFixed(2)} ${c2y.toFixed(2)},${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`);
    }
    if (close) d.push(`L0 ${pts[pts.length - 1][1]}Z`);
    return d.join('');
  }

  const area = document.createElementNS(ns, 'path');
  area.setAttribute('d', crPath(pts, true));
  area.setAttribute('fill', 'url(#ridgeFill)');
  area.setAttribute('stroke', 'none');
  svg.appendChild(area);

  const curve = document.createElementNS(ns, 'path');
  curve.setAttribute('d', crPath(pts, false));
  curve.setAttribute('fill', 'none');
  curve.setAttribute('stroke', 'url(#ridgeStroke)');
  curve.setAttribute('stroke-width', '1.5');
  curve.setAttribute('vector-effect', 'non-scaling-stroke');
  curve.setAttribute('stroke-linecap', 'round');
  curve.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(curve);

  // Invisible hit-target rects — one per day row — for hover tooltips
  let ridgeTip = document.getElementById('ridge-tip');
  if (!ridgeTip) {
    ridgeTip = document.createElement('div');
    ridgeTip.id = 'ridge-tip';
    document.body.appendChild(ridgeTip);
  }

  days.forEach((dk, i) => {
    const hrs = dayHoursSet[dk] ? dayHoursSet[dk].size : 0;
    const rect = document.createElementNS(ns, 'rect');
    rect.setAttribute('x', '0');
    rect.setAttribute('y', String(i));
    rect.setAttribute('width', '100');
    rect.setAttribute('height', '1');
    rect.setAttribute('fill', 'transparent');
    rect.style.cursor = 'default';

    rect.addEventListener('mousemove', e => {
      ridgeTip.textContent = `${dk} \n ${hrs} hr${hrs !== 1 ? 's' : ''}`;
      ridgeTip.style.display = 'block';
      ridgeTip.style.left = (e.clientX + 14) + 'px';
      ridgeTip.style.top  = (e.clientY - 28) + 'px';
    });
    rect.addEventListener('mouseleave', () => { ridgeTip.style.display = 'none'; });

    svg.appendChild(rect);
  });

  frag.appendChild(svg);
  el.appendChild(frag);
}

init();