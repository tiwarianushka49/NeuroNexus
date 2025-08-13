(function () {
  const charts = {};
  const sectorColors = {
    Energy: '#f59e0b',
    Finance: '#22c55e',
    Healthcare: '#ef4444',
    Transportation: '#3b82f6',
    Government: '#a855f7',
    Telecom: '#06b6d4'
  };

  const sectorEmoji = {
    Energy: '⚡',
    Finance: '💰',
    Healthcare: '🏥',
    Transportation: '🚚',
    Government: '🏛️',
    Telecom: '📡'
  };

  const sectors = Object.keys(sectorColors);

  // Sample entity data
  const entities = [
    { name: 'ADNOC', sector: 'Energy', coords: [54.3773, 24.4539], open: 14, closed: 45, uv: 3, oldestOpenDays: 42, highPrioOpen: true, openAgingDays: 35, prev24h: 22, curr24h: 48 },
    { name: 'DEWA', sector: 'Energy', coords: [55.2708, 25.2048], open: 8, closed: 61, uv: 2, oldestOpenDays: 18, highPrioOpen: false, openAgingDays: 21, prev24h: 19, curr24h: 17 },
    { name: 'ADCB', sector: 'Finance', coords: [54.3773, 24.4639], open: 11, closed: 33, uv: 4, oldestOpenDays: 58, highPrioOpen: true, openAgingDays: 49, prev24h: 14, curr24h: 33 },
    { name: 'DoH', sector: 'Healthcare', coords: [54.4073, 24.4539], open: 17, closed: 27, uv: 6, oldestOpenDays: 67, highPrioOpen: true, openAgingDays: 52, prev24h: 27, curr24h: 16 },
    { name: 'RTA', sector: 'Transportation', coords: [55.3150, 25.2712], open: 5, closed: 44, uv: 1, oldestOpenDays: 11, highPrioOpen: false, openAgingDays: 9, prev24h: 8, curr24h: 10 },
    { name: 'MOI', sector: 'Government', coords: [54.3773, 24.4039], open: 9, closed: 58, uv: 3, oldestOpenDays: 24, highPrioOpen: false, openAgingDays: 23, prev24h: 41, curr24h: 55 },
    { name: 'Etisalat', sector: 'Telecom', coords: [55.3781, 25.2667], open: 22, closed: 70, uv: 4, oldestOpenDays: 73, highPrioOpen: true, openAgingDays: 61, prev24h: 31, curr24h: 85 },
    { name: 'DU', sector: 'Telecom', coords: [55.2962, 25.2760], open: 13, closed: 36, uv: 2, oldestOpenDays: 36, highPrioOpen: false, openAgingDays: 33, prev24h: 12, curr24h: 6 },
    { name: 'FAB', sector: 'Finance', coords: [54.3773, 24.4339], open: 10, closed: 28, uv: 5, oldestOpenDays: 51, highPrioOpen: true, openAgingDays: 47, prev24h: 11, curr24h: 25 },
    { name: 'SEHA', sector: 'Healthcare', coords: [54.4073, 24.4530], open: 6, closed: 19, uv: 1, oldestOpenDays: 29, highPrioOpen: false, openAgingDays: 24, prev24h: 10, curr24h: 7 }
  ];

  // Attack origin samples (city -> entity index)
  const origins = [
    { from: [37.6173, 55.7558], toEntity: 0 },   // Moscow -> ADNOC
    { from: [51.3890, 35.6892], toEntity: 2 },   // Tehran -> ADCB
    { from: [116.4074, 39.9042], toEntity: 6 },  // Beijing -> Etisalat
    { from: [74.3587, 31.5204], toEntity: 5 },   // Lahore -> MOI
    { from: [28.9784, 41.0082], toEntity: 1 }    // Istanbul -> DEWA
  ];

  // Key violations by Sig ID (last 24h), stacked by sector
  const topSigIds = ['SIG-1001','SIG-2003','SIG-2104','SIG-3302','SIG-4409','SIG-5501','SIG-6607','SIG-7002','SIG-8304','SIG-9901'];
  const sigBySector = sectors.reduce((acc, s) => {
    acc[s] = topSigIds.map(() => Math.floor(Math.random() * 120));
    return acc;
  }, {});

  // Load and register UAE map from Natural Earth via geojson.xyz
  async function ensureUaeMapRegistered() {
    try {
      if (echarts.getMap('UAE')) return true;
      const resp = await fetch('https://geojson.xyz/naturalearth-3.3.0/ne_110m_admin_0_countries.geojson');
      const world = await resp.json();
      const feature = world.features.find(f => f.properties && (
        f.properties.ADMIN === 'United Arab Emirates' ||
        f.properties.SOVEREIGNT === 'United Arab Emirates' ||
        f.properties.ISO_A3 === 'ARE' || f.properties.SOV_A3 === 'ARE'
      ));
      if (feature) {
        const fc = { type: 'FeatureCollection', features: [feature] };
        echarts.registerMap('UAE', fc);
        return true;
      }
    } catch (err) {
      console.warn('Failed to load UAE GeoJSON; falling back to world map.', err);
    }
    return false;
  }

  function setLastUpdated() {
    const el = document.getElementById('lastUpdated');
    if (el) {
      const now = new Date();
      el.textContent = `Last updated ${now.toLocaleString()}`;
    }
  }

  function initAll() {
    setLastUpdated();
    // Initialize non-map charts immediately
    initDonutTotals();
    initStackedBySector();
    initAgingBySector();
    initTopEntitiesStacked();
    initAgingByEntity();
    initMitreSankey();
    initTopSigIdsStacked();
    initPercentChangeEntities();

    // Load UAE map then render the geo chart
    ensureUaeMapRegistered().then(() => {
      initUaeMap();
    });

    window.addEventListener('resize', () => {
      Object.values(charts).forEach((c) => c && c.resize());
    });
  }

  function mountChart(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    const chart = echarts.init(el, null, { renderer: 'canvas' });
    charts[id] = chart;
    return chart;
  }

  function totals() {
    return entities.reduce((acc, e) => {
      acc.open += e.open; acc.closed += e.closed; acc.uv += e.uv; return acc;
    }, { open: 0, closed: 0, uv: 0 });
  }

  function groupedBySector() {
    const by = {};
    sectors.forEach(s => by[s] = { open: 0, closed: 0 });
    entities.forEach(e => {
      by[e.sector].open += e.open;
      by[e.sector].closed += e.closed;
    });
    return by;
  }

  function initUaeMap() {
    const chart = mountChart('uaeMap');
    if (!chart) return;

    // Scatter data
    const scatterData = entities.map((e) => ({
      name: e.name,
      value: [...e.coords, e.open + e.closed + e.uv],
      sector: e.sector,
      high: e.highPrioOpen
    }));

    // Lines data from origins
    const lineData = origins.map((o) => ({
      coords: [o.from, entities[o.toEntity].coords],
      value: 1
    }));

    const hasUAE = !!echarts.getMap('UAE');

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: (params) => {
          if (params.seriesType === 'effectScatter') {
            const ent = entities.find(x => x.name === params.name);
            const icon = sectorEmoji[ent.sector] || '';
            return `${icon} <b>${ent.name}</b><br/>Sector: ${ent.sector}<br/>Open: ${ent.open} • Closed: ${ent.closed} • UV: ${ent.uv}<br/>Oldest open: ${ent.oldestOpenDays}d`;
          }
          if (params.seriesType === 'lines') {
            return 'Suspected attack origin';
          }
          return params.name || '';
        }
      },
      geo: {
        map: hasUAE ? 'UAE' : 'world',
        roam: true,
        ...(hasUAE ? {} : { zoom: 4.2, center: [54.4, 24.6] }),
        selectedMode: false,
        label: { show: false },
        itemStyle: {
          areaColor: '#0b1730',
          borderColor: 'rgba(255,255,255,.08)'
        },
        emphasis: { label: { show: false }, itemStyle: { areaColor: '#16213e' } }
      },
      series: [
        {
          name: 'Attack Origins',
          type: 'lines',
          coordinateSystem: 'geo',
          zlevel: 1,
          effect: { show: true, symbol: 'arrow', color: '#60a5fa', trailLength: 0.2, symbolSize: 6 },
          lineStyle: { color: '#60a5fa', width: 1, opacity: 0.6, curveness: 0.2 },
          data: lineData
        },
        {
          name: 'Entities',
          type: 'effectScatter',
          coordinateSystem: 'geo',
          zlevel: 2,
          symbolSize: (val) => Math.max(10, Math.min(22, (val[2] || 10) / 4)),
          encode: { value: 2 },
          label: {
            show: true,
            position: 'right',
            formatter: (p) => {
              const ent = entities.find(x => x.name === p.name);
              const icon = sectorEmoji[ent.sector] || '';
              return `${icon} ${p.name}`;
            },
            color: '#e5e7eb',
            fontSize: 12
          },
          itemStyle: {
            color: (p) => {
              const ent = entities.find(x => x.name === p.name);
              return ent.highPrioOpen ? '#ef4444' : (sectorColors[ent.sector] || '#93c5fd');
            },
            borderColor: '#fff',
            borderWidth: 0.8
          },
          data: scatterData
        }
      ]
    });
  }

  function initDonutTotals() {
    const chart = mountChart('donutTotals');
    if (!chart) return;
    const t = totals();
    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'item' },
      legend: { bottom: 0, textStyle: { color: '#9ca3af' } },
      series: [
        {
          type: 'pie',
          radius: ['45%', '70%'],
          avoidLabelOverlap: true,
          label: { show: true, formatter: '{b}: {c}' },
          data: [
            { name: 'Open', value: t.open, itemStyle: { color: '#ef4444' } },
            { name: 'Closed', value: t.closed, itemStyle: { color: '#22c55e' } },
            { name: 'Under Investigation', value: t.uv, itemStyle: { color: '#f59e0b' } }
          ]
        }
      ]
    });
  }

  function initStackedBySector() {
    const chart = mountChart('stackedBySector');
    if (!chart) return;
    const by = groupedBySector();
    const x = sectors;
    const open = x.map(s => by[s].open);
    const closed = x.map(s => by[s].closed);
    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      legend: { bottom: 0, textStyle: { color: '#9ca3af' } },
      grid: { top: 20, left: 40, right: 20, bottom: 40 },
      xAxis: { type: 'category', data: x, axisLabel: { color: '#9ca3af' } },
      yAxis: { type: 'value', axisLabel: { color: '#9ca3af' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,.08)' } } },
      series: [
        { name: 'Open', type: 'bar', stack: 'total', itemStyle: { color: '#ef4444' }, data: open },
        { name: 'Closed', type: 'bar', stack: 'total', itemStyle: { color: '#22c55e' }, data: closed }
      ]
    });
  }

  function initAgingBySector() {
    const chart = mountChart('agingBySector');
    if (!chart) return;
    const oldest = sectors.map(s => {
      const sectorEnts = entities.filter(e => e.sector === s);
      return sectorEnts.length ? Math.max(...sectorEnts.map(e => e.oldestOpenDays)) : 0;
    });
    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      grid: { top: 20, left: 40, right: 20, bottom: 40 },
      xAxis: { type: 'category', data: sectors, axisLabel: { color: '#9ca3af' } },
      yAxis: { type: 'value', name: 'days', axisLabel: { color: '#9ca3af' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,.08)' } } },
      series: [
        { name: 'Oldest Open (days)', type: 'line', smooth: true, symbol: 'circle', symbolSize: 8, lineStyle: { color: '#60a5fa' }, itemStyle: { color: '#60a5fa' }, data: oldest }
      ]
    });
  }

  function initTopEntitiesStacked() {
    const chart = mountChart('topEntitiesStacked');
    if (!chart) return;
    const sorted = [...entities]
      .sort((a, b) => (b.open + b.closed) - (a.open + a.closed))
      .slice(0, 10);
    const names = sorted.map(e => e.name);
    const open = sorted.map(e => e.open);
    const closed = sorted.map(e => e.closed);
    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      legend: { bottom: 0, textStyle: { color: '#9ca3af' } },
      grid: { top: 20, left: 50, right: 20, bottom: 40 },
      xAxis: { type: 'category', data: names, axisLabel: { color: '#9ca3af', interval: 0, rotate: 20 } },
      yAxis: { type: 'value', axisLabel: { color: '#9ca3af' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,.08)' } } },
      series: [
        { name: 'Open', type: 'bar', stack: 'total', itemStyle: { color: '#ef4444' }, data: open },
        { name: 'Closed', type: 'bar', stack: 'total', itemStyle: { color: '#22c55e' }, data: closed }
      ]
    });
  }

  function initAgingByEntity() {
    const chart = mountChart('agingByEntity');
    if (!chart) return;
    const sorted = [...entities]
      .sort((a, b) => b.openAgingDays - a.openAgingDays)
      .slice(0, 10);
    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      grid: { top: 20, left: 50, right: 20, bottom: 40 },
      xAxis: { type: 'category', data: sorted.map(e => e.name), axisLabel: { color: '#9ca3af', interval: 0, rotate: 20 } },
      yAxis: { type: 'value', name: 'days', axisLabel: { color: '#9ca3af' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,.08)' } } },
      series: [
        { name: 'Open Aging (days)', type: 'line', smooth: true, symbol: 'circle', symbolSize: 8, lineStyle: { color: '#f472b6' }, itemStyle: { color: '#f472b6' }, data: sorted.map(e => e.openAgingDays) }
      ]
    });
  }

  function initMitreSankey() {
    const chart = mountChart('mitreSankey');
    if (!chart) return;

    const nodes = [
      'Initial Access', 'Phishing', 'Exploit Public-Facing App',
      'Execution', 'Privilege Escalation', 'Credential Dumping',
      'Defense Evasion', 'C2', 'Exfiltration', 'Impact'
    ];
    const links = [
      { source: 'Initial Access', target: 'Phishing', value: 51 },
      { source: 'Initial Access', target: 'Exploit Public-Facing App', value: 36 },
      { source: 'Phishing', target: 'Execution', value: 44 },
      { source: 'Exploit Public-Facing App', target: 'Execution', value: 31 },
      { source: 'Execution', target: 'Privilege Escalation', value: 28 },
      { source: 'Privilege Escalation', target: 'Credential Dumping', value: 18 },
      { source: 'Execution', target: 'Defense Evasion', value: 22 },
      { source: 'Defense Evasion', target: 'C2', value: 19 },
      { source: 'C2', target: 'Exfiltration', value: 24 },
      { source: 'C2', target: 'Impact', value: 11 }
    ];

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'item' },
      series: [
        {
          type: 'sankey',
          data: nodes.map(n => ({ name: n })),
          links,
          emphasis: { focus: 'adjacency' },
          left: '2%', right: '2%', top: '2%', bottom: '10%',
          lineStyle: { color: 'gradient', curveness: 0.5 },
          itemStyle: { borderWidth: 0 },
          label: { color: '#d1d5db' }
        }
      ]
    });
  }

  function initTopSigIdsStacked() {
    const chart = mountChart('topSigIdsStacked');
    if (!chart) return;
    const x = topSigIds;
    const series = sectors.map((s) => ({
      name: s,
      type: 'bar',
      stack: 'total',
      itemStyle: { color: sectorColors[s] },
      data: sigBySector[s]
    }));
    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      legend: { bottom: 0, textStyle: { color: '#9ca3af' } },
      grid: { top: 20, left: 50, right: 20, bottom: 40 },
      xAxis: { type: 'category', data: x, axisLabel: { color: '#9ca3af', interval: 0, rotate: 30 } },
      yAxis: { type: 'value', axisLabel: { color: '#9ca3af' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,.08)' } } },
      series
    });
  }

  function initPercentChangeEntities() {
    const chart = mountChart('percentChangeEntities');
    if (!chart) return;
    const rows = entities.map(e => ({
      name: e.name,
      prev: e.prev24h,
      curr: e.curr24h,
      deltaPct: e.prev24h === 0 ? 100 : ((e.curr24h - e.prev24h) / e.prev24h) * 100
    }));
    const top = rows.sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct)).slice(0, 10);
    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', formatter: (p) => {
        const d = p[0];
        const row = top[d.dataIndex];
        return `${row.name}<br/>Prev 24h: ${row.prev}<br/>Curr 24h: ${row.curr}<br/>Δ: ${row.deltaPct.toFixed(1)}%`;
      } },
      grid: { top: 10, left: 120, right: 20, bottom: 40 },
      xAxis: { type: 'value', axisLabel: { color: '#9ca3af' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,.08)' } } },
      yAxis: { type: 'category', inverse: true, data: top.map(r => r.name), axisLabel: { color: '#9ca3af' } },
      series: [
        { name: 'Δ 24h %', type: 'bar', data: top.map(r => r.deltaPct), itemStyle: { color: (p) => p.value >= 0 ? '#34d399' : '#ef4444' } }
      ]
    });
  }

  // Kick off
  document.addEventListener('DOMContentLoaded', initAll);
})();