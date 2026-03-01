/* ============================================================
   simulator.js — Live Roulette Simulation Engine
   Bankroll tracking, Chart.js line chart, spin history log
   ============================================================ */

'use strict';

const Simulator = (() => {

  // ── State ────────────────────────────────────────────────────
  const state = {
    bankroll:      1000,
    startBankroll: 1000,
    betSize:       10,
    betType:       'red',
    pickedNumber:  7,
    payout:        1,
    winProb:       18 / 37,
    spins:         0,
    wins:          0,
    losses:        0,
    history:       [],       // full spin history
    bankrollSeries: [],      // bankroll after each spin (for chart)
    maxBankroll:   1000,
    minBankroll:   1000,
    isBankrupt:    false,
  };

  let chart = null;

  // ── European roulette red numbers ────────────────────────────
  const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

  // ── Core spin logic ──────────────────────────────────────────
  function spinOnce() {
    if (state.bankroll < state.betSize || state.isBankrupt) return null;

    const num   = Math.floor(Math.random() * 37);   // 0–36 uniform
    const color = num === 0 ? 'green' : RED_NUMBERS.has(num) ? 'red' : 'black';

    // Determine win based on bet type
    let won = false;
    if      (state.betType === 'red')    won = color === 'red';
    else if (state.betType === 'black')  won = color === 'black';
    else if (state.betType === 'number') won = num === state.pickedNumber;

    // Net profit/loss this spin
    const profit = won ? state.betSize * state.payout : -state.betSize;
    state.bankroll += profit;

    // Update aggregate counters
    state.spins++;
    won ? state.wins++ : state.losses++;
    state.maxBankroll = Math.max(state.maxBankroll, state.bankroll);
    state.minBankroll = Math.min(state.minBankroll, state.bankroll);
    if (state.bankroll <= 0) state.isBankrupt = true;

    const record = { spin: state.spins, num, color, won, profit, bankroll: state.bankroll };
    state.history.push(record);
    state.bankrollSeries.push(state.bankroll);

    return record;
  }

  // ── Batch spin (efficient, no per-spin DOM) ──────────────────
  function spin(n) {
    if (state.isBankrupt) {
      showBankruptAlert();
      return;
    }

    // Sync config from inputs before spinning
    syncConfig();

    let lastRecord = null;
    const spinCount = Math.min(n, 100000); // safety cap

    for (let i = 0; i < spinCount; i++) {
      lastRecord = spinOnce();
      if (!lastRecord || state.isBankrupt) break;
    }

    updateUI(lastRecord);
    updateChart();

    if (state.isBankrupt) showBankruptAlert();
  }

  // ── Sync config from DOM inputs ──────────────────────────────
  function syncConfig() {
    state.betType      = document.getElementById('sim-bet-type').value;
    state.betSize      = parseFloat(document.getElementById('sim-bet-size').value)  || 10;
    state.pickedNumber = parseInt(document.getElementById('sim-number').value)       || 0;

    if (state.betType === 'number') {
      state.payout  = 35;
      state.winProb = 1 / 37;
    } else {
      state.payout  = 1;
      state.winProb = 18 / 37;
    }

    // Update theoretical prob bar
    const theoPct = state.winProb * 100;
    setTextSafe('theo-prob', theoPct.toFixed(3) + '%');
    setStyleSafe('theo-bar', 'width', Math.min(theoPct, 100) + '%');
  }

  // ── Full UI refresh ──────────────────────────────────────────
  function updateUI(lastRecord) {
    const pnl     = state.bankroll - state.startBankroll;
    const winRate = state.spins > 0 ? state.wins / state.spins : 0;

    // Bankroll display
    const brEl = document.getElementById('sim-bankroll-display');
    if (brEl) {
      brEl.textContent  = Fmt.currency(state.bankroll);
      brEl.style.color  = state.bankroll >= state.startBankroll ? '#facc15' : '#ef4444';
    }

    setTextSafe('sim-pnl',
      `P&L: <span style="color:${pnl >= 0 ? '#22c55e' : '#ef4444'}">${Fmt.currency(pnl)}</span>`);

    // Session stats
    setTextSafe('stat-spins',   Fmt.int(state.spins));
    setTextSafe('stat-wins',    Fmt.int(state.wins));
    setTextSafe('stat-losses',  Fmt.int(state.losses));
    setTextSafe('stat-winrate', Fmt.percent(winRate));
    setTextSafe('stat-max',     Fmt.currency(state.maxBankroll));
    setTextSafe('stat-min',     Fmt.currency(state.minBankroll));

    // Experimental vs theoretical probability bars
    const expPct = winRate * 100;
    setTextSafe('exp-prob', expPct.toFixed(3) + '%');
    setStyleSafe('exp-bar', 'width', Math.min(expPct, 100) + '%');
    setTextSafe('prob-deviation',
      state.spins > 0 ? (expPct - state.winProb * 100).toFixed(3) + ' pp' : '—');

    // EV comparison
    const theoEV = state.spins * state.betSize * (state.winProb * state.payout - (1 - state.winProb));
    setTextSafe('theo-ev',    Fmt.currency(theoEV));
    setTextSafe('actual-pnl', Fmt.currency(pnl));

    // Last spin result pocket
    if (lastRecord) {
      const pocket = document.getElementById('spin-pocket');
      if (pocket) {
        pocket.textContent = lastRecord.num;
        pocket.className   = `roulette-pocket pocket-result pocket-${lastRecord.color}`;
      }
      setTextSafe('spin-color-label', lastRecord.color.toUpperCase());
      const outcomeEl = document.getElementById('spin-outcome-label');
      if (outcomeEl) {
        outcomeEl.innerHTML = lastRecord.won
          ? `<span style="color:var(--green)">WIN +${Fmt.currency(lastRecord.profit)}</span>`
          : `<span style="color:var(--red)">LOSE ${Fmt.currency(lastRecord.profit)}</span>`;
      }
    }

    // Spin history log (last 20, newest first)
    buildSpinLog();
  }

  // ── Spin Log Table ───────────────────────────────────────────
  function buildSpinLog() {
    const tbody  = document.getElementById('spin-log');
    if (!tbody) return;
    const recent = state.history.slice(-20).reverse();
    tbody.innerHTML = recent.map(h => `
      <tr>
        <td class="mono text-muted">${h.spin}</td>
        <td class="mono text-gold">${h.num}</td>
        <td><span style="color:${h.color === 'red' ? '#ef4444' : h.color === 'black' ? '#94a3b8' : '#22c55e'}">${h.color}</span></td>
        <td>${h.won
          ? '<span class="badge badge-green">WIN</span>'
          : '<span class="badge badge-red">LOSE</span>'}</td>
        <td class="mono">$${h.profit >= 0 ? '+' : ''}${h.profit.toFixed(2)}</td>
        <td class="mono">${Fmt.currency(h.bankroll)}</td>
      </tr>`).join('');
  }

  // ── Chart.js Bankroll Chart ──────────────────────────────────
  function initChart() {
    const canvas = document.getElementById('bankroll-chart');
    if (!canvas) return;
    const ctx      = canvas.getContext('2d');
    const defaults = getChartDefaults();

    chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [0],
        datasets: [
          {
            label:           'Actual Bankroll',
            data:            [state.startBankroll],
            borderColor:     '#facc15',
            backgroundColor: 'rgba(250,204,21,0.06)',
            borderWidth:     2,
            pointRadius:     0,
            tension:         0.1,
            fill:            true,
          },
          {
            label:       'Expected (Theoretical EV)',
            data:        [state.startBankroll],
            borderColor: '#ef4444',
            borderWidth: 1.5,
            borderDash:  [6, 4],
            pointRadius: 0,
            tension:     0,
            fill:        false,
          }
        ]
      },
      options: {
        ...defaults,
        responsive:          true,
        maintainAspectRatio: false,
        animation:           false,
        plugins:             { ...defaults.plugins },
        scales: {
          x: { ...defaults.scales.x, title: { display: true, text: 'Spin #',       color: '#64748b' } },
          y: { ...defaults.scales.y, title: { display: true, text: 'Bankroll ($)', color: '#64748b' } },
        },
      },
    });
  }

  // ── Chart Update (downsampled for large n) ───────────────────
  function updateChart() {
    if (!chart) return;

    const MAX_POINTS = 600;
    let   series     = state.bankrollSeries;
    let   labels;

    if (series.length > MAX_POINTS) {
      const step = Math.ceil(series.length / MAX_POINTS);
      series = series.filter((_, i) => i % step === 0 || i === series.length - 1);
      labels = series.map((_, i) => i * step);
    } else {
      labels = series.map((_, i) => i + 1);
    }

    // Theoretical EV trajectory aligned to downsampled labels
    const evPerBet = state.betSize *
      (state.winProb * state.payout - (1 - state.winProb));
    const expectedSeries = labels.map(s => state.startBankroll + s * evPerBet);

    chart.data.labels              = [0, ...labels];
    chart.data.datasets[0].data    = [state.startBankroll, ...series];
    chart.data.datasets[1].data    = [state.startBankroll, ...expectedSeries];
    chart.update('none');
  }

  // ── Reset ────────────────────────────────────────────────────
  function reset() {
    const startBR = parseFloat(document.getElementById('sim-bankroll-start').value) || 1000;

    Object.assign(state, {
      bankroll:       startBR,
      startBankroll:  startBR,
      betSize:        parseFloat(document.getElementById('sim-bet-size').value) || 10,
      betType:        document.getElementById('sim-bet-type').value,
      pickedNumber:   parseInt(document.getElementById('sim-number').value) || 0,
      payout:         1,
      winProb:        18 / 37,
      spins:          0,
      wins:           0,
      losses:         0,
      history:        [],
      bankrollSeries: [],
      maxBankroll:    startBR,
      minBankroll:    startBR,
      isBankrupt:     false,
    });

    // Reset UI text
    setTextSafe('sim-pnl', 'P&L: $0.00');
    const brEl = document.getElementById('sim-bankroll-display');
    if (brEl) { brEl.textContent = Fmt.currency(startBR); brEl.style.color = '#facc15'; }

    ['stat-spins','stat-wins','stat-losses'].forEach(id => setTextSafe(id, '0'));
    setTextSafe('stat-winrate', '0.000%');
    setTextSafe('exp-prob',     '0.000%');
    setTextSafe('prob-deviation', '—');
    setTextSafe('theo-ev',      '$0.00');
    setTextSafe('actual-pnl',   '$0.00');
    setTextSafe('stat-max',     '—');
    setTextSafe('stat-min',     '—');
    setStyleSafe('exp-bar', 'width', '0%');
    const tbody = document.getElementById('spin-log');
    if (tbody) tbody.innerHTML = '';

    // Reset pocket
    const pocket = document.getElementById('spin-pocket');
    if (pocket) { pocket.textContent = '—'; pocket.className = 'roulette-pocket'; pocket.style.cssText = 'background:#1e293b; border-color:#334155;'; }
    setTextSafe('spin-color-label',   '—');
    setTextSafe('spin-outcome-label', 'Awaiting spin…');

    if (chart) {
      chart.data.labels           = [0];
      chart.data.datasets[0].data = [startBR];
      chart.data.datasets[1].data = [startBR];
      chart.update();
    }

    syncConfig();
  }

  // ── Bet type toggle ──────────────────────────────────────────
  function onBetTypeChange() {
    const t = document.getElementById('sim-bet-type').value;
    const group = document.getElementById('number-pick-group');
    if (group) group.style.display = t === 'number' ? 'flex' : 'none';
    syncConfig();
  }

  // ── Bankruptcy alert ─────────────────────────────────────────
  function showBankruptAlert() {
    const card = document.getElementById('spin-result-card');
    if (card) {
      card.style.borderColor = 'var(--red)';
      card.style.boxShadow   = '0 0 20px rgba(239,68,68,0.3)';
    }
    setTextSafe('spin-outcome-label',
      '<span style="color:var(--red); font-weight:700;">BANKRUPT — Reset to continue</span>');
  }

  // ── DOM helpers ──────────────────────────────────────────────
  function setTextSafe(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  function setStyleSafe(id, prop, val) {
    const el = document.getElementById(id);
    if (el) el.style[prop] = val;
  }

  // ── Init ─────────────────────────────────────────────────────
  function init() {
    initChart();
    syncConfig();

    // Wire up bet type change
    const btEl = document.getElementById('sim-bet-type');
    if (btEl) btEl.addEventListener('change', onBetTypeChange);
  }

  // Public API (called from inline onclick attributes)
  return { init, spin, reset, onBetTypeChange };

})();

document.addEventListener('DOMContentLoaded', Simulator.init);
