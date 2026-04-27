/**
 * renderers.js — DOM and SVG rendering from lesson JSON.
 * 4.21 更新：
 *  - Learning Steps 模块（页面顶部完整版）
 *  - Sticky sidebar（精简步骤）
 *  - 最小化概念区
 *  - Sentence card 新增 sentence purpose
 *  - Focus word 加粗
 *  - Hover 分析框显示 Start / Focus / End（替代大 tooltip）
 *  - Task prompt 区块
 */

'use strict';

import {
  SVG_LAYOUT,
  getGroupSegmentX,
  normalizeYToPixel,
  getColorForMovement,
  resolveContourStrategy,
  svgEl,
  chipId,
} from './utils.js?v=422';

import {
  CONTROLS,
  CONCEPT_PANEL,
  PITCH_TOOLTIPS,
  LEGEND,
  LEARNING_STEPS,
  LEARNING_STEPS_SIDEBAR,
  ANALYSIS_LABELS,
  TASK_PROMPT,
  SOURCE_CONTEXT,
} from './ui-content.js?v=422';

/* ── Public API ───────────────────────────────────────────────── */
export function renderLesson(lesson, callbacks, root) {
  root.innerHTML = '';

  root.appendChild(renderSidebar());
  root.appendChild(renderHeader(lesson));
  root.appendChild(renderLearningSteps());
  root.appendChild(renderConceptPanel(callbacks.onStep1Done));
  root.appendChild(renderControls());
  root.appendChild(renderSourceContext());
  

  const sentencesEl = document.createElement('div');
  sentencesEl.className = 'lesson-sentences';
  sentencesEl.id = 'lesson-sentences';
  for (const sentence of lesson.sentences) {
    sentencesEl.appendChild(renderSentenceCard(sentence, lesson.ui, callbacks));
  }
  root.appendChild(sentencesEl);
  root.appendChild(renderTaskPrompt());

  if (lesson.ui?.showLegend) root.appendChild(renderLegend());
}

/* ── Sidebar ──────────────────────────────────────────────────── */
function renderSidebar() {
  const sidebar = document.createElement('div');
  sidebar.className = 'steps-sidebar';
  sidebar.id = 'steps-sidebar';

  LEARNING_STEPS_SIDEBAR.forEach((step, idx) => {
    const fullStep = LEARNING_STEPS.steps[idx] ?? step;
    const item = document.createElement('div');
    item.className = 'sidebar-step';
    item.dataset.step = String(idx + 1);

    const num = document.createElement('div');
    num.className = 'sidebar-num';
    num.innerHTML = `<span class="sidebar-num-text">${step.number}</span><span class="sidebar-check" aria-hidden="true">✓</span>`;

    const labelEl = document.createElement('div');
    labelEl.className = 'sidebar-step-label';
    labelEl.textContent = step.label;

    const detailEl = document.createElement('div');
    detailEl.className = 'sidebar-step-detail';
    detailEl.innerHTML = fullStep.detail ?? '';

    item.appendChild(num);
    item.appendChild(labelEl);
    item.appendChild(detailEl);
    sidebar.appendChild(item);
  });

  // Playback controls divider + buttons
  const divider = document.createElement('div');
  divider.className = 'sidebar-divider';
  sidebar.appendChild(divider);

  const controls = document.createElement('div');
  controls.className = 'sidebar-playback';
  controls.innerHTML = `
    <button class="sb-btn" id="sb-play" title="${CONTROLS.playAll}">
      <span class="icon-play" aria-hidden="true"></span>
      <span class="sb-btn-label">${CONTROLS.playAll}</span>
    </button>
    <button class="sb-btn" id="sb-pause" disabled title="${CONTROLS.pause}">
      <span class="icon-pause" aria-hidden="true"><span></span><span></span></span>
      <span class="sb-btn-label">${CONTROLS.pause}</span>
    </button>
    <button class="sb-btn" id="sb-continue" title="${CONTROLS.continue}">
      <span class="icon-play" aria-hidden="true"></span>
      <span class="sb-btn-label">${CONTROLS.continue}</span>
    </button>
    <div class="sb-progress"><div class="sb-progress-fill" id="sb-progress-fill"></div></div>
  `;
  sidebar.appendChild(controls);

  return sidebar;
}

/* ── Header ───────────────────────────────────────────────────── */
function renderHeader(lesson) {
  const header = document.createElement('header');
  header.className = 'lesson-header';

  const title = document.createElement('h1');
  title.className = 'lesson-title';
  title.textContent = lesson.title;
  header.appendChild(title);

  if (lesson.instructions) {
    const inst = document.createElement('p');
    inst.className = 'lesson-instructions';
    inst.innerHTML = lesson.instructions;
    header.appendChild(inst);
  }

  return header;
}

/* ── Learning Steps (full) ────────────────────────────────────── */
function renderLearningSteps() {
  const wrap = document.createElement('div');
  wrap.className = 'learning-steps';
  wrap.id = 'learning-steps';

  const heading = document.createElement('div');
  heading.className = 'learning-steps-heading';
  heading.textContent = LEARNING_STEPS.heading;
  wrap.appendChild(heading);

  const list = document.createElement('div');
  list.className = 'steps-list';

  LEARNING_STEPS.steps.forEach(step => {
    const item = document.createElement('div');
    item.className = 'step-item';

    const num = document.createElement('div');
    num.className = 'step-num';
    num.textContent = step.number;

    const body = document.createElement('div');
    body.className = 'step-body';

    const lbl = document.createElement('div');
    lbl.className = 'step-label';
    lbl.textContent = step.label;

    const det = document.createElement('div');
    det.className = 'step-detail';
    det.innerHTML = step.detail;

    body.appendChild(lbl);
    body.appendChild(det);
    item.appendChild(num);
    item.appendChild(body);
    list.appendChild(item);
  });

  wrap.appendChild(list);
  return wrap;
}

/* ── Concept panel — accordion ────────────────────────────────── */
function renderConceptPanel(onAllExpanded) {
  const panel = document.createElement('div');
  panel.className = 'concept-panel';

  const titleRow = document.createElement('div');
  titleRow.className = 'concept-panel-title-row';

  const title = document.createElement('div');
  title.className = 'concept-panel-title';
  title.textContent = CONCEPT_PANEL.thoughtGroup.title;
  titleRow.appendChild(title);

  const doneBadge = document.createElement('div');
  doneBadge.className = 'concept-done-badge';
  doneBadge.textContent = '✓ Done';
  doneBadge.setAttribute('aria-hidden', 'true');
  titleRow.appendChild(doneBadge);
  panel.appendChild(titleRow);

  const expandedSet = new Set();
  const total = CONCEPT_PANEL.thoughtGroup.items.length;

  CONCEPT_PANEL.thoughtGroup.items.forEach((item, idx) => {
    const cell = document.createElement('div');
    cell.className = 'concept-accordion';
    cell.setAttribute('role', 'button');
    cell.tabIndex = 0;
    cell.setAttribute('aria-expanded', 'false');

    const header = document.createElement('div');
    header.className = 'concept-accordion-header';

    const term = document.createElement('div');
    term.className = 'concept-term';
    term.textContent = item.term;

    const chevron = document.createElement('span');
    chevron.className = 'concept-chevron';
    chevron.setAttribute('aria-hidden', 'true');
    chevron.textContent = '▸';

    header.appendChild(term);
    header.appendChild(chevron);

    const body = document.createElement('div');
    body.className = 'concept-accordion-body';

    const def = document.createElement('div');
    def.className = 'concept-def';
    def.textContent = item.def;
    body.appendChild(def);

    cell.appendChild(header);
    cell.appendChild(body);

    const toggle = () => {
      if (cell.classList.contains('is-open')) return;
      cell.classList.add('is-open');
      cell.setAttribute('aria-expanded', 'true');
      expandedSet.add(idx);
      if (expandedSet.size === total) {
        doneBadge.classList.add('is-visible');
        onAllExpanded?.();
      }
    };

    cell.addEventListener('click', toggle);
    cell.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });

    panel.appendChild(cell);
  });

  return panel;
}

/* ── Controls ─────────────────────────────────────────────────── */
function renderControls() {
  const bar = document.createElement('div');
  bar.className = 'controls';

  bar.innerHTML = `
    <button class="btn" id="btn-play" aria-label="${CONTROLS.playAll}">
      <span class="icon-play" aria-hidden="true"></span> ${CONTROLS.playAll}
    </button>
    <button class="btn" id="btn-pause" disabled aria-label="${CONTROLS.pause}">
      <span class="icon-pause" aria-hidden="true"><span></span><span></span></span> ${CONTROLS.pause}
    </button>
    <button class="btn" id="btn-continue" aria-label="${CONTROLS.continue}">
      <span class="icon-play" aria-hidden="true"></span> ${CONTROLS.continue}
    </button>
    <div class="progress-bar" role="progressbar" aria-label="Playback progress">
      <div class="progress-fill" id="progress-fill"></div>
    </div>
  `;

  return bar;
}

/* ── Task prompt ──────────────────────────────────────────────── */
function renderTaskPrompt() {
  const wrap = document.createElement('div');
  wrap.className = 'task-prompt';

  const heading = document.createElement('div');
  heading.className = 'task-prompt-heading';
  heading.textContent = TASK_PROMPT.heading;
  wrap.appendChild(heading);

  const body = document.createElement('p');
  body.className = 'task-prompt-body';
  body.innerHTML = TASK_PROMPT.body;
  wrap.appendChild(body);

  return wrap;
}

/* ── Source context ───────────────────────────────────────────── */
function renderSourceContext() {
  const wrap = document.createElement('div');
  wrap.className = 'source-context';

  const heading = document.createElement('div');
  heading.className = 'source-context-heading';
  heading.textContent = SOURCE_CONTEXT.heading;
  wrap.appendChild(heading);

  const body = document.createElement('p');
  body.className = 'source-context-body';
  body.innerHTML = SOURCE_CONTEXT.body;
  wrap.appendChild(body);

  return wrap;
}

/* ── Sentence card ────────────────────────────────────────────── */
export function renderSentenceCard(sentence, uiOptions, callbacks) {
  const card = document.createElement('div');
  card.className = 'sentence-card';
  card.id = `card-${sentence.sentenceId}`;
  card.setAttribute('data-sentence-id', sentence.sentenceId);

  // Sentence purpose row (if present)
  if (sentence.purpose) {
    const purpose = document.createElement('div');
    purpose.className = 'sentence-purpose';
    purpose.textContent = sentence.purpose;
    card.appendChild(purpose);
  }

  card.appendChild(renderThoughtGroups(sentence, callbacks));
  card.appendChild(renderContour(sentence, uiOptions));

  return card;
}

/* ── Thought groups ───────────────────────────────────────────── */
export function renderThoughtGroups(sentence, callbacks) {
  const top = document.createElement('div');
  top.className = 'sentence-top';

  const badge = document.createElement('span');
  badge.className = 'sentence-badge';
  badge.textContent = sentence.badge || `S${sentence.order}`;
  badge.setAttribute('aria-hidden', 'true');
  top.appendChild(badge);

  const row = document.createElement('div');
  row.className = 'tg-row';

  sentence.thoughtGroups.forEach((group, idx) => {
    if (idx > 0) {
      const sep = document.createElement('span');
      sep.className = 'tg-sep';
      sep.textContent = '|';
      sep.setAttribute('aria-hidden', 'true');
      row.appendChild(sep);
    }

    const wrap = document.createElement('div');
    wrap.className = 'tg-tooltip-wrap';

    const chip = document.createElement('div');
    chip.className = 'tg-chip';
    chip.id = chipId(sentence.sentenceId, group.groupId);
    chip.tabIndex = 0;
    chip.setAttribute('role', 'button');
    chip.setAttribute('aria-label', `Play: ${group.text}`);
    chip.setAttribute('data-sentence-id', sentence.sentenceId);
    chip.setAttribute('data-group-id', group.groupId);

    // Chip text — bold focus words
    const chipText = document.createElement('span');
    chipText.className = 'tg-chip-text';
    chipText.innerHTML = renderTextWithFocus(group.text, group.focusWord ?? group.focus_word ?? group.focus ?? null);
    chip.appendChild(chipText);


    chip.addEventListener('click', () => callbacks.onChipClick(sentence.sentenceId, group.groupId));
    chip.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); callbacks.onChipClick(sentence.sentenceId, group.groupId); }
    });
    chip.addEventListener('animationend', () => chip.classList.remove('is-pulsing'));

    // Compact analysis tooltip (replaces old verbose tooltip)
    const tooltip = buildAnalysisTooltip(group);
    wrap.appendChild(chip);
    wrap.appendChild(tooltip);
    row.appendChild(wrap);
  });

  top.appendChild(row);
  return top;
}

/* ── Focus word bolding ───────────────────────────────────────── */
function renderTextWithFocus(text, focusWord) {
  if (!focusWord) return escapeHtml(text);
  // Case-insensitive match of focus word in text
  const escaped = escapeHtml(text);
  const escapedFocus = escapeHtml(focusWord);
  const regex = new RegExp(`(${escapedFocus.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'i');
  return escaped.replace(regex, '<strong class="focus-word">$1</strong>');
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── Format a pitch label string with icon ────────────────────── */
function formatPitchLabel(raw) {
  if (!raw) return null;
  const s = raw.toLowerCase();
  const icon = s.includes('rising')  ? '↑'
             : s.includes('falling') ? '↓'
             : '—';
  return `${icon} ${raw}`;
}

function directionFromLabel(raw) {
  const s = (raw ?? '').toLowerCase();
  if (s.includes('rising'))  return 'rising';
  if (s.includes('falling')) return 'falling';
  return 'level';
}

/* ── Analysis tooltip: Start / Focus / End ────────────────────── */
function buildAnalysisTooltip(group) {
  const tooltip = document.createElement('div');
  tooltip.className = 'tg-tooltip';
  tooltip.setAttribute('role', 'tooltip');

  // START — only shown if group.startLabel is explicitly set in JSON
  const startFormatted = formatPitchLabel(group.startLabel ?? null);
  if (startFormatted) {
    tooltip.appendChild(buildAnalysisRow(ANALYSIS_LABELS.start, startFormatted));
  }

  // FOCUS — group.focusWord (resolved from pitchMovement.focus or top-level focus)
  const focusWord = group.focusWord ?? null;
  if (focusWord) {
    tooltip.appendChild(buildAnalysisRow(ANALYSIS_LABELS.focus, focusWord));
  }

  // END — only shown if group.endLabel is explicitly set in JSON
  const endFormatted = formatPitchLabel(group.endLabel ?? null);
  if (endFormatted) {
    tooltip.appendChild(buildAnalysisRow(ANALYSIS_LABELS.end, endFormatted));
  }

  // REASON — from JSON reason field
  const reason = group.reason ?? group.llm_reason ?? null;
  if (reason) {
    const reasonEl = document.createElement('div');
    reasonEl.className = 'tg-tooltip-reason';
    reasonEl.textContent = reason;
    tooltip.appendChild(reasonEl);
  } else {
    // Fallback: generic description based on pitchMovement.label
    const dir = directionFromLabel(group.pitchMovement?.label);
    const descEl = document.createElement('div');
    descEl.className = 'tg-tooltip-reason';
    descEl.textContent = PITCH_TOOLTIPS[dir] ?? '';
    tooltip.appendChild(descEl);
  }

  return tooltip;
}

function buildAnalysisRow(label, value) {
  const row = document.createElement('div');
  row.className = 'tg-analysis-row';
  row.innerHTML = `<span class="tg-analysis-key">${label}:</span><span class="tg-analysis-val">${escapeHtml(value)}</span>`;
  return row;
}

/* ── Contour SVG ──────────────────────────────────────────────── */
export function renderContour(sentence, uiOptions) {
  const bottom = document.createElement('div');
  bottom.className = 'sentence-bottom';

  const L = SVG_LAYOUT;
  const groups = sentence.thoughtGroups;
  const n = groups.length;
  const sid = sentence.sentenceId;

  const svg = svgEl('svg', {
    class:        'contour-svg',
    viewBox:      `0 0 ${L.viewBoxW} ${L.viewBoxH}`,
    'aria-label': `Pitch contour for sentence ${sentence.badge || sentence.order}`,
  });

  const defs = svgEl('defs');
  defs.appendChild(buildArrowMarker(`au-${sid}`, 'up',   '#e07b00'));
  defs.appendChild(buildArrowMarker(`ad-${sid}`, 'down', '#1a6b36'));
  svg.appendChild(defs);

  // Guide lines
  for (const y of [L.guideYHi, L.guideYMi, L.guideYLo]) {
    svg.appendChild(svgEl('line', {
      x1: String(L.innerLeft - 2), y1: String(y),
      x2: String(L.innerRight + 6), y2: String(y),
      stroke: '#ede9df', 'stroke-width': '0.5',
    }));
  }

  // Guide labels
  const guideLabels = ['Hi', 'Mi', 'Lo'];
  [L.guideYHi, L.guideYMi, L.guideYLo].forEach((y, i) => {
    const t = svgEl('text', { x: '4', y: String(y + 4), 'font-size': '8', fill: '#ccc9be', 'font-family': 'inherit' });
    t.textContent = guideLabels[i];
    svg.appendChild(t);
  });

  groups.forEach((group, idx) => {
    const { x1, x2, midX } = getGroupSegmentX(idx, n);
    const colors   = getColorForMovement(group.pitchMovement?.label);
    const strategy = resolveContourStrategy(group.pitchMovement);

    if (idx > 0) {
      svg.appendChild(svgEl('line', {
        id: `div-${sid}-${idx}`,
        x1: String(x1), y1: '8', x2: String(x1), y2: '100',
        stroke: '#e0ded6', 'stroke-width': '0.5', 'stroke-dasharray': '3 4',
        style: 'opacity:0;transition:opacity 0.28s',
      }));
    }

    if (strategy?.type === 'polyline' && strategy.pts?.length >= 2) {
      const segW   = x2 - x1;
      const svgPts = strategy.pts.map(p => ({
        px:   x1 + p.x * segW,
        py:   normalizeYToPixel(p.y),
        role: p.role ?? null,
      }));

      const pointsStr = svgPts.map(p => `${p.px},${p.py}`).join(' ');
      let pathLen = 0;
      for (let i = 1; i < svgPts.length; i++) {
        const dx = svgPts[i].px - svgPts[i-1].px;
        const dy = svgPts[i].py - svgPts[i-1].py;
        pathLen += Math.sqrt(dx*dx + dy*dy);
      }
      pathLen = Math.ceil(pathLen) + 2;

      const polyline = svgEl('polyline', {
        id: `line-${sid}-${idx}`, points: pointsStr,
        fill: 'none', stroke: colors.stroke, 'stroke-width': '3.5',
        'stroke-linecap': 'round', 'stroke-linejoin': 'round',
        'stroke-dasharray': String(pathLen), 'stroke-dashoffset': String(pathLen),
      });
      polyline.dataset.pathLen = pathLen;
      svg.appendChild(polyline);

      const last = svgPts[svgPts.length - 1];
      svg.appendChild(svgEl('circle', {
        id: `dot-end-${sid}-${idx}`,
        cx: String(last.px), cy: String(last.py),
        r: '4.5', fill: '#fff', stroke: colors.stroke, 'stroke-width': '2', opacity: '0',
      }));

      if (svgPts.length > 2) {
        svgPts.slice(1, -1).forEach((p, midI) => {
          svg.appendChild(svgEl('circle', {
            id: `dot-mid-${sid}-${idx}-${midI}`,
            cx: String(p.px), cy: String(p.py),
            r: '3', fill: '#fff', stroke: colors.stroke, 'stroke-width': '1.5', opacity: '0',
          }));
        });
      }
    }

    // Movement labels (Rising / Falling / Level)
    if (uiOptions?.showMovementLabels) {
      const labelG = svgEl('g', { id: `lbl-${sid}-${idx}`, style: 'opacity:0;transition:opacity 0.55s' });
      const movLabel = (group.pitchMovement?.label || '').toLowerCase();

      if (strategy?.type === 'polyline' && strategy.pts?.length >= 2) {
        const midPy = strategy.pts.reduce((sum, p) => sum + normalizeYToPixel(p.y), 0) / strategy.pts.length;

        if (movLabel.includes('rising')) {
          labelG.appendChild(svgEl('line', { x1: String(midX), y1: String(midPy + 14), x2: String(midX), y2: String(midPy - 2), stroke: colors.text, 'stroke-width': '1.2', 'marker-end': `url(#au-${sid})` }));
          const t = svgEl('text', { x: String(midX + 8), y: String(midPy + 10), 'font-size': '10.5', 'font-weight': '600', fill: colors.text, 'font-family': 'inherit' });
          t.textContent = 'Rising'; labelG.appendChild(t);
        } else if (movLabel.includes('falling')) {
          labelG.appendChild(svgEl('line', { x1: String(midX), y1: String(midPy - 14), x2: String(midX), y2: String(midPy), stroke: colors.text, 'stroke-width': '1.2', 'marker-end': `url(#ad-${sid})` }));
          const t = svgEl('text', { x: String(midX + 8), y: String(midPy - 4), 'font-size': '10.5', 'font-weight': '600', fill: colors.text, 'font-family': 'inherit' });
          t.textContent = 'Falling'; labelG.appendChild(t);
        } else {
          const t = svgEl('text', { x: String(midX), y: String(L.guideYHi - 6), 'text-anchor': 'middle', 'font-size': '10', 'font-weight': '500', fill: colors.text, 'font-family': 'inherit' });
          t.textContent = movLabel.charAt(0).toUpperCase() + movLabel.slice(1) || 'Level';
          labelG.appendChild(t);
        }
      }
      svg.appendChild(labelG);
    }

    if (uiOptions?.showGroupLabels) {
      const t = svgEl('text', { x: String(midX), y: String(L.viewBoxH - 2), 'text-anchor': 'middle', 'font-size': '9', fill: '#ccc9be', 'font-family': 'inherit' });
      t.textContent = `group ${idx + 1}`;
      svg.appendChild(t);
    }
  });

  bottom.appendChild(svg);
  return bottom;
}

/* ── Legend ───────────────────────────────────────────────────── */
function renderLegend() {
  const legend = document.createElement('div');
  legend.className = 'lesson-legend';
  legend.setAttribute('aria-label', 'Contour legend');

  LEGEND.forEach(item => {
    const li = document.createElement('div');
    li.className = 'legend-item';
    if (item.type === 'focus-word') {
      li.innerHTML = `<div class="legend-focus-icon"><strong>A</strong></div><span class="legend-focus-label">${item.label}</span>`;
    } else if (item.type === 'box') {
      li.innerHTML = `<div class="legend-box"></div><span>${item.label}</span>`;
    } else if (item.type === 'click') {
      li.innerHTML = `<div class="legend-click"><div class="legend-click-tri"></div></div><span>${item.label}</span>`;
    }
    legend.appendChild(li);
  });

  return legend;
}

/* ── Arrow marker ─────────────────────────────────────────────── */
function buildArrowMarker(id, dir, color) {
  const isUp = dir === 'up';
  const m = svgEl('marker', { id, viewBox: '0 0 10 10', refX: '5', refY: isUp ? '9' : '1', markerWidth: '5', markerHeight: '5', orient: 'auto' });
  m.appendChild(svgEl('path', { d: isUp ? 'M1 8L5 1L9 8' : 'M1 2L5 9L9 2', fill: 'none', stroke: color, 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
  return m;
}