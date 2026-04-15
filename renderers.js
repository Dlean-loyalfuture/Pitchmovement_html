/**
 * renderers.js — DOM and SVG rendering from lesson JSON.
 * Stateless: every function takes data and returns DOM nodes or mutates SVG.
 * Does not import playback logic; receives callbacks instead.
 *
 * 静态文字全部来自 ui-content.js，此文件不再包含任何面向用户的硬编码字符串。
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
  clipId,
  clipRectId,
} from './utils.js';

import {
  CONTROLS,
  CONCEPT_PANEL,
  PITCH_TOOLTIPS,
  LEGEND,
} from './ui-content.js';

/* ── Public API ───────────────────────────────────────────────── */

/**
 * Render the full lesson into #app.
 * @param {object} lesson     — parsed lesson JSON
 * @param {object} callbacks  — { onChipClick(sentenceId, groupId) }
 * @param {HTMLElement} root  — container element
 */
export function renderLesson(lesson, callbacks, root) {
  root.innerHTML = '';

  // Header
  const header = renderHeader(lesson);
  root.appendChild(header);

  // Concept panel (pitch movement types overview)
  root.appendChild(renderConceptPanel());
  
  // Controls
  const controls = renderControls();
  root.appendChild(controls);

  // Sentence cards
  const sentencesEl = document.createElement('div');
  sentencesEl.className = 'lesson-sentences';
  sentencesEl.id = 'lesson-sentences';

  for (const sentence of lesson.sentences) {
    const card = renderSentenceCard(sentence, lesson.ui, callbacks);
    sentencesEl.appendChild(card);
  }
  root.appendChild(sentencesEl);

  // Legend
  if (lesson.ui?.showLegend) {
    root.appendChild(renderLegend());
  }
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

/* ── Tooltip builder ──────────────────────────────────────────── */
function buildTooltip(group) {
  const tooltip = document.createElement('div');
  tooltip.className = 'tg-tooltip';
  tooltip.setAttribute('role', 'tooltip');

  const pm       = group.pitchMovement;
  const rawLabel = (pm?.label ?? 'level').toLowerCase();
  const baseKey  = rawLabel.includes('rising')  ? 'rising'
                 : rawLabel.includes('falling') ? 'falling'
                 : 'level';

  // Label line
  const labelEl = document.createElement('div');
  labelEl.className = 'tg-tooltip-label';
  const icon = baseKey === 'rising' ? '↑' : baseKey === 'falling' ? '↓' : '—';
  labelEl.textContent = `${icon} ${pm?.label ?? 'level'}`;
  tooltip.appendChild(labelEl);

  // General description — from ui-content.js
  const descEl = document.createElement('div');
  descEl.className = 'tg-tooltip-desc';
  descEl.textContent = PITCH_TOOLTIPS[baseKey] ?? '';
  tooltip.appendChild(descEl);

  // Per-group reason from JSON
  const reason = group.llm_reason ?? group.reason ?? pm?.reason ?? null;
  if (reason) {
    const reasonEl = document.createElement('div');
    reasonEl.className = 'tg-tooltip-reason';
    reasonEl.textContent = reason;
    tooltip.appendChild(reasonEl);
  }

  return tooltip;
}

/* ── Concept panel ────────────────────────────────────────────── */
function renderConceptPanel() {
  const panel = document.createElement('div');
  panel.className = 'concept-panel';

  const { thoughtGroup, pitchMovement } = CONCEPT_PANEL;

  // ── Section 1: What is a thought group ──
  const sec1Title = document.createElement('div');
  sec1Title.className = 'concept-panel-title';
  sec1Title.textContent = thoughtGroup.title;
  panel.appendChild(sec1Title);

  const tgDesc = document.createElement('p');
  tgDesc.className = 'concept-tg-desc';
  tgDesc.innerHTML = thoughtGroup.description;
  panel.appendChild(tgDesc);

  const tgFacts = document.createElement('div');
  tgFacts.className = 'concept-facts';
  thoughtGroup.facts.forEach(f => {
    const row = document.createElement('div');
    row.className = 'concept-fact-row';
    row.innerHTML =
      `<span class="concept-fact-icon">${f.icon}</span>` +
      `<span class="concept-fact-text">${f.text}</span>`;
    tgFacts.appendChild(row);
  });
  panel.appendChild(tgFacts);

  // ── Divider ──
  const divider = document.createElement('div');
  divider.className = 'concept-divider';
  panel.appendChild(divider);

  // ── Section 2: Pitch movement types ──
  const sec2Title = document.createElement('div');
  sec2Title.className = 'concept-panel-title';
  sec2Title.textContent = pitchMovement.title;
  panel.appendChild(sec2Title);

  const items = document.createElement('div');
  items.className = 'concept-items';

  pitchMovement.types.forEach(c => {
    const item = document.createElement('div');
    item.className = 'concept-item';

    const badge = document.createElement('span');
    badge.className = `concept-badge pm-${c.key}`;
    badge.textContent = c.badge;

    const desc = document.createElement('span');
    desc.style.color = 'var(--text-secondary)';
    desc.textContent = c.desc;

    item.appendChild(badge);
    item.appendChild(desc);
    items.appendChild(item);
  });

  panel.appendChild(items);
  return panel;
}

/* ── Global controls ──────────────────────────────────────────── */
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
    <button class="btn" id="btn-replay" aria-label="${CONTROLS.replay}">
      <span class="icon-replay" aria-hidden="true">↺</span> ${CONTROLS.replay}
    </button>
    <div class="progress-bar" role="progressbar" aria-label="Playback progress">
      <div class="progress-fill" id="progress-fill"></div>
    </div>
  `;

  return bar;
}

/* ── Sentence card ────────────────────────────────────────────── */
export function renderSentenceCard(sentence, uiOptions, callbacks) {
  const card = document.createElement('div');
  card.className = 'sentence-card';
  card.id = `card-${sentence.sentenceId}`;
  card.setAttribute('data-sentence-id', sentence.sentenceId);

  // Text row
  card.appendChild(renderThoughtGroups(sentence, callbacks));

  // Contour row
  card.appendChild(renderContour(sentence, uiOptions));

  return card;
}

/* ── Thought groups ───────────────────────────────────────────── */
export function renderThoughtGroups(sentence, callbacks) {
  const top = document.createElement('div');
  top.className = 'sentence-top';

  // Badge
  const badge = document.createElement('span');
  badge.className = 'sentence-badge';
  badge.textContent = sentence.badge || `S${sentence.order}`;
  badge.setAttribute('aria-hidden', 'true');
  top.appendChild(badge);

  // Chips row
  const row = document.createElement('div');
  row.className = 'tg-row';

  sentence.thoughtGroups.forEach((group, idx) => {
    // Separator before groups after the first
    if (idx > 0) {
      const sep = document.createElement('span');
      sep.className = 'tg-sep';
      sep.textContent = '|';
      sep.setAttribute('aria-hidden', 'true');
      row.appendChild(sep);
    }

    // Tooltip wrapper (handles hover show/hide via CSS)
    const wrap = document.createElement('div');
    wrap.className = 'tg-tooltip-wrap';

    // Chip
    const chip = document.createElement('div');
    chip.className = 'tg-chip';
    chip.id = chipId(sentence.sentenceId, group.groupId);
    chip.tabIndex = 0;
    chip.setAttribute('role', 'button');
    chip.setAttribute('aria-label', `Play: ${group.text}`);
    chip.setAttribute('data-sentence-id', sentence.sentenceId);
    chip.setAttribute('data-group-id', group.groupId);

    // Chip text
    const chipText = document.createElement('span');
    chipText.className = 'tg-chip-text';
    chipText.textContent = group.text;
    chip.appendChild(chipText);

    // Pitch movement label inside chip
    const pm = group.pitchMovement;
    if (pm?.label) {
      const chipLabel = document.createElement('span');
      const rawLabel  = pm.label.toLowerCase();
      const cssClass  = rawLabel === 'rising'  ? 'pm-rising'
                      : rawLabel === 'falling' ? 'pm-falling'
                      : rawLabel === 'level'   ? 'pm-level'
                      : 'pm-other';
      const icon      = rawLabel.includes('rising')  ? '↑'
                      : rawLabel.includes('falling') ? '↓'
                      : '—';
      chipLabel.className = `tg-chip-label ${cssClass}`;
      chipLabel.textContent = `${icon} ${pm.label}`;
      chip.appendChild(chipLabel);
    }

    chip.addEventListener('click', () => {
      callbacks.onChipClick(sentence.sentenceId, group.groupId);
    });
    chip.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        callbacks.onChipClick(sentence.sentenceId, group.groupId);
      }
    });
    chip.addEventListener('animationend', () => {
      chip.classList.remove('is-pulsing');
    });

    // Tooltip
    const tooltip = buildTooltip(group);
    wrap.appendChild(chip);
    wrap.appendChild(tooltip);
    row.appendChild(wrap);
  });

  top.appendChild(row);
  return top;
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
    class:       'contour-svg',
    viewBox:     `0 0 ${L.viewBoxW} ${L.viewBoxH}`,
    'aria-label': `Pitch contour for sentence ${sentence.badge || sentence.order}`,
  });

  // ── defs: arrowhead markers only (no clipPath — using dashoffset reveal) ──
  const defs = svgEl('defs');
  const markerUp = buildArrowMarker(`au-${sid}`, 'up',   '#e07b00');
  const markerDn = buildArrowMarker(`ad-${sid}`, 'down', '#1a6b36');
  defs.appendChild(markerUp);
  defs.appendChild(markerDn);
  svg.appendChild(defs);

  // ── horizontal guide lines ──
  for (const y of [L.guideYHi, L.guideYMi, L.guideYLo]) {
    svg.appendChild(svgEl('line', {
      x1: String(L.innerLeft - 2), y1: String(y),
      x2: String(L.innerRight + 6), y2: String(y),
      stroke: '#ede9df', 'stroke-width': '0.5',
    }));
  }

  // ── Hi / Mi / Lo labels ──
  const guideLabels = ['Hi', 'Mi', 'Lo'];
  [L.guideYHi, L.guideYMi, L.guideYLo].forEach((y, i) => {
    const t = svgEl('text', {
      x: '4', y: String(y + 4),
      'font-size': '8',
      fill: '#ccc9be',
      'font-family': 'inherit',
    });
    t.textContent = guideLabels[i];
    svg.appendChild(t);
  });

  // ── Per-group: segment, divider, labels ──
  groups.forEach((group, idx) => {
    const { x1, x2, midX } = getGroupSegmentX(idx, n);
    const colors  = getColorForMovement(group.pitchMovement?.label);
    const strategy = resolveContourStrategy(group.pitchMovement);

    // vertical dashed divider before this group (not before the first)
    if (idx > 0) {
      svg.appendChild(svgEl('line', {
        id:                `div-${sid}-${idx}`,
        x1: String(x1), y1: '8',
        x2: String(x1), y2: '100',
        stroke: '#e0ded6',
        'stroke-width':    '0.5',
        'stroke-dasharray':'3 4',
        style:             'opacity:0;transition:opacity 0.28s',
      }));
    }

    // contour segment — dashoffset reveal (no clipPath needed)
    if (strategy?.type === 'polyline' && strategy.pts?.length >= 2) {
      const segW   = x2 - x1;
      const svgPts = strategy.pts.map(p => ({
        px:   x1 + p.x * segW,
        py:   normalizeYToPixel(p.y),
        role: p.role ?? null,
      }));

      const pointsStr = svgPts.map(p => `${p.px},${p.py}`).join(' ');

      // Estimate path length from point distances (good enough for dashoffset)
      let pathLen = 0;
      for (let i = 1; i < svgPts.length; i++) {
        const dx = svgPts[i].px - svgPts[i-1].px;
        const dy = svgPts[i].py - svgPts[i-1].py;
        pathLen += Math.sqrt(dx*dx + dy*dy);
      }
      pathLen = Math.ceil(pathLen) + 2; // small buffer

      const polyline = svgEl('polyline', {
        id:                `line-${sid}-${idx}`,
        points:            pointsStr,
        fill:              'none',
        stroke:            colors.stroke,
        'stroke-width':    '3.5',
        'stroke-linecap':  'round',
        'stroke-linejoin': 'round',
        'stroke-dasharray':  String(pathLen),
        'stroke-dashoffset': String(pathLen), // fully hidden initially
      });
      polyline.dataset.pathLen = pathLen;
      svg.appendChild(polyline);

      // End-point circle — hidden initially, revealed when group completes
      const last = svgPts[svgPts.length - 1];
      const endCircle = svgEl('circle', {
        id:             `dot-end-${sid}-${idx}`,
        cx: String(last.px), cy: String(last.py),
        r: '4.5', fill: '#fff',
        stroke: colors.stroke, 'stroke-width': '2',
        opacity: '0',
      });
      svg.appendChild(endCircle);

      // Interior mid-point dots — hidden initially
      if (svgPts.length > 2) {
        svgPts.slice(1, -1).forEach((p, midI) => {
          svg.appendChild(svgEl('circle', {
            id:      `dot-mid-${sid}-${idx}-${midI}`,
            cx: String(p.px), cy: String(p.py),
            r: '3', fill: '#fff',
            stroke: colors.stroke, 'stroke-width': '1.5',
            opacity: '0',
          }));
        });
      }
    }

    // movement labels (Rising / Level / Falling)
    if (uiOptions?.showMovementLabels) {
      const labelG = svgEl('g', {
        id:    `lbl-${sid}-${idx}`,
        style: 'opacity:0;transition:opacity 0.55s',
      });

      const movLabel = (group.pitchMovement?.label || '').toLowerCase();

      if (strategy?.type === 'polyline' && strategy.pts?.length >= 2) {
        const midPy = strategy.pts.reduce((sum, p) => sum + normalizeYToPixel(p.y), 0)
                      / strategy.pts.length;

        if (movLabel === 'rising') {
          labelG.appendChild(svgEl('line', {
            x1: String(midX), y1: String(midPy + 14),
            x2: String(midX), y2: String(midPy - 2),
            stroke: colors.text, 'stroke-width': '1.2',
            'marker-end': `url(#au-${sid})`,
          }));
          const t = svgEl('text', {
            x: String(midX + 8), y: String(midPy + 10),
            'font-size': '10.5', 'font-weight': '600',
            fill: colors.text, 'font-family': 'inherit',
          });
          t.textContent = 'Rising';
          labelG.appendChild(t);
        } else if (movLabel === 'falling') {
          labelG.appendChild(svgEl('line', {
            x1: String(midX), y1: String(midPy - 14),
            x2: String(midX), y2: String(midPy),
            stroke: colors.text, 'stroke-width': '1.2',
            'marker-end': `url(#ad-${sid})`,
          }));
          const t = svgEl('text', {
            x: String(midX + 8), y: String(midPy - 4),
            'font-size': '10.5', 'font-weight': '600',
            fill: colors.text, 'font-family': 'inherit',
          });
          t.textContent = 'Falling';
          labelG.appendChild(t);
        } else {
          const t = svgEl('text', {
            x: String(midX), y: String(L.guideYHi - 6),
            'text-anchor': 'middle',
            'font-size': '10', 'font-weight': '500',
            fill: colors.text, 'font-family': 'inherit',
          });
          t.textContent = movLabel.charAt(0).toUpperCase() + movLabel.slice(1) || 'Level';
          labelG.appendChild(t);
        }
      }

      svg.appendChild(labelG);
    }

    // group label at bottom
    if (uiOptions?.showGroupLabels) {
      const t = svgEl('text', {
        x: String(midX), y: String(L.viewBoxH - 2),
        'text-anchor': 'middle',
        'font-size': '9',
        fill: '#ccc9be',
        'font-family': 'inherit',
      });
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

    if (item.type === 'swatch') {
      li.innerHTML =
        `<div class="legend-swatch" style="background:${item.color}"></div>` +
        `<span>${item.label}</span>`;
    } else if (item.type === 'box') {
      li.innerHTML =
        `<div class="legend-box"></div>` +
        `<span>${item.label}</span>`;
    } else if (item.type === 'click') {
      li.innerHTML =
        `<div class="legend-click"><div class="legend-click-tri"></div></div>` +
        `<span>${item.label}</span>`;
    }

    legend.appendChild(li);
  });

  return legend;
}

/* ── Arrow marker helper ──────────────────────────────────────── */
function buildArrowMarker(id, dir, color) {
  const isUp = dir === 'up';
  const m = svgEl('marker', {
    id,
    viewBox:      '0 0 10 10',
    refX:         '5',
    refY:         isUp ? '9' : '1',
    markerWidth:  '5',
    markerHeight: '5',
    orient:       'auto',
  });
  const p = svgEl('path', {
    d:               isUp ? 'M1 8L5 1L9 8' : 'M1 2L5 9L9 2',
    fill:            'none',
    stroke:          color,
    'stroke-width':  '1.8',
    'stroke-linecap':'round',
    'stroke-linejoin':'round',
  });
  m.appendChild(p);
  return m;
}