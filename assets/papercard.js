/* Card "Conta de papel" — dados reais de data/paper.json (exportado pelo souza-algo). Independente da animação. */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n = v => (v === null || v === undefined || v === '' || isNaN(+v)) ? null : +v;
const nf = (v, d = 2) => n(v) === null ? '—' : (+v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const usd = (v, d = 2) => n(v) === null ? '—' : (v < 0 ? '−' : '') + 'US$ ' + nf(Math.abs(v), d);
const cls = v => n(v) === null || +v === 0 ? '' : (+v > 0 ? 'up' : 'down');
const tm = t => { if (!t) return '—'; const d = new Date(typeof t === 'number' && t < 1e12 ? t * 1000 : t); return isNaN(d) ? esc(t) : d.toLocaleString('pt-BR', { timeZone: 'America/New_York', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' ET'; };
async function load() {
  let p = null;
  try { const r = await fetch('data/paper.json?v=' + Date.now(), { cache: 'no-store' }); if (r.ok) p = await r.json(); } catch {}
  if (!p) { $('#pcBody').innerHTML = '<p class="empty">Aguardando a primeira exportação do paper trader.</p>'; $('#pcUpdated').textContent = 'sem dados'; return; }
  const a = p.account || {}, start = n(a.start_balance), eq = n(a.equity) ?? n(a.balance);
  const pnl = n(a.pnl) ?? (start !== null && eq !== null ? eq - start : null);
  const pp = n(a.pnl_pct) ?? (start ? pnl / start * 100 : null);
  const st = p.strategies || [], pos = p.positions || [], tr = (p.trades || []).slice(0, 4);
  $('#pcBody').innerHTML =
    `<div class="stats3"><div><small>Patrimônio</small><b>${usd(eq, 0)}</b></div><div><small>P&amp;L</small><b class="${cls(pnl)}">${pp === null ? '—' : (pp > 0 ? '+' : '') + nf(pp) + '%'}</b></div><div><small>Posições</small><b>${pos.length}</b></div></div>` +
    `<div class="sub-h" style="margin-top:0">Estratégias</div><div class="pc-strats">${st.map(s => `<span class="${s.enabled ? 'on' : ''}" title="${s.enabled ? 'ligada' : 'desligada'}"><i></i>${esc(s.name)}</span>`).join('') || '<span>—</span>'}</div>` +
    (pos.length ? `<div class="sub-h">Posições abertas</div><ul class="pc-list">${pos.slice(0, 3).map(x => `<li><span>${esc(x.symbol)} · ${esc(x.side || 'long')}</span><span class="${cls(x.unrealized_pnl)}">${usd(x.unrealized_pnl)}</span></li>`).join('')}</ul>` : '') +
    `<div class="sub-h">Últimas operações</div><ul class="pc-list">${tr.map(x => `<li><span>${tm(x.time)} ${esc(x.symbol)} ${esc(x.side)}</span><span class="${cls(x.pnl)}">${n(x.pnl) === null ? nf(x.price) : usd(x.pnl)}</span></li>`).join('') || '<li><span>Nenhuma operação ainda</span><span></span></li>'}</ul>`;
  const ap = p.approver;
  if (ap && ap.enabled !== undefined) {
    const ds = (ap.decisions || []).slice(0, 3);
    $('#pcBody').insertAdjacentHTML('beforeend',
      `<div class="sub-h" title="Portão real do paper trader: mesmas regras do Aprovador do pregão, só com dados disponíveis (Cético e Notícias não pontuados)">Aprovador · portão real ${ap.enabled ? `<span class="up">ligado</span> · limite ${esc(ap.threshold)}` : '<span class="down">desligado</span>'}${ap.kill_switch ? ' · <span class="down">KILL</span>' : ''} · ${ap.approved ?? 0} aprov. / ${ap.rejected ?? 0} rej.</div>` +
      `<ul class="pc-gate">${ds.map(d => `<li class="${d.decision === 'APROVADO' ? 'ok' : 'no'}"><b>${esc(d.decision)}</b> ${esc(d.strategy)} ${esc(d.symbol)} · score <b>${esc(d.score)}</b>${d.decision === 'APROVADO' && +d.size_mult < 1 ? ' · ×' + nf(d.size_mult, 1) : ''}<small>${tm(d.ts)} · ${(d.reasons || []).slice(0, 3).map(esc).join(' · ')}</small></li>`).join('') || '<li>Nenhum sinal avaliado ainda — o portão roda a cada 15 min, antes de abrir posições de papel.</li>'}</ul>`);
  }
  $('#pcUpdated').textContent = 'exportado ' + tm(p.generated_at);
  $('#pcSub').textContent = `paper trader · início US$ ${nf(start, 0)} · ${a.trades_closed ?? 0} trades`;
}
load(); setInterval(load, 5 * 60 * 1000);
})();
