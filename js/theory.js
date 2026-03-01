/* ============================================================
   theory.js — Mathematical Foundation Page
   EV Calculator, Variance Explorer, Bet Taxonomy Table
   ============================================================ */

'use strict';

const Theory = (() => {

  // ── EV Calculator ────────────────────────────────────────────
  function calculateEV() {
    const bet    = parseFloat(document.getElementById('ev-bet').value)    || 0;
    const prob   = parseFloat(document.getElementById('ev-prob').value)   || 0;
    const payout = parseFloat(document.getElementById('ev-payout').value) || 0;

    if (prob < 0 || prob > 1) {
      showInputError('ev-prob', 'Probability must be between 0 and 1');
      return;
    }
    if (bet <= 0) {
      showInputError('ev-bet', 'Bet size must be greater than 0');
      return;
    }

    const winAmt  = bet * payout;           // net gain on win
    const lossAmt = bet;                    // loss on defeat
    const lossPct = 1 - prob;

    // EV = P(win)×gain − P(lose)×loss
    const ev        = prob * winAmt - lossPct * lossAmt;
    const houseEdge = -ev / bet;            // house edge as fraction of bet
    const loss100   = ev * 100;             // expected P&L over 100 bets

    // Variance calculation
    const meanOutcome = prob * winAmt + lossPct * (-lossAmt);
    const variance    = prob  * Math.pow(winAmt  - meanOutcome, 2) +
                        lossPct * Math.pow(-lossAmt - meanOutcome, 2);
    const stdDev = Math.sqrt(variance);

    // Update formula display with step-by-step derivation
    document.getElementById('ev-formula').innerHTML =
      `<span style="color:var(--text-muted); font-size:0.75rem;">EV = P(win)×(payout×bet) − P(lose)×bet</span><br/>` +
      `EV = ${prob.toFixed(4)} × $${winAmt.toFixed(2)} − ${lossPct.toFixed(4)} × $${lossAmt.toFixed(2)}<br/>` +
      `EV = $${(prob*winAmt).toFixed(4)} − $${(lossPct*lossAmt).toFixed(4)}<br/>` +
      `<strong>EV = ${Fmt.currency(ev)}</strong>`;

    // Result elements
    const evEl = document.getElementById('ev-result');
    evEl.textContent = Fmt.currency(ev);
    evEl.className   = 'result-value ' + (ev > 0.0001 ? 'positive' : ev < -0.0001 ? 'negative' : 'neutral');

    document.getElementById('ev-edge').textContent    = Fmt.percent(Math.abs(houseEdge));
    document.getElementById('ev-loss100').textContent = Fmt.currency(loss100);
    document.getElementById('ev-variance').textContent = Fmt.fixed(variance, 4);
    document.getElementById('ev-stddev').textContent   = Fmt.currency(stdDev);

    // Badge + interpretation
    const badge  = document.getElementById('ev-badge');
    const interp = document.getElementById('ev-interpretation');

    if (ev > 0.0001) {
      badge.innerHTML = '<span class="badge badge-green">Positive EV — Player Advantage</span>';
      interp.innerHTML =
        `<p>This bet has a <strong class="text-green">positive expected value</strong> of ${Fmt.currency(ev)} per bet.
        The player gains money on average. This is essentially non-existent in commercial casino games and
        would only arise from promotional offers, errors, or card-counting situations.</p>
        <p>Over 1,000 bets: expected gain = <strong class="text-green">${Fmt.currency(ev*1000)}</strong></p>`;
    } else if (ev < -0.0001) {
      badge.innerHTML = '<span class="badge badge-red">Negative EV — House Advantage</span>';
      interp.innerHTML =
        `<p>This bet has a <strong class="text-red">negative expected value</strong> of ${Fmt.currency(ev)} per bet.
        The house retains <strong>${Fmt.percent(Math.abs(houseEdge))}</strong> of all money wagered.</p>
        <p class="mt-1">Projection:</p>
        <ul style="margin:0.5rem 0 0 1.5rem; line-height:1.9;">
          <li>100 bets: <span class="text-red">${Fmt.currency(loss100)}</span></li>
          <li>1,000 bets: <span class="text-red">${Fmt.currency(ev*1000)}</span></li>
          <li>10,000 bets: <span class="text-red">${Fmt.currency(ev*10000)}</span></li>
        </ul>`;
    } else {
      badge.innerHTML = '<span class="badge badge-gold">Fair Game — Zero Edge</span>';
      interp.innerHTML =
        `<p>This bet has <strong>zero expected value</strong> — a perfectly fair game.
        Neither player nor house has a mathematical advantage. Such bets do not exist
        in commercial casinos; they exist only in theoretical probability models.</p>`;
    }
  }

  // ── Variance Explorer ────────────────────────────────────────
  function updateVariance() {
    const n   = parseInt(document.getElementById('var-n').value) || 100;
    const bet = parseFloat(document.getElementById('var-bet').value) || 10;

    document.getElementById('var-n-label').textContent = Fmt.int(n) + ' bets';

    // Red/black: p = 18/37, even-money payout
    const p   = 18 / 37;
    const q   = 1 - p;

    // Single-bet outcome distribution
    const winAmt  =  bet;   // net win
    const lossAmt = -bet;   // net loss
    const meanSingle = p * winAmt + q * lossAmt;       // EV per bet = −bet/37
    const varSingle  = p * Math.pow(winAmt  - meanSingle, 2) +
                       q * Math.pow(lossAmt - meanSingle, 2);
    const sdSingle   = Math.sqrt(varSingle);

    // Over n bets (independence → additive variance)
    const totalEV  = n * meanSingle;
    const totalSD  = Math.sqrt(n) * sdSingle;          // σ_total = √n × σ_single

    // 95% confidence interval: EV ± 1.96σ
    const lo95 = totalEV - 1.96 * totalSD;
    const hi95 = totalEV + 1.96 * totalSD;

    // Signal-to-noise ratio (how certain is the casino's profit?)
    const snr = totalSD > 0 ? Math.abs(totalEV) / totalSD : 0;

    // Probability of being ahead (P(total > 0)) via normal approx
    const zBeatHouse = (0 - totalEV) / totalSD;
    const pAhead = 1 - normalCDF(zBeatHouse);

    document.getElementById('var-ev').textContent       = Fmt.currency(totalEV);
    document.getElementById('var-sd').textContent       = Fmt.currency(totalSD);
    document.getElementById('var-range').textContent    = `${Fmt.currency(lo95)} to ${Fmt.currency(hi95)}`;
    document.getElementById('var-snr').textContent      = snr.toFixed(3);
    document.getElementById('var-pahead').textContent   = Fmt.percent(pAhead);

    // Color the P(ahead) value
    const pAheadEl = document.getElementById('var-pahead');
    pAheadEl.className = 'result-value ' + (pAhead > 0.5 ? 'positive' : pAhead < 0.3 ? 'negative' : 'neutral');

    // Variance formula display
    document.getElementById('var-formula-out').innerHTML =
      `Var(total) = ${n} × ${Fmt.fixed(varSingle, 4)} = ${Fmt.fixed(n * varSingle, 2)}<br/>` +
      `σ(total) = √${n} × ${Fmt.fixed(sdSingle, 4)} = ${Fmt.currency(totalSD)}`;
  }

  // ── Bet Taxonomy Table ───────────────────────────────────────
  function buildBetTable() {
    const bets = [
      { name: 'Straight Up',     cover: 1,  payout: 35, desc: 'Single number' },
      { name: 'Split',           cover: 2,  payout: 17, desc: 'Two adjacent numbers' },
      { name: 'Street',          cover: 3,  payout: 11, desc: 'Three-number row' },
      { name: 'Corner (Square)', cover: 4,  payout:  8, desc: 'Four-number block' },
      { name: 'Six Line',        cover: 6,  payout:  5, desc: 'Two adjacent rows' },
      { name: 'Column',          cover:12,  payout:  2, desc: 'Vertical 12-number column' },
      { name: 'Dozen',           cover:12,  payout:  2, desc: '1-12, 13-24, or 25-36' },
      { name: 'Red / Black',     cover:18,  payout:  1, desc: 'Color bet (excludes 0)' },
      { name: 'Odd / Even',      cover:18,  payout:  1, desc: 'Parity bet (excludes 0)' },
      { name: 'High / Low',      cover:18,  payout:  1, desc: '1-18 or 19-36' },
    ];

    const tbody = document.getElementById('bet-table-body');
    tbody.innerHTML = bets.map(b => {
      const p  = b.cover / 37;
      const ev = p * b.payout - (1 - p) * 1;     // EV per $1 bet
      const he = -ev;                               // house edge
      const heBar = Math.round(he * 1000);          // scaled for visual
      return `
        <tr>
          <td>
            <strong>${b.name}</strong>
            <div style="font-size:0.78rem; color:var(--text-dim); margin-top:0.15rem;">${b.desc}</div>
          </td>
          <td class="mono">${b.cover}</td>
          <td class="mono">${b.cover}/37<br/><span style="color:var(--text-muted)">${(p*100).toFixed(3)}%</span></td>
          <td class="mono text-gold">${b.payout}:1</td>
          <td class="mono ${ev < 0 ? 'text-red' : 'text-green'}">${ev.toFixed(5)}</td>
          <td>
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <div class="prob-bar" style="width:80px; flex-shrink:0;">
                <div class="prob-bar-fill bar-red" style="width:${Math.min(he*3700,100)}%"></div>
              </div>
              <span class="mono" style="font-size:0.8rem;">${(he*100).toFixed(3)}%</span>
            </div>
          </td>
        </tr>`;
    }).join('');
  }

  // ── Helpers ──────────────────────────────────────────────────
  function showInputError(id, msg) {
    const el = document.getElementById(id);
    el.style.borderColor = 'var(--red)';
    el.style.boxShadow   = '0 0 0 2px rgba(239,68,68,0.2)';
    setTimeout(() => {
      el.style.borderColor = '';
      el.style.boxShadow   = '';
    }, 2000);
    console.warn(msg);
  }

  // Standard normal CDF (Abramowitz & Stegun approximation)
  function normalCDF(z) {
    if (z < -8) return 0;
    if (z > 8)  return 1;
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989422820 * Math.exp(-z * z / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.8212560 + t * 1.3302745))));
    return z >= 0 ? 1 - p : p;
  }

  // ── Event Wiring ─────────────────────────────────────────────
  function init() {
    // EV calculator inputs
    ['ev-bet', 'ev-prob', 'ev-payout'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', calculateEV);
    });

    // Variance explorer inputs
    ['var-n', 'var-bet'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', updateVariance);
    });

    // Button
    const btn = document.getElementById('ev-calc-btn');
    if (btn) btn.addEventListener('click', calculateEV);

    // Initialize displays
    buildBetTable();
    updateVariance();
    calculateEV();
  }

  return { init, calculateEV, updateVariance, buildBetTable };

})();

// Boot when DOM is ready
document.addEventListener('DOMContentLoaded', Theory.init);
