/* Diário de Enxaqueca — PWA (pt-PT)
   Dados guardados localmente no dispositivo (localStorage). Nada é enviado para servidores. */
'use strict';

const STORE_KEY = 'enxaq.crises.v1';
const MEDS_KEY = 'enxaq.meds.v1';

/* ---------- Opções ---------- */
const PERIODOS = ['Madrugada', 'Manhã', 'Tarde', 'Noite'];
const PERIODO_HORAS = { 'Madrugada': '00h–06h', 'Manhã': '06h–12h', 'Tarde': '12h–19h', 'Noite': '19h–00h' };
const TEMPOS_EFEITO = ['Menos de 30 min', '30–60 min', '1–2 h', '2–6 h', 'Até 1 dia', '1–3 dias', 'Mais de 3 dias'];
const LOCALIZACOES = ['Lado esquerdo', 'Lado direito', 'Ambos os lados', 'Testa / frontal', 'Nuca', 'Atrás dos olhos', 'Topo da cabeça'];
const SINTOMAS = ['Náuseas', 'Vómitos', 'Aura visual', 'Sensibilidade à luz', 'Sensibilidade ao som', 'Sensibilidade a cheiros', 'Tonturas', 'Visão turva', 'Formigueiro', 'Dificuldade de concentração', 'Rigidez no pescoço', 'Tensão na cervical', 'Temperatura corporal'];
const GATILHOS = ['Stress', 'Falta de sono', 'Excesso de sono', 'Jejum / saltar refeição', 'Desidratação', 'Álcool', 'Cafeína', 'Chocolate', 'Queijo curado', 'Menstruação', 'Mudança de tempo', 'Calor', 'Frio', 'Esforço físico', 'Ecrãs / luz azul', 'Ruído', 'Perfumes / cheiros fortes'];

/* ---------- Utilitários base ---------- */
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MONTHS_LONG = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function pad(n) { return String(n).padStart(2, '0'); }
function todayISO() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function diaToDate(dia) { return new Date((dia || todayISO()) + 'T00:00'); }
function fmtDia(dia) {
  const d = diaToDate(dia);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
function periodoFromDate(d) {
  const h = d.getHours();
  if (h < 6) return 'Madrugada';
  if (h < 12) return 'Manhã';
  if (h < 19) return 'Tarde';
  return 'Noite';
}
function periodoIndex(p) { const i = PERIODOS.indexOf(p); return i < 0 ? 1 : i; }
function durFromMins(m) { return m < 60 ? 'Menos de 1h' : m < 240 ? '1–4h' : m < 720 ? '4–12h' : 'Mais de 12h'; }
// valor para ordenar: dia + deslocamento do período dentro do dia
function sortVal(c) { return diaToDate(c.dia).getTime() + periodoIndex(c.periodo) * 3600000; }
// duração calculada a partir das datas de início e fim
function nDias(c) { return Math.round((diaToDate(c.diaFim) - diaToDate(c.dia)) / 86400000) + 1; }
function duracaoTexto(c) {
  if (!c.diaFim) return 'Ainda a decorrer';
  if (c.diaFim === c.dia) return 'Mesmo dia';
  return nDias(c) + ' dias';
}
function duracaoCategoria(c) {
  if (!c.diaFim) return 'Ainda a decorrer';
  if (c.diaFim === c.dia) return 'Mesmo dia';
  return nDias(c) <= 3 ? '2–3 dias' : '4+ dias';
}
function diaFimDe(c) { return c.diaFim || c.dia; }
function intensityColor(v) {
  if (v <= 3) return '#16a34a';
  if (v <= 6) return '#d97706';
  if (v <= 8) return '#ea580c';
  return '#dc2626';
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- Migração + Estado ---------- */
// Converte registos antigos (inicio/fim) para o novo modelo (dia/periodo/duracao) e normaliza.
function migrate(c) {
  const out = Object.assign({}, c);
  if (!out.dia) {
    if (out.inicio) {
      const d = new Date(out.inicio);
      out.dia = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      if (!out.periodo) out.periodo = periodoFromDate(d);
      if (!out.duracao) out.duracao = out.fim ? durFromMins(Math.round((new Date(out.fim) - d) / 60000)) : 'Ainda a decorrer';
    } else {
      out.dia = todayISO();
    }
  }
  out.periodo = out.periodo || '';
  // Data de fim: deriva do modelo antigo (duracao) quando ainda não existe
  if (!('diaFim' in out) || out.diaFim == null) {
    if (out.duracao && out.duracao !== 'Ainda a decorrer') out.diaFim = out.dia; // terminou (mesmo dia)
    else out.diaFim = ''; // sem fim definido / ainda a decorrer
  }
  delete out.duracao;
  out.localizacao = Array.isArray(out.localizacao) ? out.localizacao : [];
  out.sintomas = Array.isArray(out.sintomas) ? out.sintomas : [];
  out.gatilhos = Array.isArray(out.gatilhos) ? out.gatilhos : [];
  out.medicacao = out.medicacao || '';
  out.frequencia = out.frequencia || '';
  out.eficacia = out.eficacia || '';
  out.tempoEfeito = out.tempoEfeito || '';
  out.notas = out.notas || '';
  if (typeof out.intensidade !== 'number') out.intensidade = 5;
  if (!out.id) out.id = uid();
  delete out.inicio;
  delete out.fim;
  return out;
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw).map(migrate) : [];
  } catch (e) { return []; }
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(crises)); }
  catch (e) { toast('Não foi possível guardar os dados.'); }
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

let crises = load();
let editingId = null;

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
    const d = diaToDate(c.dia);
    return d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear();
  });
  const diasSemCrise = calcDiasSemCrise();
  const intensidades = crises.map(c => c.intensidade).filter(n => typeof n === 'number');
  const media = intensidades.length ? (intensidades.reduce((a, b) => a + b, 0) / intensidades.length) : null;
  const emCurso = crises.find(c => !c.diaFim);

  let html = `
    <div class="brand topbar">
      <img class="brand-logo" src="icons/icon.svg" alt="" width="48" height="48" />
      <div>
        <h1>Diário de Enxaqueca</h1>
        <p class="subtitle" style="margin:2px 0 0">Olá. Como está a sua cabeça hoje?</p>
      </div>
    </div>
  `;

  if (isBackupOverdue()) {
    html += `
      <div class="inline-note" style="align-items:center;justify-content:space-between">
        <span>💾 Faça uma cópia dos seus registos para não os perder.</span>
        <button class="btn btn-ghost" data-nav="dados" style="width:auto;flex:0 0 auto;padding:8px 14px">Fazer cópia</button>
      </div>`;
  }

  if (emCurso) {
    html += `
      <div class="card" style="border-color:var(--warn)">
        <strong>⚠️ Crise ainda a decorrer</strong>
        <p class="hint" style="margin:6px 0 12px">${fmtDia(emCurso.dia)}${emCurso.periodo ? ' · ' + emCurso.periodo : ''}.</p>
        <button class="btn btn-ghost" data-edit="${emCurso.id}">Atualizar / terminar</button>
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
    const recentes = [...crises].sort((a, b) => sortVal(b) - sortVal(a)).slice(0, 3);
    html += recentes.map(crisisCard).join('');
    if (crises.length > 3) {
      html += `<button class="btn btn-ghost" data-nav="historico" style="margin-top:6px">Ver histórico completo (${crises.length})</button>`;
    }
  }

  app.innerHTML = html;
  bindCommon();
}

function calcDiasSemCrise() {
  const dias = crises.map(diaFimDe).filter(Boolean).sort();
  if (!dias.length) return null;
  const ultima = diaToDate(dias[dias.length - 1]);
  const hoje = diaToDate(todayISO());
  return Math.max(0, Math.round((hoje - ultima) / 86400000));
}

/* ======================================================
   VISTA: REGISTAR / EDITAR
   ====================================================== */
function renderRegistar() {
  const editing = editingId ? crises.find(c => c.id === editingId) : null;
  const now = new Date();
  const c = editing || {
    dia: todayISO(),
    periodo: periodoFromDate(now),
    diaFim: todayISO(),
    intensidade: 5,
    localizacao: [],
    sintomas: [],
    gatilhos: [],
    medicacao: '',
    frequencia: '',
    eficacia: '',
    tempoEfeito: '',
    notas: '',
  };
  const savedMeds = getSavedMeds();

  app.innerHTML = `
    <div class="topbar">
      <h1>${editing ? 'Editar crise' : 'Registar crise'}</h1>
      <p class="subtitle">${editing ? 'Atualize os dados desta crise.' : 'Preencha o que souber. Só o dia e a intensidade são obrigatórios.'}</p>
    </div>

    <form id="form-crise" novalidate>
      <div class="card">
        <div class="field">
          <label for="dia">Início da crise *</label>
          <input type="date" id="dia" value="${c.dia}" required />
        </div>
        <div class="field">
          <label>Período do dia</label>
          <div class="chips" id="chips-periodo">
            ${PERIODOS.map(p => `<button type="button" class="chip" data-val="${esc(p)}" aria-pressed="${c.periodo === p}">${esc(p)} <span style="opacity:.6;font-size:.8em">${PERIODO_HORAS[p]}</span></button>`).join('')}
          </div>
        </div>
        <div class="field" style="margin-bottom:0">
          <label for="diaFim">Fim da crise</label>
          <input type="date" id="diaFim" value="${c.diaFim || ''}" />
          <div class="hint">Deixe vazio se a crise ainda está a decorrer.</div>
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
        <div class="field">
          <label for="frequencia">Quantas vezes por dia</label>
          <select id="frequencia">
            <option value="">—</option>
            <option value="1x por dia"${c.frequencia === '1x por dia' ? ' selected' : ''}>1x por dia</option>
            <option value="2x por dia"${c.frequencia === '2x por dia' ? ' selected' : ''}>2x por dia</option>
            <option value="3x por dia"${c.frequencia === '3x por dia' ? ' selected' : ''}>3x por dia</option>
          </select>
        </div>
        <div class="field">
          <label for="eficacia">A medicação ajudou?</label>
          <select id="eficacia">
            <option value="">—</option>
            <option value="Resolveu"${c.eficacia === 'Resolveu' ? ' selected' : ''}>Resolveu a dor</option>
            <option value="Aliviou"${c.eficacia === 'Aliviou' ? ' selected' : ''}>Aliviou parcialmente</option>
            <option value="Não ajudou"${c.eficacia === 'Não ajudou' ? ' selected' : ''}>Não ajudou</option>
          </select>
        </div>
        <div class="field" style="margin-bottom:0">
          <label for="tempoEfeito">Tempo até fazer efeito</label>
          <select id="tempoEfeito">
            <option value="">—</option>
            ${TEMPOS_EFEITO.map(t => `<option value="${esc(t)}"${c.tempoEfeito === t ? ' selected' : ''}>${esc(t)}</option>`).join('')}
          </select>
          <div class="hint">Desde a 1.ª toma até a dor passar (mesmo que tenha tomado vários dias).</div>
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

  // Período: escolha única
  document.querySelectorAll('#chips-periodo .chip').forEach(ch => {
    ch.addEventListener('click', () => {
      const was = ch.getAttribute('aria-pressed') === 'true';
      document.querySelectorAll('#chips-periodo .chip').forEach(o => o.setAttribute('aria-pressed', 'false'));
      ch.setAttribute('aria-pressed', String(!was));
    });
  });

  // Chips de escolha múltipla
  document.querySelectorAll('#chips-loc .chip, #chips-sin .chip, #chips-gat .chip').forEach(ch => {
    ch.addEventListener('click', () => {
      const pressed = ch.getAttribute('aria-pressed') === 'true';
      ch.setAttribute('aria-pressed', String(!pressed));
    });
  });

  document.getElementById('form-crise').addEventListener('submit', onSubmit);
  bindCommon();
}

function addBtn() {
  return `<button class="add-btn" data-nav="registar" aria-label="Registar crise"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>`;
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
function collectSingleChip(containerId) {
  const el = document.querySelector(`#${containerId} .chip[aria-pressed="true"]`);
  return el ? el.dataset.val : '';
}

function onSubmit(e) {
  e.preventDefault();
  const dia = document.getElementById('dia').value;
  if (!dia) { toast('Indique o dia de início da crise.'); return; }
  const diaFim = document.getElementById('diaFim').value;
  if (diaFim && diaFim < dia) { toast('O fim não pode ser antes do início.'); return; }

  const data = {
    dia,
    diaFim,
    periodo: collectSingleChip('chips-periodo'),
    intensidade: +document.getElementById('intensidade').value,
    localizacao: collectChips('chips-loc'),
    sintomas: collectChips('chips-sin'),
    gatilhos: collectChips('chips-gat'),
    medicacao: document.getElementById('medicacao').value.trim(),
    frequencia: document.getElementById('frequencia').value,
    eficacia: document.getElementById('eficacia').value,
    tempoEfeito: document.getElementById('tempoEfeito').value,
    notas: document.getElementById('notas').value.trim(),
  };

  if (editingId) {
    const idx = crises.findIndex(c => c.id === editingId);
    if (idx >= 0) crises[idx] = Object.assign({}, crises[idx], data);
    toast('Crise atualizada.');
  } else {
    crises.push(Object.assign({ id: uid(), criadoEm: new Date().toISOString() }, data));
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

  const sorted = [...crises].sort((a, b) => sortVal(b) - sortVal(a));
  let html = `<div class="page-head topbar"><div><h1>Histórico</h1><p class="subtitle">${crises.length} ${crises.length === 1 ? 'registo' : 'registos'} no total.</p></div>${addBtn()}</div>`;

  let lastKey = '';
  for (const c of sorted) {
    const d = diaToDate(c.dia);
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
  if (c.medicacao) tags.push('💊 ' + c.medicacao + (c.frequencia ? ' · ' + c.frequencia : ''));
  if (c.tempoEfeito) tags.push('⏱ efeito: ' + c.tempoEfeito);
  const meta = !c.diaFim
    ? '<span class="ongoing">Ainda a decorrer</span>'
    : 'Duração: ' + duracaoTexto(c);
  return `
    <div class="crisis">
      <div class="intensity" style="background:${intensityColor(c.intensidade)}">${c.intensidade}</div>
      <div class="body">
        <div class="when">${fmtDia(c.dia)}${c.periodo ? ' · ' + esc(c.periodo) : ''}</div>
        ${meta ? `<div class="meta">${meta}</div>` : ''}
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

  // Período mais comum
  const periodoCounts = PERIODOS.map(p => [p, crises.filter(c => c.periodo === p).length]);
  const topPeriodo = [...periodoCounts].filter(x => x[1] > 0).sort((a, b) => b[1] - a[1])[0];

  // Últimos 6 meses
  const now = new Date();
  const buckets = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ y: d.getFullYear(), m: d.getMonth(), count: 0 });
  }
  crises.forEach(c => {
    const d = diaToDate(c.dia);
    const b = buckets.find(x => x.y === d.getFullYear() && x.m === d.getMonth());
    if (b) b.count++;
  });
  const maxCount = Math.max(1, ...buckets.map(b => b.count));

  const topGat = topCounts(crises.flatMap(c => c.gatilhos || []));
  const topSin = topCounts(crises.flatMap(c => c.sintomas || []));

  let html = `
    <div class="page-head topbar"><div><h1>Estatísticas</h1><p class="subtitle">Padrões a partir dos seus ${total} registos.</p></div>${addBtn()}</div>

    <div class="stats-grid" style="margin-bottom:14px">
      <div class="stat"><span class="num">${total}</span><span class="lbl">crises</span></div>
      <div class="stat"><span class="num">${mediaInt}</span><span class="lbl">intensidade média</span></div>
      <div class="stat"><span class="num" style="font-size:1.05rem">${topPeriodo ? esc(topPeriodo[0]) : '—'}</span><span class="lbl">período mais comum</span></div>
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

  // Por período do dia
  const maxPer = Math.max(1, ...periodoCounts.map(p => p[1]));
  if (periodoCounts.some(p => p[1] > 0)) {
    html += `
      <div class="card">
        <h2 style="margin-top:0">Por período do dia</h2>
        ${periodoCounts.map(([name, n]) => barRow(name, n, maxPer)).join('')}
      </div>`;
  }

  // Duração
  const CATS = ['Mesmo dia', '2–3 dias', '4+ dias', 'Ainda a decorrer'];
  const durCounts = CATS.map(d => [d, crises.filter(c => duracaoCategoria(c) === d).length]).filter(x => x[1] > 0);
  if (durCounts.length) {
    const maxDur = Math.max(...durCounts.map(d => d[1]));
    html += `
      <div class="card">
        <h2 style="margin-top:0">Duração das crises</h2>
        ${durCounts.map(([name, n]) => barRow(name, n, maxDur)).join('')}
      </div>`;
  }

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

  // Tempo até fazer efeito
  const comEfeito = crises.filter(c => c.tempoEfeito);
  if (comEfeito.length) {
    const counts = TEMPOS_EFEITO.map(t => [t, comEfeito.filter(c => c.tempoEfeito === t).length]).filter(x => x[1] > 0);
    const maxE = Math.max(...counts.map(c => c[1]));
    html += `
      <div class="card">
        <h2 style="margin-top:0">Tempo até fazer efeito</h2>
        ${counts.map(([name, n]) => barRow(name, n, maxE)).join('')}
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

/* ======================================================
   VISTA: DADOS
   ====================================================== */
function renderDados() {
  app.innerHTML = `
    <div class="topbar">
      <h1>Os seus dados</h1>
      <p class="subtitle">Tudo é guardado apenas neste dispositivo.</p>
    </div>

    <div class="inline-note">
      🔒 Os registos ficam no seu telemóvel. Nada é enviado para a internet. Faça cópias de segurança de vez em quando.
    </div>

    <div class="card">
      <h2 style="margin-top:0">Cópia de segurança</h2>
      <p class="hint" style="margin-top:0">${backupStatusText()}</p>
      <button class="btn btn-primary" id="share-backup">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M12 3v13M8 7l4-4 4 4"/></svg>
        Partilhar cópia
      </button>
      <p class="hint" style="margin:10px 0 0">Envie a cópia para outro dispositivo (AirDrop, email, etc.) e abra-a lá em <strong>Restaurar</strong>.</p>
      <div class="btn-row">
        <button class="btn btn-ghost" id="exp-json">Guardar (.json)</button>
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

  document.getElementById('share-backup').addEventListener('click', shareBackup);
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

/* ---------- Cópias de segurança ---------- */
const BACKUP_KEY = 'enxaq.lastBackup';
function backupInfo() {
  let ts = 0;
  try { ts = +localStorage.getItem(BACKUP_KEY) || 0; } catch (e) {}
  if (!ts) return { never: true };
  return { never: false, dias: Math.floor((Date.now() - ts) / 86400000) };
}
function markBackup() {
  try { localStorage.setItem(BACKUP_KEY, String(Date.now())); } catch (e) {}
  if (currentView === 'dados') renderDados();
}
function isBackupOverdue() {
  if (!crises.length) return false;
  const bi = backupInfo();
  return bi.never || bi.dias >= 30;
}
function backupStatusText() {
  if (!crises.length) return 'Ainda não há registos para guardar.';
  const bi = backupInfo();
  const n = `${crises.length} ${crises.length === 1 ? 'registo' : 'registos'}`;
  if (bi.never) return `Tem ${n} e ainda não fez nenhuma cópia.`;
  if (bi.dias === 0) return `Última cópia: hoje · ${n}.`;
  return `Última cópia: há ${bi.dias} ${bi.dias === 1 ? 'dia' : 'dias'} · ${n}.`;
}
async function shareBackup() {
  if (!crises.length) { toast('Não há registos para partilhar.'); return; }
  const text = JSON.stringify(crises, null, 2);
  const name = `enxaqueca-${stamp()}.json`;
  try {
    const file = new File([text], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Cópia do Diário de Enxaqueca' });
      markBackup();
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return; // utilizador cancelou
  }
  // Sem partilha de ficheiros (ex.: computador): descarrega o ficheiro
  download(name, text, 'application/json');
  markBackup();
  toast('Ficheiro guardado.');
}
function exportJSON() {
  if (!crises.length) { toast('Não há registos para exportar.'); return; }
  download(`enxaqueca-${stamp()}.json`, JSON.stringify(crises, null, 2), 'application/json');
  markBackup();
  toast('Ficheiro exportado.');
}
function exportCSV() {
  if (!crises.length) { toast('Não há registos para exportar.'); return; }
  const cols = ['dia', 'diaFim', 'periodo', 'intensidade', 'localizacao', 'sintomas', 'gatilhos', 'medicacao', 'frequencia', 'eficacia', 'tempoEfeito', 'notas'];
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
      const clean = data.filter(c => c && (c.dia || c.inicio)).map(migrate);
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
}

/* ---------- Service worker ---------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

/* ---------- Arranque ---------- */
go('inicio');
