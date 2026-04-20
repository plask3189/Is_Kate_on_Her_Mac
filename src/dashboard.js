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
  let totC = 0, totK = 0, totM = 0;
  for (const d of data) { totC += d.left_clicks; totK += d.keypresses; totM += d.mouse_movements; }
  const totAll = totC + totK + totM;

  // Average active hours per day
  const dayHours = {};
  for (const d of data) {
    const dk = d._t.toISOString().slice(0, 10);
    if (!dayHours[dk]) dayHours[dk] = new Set();
    if (d.left_clicks + d.keypresses + d.mouse_movements > 0) dayHours[dk].add(d._t.getHours());
  }
  const dayKeys = Object.keys(dayHours);
  const totalActiveHours = dayKeys.reduce((sum, dk) => sum + dayHours[dk].size, 0);
  const avgHoursPerDay = dayKeys.length ? (totalActiveHours / dayKeys.length).toFixed(1) : '0';

  const spanMin = Math.max(1, Math.round((data[data.length-1]._t - data[0]._t) / 60000));
  const spanLbl = spanMin >= 60 ? (spanMin/60).toFixed(1)+'h' : spanMin+'min';

  document.getElementById('app').innerHTML = `
    <div class="hero anim">
      <div class="hero-label">Overall Average Active Hours</div>
      <div class="hero-value">${avgHoursPerDay} hrs/day</div> 
      <div class="hero-sub">
        <span class="green">${(totAll/spanMin).toFixed(0)} events/min</span>
        <span class="dim">over ${spanLbl}</span>
      </div>
    </div>

    <div class="section anim" style="animation-delay:0.24s">
      <div class="section-header"><span class="section-title">Hourly Heatmap</span></div>
      <div class="chart-card"><div class="heatmap-container"><div class="heatmap-grid" id="heatmap"></div></div></div>
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
    if (d.left_clicks + d.keypresses + d.mouse_movements > 0) {
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

  data.forEach(d => {
    const dk = d._t.toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric'});
    //console.log(dk);
    const h = d._t.getHours();
    map[dk+'|'+h] = (map[dk+'|'+h]||0) + d.left_clicks + d.keypresses + d.mouse_movements;
    daySet.add(dk);
  });

  const days = [...daySet];
  const mx = Math.max(1, ...Object.values(map));

  const frag = document.createDocumentFragment();
  frag.appendChild(document.createElement('div'));
  for (let h = 0; h < 24; h++) {
    const hd = document.createElement('div');
    hd.className = 'hm-header';
    hd.textContent = String(h).padStart(2, '0');
    frag.appendChild(hd);
  }

  days.forEach(day => {
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
        cell.style.backgroundColor = `rgba(0,200,5,${0.1+intensity*0.8})`;
        if (intensity > 0.7) cell.style.boxShadow = `0 0 6px rgba(0,200,5,${intensity*0.3})`;
      }
      frag.appendChild(cell);
    }
  });

  el.appendChild(frag);
}

init();