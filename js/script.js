/* ============================================================
   Casino Probability Simulator — Shared Utilities (script.js)
   ============================================================ */

'use strict';

// ── Navigation active state ──────────────────────────────────
(function initNav() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(link => {
    const href = link.getAttribute('href');
    if (href === path || (path === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });
})();

// ── Scroll fade-in ───────────────────────────────────────────
(function initFadeIn() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
})();

// ── Core Roulette Math ───────────────────────────────────────
const Roulette = {
  TOTAL: 37,        // European roulette
  RED_COUNT: 18,
  BLACK_COUNT: 18,
  GREEN_COUNT: 1,

  // Spin: returns { number, color }
  spin() {
    const n = Math.floor(Math.random() * this.TOTAL); // 0–36
    let color;
    if (n === 0) {
      color = 'green';
    } else {
      // Standard European roulette red numbers
      const reds = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
      color = reds.has(n) ? 'red' : 'black';
    }
    return { number: n, color };
  },

  // Expected value for a single bet
  // payout = net payout multiplier (e.g. 1 for red/black, 35 for single number)
  // winProb = probability of winning
  expectedValue(betSize, payout, winProb) {
    const ev = betSize * winProb * payout - betSize * (1 - winProb);
    return ev;
  },

  // House edge for European roulette color bets
  houseEdge() { return 1 / 37; }, // ≈ 2.7%

  // Variance for a single bet (Bernoulli)
  variance(betSize, payout, winProb) {
    const ev = this.expectedValue(betSize, payout, winProb);
    const lossAmount = -betSize;
    const winAmount  = betSize * payout;
    const v = winProb * Math.pow(winAmount - ev / betSize, 2) +
              (1 - winProb) * Math.pow(lossAmount - ev / betSize, 2);
    // Proper variance = p*(W-EV)^2 + (1-p)*(L-EV)^2
    const meanOutcome = winProb * winAmount + (1 - winProb) * lossAmount;
    const variance = winProb * Math.pow(winAmount - meanOutcome, 2) +
                     (1 - winProb) * Math.pow(lossAmount - meanOutcome, 2);
    return variance;
  },

  stdDev(betSize, payout, winProb) {
    return Math.sqrt(this.variance(betSize, payout, winProb));
  }
};

// ── Statistics Utilities ─────────────────────────────────────
const Stats = {
  mean(arr) {
    return arr.reduce((s, v) => s + v, 0) / arr.length;
  },
  median(arr) {
    const s = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
  },
  stdDev(arr) {
    const m = this.mean(arr);
    const variance = arr.reduce((s, v) => s + Math.pow(v - m, 2), 0) / arr.length;
    return Math.sqrt(variance);
  },
  // Build histogram bins from array of values
  histogram(arr, bins = 30) {
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    const binSize = (max - min) / bins;
    const counts = new Array(bins).fill(0);
    const labels = [];
    for (let i = 0; i < bins; i++) {
      labels.push(Math.round(min + i * binSize));
    }
    arr.forEach(v => {
      let idx = Math.floor((v - min) / binSize);
      if (idx >= bins) idx = bins - 1;
      counts[idx]++;
    });
    return { labels, counts, min, max, binSize };
  }
};

// ── Number Formatting ────────────────────────────────────────
const Fmt = {
  currency(n) {
    const sign = n < 0 ? '-' : '';
    return sign + '$' + Math.abs(n).toFixed(2);
  },
  percent(n, decimals = 2) {
    return (n * 100).toFixed(decimals) + '%';
  },
  fixed(n, d = 4) {
    return Number(n).toFixed(d);
  },
  int(n) {
    return Math.round(n).toLocaleString();
  }
};

// ── Shared Chart.js Defaults ─────────────────────────────────
function getChartDefaults() {
  return {
    color: '#94a3b8',
    borderColor: 'rgba(250,204,21,0.2)',
    plugins: {
      legend: { labels: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 11 } } },
      tooltip: {
        backgroundColor: '#1e293b',
        borderColor: 'rgba(250,204,21,0.3)',
        borderWidth: 1,
        titleColor: '#facc15',
        bodyColor: '#e2e8f0',
        titleFont: { family: 'JetBrains Mono' },
        bodyFont:  { family: 'JetBrains Mono' }
      }
    },
    scales: {
      x: {
        ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 10 } },
        grid:  { color: 'rgba(255,255,255,0.05)' }
      },
      y: {
        ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 10 } },
        grid:  { color: 'rgba(255,255,255,0.05)' }
      }
    }
  };
}

// Expose globally
window.Roulette = Roulette;
window.Stats    = Stats;
window.Fmt      = Fmt;
window.getChartDefaults = getChartDefaults;
