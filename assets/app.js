/* Souza Trading Floor — tudo simulado (passeio aleatório). Nenhuma API, corretora ou dinheiro real. */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const nf = (v, d = 2) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const sgn = v => (v >= 0 ? '+' : '−');
const usd = (v, d = 0) => sgn(v) + 'US$ ' + nf(Math.abs(v), d);
const pctf = v => sgn(v) + nf(Math.abs(v), 2) + '%';
const cls = v => (v >= 0 ? 'up' : 'down');
const now = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const BANCA = 100000, FLOOR = 4.5, NOTIONAL = 10000, HOP = 950, PROP_TTL = 90;
const state = { halted: false, cycles: 0, props: 0, approved: 0, rejected: 0, queue: [], nextId: 1, realizedExec: 0 };

/* ---------------- mercado simulado ---------------- */
const SYMS = {
  BTC:    { p: 67250,  v: .0017,  d: 2, qd: 4, n: 'Bitcoin' },
  ETH:    { p: 3420,   v: .0020,  d: 2, qd: 3, n: 'Ethereum' },
  SOL:    { p: 162.4,  v: .0025,  d: 2, qd: 1, n: 'Solana' },
  SPY:    { p: 561.3,  v: .0006,  d: 2, qd: 0, n: 'S&P 500 ETF' },
  QQQ:    { p: 482.1,  v: .0008,  d: 2, qd: 0, n: 'Nasdaq 100 ETF' },
  NVDA:   { p: 126.8,  v: .0015,  d: 2, qd: 0, n: 'NVIDIA' },
  AAPL:   { p: 226.5,  v: .0008,  d: 2, qd: 0, n: 'Apple' },
  TSLA:   { p: 241.2,  v: .0018,  d: 2, qd: 0, n: 'Tesla' },
  EURUSD: { p: 1.0842, v: .00025, d: 4, qd: 0, n: 'Euro/Dólar' },
  XAUUSD: { p: 2412,   v: .0006,  d: 2, qd: 2, n: 'Ouro' },
};
for (const s of Object.values(SYMS)) {
  s.hist = []; let p = s.p;
  for (let i = 0; i < 90; i++) { s.hist.unshift(p); p = p / (1 + s.v * gauss()); }
  s.open = s.hist[0]; s.prev = s.p;
}
const px = sym => nf(SYMS[sym].p, SYMS[sym].d);
const chg = sym => (SYMS[sym].p / SYMS[sym].open - 1) * 100;
function stepPrices() {
  for (const s of Object.values(SYMS)) {
    s.prev = s.p;
    const revert = (s.open - s.p) / s.open * 0.004;
    s.p *= 1 + s.v * gauss() + revert;
    s.hist.push(s.p); if (s.hist.length > 90) s.hist.shift();
  }
}

/* ---------------- agentes ---------------- */
const AGENTS = [
  { id: 'noticias', pt: 'Notícias', en: 'News', sub: 'Leitor de manchetes · sentimento', color: '#2dd4bf', sym: 'NVDA',
    statuses: ['Lendo manchetes', 'Sentimento +', 'Monitorando', 'Filtrando ruído'],
    intro: 'Notícias aqui. Leio manchetes, comunicados e redes e transformo tudo em sentimento para o pregão. Pergunte sobre qualquer ativo.',
    replies: ['Nada de manchete relevante nos últimos minutos — só ruído de redes.', 'Sentimento geral levemente positivo. Tecnologia puxando.', 'Calendário cheio amanhã: CPI às 9h30. Espero volatilidade.', 'Eu só informo. Quem decide é o Cético, e quem aprova é você.'] },
  { id: 'batedor', pt: 'Batedor', en: 'Scout', sub: 'Caça grandes movimentos', color: '#a78bfa', sym: 'BTC',
    statuses: ['Escaneando', 'Movimento > 2σ', 'Varredura', 'Rastreando volume'],
    intro: 'Batedor no ar. Vasculho o mercado atrás de movimentos grandes e volume fora do normal. Quando acho algo, passo pro Gráfico.',
    replies: ['Varredura completa: 3 ativos com volume acima de 2x a média.', 'Cripto está mais nervosa que ações agora.', 'Se mexer forte, você fica sabendo primeiro — antes até do Gráfico.', 'Ainda sem rompimento limpo. Continuo de olho.'] },
  { id: 'grafico', pt: 'Gráfico', en: 'Chart', sub: 'Entrada · saída · stop', color: '#fb923c', sym: 'ETH',
    statuses: ['Marcando níveis', 'Rompimento?', 'Reteste', 'Desenhando'],
    intro: 'Gráfico aqui. Para cada ideia eu defino entrada, alvo e stop. Sem stop, sem trade.',
    replies: ['Prefiro R:R de pelo menos 1:2. Abaixo disso eu nem mando adiante.', 'Stop sempre abaixo da última mínima relevante.', 'O timeframe de 4h está mais limpo que o de 15 min agora.', 'Me diga um ativo e eu te passo os níveis.'] },
  { id: 'cetico', pt: 'Cético', en: 'Skeptic', sub: 'Veredito: comprar / esperar / pular', color: '#facc15', sym: 'SPY',
    statuses: ['Duvidando', 'ESPERAR', 'Revisando tese', 'PULAR'],
    intro: 'Sou o Cético. Toda ideia passa por mim e sai com um veredito: COMPRAR, ESPERAR ou PULAR. Meu trabalho é tentar derrubar a tese.',
    replies: ['Minha pergunta é sempre: o que já está no preço?', 'Hoje estou mais para ESPERAR do que para COMPRAR.', 'Se a tese não sobrevive a três objeções, eu pulo.', 'Volume sem notícia me deixa desconfiado.'] },
  { id: 'risco', pt: 'Risco', en: 'Risk desk', sub: 'CRO · kill 4,5%', color: '#f472b6', sym: 'QQQ',
    statuses: ['Vigiando', 'Piso intacto', 'Checando correlação', 'Exposição OK'],
    intro: 'Mesa de risco. Eu filtro cada trade contra o piso de 4,5% — pergunte qualquer coisa sobre como dimensionamos ou protegemos a banca.',
    replies: ['Regra simples: se a perda do dia chegar a 4,5%, o kill switch desliga tudo.', 'Nenhum trade arrisca mais de 1,2% da banca.', 'BTC e ETH andam juntos — conto os dois como uma exposição só.', 'Proteger a banca vem antes de qualquer lucro.'] },
  { id: 'dimensionador', pt: 'Dimensionador', en: 'Sizer', sub: 'Tamanho de posição', color: '#4ade80', sym: 'SOL',
    statuses: ['Calculando', 'Ajustando vol', 'Pronto', 'Recalibrando'],
    intro: 'Dimensionador aqui. Transformo o stop do Gráfico e o limite do Risco em um tamanho de posição exato.',
    replies: ['Tamanho = risco em US$ ÷ distância até o stop.', 'Volatilidade subiu, então corto o tamanho em ~20%.', 'Risco por trade entre 0,5% e 1,2% da banca.', 'Posição pequena demais não paga a taxa; grande demais quebra o piso.'] },
  { id: 'executor', pt: 'Executor', en: 'Executor', sub: 'Só executa após aprovação do dono', color: '#60a5fa', sym: 'TSLA', exec: true,
    statuses: ['Aguardando aprovação', 'Em espera', 'Modo papel'],
    intro: 'Executor. Eu nunca envio uma ordem sem a sua aprovação. Tudo aqui é modo papel — nenhuma corretora conectada.',
    replies: ['Sem aprovação, sem ordem. Essa regra não muda.', 'Estou em modo papel: execuções são simuladas.', 'Aprove ou rejeite as propostas na fila à direita.', 'Posso zerar tudo se o Risco acionar o kill switch.'] },
];
const BYID = Object.fromEntries(AGENTS.map(a => [a.id, a]));
for (const a of AGENTS) {
  a.status = a.statuses[0]; a.log = []; a.positions = [];
  if (!a.exec) { a.entry = SYMS[a.sym].p * (1 + rand(-0.012, 0.010)); a.qty = NOTIONAL / a.entry; }
}
function pnlOf(a) {
  if (!a.exec) return (SYMS[a.sym].p - a.entry) * a.qty;
  return state.realizedExec + a.positions.reduce((t, p) => t + (SYMS[p.sym].p - p.entry) * p.qty, 0);
}
const pnlPct = a => pnlOf(a) / NOTIONAL * 100;

/* ---------------- layout do pregão (coords do palco 1280×910) ---------------- */
const POS = { noticias: [170, 520], batedor: [480, 520], grafico: [800, 520], cetico: [1110, 520], risco: [955, 810], dimensionador: [640, 810], executor: [325, 810] };
const CHAIN = ['noticias', 'batedor', 'grafico', 'cetico', 'risco', 'dimensionador', 'executor'];
const avaXY = id => [POS[id][0], POS[id][1] + 25];

const stage = $('#stage');
function buildFloor() {
  // grade isométrica
  const W = 1280, H = 910; let g = '';
  for (let c = -2 * H; c < W + 2 * H; c += 64) {
    g += `<line x1="${c}" y1="0" x2="${c + 2 * H}" y2="${H}"/><line x1="${c}" y1="${H}" x2="${c + 2 * H}" y2="0"/>`;
  }
  $('#floorGrid').innerHTML = `<g stroke="#7c8cff" stroke-opacity=".09" stroke-width="1">${g}</g>`;
  // ligações da cadeia
  let l = '';
  for (let i = 0; i < CHAIN.length - 1; i++) {
    const [x1, y1] = avaXY(CHAIN[i]), [x2, y2] = avaXY(CHAIN[i + 1]);
    l += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${BYID[CHAIN[i]].color}" stroke-opacity=".35" stroke-width="2"/>`;
  }
  $('#links').innerHTML = l;
  // decoração: plantas e postes
  const plant = (x, y) => `<svg class="decor" style="left:${x - 16}px;top:${y - 44}px" width="32" height="50" viewBox="0 0 32 50"><polygon points="16,0 28,30 4,30" fill="#16a34a"/><polygon points="16,8 26,34 6,34" fill="#22c55e" opacity=".8"/><polygon points="6,34 26,34 23,46 9,46" fill="#7c4a2a"/><ellipse cx="16" cy="47" rx="11" ry="3" fill="#000" opacity=".5"/></svg>`;
  const lamp = (x, y) => `<svg class="decor" style="left:${x - 8}px;top:${y - 56}px" width="16" height="60" viewBox="0 0 16 60"><rect x="7" y="8" width="2" height="48" fill="#3a3f55"/><rect x="3" y="2" width="10" height="9" rx="2" fill="#facc15"/><circle cx="8" cy="6" r="9" fill="#facc15" opacity=".18"/><ellipse cx="8" cy="57" rx="6" ry="2" fill="#000" opacity=".5"/></svg>`;
  $('#decor').innerHTML = plant(40, 330) + plant(1240, 330) + plant(48, 880) + plant(1232, 880) + lamp(325, 400) + lamp(955, 400) + lamp(640, 640) + lamp(1220, 700) + lamp(60, 700);
  // mesas
  $('#pods').innerHTML = AGENTS.map(podHTML).join('');
  for (const a of AGENTS) {
    const el = $(`#pod-${a.id}`); a.el = el;
    a.ui = { st: $('.st', el), px: $('.px', el), chg: $('.chg', el), pnl: $('.pnl', el), pnlp: $('.pnlp', el), pn: $('.pn', el), chip: $('.chip', el), spark: $('.spark', el), bubble: $('.bubble', el) };
    el.addEventListener('click', () => openDrawer(a));
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDrawer(a); } });
  }
  // legenda e chips mobile
  $('#legend').innerHTML = AGENTS.map(a => `<span data-id="${a.id}" style="--c:${a.color}"><i></i>${a.pt} <small>${a.en}</small></span>`).join('');
  $('#agentChips').innerHTML = AGENTS.map(a => `<button data-id="${a.id}"><span class="bot xs" style="--c:${a.color}"></span>${a.pt}</button>`).join('');
  for (const el of document.querySelectorAll('#legend [data-id], #agentChips [data-id]')) el.addEventListener('click', () => openDrawer(BYID[el.dataset.id]));
}
function podHTML(a) {
  const c = a.color, [x, y] = POS[a.id];
  const posts = [];
  for (let i = 0; i <= 4; i++) {
    const t = i / 4;
    const x1 = 20 + 120 * t, y1 = 92 - 60 * t; posts.push([x1, y1]);
    const x2 = 140 + 120 * t, y2 = 32 + 60 * t; if (i) posts.push([x2, y2]);
  }
  const postSvg = posts.map(([px, py]) => `<line x1="${px}" y1="${py}" x2="${px}" y2="${py - 13}"/>`).join('');
  return `<div class="pod" id="pod-${a.id}" tabindex="0" role="button" aria-label="Abrir chat com ${a.pt} (${a.en})" style="--c:${c};left:${x - 140}px;top:${y - 92}px">
  <svg class="platform" viewBox="0 0 280 170" width="280" height="170">
    <polygon points="20,92 140,152 140,164 20,104" fill="${c}" opacity=".38"/>
    <polygon points="140,152 260,92 260,104 140,164" fill="${c}" opacity=".2"/>
    <polygon points="140,32 260,92 140,152 20,92" fill="${c}" fill-opacity=".13" stroke="${c}" stroke-opacity=".9" stroke-width="1.6"/>
    <polygon points="140,46 232,92 140,138 48,92" fill="none" stroke="${c}" stroke-opacity=".22" stroke-dasharray="3 5"/>
    <g stroke="${c}" stroke-opacity=".55" stroke-width="2">${postSvg}</g>
    <polyline points="20,79 140,19 260,79" fill="none" stroke="${c}" stroke-opacity=".6" stroke-width="2.4"/>
    <polygon points="94,72 140,95 140,111 94,88" fill="#151826"/>
    <polygon points="140,95 186,72 186,88 140,111" fill="#0f121c"/>
    <polygon points="94,72 140,49 186,72 140,95" fill="#2a3044" stroke="#3a4260" stroke-width=".8"/>
    <polygon points="102,68 134,52 134,24 102,40" fill="#0a0c14" stroke="#3a4260"/>
    <polygon points="105,64 131,51 131,27 105,40" fill="${c}" fill-opacity=".7"/>
    <polyline points="107,56 113,50 118,53 123,44 129,38" fill="none" stroke="#fff" stroke-width="1.4" stroke-opacity=".9"/>
    <polygon points="146,52 178,68 178,40 146,24" fill="#0a0c14" stroke="#3a4260"/>
    <polygon points="149,51 175,64 175,40 149,27" fill="${c}" fill-opacity=".45"/>
    <g stroke="#fff" stroke-opacity=".6" stroke-width="1.2"><line x1="152" y1="34" x2="171" y2="44"/><line x1="152" y1="40" x2="166" y2="47"/><line x1="152" y1="46" x2="169" y2="55"/></g>
    <ellipse cx="140" cy="136" rx="17" ry="5" fill="#000" opacity=".5"/>
  </svg>
  <div class="ava"><span class="bot" style="--c:${c}"></span></div>
  <div class="plate">${a.pt}</div>
  <div class="panel">
    <div class="bubble"></div>
    <div class="ph"><span class="dot"></span><b>${a.pt}</b><em>${a.en}</em><span class="st">${a.status}</span></div>
    <div class="pr"><span class="chip">${a.sym}</span><span class="px">—</span><span class="chg">—</span></div>
    <canvas class="spark" width="400" height="68"></canvas>
    <div class="pf"><span>P&amp;L</span><b class="pnl">—</b><span class="pnlp">—</span></div>
    <div class="pn">${esc(a.sub)}</div>
  </div>
</div>`;
}
function drawSpark(cv, hist, color) {
  const ctx = cv.getContext('2d'), w = cv.width, h = cv.height;
  ctx.clearRect(0, 0, w, h);
  const data = hist.slice(-60), mn = Math.min(...data), mx = Math.max(...data), rg = mx - mn || 1;
  const X = i => i / (data.length - 1) * (w - 4) + 2, Y = v => h - 4 - (v - mn) / rg * (h - 8);
  const grd = ctx.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, color + '55'); grd.addColorStop(1, color + '00');
  ctx.beginPath(); data.forEach((v, i) => i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v)));
  ctx.lineTo(w - 2, h); ctx.lineTo(2, h); ctx.closePath(); ctx.fillStyle = grd; ctx.fill();
  ctx.beginPath(); data.forEach((v, i) => i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v)));
  ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.beginPath(); ctx.arc(X(data.length - 1), Y(data[data.length - 1]), 4.5, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
}

/* ---------------- ticker ---------------- */
function buildTicker() {
  const one = Object.keys(SYMS).map(k => `<span class="tk" data-sym="${k}"><b>${k}</b><span class="v">${px(k)}</span><span class="c">—</span></span>`).join('');
  $('#tickerTrack').innerHTML = one + one;
}
function updateTicker() {
  for (const el of document.querySelectorAll('.tk')) {
    const k = el.dataset.sym, s = SYMS[k], v = el.children[1], c = el.children[2], ch = chg(k);
    v.textContent = px(k);
    v.className = 'v ' + (s.p >= s.prev ? 'flash-up' : 'flash-down');
    c.textContent = (ch >= 0 ? '▲ ' : '▼ ') + nf(Math.abs(ch), 2) + '%'; c.className = 'c ' + cls(ch);
  }
}

/* ---------------- ranking ---------------- */
function buildLeaderboard() {
  $('#lbRows').innerHTML = AGENTS.map(a => `<div class="lb-row" id="lb-${a.id}" style="--c:${a.color}"><span class="rk">#</span><span class="bot xs" style="--c:${a.color}"></span><span class="nm">${a.pt}<em>${a.en}</em></span><span class="sy">${a.sym}</span><span class="bar"><i></i></span><span class="pv">—</span></div>`).join('');
  for (const a of AGENTS) $(`#lb-${a.id}`).addEventListener('click', () => openDrawer(a));
}
function updateLeaderboard() {
  const ranked = [...AGENTS].sort((x, y) => pnlOf(y) - pnlOf(x));
  const maxAbs = Math.max(1, ...AGENTS.map(a => Math.abs(pnlPct(a))));
  ranked.forEach((a, i) => {
    const r = $(`#lb-${a.id}`), p = pnlPct(a);
    r.style.top = i * 24 + 'px'; r.className = 'lb-row' + (i === 0 ? ' r1' : '');
    r.children[0].textContent = i === 0 ? '★1' : '#' + (i + 1);
    r.children[3].textContent = a.exec ? (a.positions.length ? a.positions[a.positions.length - 1].sym : '—') : a.sym;
    const bar = r.children[4].firstChild, wpct = Math.abs(p) / maxAbs * 50;
    bar.style.width = wpct + '%'; bar.style.left = p >= 0 ? '50%' : (50 - wpct) + '%'; bar.style.background = p >= 0 ? 'var(--up)' : 'var(--down)';
    r.children[5].textContent = pctf(p); r.children[5].className = 'pv ' + cls(p);
  });
  const tot = AGENTS.reduce((t, a) => t + pnlOf(a), 0), totPct = tot / (NOTIONAL * AGENTS.length) * 100;
  const T = $('#lbTotal'); T.textContent = pctf(totPct); T.className = cls(totPct);
  $('#lbTotalUsd').textContent = usd(tot) + ' · floor';
}

/* ---------------- risco ---------------- */
function riskSnapshot() {
  const day = AGENTS.reduce((t, a) => t + pnlOf(a), 0);
  const dd = Math.min(0, day) / BANCA * 100;
  const openRisk = BYID.executor.positions.reduce((t, p) => t + p.riskPct, 0);
  return { day, dd, openRisk, used: Math.min(100, (Math.abs(dd) + openRisk) / FLOOR * 100) };
}
function updateRisk() {
  const r = riskSnapshot();
  $('#riskFill').style.width = r.used + '%';
  const dv = $('#ddVal'); dv.textContent = (r.dd < 0 ? '−' : '') + nf(Math.abs(r.dd), 2) + '%'; dv.className = r.dd < 0 ? 'down' : '';
  $('#openRiskVal').textContent = nf(r.openRisk, 2) + '%';
  $('#bancaVal').textContent = 'US$ ' + nf(BANCA + r.day, 0);
  const pill = $('#riskPill');
  if (state.halted) { pill.textContent = 'KILL'; pill.className = 'pill bad'; }
  else if (r.used > 70) { pill.textContent = 'ATENÇÃO'; pill.className = 'pill warn'; }
  else { pill.textContent = 'OK'; pill.className = 'pill'; }
  if (!state.halted && Math.abs(r.dd) >= FLOOR) killSwitch(true);
}

/* ---------------- mesas: atualização ---------------- */
function updatePods() {
  for (const a of AGENTS) {
    const sym = a.exec ? (a.positions.length ? a.positions[a.positions.length - 1].sym : a.sym) : a.sym;
    const ch = chg(sym), p = pnlOf(a), pp = pnlPct(a);
    a.ui.chip.textContent = sym;
    a.ui.px.textContent = px(sym);
    a.ui.chg.textContent = pctf(ch); a.ui.chg.className = 'chg ' + cls(ch);
    a.ui.pnl.textContent = usd(p); a.ui.pnl.className = 'pnl ' + cls(p);
    a.ui.pnlp.textContent = pctf(pp); a.ui.pnlp.className = 'pnlp ' + cls(pp);
    a.ui.st.textContent = state.halted ? 'Pausado' : a.status;
    a.ui.st.className = 'st ' + (state.halted ? 'bad' : /PULAR|BLOQ/.test(a.status) ? 'bad' : /ESPERAR|Aguard|σ|Rompimento/.test(a.status) ? 'warn' : /OK|Pronto|intacto|executad/i.test(a.status) ? 'good' : '');
    drawSpark(a.ui.spark, SYMS[sym].hist, a.color);
    a.el.classList.toggle('halted', state.halted);
  }
}

/* ---------------- notas, bolhas, feed ---------------- */
function addNote(a, text, opts = {}) {
  const item = { from: 'note', text, t: now() };
  a.log.push(item); if (a.log.length > 60) a.log.shift();
  a.ui.pn.textContent = text;
  if (opts.status) a.status = opts.status;
  if (!opts.quiet) bubble(a, text);
  const li = document.createElement('li');
  li.style.setProperty('--c', a.color);
  li.innerHTML = `<span class="bot" style="--c:${a.color}"></span><div><b>${a.pt}</b><time>${item.t}</time><div>${esc(text)}</div></div>`;
  li.addEventListener('click', () => openDrawer(a));
  const feed = $('#feed'); feed.prepend(li); while (feed.children.length > 40) feed.lastChild.remove();
  if (drawerAgent === a) appendMsg(item, a);
}
function bubble(a, text) {
  const b = a.ui.bubble; b.textContent = text.length > 90 ? text.slice(0, 88) + '…' : text;
  b.classList.add('show'); a.el.classList.add('speaking');
  clearTimeout(a._bt); a._bt = setTimeout(() => { b.classList.remove('show'); a.el.classList.remove('speaking'); }, 3200);
}

const HEADLINES = [
  s => `${s}: fluxo comprador acima da média hoje — sentimento positivo`,
  s => `${s}: rumor de parceria circulando nas redes, ainda não confirmado`,
  s => `Fed: ata sugere cautela; ${s} reage ${pctf(chg(s))}`,
  s => `${s}: menções nas redes +${Math.round(rand(20, 160))}% na última hora`,
  s => `Calendário: CPI amanhã às 9h30 — esperar volatilidade em ${s}`,
  s => `${s}: analistas revisam preço-alvo para cima`,
];
function ambient() {
  if (state.halted) return;
  const a = pick(AGENTS), s = pick(Object.keys(SYMS)), r = riskSnapshot();
  const T = {
    noticias: () => pick(HEADLINES)(s),
    batedor: () => pick([`${s} ${pctf(chg(s))} na sessão · volume ${nf(rand(1.2, 3.4), 1)}x a média`, `Varredura: ${Math.round(rand(40, 120))} ativos, ${Math.round(rand(1, 5))} com movimento > 2σ`, `Nada grande em ${s} agora. Continuo de olho.`]),
    grafico: () => { const p = SYMS[s].p; return pick([`${s}: suporte em ${nf(p * 0.985, SYMS[s].d)}, resistência em ${nf(p * 1.012, SYMS[s].d)}`, `${s}: rompimento do topo de 4h — aguardando reteste`, `${s}: médias de 20 e 50 cruzando para cima`]); },
    cetico: () => pick([`${s}: ESPERAR — volume não confirma o movimento`, `${s}: PULAR — notícia já está no preço`, `${s}: tese sobreviveu a 3 objeções. Se vier setup, COMPRAR.`]),
    risco: () => pick([`Drawdown do dia ${nf(r.dd, 2)}% · piso −4,5% intacto`, `Correlação alta entre BTC e ETH — exposição conjunta limitada`, `Risco aberto ${nf(r.openRisk, 2)}% da banca · OK`]),
    dimensionador: () => pick([`Risco por trade calibrado entre 0,5% e 1,2% da banca`, `Volatilidade de ${s} subiu — reduzindo tamanho em 20%`, `${s}: 1% de risco = US$ ${nf(BANCA * 0.01, 0)} até o stop`]),
    executor: () => pick([`Fila: ${state.queue.length} proposta(s) aguardando você`, `Nenhuma ordem sem aprovação do dono. Modo papel ativo.`, `Posições em papel abertas: ${BYID.executor.positions.length}`]),
  };
  addNote(a, T[a.id](), { status: Math.random() < 0.5 ? pick(a.statuses) : undefined });
}

/* ---------------- ciclo do fluxo ---------------- */
const STAGES = [
  { pt: 'Dados', en: 'Data feed', c: '#2dd4bf', ico: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>' },
  { pt: 'Analista', en: 'Analyst', c: '#a78bfa', ico: '<path d="M4 20V11M10 20V5M16 20v-7M21 20H3"/>' },
  { pt: 'Notícias', en: 'News', c: '#fb923c', ico: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h10M7 16h6"/>' },
  { pt: 'Raciocínio', en: 'Reasoning', c: '#f472b6', ico: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/>' },
  { pt: 'Relatório', en: 'Report', c: '#facc15', ico: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>' },
  { pt: 'Alerta', en: 'Alert', c: '#4ade80', ico: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0"/>' },
  { pt: 'Painel', en: 'Dashboard', c: '#60a5fa', ico: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>' },
];
function buildFlow() {
  $('#flow').innerHTML = STAGES.map((s, i) => `<div class="fstage" data-i="${i}" style="--c:${s.c}"><span class="fcount">0</span><div class="fi"><svg viewBox="0 0 24 24">${s.ico}</svg></div><b>${s.pt}</b><small>${s.en}</small><p class="fl">aguardando…</p></div>`).join('');
  STAGES.forEach((s, i) => { s.el = $(`.fstage[data-i="${i}"]`); s.n = 0; });
}
function flowLog(cid, i, text, color) {
  const li = document.createElement('li'); li.style.setProperty('--c', color || STAGES[i].c);
  li.innerHTML = `<time>${now()}</time><span class="cid">#${String(cid).padStart(3, '0')}</span><span class="stg">${STAGES[i].pt}</span><span>${esc(text)}</span>`;
  const ol = $('#flowLog'); ol.prepend(li); while (ol.children.length > 60) ol.lastChild.remove();
}
function chipXY(i) { const el = STAGES[i].el; return [el.offsetLeft + el.offsetWidth / 2, el.offsetTop]; }

const SYM_POOL = ['BTC', 'ETH', 'SOL', 'NVDA', 'SPY', 'TSLA', 'AAPL', 'QQQ', 'XAUUSD', 'EURUSD'];
function runCycle() {
  if (state.halted) return;
  const cid = ++state.cycles; $('#stCycles').textContent = state.cycles;
  const sym = pick(SYM_POOL), S = SYMS[sym], price = S.p;
  const atr = price * rand(0.006, 0.014), entry = price, stop = price - atr, target = price + atr * rand(1.9, 2.6);
  const rr = (target - entry) / (entry - stop);
  const roll = Math.random(), verdict = roll < 0.58 ? 'COMPRAR' : roll < 0.82 ? 'ESPERAR' : 'PULAR';
  const riskPct = +rand(0.5, 1.2).toFixed(2), r = riskSnapshot();
  const riskOK = Math.abs(r.dd) + r.openRisk + riskPct < FLOOR;
  const riskUsd = BANCA * riskPct / 100, qty = riskUsd / (entry - stop);
  const rsi = Math.round(rand(38, 72)), head = pick(HEADLINES)(sym);
  const reason = verdict === 'COMPRAR' ? 'tese sobreviveu às objeções' : verdict === 'ESPERAR' ? 'volume ainda não confirma' : 'movimento já precificado';
  const id = state.nextId++;
  const prop = { id, cid, sym, entry, stop, target, rr, qty, riskPct, riskUsd, verdict };

  // passos: cadeia do pregão (agente) e fluxo (estágio) em paralelo
  const steps = [
    { a: 'noticias', note: `Manchete: ${head}`, f: `${sym} ${px(sym)} · Δ ${pctf(chg(sym))} · tick recebido` },
    { a: 'batedor', note: `${sym} chamou atenção: ${pctf(chg(sym))} na sessão, volume ${nf(rand(1.5, 3.8), 1)}x a média. Passando pro Gráfico.`, f: `RSI ${rsi} · volume ${nf(rand(1.5, 3.8), 1)}x · tendência ${chg(sym) >= 0 ? 'de alta' : 'lateral'}`, st: 'Movimento > 2σ' },
    { a: 'grafico', note: `${sym}: entrada ${nf(entry, S.d)} · stop ${nf(stop, S.d)} · alvo ${nf(target, S.d)} (R:R 1:${nf(rr, 1)})`, f: head.length > 70 ? head.slice(0, 68) + '…' : head, st: 'Marcando níveis' },
    { a: 'cetico', note: `Veredito ${sym}: ${verdict} — ${reason}.`, f: `Cético: ${verdict} · Risco: ${riskOK ? 'dentro do piso' : 'BLOQUEADO'}`, st: verdict, stopHere: verdict !== 'COMPRAR', kind: verdict === 'ESPERAR' ? 'wait' : 'dead' },
    { a: 'risco', note: riskOK ? `OK ${sym}: risco ${nf(riskPct, 2)}% · drawdown ${nf(r.dd, 2)}% · piso −4,5% preservado.` : `BLOQUEADO ${sym}: somaria ${nf(Math.abs(r.dd) + r.openRisk + riskPct, 2)}% — acima do piso de 4,5%.`, f: `Tese ${sym}: entrada ${nf(entry, S.d)} / stop ${nf(stop, S.d)} / alvo ${nf(target, S.d)}`, st: riskOK ? 'Piso intacto' : 'BLOQUEADO', stopHere: !riskOK, kind: 'dead' },
    { a: 'dimensionador', note: `${sym}: tamanho ${nf(qty, S.qd)} un. (≈ US$ ${nf(qty * entry, 0)}) · risco US$ ${nf(riskUsd, 0)}. Enviado para aprovação.`, f: `Proposta #${String(id).padStart(3, '0')} → fila de aprovação`, st: 'Pronto', enqueue: true },
    { a: 'executor', note: `Proposta #${String(id).padStart(3, '0')} (${sym}) na fila. Aguardando aprovação do dono.`, f: `Painel atualizado · ${state.queue.length + 1} na fila`, st: 'Aguardando aprovação' },
  ];

  // pacote no pregão
  const pk = document.createElement('div'); pk.className = 'packet';
  pk.style.setProperty('--c', BYID.noticias.color);
  const [sx, sy] = avaXY('noticias'); pk.style.left = sx + 'px'; pk.style.top = sy + 'px';
  $('#packets').appendChild(pk);
  // chip no fluxo
  const chip = document.createElement('div'); chip.className = 'fchip'; chip.textContent = `${sym} #${String(cid).padStart(3, '0')}`;
  chip.style.setProperty('--c', STAGES[0].c);
  const [cx, cy] = chipXY(0); chip.style.left = cx + 'px'; chip.style.top = cy + 'px';
  $('#flow').appendChild(chip);

  let i = 0;
  const go = () => {
    if (state.halted) { pk.remove(); chip.remove(); return; }
    const st = steps[i], a = BYID[st.a], stg = STAGES[i];
    addNote(a, st.note, { status: st.st });
    stg.el.classList.add('active'); setTimeout(() => stg.el.classList.remove('active'), 800);
    stg.n++; stg.el.querySelector('.fcount').textContent = stg.n;
    let ftxt = st.f;
    if (st.stopHere) ftxt = `${sym}: ${st.st === 'BLOQUEADO' ? 'bloqueado pelo Risco' : 'Cético decidiu ' + verdict} · ciclo encerrado`;
    stg.el.querySelector('.fl').textContent = ftxt;
    flowLog(cid, i, ftxt, st.stopHere ? '#f87171' : null);
    if (st.enqueue) enqueue(prop);
    if (st.stopHere || i === steps.length - 1) {
      pk.classList.add(st.stopHere ? (st.kind || 'dead') : 'done');
      chip.classList.add('fade'); if (st.stopHere) chip.classList.add('bad');
      setTimeout(() => { pk.remove(); chip.remove(); }, 700);
      return;
    }
    i++;
    const [nx, ny] = avaXY(CHAIN[i]); pk.style.left = nx + 'px'; pk.style.top = ny + 'px'; pk.style.setProperty('--c', BYID[CHAIN[i]].color);
    const [fx, fy] = chipXY(i); chip.style.left = fx + 'px'; chip.style.top = fy + 'px'; chip.style.setProperty('--c', STAGES[i].c);
    setTimeout(go, HOP);
  };
  requestAnimationFrame(() => setTimeout(go, 60));
}

/* ---------------- fila de aprovação ---------------- */
function enqueue(p) {
  p.ttl = PROP_TTL; state.queue.unshift(p); state.props++;
  while (state.queue.length > 5) { const old = state.queue.pop(); addNote(BYID.executor, `Proposta #${String(old.id).padStart(3, '0')} (${old.sym}) descartada — fila cheia.`, { quiet: true }); }
  $('#stProps').textContent = state.props; renderQueue();
}
function renderQueue() {
  const q = $('#queue');
  if (!state.queue.length) q.innerHTML = '<p class="empty">Nenhuma proposta aguardando. O próximo ciclo do fluxo traz novas ideias.</p>';
  else q.innerHTML = state.queue.map(p => { const S = SYMS[p.sym]; return `<div class="prop" data-id="${p.id}">
    <div class="prop-head"><span class="sym">${p.sym}</span><span class="side-tag">COMPRA</span><span class="pid">#${String(p.id).padStart(3, '0')}</span><span class="ttl">${state.halted ? 'congelada' : p.ttl + 's'}</span></div>
    <div class="prop-grid"><div><small>Entrada</small><b>${nf(p.entry, S.d)}</b></div><div><small>Stop</small><b class="down">${nf(p.stop, S.d)}</b></div><div><small>Alvo</small><b class="up">${nf(p.target, S.d)}</b></div><div><small>Tamanho</small><b>${nf(p.qty, S.qd)}</b></div></div>
    <div class="prop-tags"><span class="tag ok">Cético: ${p.verdict}</span><span class="tag ok">Risco: ${nf(p.riskPct, 2)}% ✓</span><span class="tag info">R:R 1:${nf(p.rr, 1)}</span></div>
    <div class="prop-bar"><i style="width:${p.ttl / PROP_TTL * 100}%"></i></div>
    <div class="prop-actions"><button class="btn approve" data-act="ok" ${state.halted ? 'disabled' : ''}>✓ Aprovar</button><button class="btn reject" data-act="no" ${state.halted ? 'disabled' : ''}>✕ Rejeitar</button></div>
  </div>`; }).join('');
  const n = state.queue.length, qc = $('#qCount');
  qc.textContent = n; qc.className = n ? '' : 'zero'; $('#qPill').textContent = n; $('#qPill').className = 'pill' + (n ? ' warn' : '');
}
$('#queue').addEventListener('click', e => {
  const btn = e.target.closest('button[data-act]'); if (!btn || state.halted) return;
  const card = btn.closest('.prop'), id = +card.dataset.id, p = state.queue.find(x => x.id === id); if (!p) return;
  state.queue = state.queue.filter(x => x.id !== id);
  card.classList.add('out');
  const ex = BYID.executor, tag = `#${String(p.id).padStart(3, '0')}`;
  if (btn.dataset.act === 'ok') {
    const fill = SYMS[p.sym].p;
    ex.positions.push({ ...p, entry: fill, stop: fill - (p.entry - p.stop), target: fill + (p.target - p.entry) });
    state.approved++; $('#stApproved').textContent = state.approved;
    addNote(ex, `Aprovado pelo dono ✓ ${tag}: COMPRA ${nf(p.qty, SYMS[p.sym].qd)} ${p.sym} @ ${nf(fill, SYMS[p.sym].d)} (papel).`, { status: 'Ordem executada' });
  } else {
    state.rejected++; $('#stRejected').textContent = state.rejected;
    addNote(ex, `Rejeitado pelo dono ✕ ${tag} (${p.sym}). Nenhuma ordem enviada.`, { status: 'Em espera' });
  }
  setTimeout(() => { renderQueue(); renderPositions(); }, 330);
});
function tickQueue() {
  if (state.halted) return;
  let changed = false;
  for (const p of state.queue) p.ttl--;
  for (const p of state.queue.filter(p => p.ttl <= 0)) { addNote(BYID.executor, `Proposta #${String(p.id).padStart(3, '0')} (${p.sym}) expirou sem aprovação. Nada executado.`, { quiet: true }); changed = true; }
  state.queue = state.queue.filter(p => p.ttl > 0);
  if (changed) renderQueue();
  else for (const p of state.queue) { const c = document.querySelector(`.prop[data-id="${p.id}"]`); if (c) { c.querySelector('.ttl').textContent = p.ttl + 's'; c.querySelector('.prop-bar i').style.width = p.ttl / PROP_TTL * 100 + '%'; } }
  const qc = $('#qCount'); qc.textContent = state.queue.length;
}
function checkPositions() {
  const ex = BYID.executor; let changed = false;
  ex.positions = ex.positions.filter(p => {
    const price = SYMS[p.sym].p;
    if (price <= p.stop || price >= p.target) {
      const pl = (price - p.entry) * p.qty; state.realizedExec += pl; changed = true;
      addNote(ex, `${price >= p.target ? 'Alvo' : 'Stop'} atingido em ${p.sym}: posição zerada, ${usd(pl)} (papel).`, { status: price >= p.target ? 'Alvo OK' : 'Stop' });
      return false;
    }
    return true;
  });
  if (changed || ex.positions.length) renderPositions();
}
function renderPositions() {
  const ex = BYID.executor, el = $('#positions');
  if (!ex.positions.length) { el.innerHTML = `<p class="empty">Sem posições abertas.${state.realizedExec ? ` Realizado: <b class="${cls(state.realizedExec)}">${usd(state.realizedExec)}</b>` : ''}</p>`; return; }
  el.innerHTML = ex.positions.map(p => { const pl = (SYMS[p.sym].p - p.entry) * p.qty; return `<div class="posrow"><b>${p.sym}</b><small>${nf(p.qty, SYMS[p.sym].qd)} @ ${nf(p.entry, SYMS[p.sym].d)}</small><span class="${cls(pl)}">${usd(pl)}</span></div>`; }).join('');
}

/* ---------------- kill switch ---------------- */
function killSwitch(auto) {
  state.halted = true;
  const ex = BYID.executor;
  for (const p of ex.positions) state.realizedExec += (SYMS[p.sym].p - p.entry) * p.qty;
  ex.positions = [];
  $('#killBanner').hidden = false;
  const fs = $('#floorStatus'); fs.classList.add('halted'); fs.lastChild.textContent = 'Pregão pausado';
  const kb = $('#killBtn'); kb.textContent = '↺ Rearmar pregão'; kb.classList.add('armed');
  $('#btnCycle').disabled = true;
  const r = BYID.risco; r.status = 'KILL'; 
  state.halted = false; addNote(r, auto ? 'Piso de 4,5% atingido. KILL SWITCH automático: tudo pausado.' : 'KILL SWITCH acionado pelo dono. Posições em papel zeradas, agentes pausados.'); state.halted = true;
  renderQueue(); renderPositions(); updateAll(); layoutSticky();
}
function rearm() {
  state.halted = false;
  $('#killBanner').hidden = true;
  const fs = $('#floorStatus'); fs.classList.remove('halted'); fs.lastChild.textContent = 'Pregão ativo';
  const kb = $('#killBtn'); kb.textContent = '⏻ Acionar kill switch'; kb.classList.remove('armed');
  $('#btnCycle').disabled = false;
  BYID.risco.status = 'Piso intacto';
  addNote(BYID.risco, 'Pregão rearmado. Piso de 4,5% monitorado novamente.');
  renderQueue(); updateAll(); layoutSticky();
}
$('#killBtn').addEventListener('click', () => state.halted ? rearm() : killSwitch(false));
$('#rearmBtn').addEventListener('click', rearm);
$('#btnCycle').addEventListener('click', () => { runCycle(); });

/* ---------------- drawer / chat ---------------- */
let drawerAgent = null;
const drawer = $('#drawer'), scrim = $('#scrim');
function openDrawer(a) {
  drawerAgent = a;
  for (const x of AGENTS) x.el.classList.toggle('sel', x === a);
  drawer.style.setProperty('--c', a.color);
  $('#drBot').style.setProperty('--c', a.color);
  $('#drName').textContent = `${a.pt} · ${a.en}`;
  $('#drSub').textContent = a.sub;
  renderDrStats();
  const body = $('#drBody'); body.innerHTML = '';
  appendMsg({ from: 'agent', text: a.intro, t: '' }, a);
  const q = document.createElement('div'); q.className = 'quick';
  const qs = ['Como está o risco?', `Preço de ${a.exec ? 'BTC' : a.sym}?`, 'O que tem na fila?', 'Qual seu P&L?'];
  q.innerHTML = qs.map(s => `<button type="button">${esc(s)}</button>`).join('');
  q.addEventListener('click', e => { const b = e.target.closest('button'); if (b) ask(b.textContent); });
  body.appendChild(q);
  for (const m of a.log.slice(-14)) appendMsg(m, a);
  scrim.hidden = false; requestAnimationFrame(() => { scrim.classList.add('show'); drawer.classList.add('open'); });
  drawer.setAttribute('aria-hidden', 'false');
  setTimeout(() => { if (matchMedia('(pointer:fine)').matches) $('#drInput').focus(); }, 350);
}
function closeDrawer() {
  drawer.classList.remove('open'); scrim.classList.remove('show'); drawer.setAttribute('aria-hidden', 'true');
  for (const x of AGENTS) x.el.classList.remove('sel');
  setTimeout(() => { scrim.hidden = true; }, 300); drawerAgent = null;
}
function renderDrStats() {
  const a = drawerAgent; if (!a) return;
  const p = pnlOf(a), sym = a.exec ? (a.positions.length ? a.positions[a.positions.length - 1].sym : '—') : a.sym;
  $('#drStats').innerHTML = `<div><small>Status</small><b>${esc(state.halted ? 'Pausado' : a.status)}</b></div><div><small>Ativo</small><b>${sym}${sym !== '—' ? ' ' + px(sym) : ''}</b></div><div><small>P&amp;L (papel)</small><b class="${cls(p)}">${usd(p)}</b></div>`;
}
function appendMsg(m, a) {
  const body = $('#drBody'), d = document.createElement('div');
  d.className = 'msg ' + (m.from === 'user' ? 'user' : m.from === 'note' ? 'note' : 'agent');
  d.style.setProperty('--c', a.color);
  d.innerHTML = `<span class="who">${m.from === 'user' ? 'Você' : esc(a.pt)}${m.t ? ' · ' + m.t : ''}</span><p>${esc(m.text)}</p>`;
  body.appendChild(d); body.scrollTop = body.scrollHeight;
}
function reply(a, q) {
  const t = q.toLowerCase(), r = riskSnapshot();
  const sym = Object.keys(SYMS).find(s => new RegExp('\\b' + s.toLowerCase() + '\\b').test(t));
  if (sym) {
    const extra = { grafico: () => `Níveis: entrada ${px(sym)}, stop ${nf(SYMS[sym].p * 0.99, SYMS[sym].d)}, alvo ${nf(SYMS[sym].p * 1.022, SYMS[sym].d)}.`, cetico: () => `Meu veredito agora: ${pick(['COMPRAR', 'ESPERAR', 'PULAR'])}.`, risco: () => `Risco máximo permitido nele: ${nf(Math.max(0, Math.min(1.2, FLOOR - Math.abs(r.dd) - r.openRisk)), 2)}% da banca.`, noticias: () => pick(HEADLINES)(sym) + '.', batedor: () => `Volume ${nf(rand(0.8, 3), 1)}x a média.`, dimensionador: () => `Com 1% de risco e stop de 1%, seriam ~${nf(BANCA * 0.01 / (SYMS[sym].p * 0.01), SYMS[sym].qd)} unidades.`, executor: () => 'Só compro se você aprovar uma proposta.' };
    return `${sym} (${SYMS[sym].n}) está em ${px(sym)}, ${pctf(chg(sym))} na sessão simulada. ${extra[a.id]()}`;
  }
  if (/risco|stop|piso|kill|drawdown|perda/.test(t)) return `Drawdown do dia ${nf(r.dd, 2)}%, risco aberto ${nf(r.openRisk, 2)}%. Piso de 4,5%: ${nf(Math.max(0, FLOOR - Math.abs(r.dd) - r.openRisk), 2)}% de folga. ${state.halted ? 'Kill switch ATIVO.' : 'Kill switch armado.'}`;
  if (/fila|aprova|proposta|ordem/.test(t)) return state.queue.length ? `Há ${state.queue.length} proposta(s) na fila: ${state.queue.map(p => p.sym + ' #' + String(p.id).padStart(3, '0')).join(', ')}. Só o dono pode aprovar.` : 'Fila vazia agora. O próximo ciclo do fluxo deve trazer algo.';
  if (/p&l|pnl|lucro|resultado|ganho|ranking/.test(t)) { const rk = [...AGENTS].sort((x, y) => pnlOf(y) - pnlOf(x)).indexOf(a) + 1; return `Meu P&L em papel: ${usd(pnlOf(a))} (${pctf(pnlPct(a))}). Estou em #${rk} no ranking.`; }
  if (/oi|olá|ola|bom dia|boa tarde|boa noite|hello|hi\b/.test(t)) return `Olá! ${a.intro}`;
  return pick(a.replies);
}
function ask(text) {
  const a = drawerAgent; if (!a || !text.trim()) return;
  const m = { from: 'user', text: text.trim(), t: now() }; a.log.push(m); appendMsg(m, a);
  const body = $('#drBody'), typing = document.createElement('div');
  typing.className = 'msg agent typing'; typing.style.setProperty('--c', a.color); typing.innerHTML = '<i></i><i></i><i></i>';
  body.appendChild(typing); body.scrollTop = body.scrollHeight;
  setTimeout(() => { typing.remove(); if (drawerAgent !== a) return; const r = { from: 'agent', text: reply(a, text), t: now() }; a.log.push(r); appendMsg(r, a); }, rand(600, 1200));
}
$('#drForm').addEventListener('submit', e => { e.preventDefault(); const i = $('#drInput'); ask(i.value); i.value = ''; });
$('#drClose').addEventListener('click', closeDrawer);
scrim.addEventListener('click', closeDrawer);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && drawerAgent) closeDrawer(); });

/* ---------------- layout responsivo ---------------- */
const SW = 1280, SH = 910;
function fit() {
  const wrap = $('#floorWrap'), w = wrap.clientWidth;
  const s = Math.min(1.12, Math.max(0.56, w / SW));
  stage.style.transform = `scale(${s})`;
  const inner = $('#floorInner'); inner.style.width = SW * s + 'px'; inner.style.height = SH * s + 'px';
  if (SW * s > w && !fit.centered) { wrap.scrollLeft = (SW * s - w) / 2; fit.centered = true; }
}
function layoutSticky() {
  const tb = $('.topbar').offsetHeight, tk = $('.ticker');
  tk.style.top = tb + 'px';
  const kb = $('#killBanner'); kb.style.top = tb + tk.offsetHeight + 'px';
  document.documentElement.style.scrollPaddingTop = tb + tk.offsetHeight + (kb.hidden ? 0 : kb.offsetHeight) + 12 + 'px';
}
window.addEventListener('resize', () => { fit(); layoutSticky(); });

// abas ativas conforme a rolagem
const tabs = [...document.querySelectorAll('.tabs a')];
const io = new IntersectionObserver(es => {
  for (const e of es) if (e.isIntersecting) tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === e.target.id));
}, { rootMargin: '-45% 0px -50% 0px' });
['pregao', 'fluxo', 'aprovacoes'].forEach(id => io.observe(document.getElementById(id)));

/* ---------------- loop ---------------- */
function updateAll() { updateTicker(); updatePods(); updateLeaderboard(); updateRisk(); renderDrStats(); }
function clock() { $('#clock').textContent = now(); }

buildFloor(); buildTicker(); buildLeaderboard(); buildFlow();
fit(); layoutSticky(); clock(); updateAll(); renderQueue();
setInterval(() => { if (!state.halted) stepPrices(); updateAll(); checkPositions(); tickQueue(); clock(); }, 1000);
setInterval(ambient, 3800);
setInterval(runCycle, 10500);
setTimeout(runCycle, 1200);
setTimeout(ambient, 600);
})();
