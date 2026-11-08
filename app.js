/* Diário de Enxaqueca — PWA (pt-PT)
   Dados guardados localmente no dispositivo (localStorage). Nada é enviado para servidores. */
'use strict';

const STORE_KEY = 'enxaq.crises.v1';

/* ---------- Opções ---------- */
const LOCALIZACOES = ['Lado esquerdo', 'Lado direito', 'Ambos os lados', 'Testa / frontal', 'Nuca', 'Atrás dos olhos', 'Topo da cabeça'];
const SINTOMAS = ['Náuseas', 'Vómitos', 'Aura visual', 'Sensibilidade à luz', 'Sensibilidade ao som', 'Sensibilidade a cheiros', 'Tonturas', 'Visão turva', 'Formigueiro', 'Dificuldade de concentração', 'Rigidez no pescoço', 'Temperatura corporal'];
const GATILHOS = ['Stress', 'Falta de sono', 'Excesso de sono', 'Jejum / saltar refeição', 'Desidratação', 'Álcool', 'Cafeína', 'Chocolate', 'Queijo curado', 'Menstruação', 'Mudança de tempo', 'Calor', 'Frio', 'Esforço físico', 'Ecrãs / luz azul', 'Ruído', 'Perfumes / cheiros fortes'];
const MEDS_KEY = 'enxaq.meds.v1';

/* ---------- Estado ---------- */
let crises = load();
let editingId = null;

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(crises)); }
  catch (e) { toast('Não foi possível guardar os dados.'); }
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

/* Medicações guardadas (para reescolher) */
function getSavedMeds() {
  let list = [];
  try { list = JSON.parse(localStorage.getItem(MEDS_KEY)) || []; } catch (e) {}
  const fromCrises = crises.map(c => (c.medicacao || '').trim()).filter(Boolean);
  const set = new Set([...list, ...fromCrises]);
  return [...set].sort((a, b) => a.localeCompare(b, 'pt'));
}
function rememberMed(name) {
  name = (name || '').trim();
  if (!name) return;
  let list = [];
  try { list = JSON.parse(localStorage.getItem(MEDS_KEY)) || []; } catch (e) {}
  if (!list.includes(name)) {
    list.push(name);
    try { localStorage.setItem(MEDS_KEY, JSON.stringify(list)); } catch (e) {}
  }
}

/* ---------- Utilitários ---------- */
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MONTHS_LONG = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function pad(n) { return String(n).padStart(2, '0'); }
function roundTo5(d) {
  const r = new Date(d);
  r.setSeconds(0, 0);
  r.setMinutes(Math.round(r.getMinutes() / 5) * 5);
  return r;
}
function toLocalInput(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtDateTime(iso) {
  const d = new Date(iso);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtDuration(ini, fim) {
  if (!fim) return 'Em curso';
  let mins = Math.round((new Date(fim) - new Date(ini)) / 60000);
  if (mins < 0) mins = 0;
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}
function intensityColor(v) {
  if (v <= 3) return '#16a34a';
  if (v <= 6) return '#d97706';
  if (v <= 8) return '#ea580c';
  return '#dc2626';
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- Router ---------- */
const app = document.getElementById('app');
let currentView = 'inicio';

const views = {
  inicio: renderInicio,
  historico: renderHistorico,
  registar: renderRegistar,
  estatisticas: renderEstatisticas,
  dados: renderDados,
};

function go(view) {
  if (view !== 'registar') editingId = null;
  currentView = view;
  app.scrollTop = 0;
  window.scrollTo(0, 0);
  views[view]();
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.dataset.view === view);
  });
}

document.querySelectorAll('.tab').forEach(t => {
  t.addEventListener('click', () => go(t.dataset.view));
});

/* ---------- Toast ---------- */
let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

/* ======================================================
   VISTA: INÍCIO
   ====================================================== */
function renderInicio() {
  const agora = new Date();
  const mesAtual = crises.filter(c => {
    const d = new Date(c.inicio);
    return d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear();
  });
  const diasSemCrise = calcDiasSemCrise();
  const intensidades = crises.map(c => c.intensidade).filter(n => typeof n === 'number');
  const media = intensidades.length ? (intensidades.reduce((a, b) => a + b, 0) / intensidades.length) : null;
  const emCurso = crises.find(c => !c.fim);

  let html = `
    <h1>Diário de Enxaqueca</h1>
    <p class="subtitle">Olá. Como está a sua cabeça hoje?</p>
  `;

  if (emCurso) {
    html += `
      <div class="card" style="border-color:var(--warn)">
        <strong>⚠️ Crise em curso</strong>
        <p class="hint" style="margin:6px 0 12px">Começou em ${fmtDateTime(emCurso.inicio)}.</p>
        <div class="btn-row">
          <button class="btn btn-primary" data-end="${emCurso.id}">Terminar agora</button>
          <button class="btn btn-ghost" data-edit="${emCurso.id}">Editar</button>
        </div>
      </div>`;
  }

  html += `
    <div class="card hero">
      <div style="font-size:.95rem;opacity:.9;margin-bottom:10px">Sente dor neste momento?</div>
      <button class="big-btn" data-nav="registar">+ Registar crise</button>
    </div>

    <div class="stats-grid">
      <div class="stat"><span class="num">${mesAtual.length}</span><span class="lbl">crises este mês</span></div>
      <div class="stat"><span class="num">${diasSemCrise !== null ? diasSemCrise : '—'}</span><span class="lbl">dias sem crise</span></div>
      <div class="stat"><span class="num">${media !== null ? media.toFixed(1) : '—'}</span><span class="lbl">intensidade média</span></div>
    </div>
  `;

  if (crises.length === 0) {
    html += `
      <div class="card empty" style="margin-top:22px">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.6"><path d="M12 3a7 7 0 0 0-7 7c0 2 1 3.5 2 5 .5.8 1 2 1 3h8c0-1 .5-2.2 1-3 1-1.5 2-3 2-5a7 7 0 0 0-7-7Z"/><path d="M9 21h6"/></svg>
        <p>Ainda não há registos.<br>Toque em <strong>+ Registar crise</strong> quando tiver (ou quando acabar) uma crise.</p>
      </div>`;
  } else {
    html += `<h2>Últimos registos</h2>`;
    const recentes = [...crises].sort((a, b) => new Date(b.inicio) - new Date(a.inicio)).slice(0, 3);
    html += recentes.map(crisisCard).join('');
    if (crises.length > 3) {
      html += `<button class="btn btn-ghost" data-nav="historico" style="margin-top:6px">Ver histórico completo (${crises.length})</button>`;
    }
  }

  app.innerHTML = html;
  bindCommon();
}

function calcDiasSemCrise() {
  const terminadas = crises.filter(c => c.inicio).sort((a, b) => new Date(b.inicio) - new Date(a.inicio));
  if (!terminadas.length) return null;
  const ultima = new Date(terminadas[0].fim || terminadas[0].inicio);
  const diff = Math.floor((Date.now() - ultima) / 86400000);
  return Math.max(0, diff);
}

/* ======================================================
   VISTA: REGISTAR / EDITAR
   ====================================================== */
function renderRegistar() {
  const editing = editingId ? crises.find(c => c.id === editingId) : null;
  const c = editing || {
    inicio: toLocalInput(roundTo5(new Date())),
    fim: '',
    intensidade: 5,
    localizacao: [],
    sintomas: [],
    gatilhos: [],
    medicacao: '',
    eficacia: '',
    notas: '',
  };
  const iniVal = editing ? toLocalInput(new Date(c.inicio)) : c.inicio;
  const fimVal = editing && c.fim ? toLocalInput(new Date(c.fim)) : '';
  const savedMeds = getSavedMeds();

  app.innerHTML = `
    <h1>${editing ? 'Editar crise' : 'Registar crise'}</h1>
    <p class="subtitle">${editing ? 'Atualize os dados desta crise.' : 'Preencha o que souber. Só a data e a intensidade são obrigatórias.'}</p>

    <form id="form-crise" novalidate>
      <div class="card">
        <div class="field">
          <label for="inicio">Início da crise *</label>
          <input type="datetime-local" id="inicio" value="${iniVal}" step="300" required />
        </div>
        <div class="field">
          <label for="fim">Fim da crise <span class="hint" style="font-weight:400">(deixe vazio se ainda a tem)</span></label>
          <input type="datetime-local" id="fim" value="${fimVal}" step="300" />
        </div>
      </div>

      <div class="card">
        <div class="field" style="margin-bottom:6px">
          <label>Intensidade da dor *</label>
          <div class="slider-row">
            <input type="range" id="intensidade" min="1" max="10" value="${c.intensidade}" />
            <span class="int-badge" id="int-badge">${c.intensidade}</span>
          </div>
          <div class="hint" id="int-desc"></div>
        </div>
      </div>

      <div class="card">
        <div class="field" style="margin-bottom:0">
          <label>Localização da dor</label>
          <div class="chips" id="chips-loc">${chipList(LOCALIZACOES, c.localizacao)}</div>
        </div>
      </div>

      <div class="card">
        <div class="field" style="margin-bottom:0">
          <label>Sintomas</label>
          <div class="chips" id="chips-sin">${chipList(SINTOMAS, c.sintomas)}</div>
        </div>
      </div>

      <div class="card">
        <div class="field" style="margin-bottom:0">
          <label>Possíveis gatilhos</label>
          <div class="chips" id="chips-gat">${chipList(GATILHOS, c.gatilhos)}</div>
        </div>
      </div>

      <div class="card">
        <div class="field">
          <label for="medicacao">Medicação tomada</label>
          <input type="text" id="medicacao" placeholder="Ex.: Ibuprofeno 400 mg" value="${esc(c.medicacao || '')}" />
        </div>
        ${savedMeds.length ? `
        <div class="field">
          <label for="med-saved">Escolher medicação já usada</label>
          <select id="med-saved">
            <option value="">— da lista —</option>
            ${savedMeds.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('')}
          </select>
        </div>` : ''}
        <div class="field" style="margin-bottom:0">
          <label for="eficacia">A medicação ajudou?</label>
          <select id="eficacia">
            <option value="">—</option>
            <option value="Resolveu"${c.eficacia === 'Resolveu' ? ' selected' : ''}>Resolveu a dor</option>
            <option value="Aliviou"${c.eficacia === 'Aliviou' ? ' selected' : ''}>Aliviou parcialmente</option>
            <option value="Não ajudou"${c.eficacia === 'Não ajudou' ? ' selected' : ''}>Não ajudou</option>
          </select>
        </div>
      </div>

      <div class="card">
        <div class="field" style="margin-bottom:0">
          <label for="notas">Notas</label>
          <textarea id="notas" placeholder="Algo mais que queira registar...">${esc(c.notas || '')}</textarea>
        </div>
      </div>

      <button type="submit" class="btn btn-primary">${editing ? 'Guardar alterações' : 'Guardar crise'}</button>
      ${editing ? `<div class="btn-row"><button type="button" class="btn btn-danger" data-delete="${editing.id}">Apagar</button><button type="button" class="btn btn-ghost" data-nav="historico">Cancelar</button></div>` : ''}
    </form>
  `;

  // Intensidade ao vivo
  const range = document.getElementById('intensidade');
  const badge = document.getElementById('int-badge');
  const desc = document.getElementById('int-desc');
  function updInt() {
    const v = +range.value;
    badge.textContent = v;
    badge.style.background = intensityColor(v);
    desc.textContent = intDesc(v);
  }
  range.addEventListener('input', updInt);
  updInt();

  // Escolher medicação já usada preenche o campo de texto
  const medSel = document.getElementById('med-saved');
  if (medSel) medSel.addEventListener('change', () => {
    if (medSel.value) { document.getElementById('medicacao').value = medSel.value; medSel.value = ''; }
  });

  // Chips
  document.querySelectorAll('.chip').forEach(ch => {
    ch.addEventListener('click', () => {
      const pressed = ch.getAttribute('aria-pressed') === 'true';
      ch.setAttribute('aria-pressed', String(!pressed));
    });
  });

  document.getElementById('form-crise').addEventListener('submit', onSubmit);
  bindCommon();
}

function intDesc(v) {
  if (v <= 2) return 'Ligeira — quase não interfere no dia a dia.';
  if (v <= 4) return 'Leve — incómoda mas consegue funcionar.';
  if (v <= 6) return 'Moderada — difícil de ignorar.';
  if (v <= 8) return 'Forte — limita bastante as atividades.';
  return 'Muito forte — incapacitante.';
}

function chipList(options, selected) {
  const sel = selected || [];
  return options.map(o =>
    `<button type="button" class="chip" data-val="${esc(o)}" aria-pressed="${sel.includes(o)}">${esc(o)}</button>`
  ).join('');
}
function collectChips(containerId) {
  return [...document.querySelectorAll(`#${containerId} .chip[aria-pressed="true"]`)].map(c => c.dataset.val);
}

function onSubmit(e) {
  e.preventDefault();
  const inicioRaw = document.getElementById('inicio').value;
  if (!inicioRaw) { toast('Indique a data de início.'); return; }
  const fimRaw = document.getElementById('fim').value;
  const inicio = new Date(inicioRaw).toISOString();
  const fim = fimRaw ? new Date(fimRaw).toISOString() : null;

  if (fim && new Date(fim) < new Date(inicio)) {
    toast('O fim não pode ser antes do início.');
    return;
  }

  const data = {
    inicio, fim,
    intensidade: +document.getElementById('intensidade').value,
    localizacao: collectChips('chips-loc'),
    sintomas: collectChips('chips-sin'),
    gatilhos: collectChips('chips-gat'),
    medicacao: document.getElementById('medicacao').value.trim(),
    eficacia: document.getElementById('eficacia').value,
    notas: document.getElementById('notas').value.trim(),
  };

  if (editingId) {
    const idx = crises.findIndex(c => c.id === editingId);
    if (idx >= 0) crises[idx] = { ...crises[idx], ...data };
    toast('Crise atualizada.');
  } else {
    crises.push({ id: uid(), criadoEm: new Date().toISOString(), ...data });
    toast('Crise registada.');
  }
  rememberMed(data.medicacao);
  save();
  editingId = null;
  go('historico');
}

/* ======================================================
   VISTA: HISTÓRICO
   ====================================================== */
function renderHistorico() {
  if (crises.length === 0) {
    app.innerHTML = `
      <h1>Histórico</h1>
      <div class="card empty">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.6"><path d="M4 5h16M4 12h16M4 19h10"/></svg>
        <p>Sem registos ainda.</p>
        <button class="btn btn-primary" data-nav="registar" style="max-width:220px;margin:12px auto 0">Registar a primeira</button>
      </div>`;
    bindCommon();
    return;
  }

  const sorted = [...crises].sort((a, b) => new Date(b.inicio) - new Date(a.inicio));
  let html = `<h1>Histórico</h1><p class="subtitle">${crises.length} ${crises.length === 1 ? 'registo' : 'registos'} no total.</p>`;

  let lastKey = '';
  for (const c of sorted) {
    const d = new Date(c.inicio);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (key !== lastKey) {
      html += `<div class="month-head">${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}</div>`;
      lastKey = key;
    }
    html += crisisCard(c);
  }

  app.innerHTML = html;
  bindCommon();
}

function crisisCard(c) {
  const tags = [];
  if (c.localizacao && c.localizacao.length) tags.push(c.localizacao[0] + (c.localizacao.length > 1 ? ` +${c.localizacao.length - 1}` : ''));
  (c.sintomas || []).slice(0, 2).forEach(s => tags.push(s));
  if (c.medicacao) tags.push('💊 ' + c.medicacao);
  const dur = fmtDuration(c.inicio, c.fim);
  return `
    <div class="crisis">
      <div class="intensity" style="background:${intensityColor(c.intensidade)}">${c.intensidade}</div>
      <div class="body">
        <div class="when">${fmtDateTime(c.inicio)}</div>
        <div class="meta">${c.fim ? 'Duração: ' + dur : '<span class="ongoing">Em curso</span>'}</div>
        ${tags.length ? `<div class="tags">${tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
      </div>
      <button class="edit" data-edit="${c.id}" aria-label="Editar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
      </button>
    </div>`;
}

/* ======================================================
   VISTA: ESTATÍSTICAS
   ====================================================== */
function renderEstatisticas() {
  if (crises.length === 0) {
    app.innerHTML = `
      <h1>Estatísticas</h1>
      <div class="card empty">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.6"><path d="M5 20V10M12 20V4M19 20v-7"/></svg>
        <p>Registe algumas crises para ver padrões e tendências aqui.</p>
      </div>`;
    bindCommon();
    return;
  }

  const total = crises.length;
  const ints = crises.map(c => c.intensidade);
  const mediaInt = (ints.reduce((a, b) => a + b, 0) / total).toFixed(1);
  const comFim = crises.filter(c => c.fim);
  const durMedia = comFim.length
    ? Math.round(comFim.reduce((a, c) => a + (new Date(c.fim) - new Date(c.inicio)) / 60000, 0) / comFim.length)
    : null;

  // Últimos 6 meses
  const now = new Date();
  const buckets = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ y: d.getFullYear(), m: d.getMonth(), count: 0 });
  }
  crises.forEach(c => {
    const d = new Date(c.inicio);
    const b = buckets.find(x => x.y === d.getFullYear() && x.m === d.getMonth());
    if (b) b.count++;
  });
  const maxCount = Math.max(1, ...buckets.map(b => b.count));

  const topGat = topCounts(crises.flatMap(c => c.gatilhos || []));
  const topSin = topCounts(crises.flatMap(c => c.sintomas || []));

  let html = `
    <h1>Estatísticas</h1>
    <p class="subtitle">Padrões a partir dos seus ${total} registos.</p>

    <div class="stats-grid" style="margin-bottom:14px">
      <div class="stat"><span class="num">${total}</span><span class="lbl">crises</span></div>
      <div class="stat"><span class="num">${mediaInt}</span><span class="lbl">intensidade média</span></div>
      <div class="stat"><span class="num">${durMedia !== null ? fmtDurShort(durMedia) : '—'}</span><span class="lbl">duração média</span></div>
    </div>

    <div class="card">
      <h2 style="margin-top:0">Crises por mês</h2>
      <div class="months">
        ${buckets.map(b => `
          <div class="col">
            <span class="mval">${b.count || ''}</span>
            <div class="mbar" style="height:${b.count / maxCount * 100}%"></div>
            <span class="mlbl">${MONTHS[b.m]}</span>
          </div>`).join('')}
      </div>
    </div>
  `;

  if (topGat.length) {
    const max = topGat[0][1];
    html += `
      <div class="card">
        <h2 style="margin-top:0">Gatilhos mais frequentes</h2>
        ${topGat.map(([name, n]) => barRow(name, n, max)).join('')}
      </div>`;
  }

  if (topSin.length) {
    const max = topSin[0][1];
    html += `
      <div class="card">
        <h2 style="margin-top:0">Sintomas mais frequentes</h2>
        ${topSin.map(([name, n]) => barRow(name, n, max)).join('')}
      </div>`;
  }

  // Eficácia da medicação
  const comMed = crises.filter(c => c.medicacao);
  if (comMed.length) {
    const res = comMed.filter(c => c.eficacia === 'Resolveu').length;
    const ali = comMed.filter(c => c.eficacia === 'Aliviou').length;
    const nao = comMed.filter(c => c.eficacia === 'Não ajudou').length;
    html += `
      <div class="card">
        <h2 style="margin-top:0">Medicação</h2>
        <p class="hint" style="margin-top:0">Tomou medicação em ${comMed.length} de ${total} crises.</p>
        ${res ? barRow('Resolveu', res, comMed.length) : ''}
        ${ali ? barRow('Aliviou', ali, comMed.length) : ''}
        ${nao ? barRow('Não ajudou', nao, comMed.length) : ''}
      </div>`;
  }

  app.innerHTML = html;
  bindCommon();
}

function topCounts(arr) {
  const map = {};
  arr.forEach(x => { map[x] = (map[x] || 0) + 1; });
  return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
}
function barRow(name, n, max) {
  return `<div class="bar-row">
    <span class="name">${esc(name)}</span>
    <div class="bar-track"><div class="bar-fill" style="width:${Math.max(4, n / max * 100)}%"></div></div>
    <span class="val">${n}</span>
  </div>`;
}
function fmtDurShort(mins) {
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h === 0) return m + 'm';
  if (m === 0) return h + 'h';
  return `${h}h${m}`;
}

/* ======================================================
   VISTA: DADOS
   ====================================================== */
function renderDados() {
  app.innerHTML = `
    <h1>Os seus dados</h1>
    <p class="subtitle">Tudo é guardado apenas neste dispositivo.</p>

    <div class="inline-note">
      🔒 Os registos ficam no seu telemóvel. Nada é enviado para a internet. Faça cópias de segurança de vez em quando.
    </div>

    <div class="card">
      <h2 style="margin-top:0">Cópia de segurança</h2>
      <p class="hint" style="margin-top:0">Guarde um ficheiro com todos os registos (${crises.length}).</p>
      <div class="btn-row">
        <button class="btn btn-ghost" id="exp-json">Exportar (.json)</button>
        <button class="btn btn-ghost" id="exp-csv">Exportar (.csv)</button>
      </div>
    </div>

    <div class="card">
      <h2 style="margin-top:0">Restaurar</h2>
      <p class="hint" style="margin-top:0">Importar um ficheiro .json exportado desta app (substitui os registos atuais).</p>
      <input type="file" id="imp-file" accept="application/json,.json" style="margin-top:8px" />
    </div>

    <div class="card">
      <h2 style="margin-top:0">Apagar tudo</h2>
      <p class="hint" style="margin-top:0">Remove todos os registos deste dispositivo. Não pode ser desfeito.</p>
      <button class="btn btn-danger" id="wipe" style="margin-top:8px">Apagar todos os registos</button>
    </div>

    <p class="hint" style="text-align:center;margin-top:24px">
      Esta app é um diário pessoal e não substitui aconselhamento médico.<br>
      Em caso de dúvida, fale com o seu médico.
    </p>
  `;

  document.getElementById('exp-json').addEventListener('click', exportJSON);
  document.getElementById('exp-csv').addEventListener('click', exportCSV);
  document.getElementById('imp-file').addEventListener('change', importJSON);
  document.getElementById('wipe').addEventListener('click', () => {
    if (confirm('Apagar TODOS os registos? Esta ação não pode ser desfeita.')) {
      crises = [];
      save();
      toast('Todos os registos foram apagados.');
      go('inicio');
    }
  });
  bindCommon();
}

function download(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function stamp() {
  const d = new Date();
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}
function exportJSON() {
  if (!crises.length) { toast('Não há registos para exportar.'); return; }
  download(`enxaqueca-${stamp()}.json`, JSON.stringify(crises, null, 2), 'application/json');
  toast('Ficheiro exportado.');
}
function exportCSV() {
  if (!crises.length) { toast('Não há registos para exportar.'); return; }
  const cols = ['inicio', 'fim', 'intensidade', 'localizacao', 'sintomas', 'gatilhos', 'medicacao', 'eficacia', 'notas'];
  const head = cols.join(';');
  const rows = crises.map(c => cols.map(k => {
    let v = c[k];
    if (Array.isArray(v)) v = v.join(', ');
    v = v == null ? '' : String(v);
    return '"' + v.replace(/"/g, '""') + '"';
  }).join(';'));
  download(`enxaqueca-${stamp()}.csv`, '﻿' + head + '\n' + rows.join('\n'), 'text/csv;charset=utf-8');
  toast('Ficheiro exportado.');
}
function importJSON(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data)) throw new Error('formato');
      const clean = data.filter(c => c && c.inicio).map(c => ({
        id: c.id || uid(),
        inicio: c.inicio,
        fim: c.fim || null,
        intensidade: typeof c.intensidade === 'number' ? c.intensidade : 5,
        localizacao: Array.isArray(c.localizacao) ? c.localizacao : [],
        sintomas: Array.isArray(c.sintomas) ? c.sintomas : [],
        gatilhos: Array.isArray(c.gatilhos) ? c.gatilhos : [],
        medicacao: c.medicacao || '',
        eficacia: c.eficacia || '',
        notas: c.notas || '',
      }));
      if (!confirm(`Importar ${clean.length} registos? Os atuais (${crises.length}) serão substituídos.`)) return;
      crises = clean;
      save();
      toast(`${clean.length} registos importados.`);
      go('inicio');
    } catch (err) {
      toast('Ficheiro inválido.');
    }
  };
  reader.readAsText(file);
}

/* ---------- Ligações comuns ---------- */
function bindCommon() {
  document.querySelectorAll('[data-nav]').forEach(b => b.addEventListener('click', () => go(b.dataset.nav)));
  document.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => { editingId = b.dataset.edit; go('registar'); }));
  document.querySelectorAll('[data-delete]').forEach(b => b.addEventListener('click', () => {
    if (confirm('Apagar esta crise?')) {
      crises = crises.filter(c => c.id !== b.dataset.delete);
      save(); editingId = null; toast('Crise apagada.'); go('historico');
    }
  }));
  document.querySelectorAll('[data-end]').forEach(b => b.addEventListener('click', () => {
    const c = crises.find(x => x.id === b.dataset.end);
    if (c) { c.fim = new Date().toISOString(); save(); toast('Crise terminada.'); go('inicio'); }
  }));
}

/* ---------- Service worker ---------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

/* ---------- Arranque ---------- */
go('inicio');
