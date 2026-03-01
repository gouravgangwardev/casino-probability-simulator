/* ============================================================
   montecarlo.js — Monte Carlo Population Simulation
   1000+ players × N spins, histogram, sample paths, stats
   ============================================================ */

'use strict';

const MonteCarlo = (() => {

  let histChart  = null;
  let pathsChart = null;

  // ── Normal CDF (Abramowitz & Stegun) ─────────────────────────
  function normalCDF(z) {
    if (z < -8) return 0;
    if (z > 8)  return 1;
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989422820 * Math.exp(-z * z / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.8212560 + t * 1.3302745))));
    return z >= 0 ? 1 - p : p;
  }

  // ── Update theoretical prediction panel ──────────────────────
  function updateTheoreticals() {
    const nSpins   = parseInt(document.getElementById('mc-spins').value)    || 1000;
    const startBR  = parseFloat(document.getElementById('mc-bankroll').value) || 1000;
    const betSize  = parseFloat(document.getElementById('mc-bet').value)     || 10;

    const p        = 18 / 37;
    const q        = 1 - p;

    // Single-bet mean outcome (net)
    const meanSingle = p * betSize + q * (-betSize);   // = −betSize/37
    const varSingle  = p * Math.pow(betSize - meanSingle, 2) +
                       q * Math.pow(-betSize - meanSingle, 2);

    const theoMean = startBR + nSpins * meanSingle;
    const theoSD   = Math.sqrt(nSpins * varSingle);
    const theoLoss = theoMean - startBR;

    // Ruin approximation: P(final ≤ 0) via normal CDF
    const z    = (0 - theoMean) / theoSD;
    const ruin = normalCDF(z);

    setText('mc-theo-mean', Fmt.currency(theoMean));
    setText('mc-theo-sd',   Fmt.currency(theoSD));
    setText('mc-theo-loss', Fmt.currency(theoLoss));
    setText('mc-theo-ruin', Fmt.percent(ruin));
  }

  // ── Core simulation loop (efficient flat arrays) ─────────────
  function runSimulation(nPlayers, nSpins, startBR, betSize) {
    const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

    const finalBalances = new Float64Array(nPlayers);

    // Choose 20 random players for path sampling
    const NUM_SAMPLE_PATHS = 20;
    const PATH_RESOLUTION  = 200; // max points per path
    const pathStep = Math.max(1, Math.floor(nSpins / PATH_RESOLUTION));
    const pathLen  = Math.ceil(nSpins / pathStep);

    // Which player indices to record paths for
    const sampleSet = new Set();
    while (sampleSet.size < Math.min(NUM_SAMPLE_PATHS, nPlayers)) {
      sampleSet.add(Math.floor(Math.random() * nPlayers));
    }
    const sampleIdx  = [...sampleSet];
    const sampleIdxMap = new Map(sampleIdx.map((pi, i) => [pi, i]));
    const samplePaths  = sampleIdx.map(() => new Float32Array(pathLen));

    for (let p = 0; p < nPlayers; p++) {
      let br = startBR;
      const trackIdx = sampleIdxMap.has(p) ? sampleIdxMap.get(p) : -1;
      let ptIdx = 0;

      for (let s = 0; s < nSpins; s++) {
        if (br < betSize) break;   // bankrupt — stop spinning

        // Spin: uniform over {0..36}
        const n = Math.floor(Math.random() * 37);
        // Win if n is in red set (excludes 0)
        const won = n > 0 && RED.has(n);
        br += won ? betSize : -betSize;

        // Record path sample point
        if (trackIdx >= 0 && s % pathStep === 0 && ptIdx < pathLen) {
          samplePaths[trackIdx][ptIdx++] = br;
        }
      }

      finalBalances[p] = Math.max(0, br); // clamp at 0
    }

    return {
      finalBalances: Array.from(finalBalances),
      samplePaths,
      pathStep,
      pathLen,
    };
  }

  // ── Run & dispatch ────────────────────────────────────────────
  function run() {
    const btn = document.getElementById('mc-run-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Simulating…'; }

    // Short timeout so browser repaints the button state first
    setTimeout(() => {
      const nPlayers = parseInt(document.getElementById('mc-players').value)   || 1000;
      const nSpins   = parseInt(document.getElementById('mc-spins').value)     || 1000;
      const startBR  = parseFloat(document.getElementById('mc-bankroll').value) || 1000;
      const betSize  = parseFloat(document.getElementById('mc-bet').value)     || 10;

      const { finalBalances, samplePaths, pathStep, pathLen } =
        runSimulation(nPlayers, nSpins, startBR, betSize);

      computeAndDisplayStats(finalBalances, startBR, nPlayers, nSpins, betSize);
      renderHistogram(finalBalances, startBR);
      renderPaths(samplePaths, pathLen, pathStep, startBR, nSpins, betSize);
      renderInterpretation(finalBalances, startBR, nPlayers, nSpins, betSize);

      const resultsEl = document.getElementById('mc-results');
      if (resultsEl) {
        resultsEl.style.display = 'block';
        resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      if (btn) { btn.disabled = false; btn.textContent = '⚡ Run Monte Carlo Simulation'; }
    }, 30);
  }

  // ── Statistics Display ────────────────────────────────────────
  function computeAndDisplayStats(finals, startBR, nPlayers, nSpins, betSize) {
    const mean   = Stats.mean(finals);
    const median = Stats.median(finals);
    const sd     = Stats.stdDev(finals);
    const nRuined = finals.filter(b => b <= 0).length;
    const nBelow  = finals.filter(b => b < startBR).length;
    const nAbove  = finals.filter(b => b >= startBR).length;
    const maxB    = Math.max(...finals);
    const minB    = Math.min(...finals);

    setText('mc-mean',         Fmt.currency(mean));
    setText('mc-median',       Fmt.currency(median));
    setText('mc-sd',           Fmt.currency(sd));
    setText('mc-ruin',         Fmt.percent(nRuined / nPlayers));
    setText('mc-below-start',  Fmt.percent(nBelow  / nPlayers));
    setText('mc-above-start',  Fmt.percent(nAbove  / nPlayers));
    setText('mc-max',          Fmt.currency(maxB));
    setText('mc-min',          Fmt.currency(minB));

    // Color mean red/green vs start
    const meanEl = document.getElementById('mc-mean');
    if (meanEl) meanEl.className = 'stat-value ' + (mean >= startBR ? 'positive' : 'negative');
  }

  // ── Histogram ────────────────────────────────────────────────
  function renderHistogram(finals, startBR) {
    if (histChart) { histChart.destroy(); histChart = null; }

    const canvas = document.getElementById('mc-histogram');
    if (!canvas) return;

    const hist    = Stats.histogram(finals, 40);
    const ctx     = canvas.getContext('2d');
    const defaults = getChartDefaults();

    // Color each bar: green if bin center ≥ startBR, red otherwise
    const colors  = hist.labels.map(l => l >= startBR ? 'rgba(34,197,94,0.75)' : 'rgba(239,68,68,0.75)');
    const borders = hist.labels.map(l => l >= startBR ? '#22c55e'              : '#ef4444');

    histChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: hist.labels.map(l => '$' + Fmt.int(l)),
        datasets: [{
          label:           'Players',
          data:            hist.counts,
          backgroundColor: colors,
          borderColor:     borders,
          borderWidth:     1,
        }],
      },
      options: {
        ...defaults,
        responsive:          true,
        maintainAspectRatio: false,
        animation:           { duration: 600 },
        plugins: {
          ...defaults.plugins,
          tooltip: {
            ...defaults.plugins.tooltip,
            callbacks: {
              label: ctx  => `Players: ${ctx.parsed.y}`,
              title: ctx  => `Bankroll ≈ ${ctx[0].label}`,
            },
          },
        },
        scales: {
          x: { ...defaults.scales.x, title: { display: true, text: 'Final Bankroll ($)', color: '#94a3b8' } },
          y: { ...defaults.scales.y, title: { display: true, text: 'Number of Players', color: '#94a3b8' } },
        },
      },
    });
  }

  // ── Sample Path Chart ─────────────────────────────────────────
  function renderPaths(samplePaths, pathLen, pathStep, startBR, nSpins, betSize) {
    if (pathsChart) { pathsChart.destroy(); pathsChart = null; }

    const canvas = document.getElementById('mc-paths-chart');
    if (!canvas) return;

    const ctx      = canvas.getContext('2d');
    const defaults = getChartDefaults();

    // X-axis: spin numbers corresponding to each path point
    const labels = Array.from({ length: pathLen }, (_, i) => (i + 1) * pathStep);

    // Per-step mean of sample paths
    const meanPath = Array.from({ length: pathLen }, (_, i) => {
      let sum = 0;
      for (const path of samplePaths) sum += path[i] || 0;
      return sum / samplePaths.length;
    });

    // Theoretical EV trajectory (red/black, betSize)
    const evPerSpin  = betSize * (18 / 37 - 19 / 37);   // negative
    const theoPath   = labels.map(s => startBR + s * evPerSpin);

    // Individual path datasets (faint gold)
    const pathDatasets = samplePaths.map((path, idx) => ({
      label:       idx === 0 ? 'Individual player paths' : undefined,
      data:        Array.from(path),
      borderColor: 'rgba(250,204,21,0.12)',
      borderWidth: 1,
      pointRadius: 0,
      tension:     0.1,
      fill:        false,
    }));

    pathsChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          ...pathDatasets,
          {
            label:       'Mean of sample paths',
            data:        meanPath,
            borderColor: '#ef4444',
            borderWidth: 2.5,
            pointRadius: 0,
            tension:     0.2,
            fill:        false,
          },
          {
            label:       'Theoretical EV trajectory',
            data:        theoPath,
            borderColor: '#facc15',
            borderWidth: 2,
            borderDash:  [8, 4],
            pointRadius: 0,
            tension:     0,
            fill:        false,
          },
        ],
      },
      options: {
        ...defaults,
        responsive:          true,
        maintainAspectRatio: false,
        animation:           false,
        plugins: {
          ...defaults.plugins,
          legend: {
            labels: {
              color:  '#94a3b8',
              font:   { family: 'JetBrains Mono', size: 10 },
              // Hide the per-path datasets (only show mean + theo)
              filter: item => item.text !== undefined,
            },
          },
        },
        scales: {
          x: { ...defaults.scales.x, title: { display: true, text: 'Spin #',       color: '#94a3b8' } },
          y: { ...defaults.scales.y, title: { display: true, text: 'Bankroll ($)', color: '#94a3b8' } },
        },
      },
    });
  }

  // ── Interpretation Text ───────────────────────────────────────
  function renderInterpretation(finals, startBR, nPlayers, nSpins, betSize) {
    const mean    = Stats.mean(finals);
    const sd      = Stats.stdDev(finals);
    const nRuined = finals.filter(b => b <= 0).length;
    const nBelow  = finals.filter(b => b < startBR).length;
    const nAbove  = finals.filter(b => b >= startBR).length;
    const theoMean = startBR + nSpins * betSize * (18 / 37 - 19 / 37);

    const el = document.getElementById('mc-interpretation');
    if (!el) return;

    el.innerHTML = `
      <p>
        Across <strong>${Fmt.int(nPlayers)} simulated players</strong> each playing
        <strong>${Fmt.int(nSpins)} spins</strong> of $${betSize} red bets:
      </p>
      <ul style="margin:0.75rem 0 0.75rem 1.5rem; line-height:2;">
        <li>Empirical mean final bankroll:
            <strong>${Fmt.currency(mean)}</strong>
            (theoretical: <strong>${Fmt.currency(theoMean)}</strong>).
            Players lost <strong class="text-red">${Fmt.currency(mean - startBR)}</strong> on average.</li>
        <li><strong class="text-red">${Fmt.percent(nBelow / nPlayers)}</strong> of players
            ended below their starting bankroll of ${Fmt.currency(startBR)}.
            Only <strong class="text-green">${Fmt.percent(nAbove / nPlayers)}</strong> turned a net profit.</li>
        <li><strong class="text-red">${Fmt.percent(nRuined / nPlayers)}</strong> of players
            were completely bankrupt before completing all ${Fmt.int(nSpins)} spins.</li>
        <li>Standard deviation of outcomes: <strong>${Fmt.currency(sd)}</strong>.
            Individual results are highly variable — but the population mean
            converges tightly to the theoretical prediction.</li>
      </ul>
      <p>
        This illustrates the core statistical paradox of gambling:
        <em>individual outcomes are uncertain, but the casino's aggregate result
        is a near-certainty.</em> The house requires only that the Law of Large
        Numbers operate — which, by mathematical theorem, it always does.
      </p>`;
  }

  // ── DOM helper ───────────────────────────────────────────────
  function setText(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  // ── Init ─────────────────────────────────────────────────────
  function init() {
    // Wire sliders to label + theoretical update
    ['mc-players','mc-spins','mc-bankroll','mc-bet'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', () => {
        // Update slider labels
        if (id === 'mc-players') setText('mc-players-lbl', el.value + ' players');
        if (id === 'mc-spins')   setText('mc-spins-lbl',   el.value + ' spins');
        updateTheoreticals();
      });
    });

    // Run button
    const btn = document.getElementById('mc-run-btn');
    if (btn) btn.addEventListener('click', run);

    updateTheoreticals();
  }

  return { init, run };

})();

document.addEventListener('DOMContentLoaded', MonteCarlo.init);
