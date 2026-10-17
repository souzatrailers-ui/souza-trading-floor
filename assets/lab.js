/* Laboratório — renderiza data/lab.json e data/paper.json (exportados pelo souza-algo). Sem dependências. */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = v => (v === null || v === undefined || v === '' || isNaN(+v)) ? null : +v;
const nf = (v, d = 2) => num(v) === null ? '—' : (+v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const sg = (v, d = 2) => num(v) === null ? '—' : (v > 0 ? '+' : '') + nf(v, d);
const pc = (v, d = 1) => num(v) === null ? '—' : nf(v * 100, d) + '%';
const usd = (v, d = 2) => num(v) === null ? '—' : (v < 0 ? '−' : '') + 'US$ ' + nf(Math.abs(v), d);
const px = v => num(v) === null ? '—' : (+v).toPrecision(6);
const cls = v => num(v) === null || +v === 0 ? '' : (+v > 0 ? 'up' : 'down');
const COLORS = ['#2dd4bf', '#a78bfa', '#fb923c', '#f472b6', '#4ade80', '#facc15', '#60a5fa', '#f87171'];
const TZ = 'America/New_York';
const fmtTime = t => { if (!t) return '—'; const d = new Date(t); return isNaN(d) ? esc(t) : d.toLocaleString('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' ET'; };
const stc = s => s === 'operável' ? 'op' : (s === 'observação' ? 'ob' : 'rp');

async function getJSON(u) { try { const r = await fetch(u + '?v=' + Date.now(), { cache: 'no-store' }); return r.ok ? await r.json() : null; } catch { return null; } }
function box(el) { return { w: Math.max(320, el.clientWidth || 600), h: el.clientHeight || 300 }; }
function ticks(lo, hi, n = 5) { const raw = (hi - lo) / n, p = Math.pow(10, Math.floor(Math.log10(raw || 1))), st = [1, 2, 2.5, 5, 10].map(m => m * p).find(s => s >= raw) || raw; const out = []; for (let v = Math.ceil(lo / st) * st; v <= hi + 1e-9; v += st) out.push(+v.toFixed(10)); return out; }
function tipFor(el) { let t = el.querySelector('.tip'); if (!t) { t = document.createElement('div'); t.className = 'tip'; t.hidden = true; el.appendChild(t); } return t; }
function bindTips(el) {
  const t = tipFor(el);
  el.querySelectorAll('[data-tip]').forEach(n => {
    n.addEventListener('mousemove', e => { const r = el.getBoundingClientRect(); t.innerHTML = n.dataset.tip; t.hidden = false; t.style.left = Math.min(e.clientX - r.left + 12, r.width - 220) + 'px'; t.style.top = (e.clientY - r.top - 34) + 'px'; });
    n.addEventListener('mouseleave', () => t.hidden = true);
  });
}

/* ---------- veredito + ranking ---------- */
function renderVerdict(S) {
  const nop = S.filter(s => s.status === 'operável').length, nob = S.filter(s => s.status === 'observação');
  $('#verdict').hidden = false;
  $('#verdict').innerHTML = `<b>Veredito honesto:</b> ${nop ? nop + ' estratégia(s) passaram no filtro da zona operável.' : '<b>nenhuma estratégia passou no filtro completo da zona operável.</b>'}` +
    (nob.length ? ` ${nob.map(s => esc(s.strategy)).join(' e ')} tiveram expectativa OOS positiva (${nob.map(s => sg(s.oos_expectancy, 3) + 'R').join(', ')}) mas falharam no in-sample e/ou no walk-forward — ficam em <b>observação</b>: só forward-test em papel.` : '') +
    ' Nada aqui é recomendação de investimento.';
}
const COLS = [
  ['rank', '#', s => `<td class="rank">${s.rank ?? ''}</td>`],
  ['strategy', 'Estratégia', s => `<td class="name l">${esc(s.strategy)}<br><span class="par">${esc(Object.entries(s.params || {}).map(([k, v]) => k + '=' + v).join(' '))}</span></td>`],
  ['family', 'Família', s => `<td class="l">${esc(s.family)}</td>`],
  ['tf', 'TF', s => `<td class="l">${esc(s.tf)}</td>`],
  ['oos_trades', 'Trades OOS', s => `<td>${nf(s.oos_trades, 0)}</td>`],
  ['oos_win_rate', 'Acerto', s => `<td>${pc(s.oos_win_rate)}</td>`],
  ['oos_payoff', 'Payoff', s => `<td>${nf(s.oos_payoff)}</td>`],
  ['oos_expectancy', 'Exp. (R)', s => `<td class="${cls(s.oos_expectancy)}"><b>${sg(s.oos_expectancy, 3)}</b></td>`],
  ['oos_cost_R', 'Custo (R)', s => `<td>${nf(s.oos_cost_R, 3)}</td>`],
  ['oos_total_R', 'Total R', s => `<td class="${cls(s.oos_total_R)}">${sg(s.oos_total_R, 1)}</td>`],
  ['oos_max_dd_R', 'Máx DD (R)', s => `<td class="down">${nf(s.oos_max_dd_R, 1)}</td>`],
  ['oos_sharpe', 'Sharpe', s => `<td class="${cls(s.oos_sharpe)}">${nf(s.oos_sharpe)}</td>`],
  ['is_expectancy', 'IS exp', s => `<td class="${cls(s.is_expectancy)}">${sg(s.is_expectancy, 3)}</td>`],
  ['wf_expectancy', 'WF exp', s => `<td class="${cls(s.wf_expectancy)}">${sg(s.wf_expectancy, 3)}</td>`],
  ['status', 'Status', s => `<td class="l"><span class="stt ${stc(s.status)}">${esc(s.status)}</span></td>`],
];
let sortK = 'rank', sortDir = 1;
function renderRanking(S) {
  const L = S.slice().sort((a, b) => { const x = a[sortK], y = b[sortK]; return (num(x) !== null && num(y) !== null ? x - y : String(x).localeCompare(String(y))) * sortDir; });
  $('#rankTbl').innerHTML = `<thead><tr>${COLS.map(c => `<th data-k="${c[0]}" class="${['strategy', 'family', 'tf', 'status'].includes(c[0]) ? 'l' : ''}">${c[1]}${sortK === c[0] ? (sortDir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('')}</tr></thead><tbody>` +
    L.map(s => `<tr class="${s.rank <= 3 ? 'top' : ''}">${COLS.map(c => c[2](s)).join('')}</tr>`).join('') + '</tbody>';
  $('#rankTbl').querySelectorAll('th').forEach(th => th.onclick = () => { const k = th.dataset.k; sortDir = sortK === k ? -sortDir : (k === 'rank' ? 1 : -1); sortK = k; renderRanking(S); });
  $('#rankPill').textContent = S.length;
}

/* ---------- scatter: payoff (x) × acerto (y) ---------- */
function renderScatter(S, PP) {
  const el = $('#scatter'), { w, h } = box(el), P = { l: 44, r: 12, t: 10, b: 34 }, XM = 4, YM = .8;
  const X = v => P.l + Math.min(v, XM) / XM * (w - P.l - P.r), Y = v => h - P.b - Math.min(v, YM) / YM * (h - P.t - P.b);
  let g = '';
  for (let v = 0; v <= XM; v += .5) g += `<line class="grid" x1="${X(v)}" x2="${X(v)}" y1="${P.t}" y2="${h - P.b}"/><text x="${X(v)}" y="${h - P.b + 13}" text-anchor="middle">${nf(v, 1)}</text>`;
  for (let v = 0; v <= YM + 1e-9; v += .1) g += `<line class="grid" x1="${P.l}" x2="${w - P.r}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${P.l - 6}" y="${Y(v) + 3}" text-anchor="end">${Math.round(v * 100)}%</text>`;
  let be = ''; for (let p = .05; p <= XM + 1e-9; p += .05) be += `${X(p).toFixed(1)},${Y(Math.min(YM, 1 / (1 + p))).toFixed(1)} `;
  g += `<polygon points="${X(.05)},${Y(YM)} ${be} ${X(XM)},${Y(YM)}" fill="#14532d" opacity=".35"/><polyline points="${be}" fill="none" stroke="#facc15" stroke-width="1.6" stroke-dasharray="5 4"/>`;
  g += `<text x="${X(3)}" y="${Y(.62)}" style="fill:#4ade80;font-size:11px;font-weight:700">ZONA OPERÁVEL</text>`;
  g += `<text x="${(w + P.l) / 2}" y="${h - 4}" text-anchor="middle">payoff (ganho médio ÷ perda média, R)</text>`;
  const names = S.map(s => s.strategy);
  (PP || []).forEach(p => { if ((p.oos_trades || 0) < 10 || num(p.oos_payoff) === null) return; const i = names.indexOf(p.strategy);
    g += `<circle cx="${X(p.oos_payoff)}" cy="${Y(p.oos_win_rate)}" r="2.6" fill="${COLORS[i % 8]}" opacity=".4" data-tip="${esc(p.strategy)} · ${esc(p.pair)}<br>acerto ${pc(p.oos_win_rate)} · payoff ${nf(p.oos_payoff)} · exp ${sg(p.oos_expectancy, 3)}R"/>`; });
  S.forEach((s, i) => { if (num(s.oos_payoff) === null) return; const x = X(s.oos_payoff), y = Y(s.oos_win_rate);
    g += `<circle cx="${x}" cy="${y}" r="7" fill="${COLORS[i % 8]}" stroke="#06070c" stroke-width="2" data-tip="<b>${esc(s.strategy)}</b><br>acerto ${pc(s.oos_win_rate)} · payoff ${nf(s.oos_payoff)}<br>exp ${sg(s.oos_expectancy, 3)}R · ${nf(s.oos_trades, 0)} trades"/><text x="${x + 9}" y="${y - 6}" style="fill:${COLORS[i % 8]};font-weight:700">${esc(s.strategy)}</text>`; });
  el.innerHTML = `<svg viewBox="0 0 ${w} ${h}">${g}</svg>`; bindTips(el);
}

/* ---------- curvas de capital (R acumulado) ---------- */
let eqAll = false;
function renderCurves(S, curves, split) {
  const el = $('#curves'), { w, h } = box(el), P = { l: 46, r: 12, t: 10, b: 24 };
  const SS = eqAll ? S : S.slice(0, 3);
  const ser = SS.map(s => ({ n: s.strategy, c: COLORS[S.indexOf(s) % 8], pts: (curves[s.strategy] || []).map(p => [Date.parse(p[0]), +p[1]]) })).filter(s => s.pts.length > 1);
  const all = ser.flatMap(s => s.pts); if (!all.length) { el.innerHTML = '<p class="empty">Sem curvas.</p>'; return; }
  const t0 = Math.min(...all.map(p => p[0])), t1 = Math.max(...all.map(p => p[0]));
  let v0 = Math.min(0, ...all.map(p => p[1])), v1 = Math.max(0, ...all.map(p => p[1])); const pad = (v1 - v0) * .05 || 1; v0 -= pad; v1 += pad;
  const X = t => P.l + (t - t0) / (t1 - t0 || 1) * (w - P.l - P.r), Y = v => h - P.b - (v - v0) / (v1 - v0) * (h - P.t - P.b);
  let g = '';
  ticks(v0, v1, 5).forEach(v => g += `<line class="grid" x1="${P.l}" x2="${w - P.r}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${P.l - 6}" y="${Y(v) + 3}" text-anchor="end">${nf(v, 0)}</text>`);
  for (let d = new Date(t0); d <= t1; d.setMonth(d.getMonth() + 3)) { const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1); if (t >= t0) g += `<text x="${X(t)}" y="${h - 6}" text-anchor="middle">${new Date(t).toISOString().slice(0, 7)}</text>`; }
  const sp = Date.parse(split || '2026-01-01');
  if (sp > t0 && sp < t1) g += `<rect x="${X(sp)}" y="${P.t}" width="${w - P.r - X(sp)}" height="${h - P.t - P.b}" fill="#60a5fa" opacity=".06"/><line x1="${X(sp)}" x2="${X(sp)}" y1="${P.t}" y2="${h - P.b}" stroke="#60a5fa" stroke-dasharray="4 3"/><text x="${X(sp) + 4}" y="${P.t + 11}" style="fill:#60a5fa">out-of-sample →</text>`;
  g += `<line class="ax" x1="${P.l}" x2="${w - P.r}" y1="${Y(0)}" y2="${Y(0)}"/>`;
  ser.forEach(s => g += `<polyline fill="none" stroke="${s.c}" stroke-width="1.7" stroke-linejoin="round" points="${s.pts.map(p => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ')}"/>`);
  el.innerHTML = `<svg viewBox="0 0 ${w} ${h}">${g}</svg>`;
  $('#curvesLegend').innerHTML = ser.map(s => `<span style="--c:${s.c}"><i></i>${esc(s.n)} <b class="${cls(s.pts.at(-1)[1])}">${sg(s.pts.at(-1)[1], 1)}R</b></span>`).join('');
  $('#eqBtn').textContent = eqAll ? 'só top 3' : `mostrar todas (${S.length})`;
}

/* ---------- heatmap ---------- */
function renderHeat(S, PP) {
  const pairs = [...new Set((PP || []).map(p => p.pair))];
  const col = v => { if (num(v) === null) return null; const a = Math.min(1, Math.abs(v) / .4); return v > 0 ? `rgba(52,211,153,${.12 + a * .8})` : `rgba(248,113,113,${.12 + a * .8})`; };
  $('#heat').innerHTML = `<thead><tr><th></th>${pairs.map(p => `<th>${esc(p.replace('USDT', ''))}</th>`).join('')}</tr></thead><tbody>` +
    S.map(s => `<tr><th class="row">${esc(s.strategy)}</th>${pairs.map(p => { const r = PP.find(x => x.strategy === s.strategy && x.pair === p); const v = r ? r.oos_expectancy : null, c = col(v);
      return c ? `<td style="background:${c}" title="${esc(p)}: ${r.oos_trades} trades OOS · IS ${sg(r.is_expectancy, 3)}">${sg(v, 2)}</td>` : '<td class="na">—</td>'; }).join('')}</tr>`).join('') + '</tbody>';
}

/* ---------- conta de papel ---------- */
function renderPaper(p) {
  const a = p.account || {}, start = num(a.start_balance) ?? 1000;
  $('#acctSub').textContent = `início ${usd(start, 0)} · risco 1% por trade ($1–$10)`;
  $('#acctPill').textContent = sg(a.pnl_pct) + '%'; $('#acctPill').className = 'pill ' + (a.pnl_pct < 0 ? 'bad' : '');
  $('#acctStats').innerHTML = `<div><small>Saldo realizado</small><b>${usd(a.balance)}</b></div><div><small>Patrimônio (c/ abertas)</small><b class="${cls(a.pnl)}">${usd(a.equity)}</b></div><div><small>Trades · acerto</small><b>${nf(a.trades_closed, 0)} · ${a.win_rate == null ? '—' : nf(a.win_rate, 0) + '%'}</b></div>`;
  const pts = (p.equity_curve || []).slice(); if (p.equity_last) pts.push(p.equity_last);
  const el = $('#acctCurve');
  if (pts.length > 1) {
    const { w, h } = box(el), P = { l: 46, r: 10, t: 8, b: 18 }, T = pts.map(x => Date.parse(x[0])), V = pts.map(x => +x[1]);
    const v0 = Math.min(...V, start - 5), v1 = Math.max(...V, start + 5), X = t => P.l + (t - T[0]) / (T.at(-1) - T[0] || 1) * (w - P.l - P.r), Y = v => h - P.b - (v - v0) / (v1 - v0) * (h - P.t - P.b);
    let d = ''; pts.forEach((x, i) => { const xx = X(T[i]), yy = Y(V[i]); d += (i ? `H${xx.toFixed(1)}V${yy.toFixed(1)}` : `M${xx.toFixed(1)},${yy.toFixed(1)}`); });
    el.innerHTML = `<svg viewBox="0 0 ${w} ${h}"><line class="ax" stroke-dasharray="3 3" x1="${P.l}" x2="${w - P.r}" y1="${Y(start)}" y2="${Y(start)}"/><text x="${P.l - 5}" y="${Y(start) + 3}" text-anchor="end">${nf(start, 0)}</text><text x="${P.l - 5}" y="${Y(v1) + 8}" text-anchor="end">${nf(v1, 0)}</text><text x="${P.l - 5}" y="${Y(v0)}" text-anchor="end">${nf(v0, 0)}</text><path d="${d}" fill="none" stroke="#2dd4bf" stroke-width="2"/><text x="${P.l}" y="${h - 3}">${fmtTime(pts[0][0])}</text><text x="${w - P.r}" y="${h - 3}" text-anchor="end">${fmtTime(pts.at(-1)[0])}</text></svg>`;
  } else el.innerHTML = '<p class="empty">A curva aparece após algumas execuções (a cada 15 min).</p>';

  const st = p.strategies || [];
  $('#strats').innerHTML = st.length ? st.map(s => `<div class="strat-row ${s.enabled ? 'on' : ''}"><div><b>${esc(s.name)}</b> <span class="stt ${stc(s.tier)}">${esc(s.tier || '')}</span><small>exp. móvel ${sg(s.roll_exp, 3)}R · ${esc(s.roll_n)} trades · fonte ${esc(s.source)}</small></div><span class="st">${s.enabled ? 'ON' : 'OFF'}</span><span class="sw" aria-hidden="true"></span></div>`).join('') : '<p class="empty">Paper trader ainda não rodou.</p>';

  const pos = p.positions || [];
  $('#posPill').textContent = pos.length;
  $('#posTbl').innerHTML = `<thead><tr><th class="l">Estratégia</th><th class="l">Par</th><th class="l">Lado</th><th>Entrada</th><th>Último</th><th>Stop</th><th>Alvo</th><th>Risco $</th><th>P&amp;L não real.</th><th class="l">Aberta</th><th class="l">Saída máx.</th></tr></thead><tbody>` +
    (pos.map(x => `<tr><td class="l">${esc(x.strategy)}</td><td class="name l">${esc(x.symbol)}</td><td class="l ${x.dir > 0 ? 'up' : 'down'}">${esc(x.side)}</td><td>${px(x.entry_price)}</td><td>${px(x.last_price)}</td><td>${px(x.stop)}</td><td>${px(x.target)}</td><td>${nf(x.risk_usd)}</td><td class="${cls(x.unrealized_pnl)}">${usd(x.unrealized_pnl)}</td><td class="l">${fmtTime(x.opened_at)}</td><td class="l">${fmtTime(x.max_exit_at)}</td></tr>`).join('') || '<tr><td colspan="11" class="l">Nenhuma posição aberta — aguardando sinal nos candles fechados.</td></tr>') + '</tbody>';

  const tr = p.trades || [];
  $('#trPill').textContent = p.trades_total ?? tr.length;
  $('#trTbl').innerHTML = `<thead><tr><th class="l">Saída</th><th class="l">Estratégia</th><th class="l">Par</th><th class="l">Lado</th><th>Entrada</th><th>Saída</th><th>Risco $</th><th>R</th><th>P&amp;L $</th><th>Taxas $</th><th class="l">Motivo</th><th>Patrimônio</th></tr></thead><tbody>` +
    (tr.map(x => `<tr><td class="l">${fmtTime(x.time)}</td><td class="l">${esc(x.strategy)}</td><td class="name l">${esc(x.symbol)}</td><td class="l ${x.dir > 0 ? 'up' : 'down'}">${esc(x.side)}</td><td>${px(x.entry)}</td><td>${px(x.price)}</td><td>${nf(x.risk_usd)}</td><td class="${cls(x.R)}">${sg(x.R)}</td><td class="${cls(x.pnl)}">${sg(x.pnl)}</td><td>${nf(x.fees)}</td><td class="l">${esc(x.reason)}</td><td>${nf(x.equity_after)}</td></tr>`).join('') || '<tr><td colspan="12" class="l">Nenhum trade de papel fechado ainda. Estratégias swing geram poucos sinais por semana.</td></tr>') + '</tbody>';

  const ev = p.events || [];
  $('#events').innerHTML = ev.map(e => `<li><time>${fmtTime(e.ts)}</time><b class="${/FECHOU|ABRIU/.test(e.kind) ? '' : 'up'}">${esc(e.kind)}</b><span>${esc(e.msg)}</span></li>`).join('') || '<li>Sem eventos.</li>';

  const on = st.filter(s => s.enabled).length;
  $('#kpis').innerHTML = `<div><small>Patrimônio papel</small><b class="${cls(a.pnl)}">${usd(a.equity)}</b></div><div><small>P&amp;L</small><b class="${cls(a.pnl)}">${sg(a.pnl_pct)}%</b></div><div><small>Posições</small><b>${pos.length}</b></div><div><small>Estratégias ON</small><b>${on}/${st.length}</b></div>`;
}

let LAB = null, PAPER = null;
function render() {
  if (LAB && LAB.summary) {
    const S = LAB.summary.slice().sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
    renderVerdict(S); renderRanking(S); renderScatter(S, LAB.per_pair); renderCurves(S, LAB.curves || {}, LAB.split); renderHeat(S, LAB.per_pair || []);
    $('#rankSub').textContent = `Parâmetros escolhidos só no in-sample · out-of-sample = ${LAB.split || '2026-01-01'} → hoje`;
    const cov = LAB.coverage || []; if (cov.length) $('#coverage').textContent = `Dados: Binance público (data.binance.vision) · ${new Set(cov.map(c => c.pair)).size} pares × ${new Set(cov.map(c => c.tf)).size} timeframes · ${cov.reduce((a, c) => a + (c.candles || 0), 0).toLocaleString('pt-BR')} candles · ${String(cov[0].start || '').slice(0, 10)} → ${String(cov[0].end || '').slice(0, 16)} UTC`;
  }
  if (PAPER) renderPaper(PAPER);
}
async function load() {
  [LAB, PAPER] = await Promise.all([getJSON('../data/lab.json'), getJSON('../data/paper.json')]);
  $('#emptyState').hidden = !!(LAB || PAPER);
  const g = (PAPER && PAPER.generated_at) || (LAB && LAB.generated_at);
  $('#updated').textContent = g ? 'exportado ' + fmtTime(g) : 'sem dados';
  if (PAPER && PAPER.last_run) $('#updated').title = 'Última rodada do paper trader: ' + fmtTime(PAPER.last_run);
  render();
}
$('#eqBtn').onclick = () => { eqAll = !eqAll; if (LAB) renderCurves(LAB.summary.slice().sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)), LAB.curves || {}, LAB.split); };
let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(render, 150); });
load(); setInterval(load, 5 * 60 * 1000);
})();
