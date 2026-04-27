/**
 * utils.js
 */

'use strict';

export const SVG_LAYOUT = {
  viewBoxW:     560,
  viewBoxH:     110,
  innerLeft:    20,
  innerRight:   540,
  contourTop:   22,
  contourBottom:92,
  guideYHi:     22,
  guideYMi:     58,
  guideYLo:     92,
};

export function getGroupSegmentX(index, totalGroups, layout = SVG_LAYOUT) {
  const usableW = layout.innerRight - layout.innerLeft;
  const groupW  = usableW / totalGroups;
  const x1 = layout.innerLeft + index * groupW;
  const x2 = x1 + groupW;
  return { x1, x2, midX: (x1 + x2) / 2 };
}

export function normalizeYToPixel(normalizedY, layout = SVG_LAYOUT) {
  const h = layout.contourBottom - layout.contourTop;
  return layout.contourTop + normalizedY * h;
}

export function getColorForMovement(label) {
  const s = (label || '').toLowerCase();
  if (s.includes('rising'))  return { stroke: '#e07b00', text: '#b85c00', arrowDir: 'up'   };
  if (s.includes('falling')) return { stroke: '#1a6b36', text: '#1a6b36', arrowDir: 'down' };
  return { stroke: '#888780', text: '#6b6966', arrowDir: null };
}

/**
 * Resolve contour strategy.
 * Priority: points array → line fallback → horizontal mid line
 * Always returns { type: 'polyline', pts: [{x, y, role?}] }
 */
export function resolveContourStrategy(pitchMovement) {
  // 1. points array (new format)
  if (Array.isArray(pitchMovement?.points) && pitchMovement.points.length >= 2) {
    const pts = pitchMovement.points
      .map(p => ({
        x:    clamp(typeof p.x === 'number' ? p.x : 0, 0, 1),
        y:    clamp(typeof p.y === 'number' ? p.y : 0.5, 0, 1),
        role: p.role ?? null,
      }))
      .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y))
      .sort((a, b) => a.x - b.x);
    if (pts.length >= 2) return { type: 'polyline', pts };
  }

  // 2. legacy line {startY, endY}
  if (pitchMovement?.line) {
    return {
      type: 'polyline',
      pts: [
        { x: 0, y: clamp(pitchMovement.line.startY ?? 0.5, 0, 1), role: 'start' },
        { x: 1, y: clamp(pitchMovement.line.endY   ?? 0.5, 0, 1), role: 'end'   },
      ],
    };
  }

  // 3. fallback horizontal
  return {
    type: 'polyline',
    pts: [{ x: 0, y: 0.5, role: 'start' }, { x: 1, y: 0.5, role: 'end' }],
  };
}

export function svgEl(tag, attrs = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

export function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

export function chipId(sentenceId, groupId) {
  return `chip-${sentenceId}-${groupId}`;
}

// kept for any legacy references, not used by dashoffset approach
export function clipId(sentenceId)     { return `clip-${sentenceId}`; }
export function clipRectId(sentenceId) { return `cr-${sentenceId}`;   }