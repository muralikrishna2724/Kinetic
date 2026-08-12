/**
 * Emits the Kinetic design-system preview bundle into design-system/.
 *
 *   node scripts/build-design-system.mjs
 *
 * The values below are read from the same token module the app uses, so a
 * change to src/theme/tokens.ts shows up here on the next build rather than
 * quietly drifting out of sync.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const OUT = path.join(process.cwd(), 'design-system');

/* ------------------------------------------------------------------ *
 * Tokens — parsed straight out of the TypeScript source
 * ------------------------------------------------------------------ */

const { readFileSync } = require('node:fs');
const tokenSrc = readFileSync(path.join(process.cwd(), 'src/theme/tokens.ts'), 'utf8');

/**
 * Pulls an object literal out of tokens.ts and evaluates it as JS.
 *
 * `scope` supplies any earlier tokens the literal refers to — the palettes are
 * written in terms of the `kinetic` ramp, so they can't be evaluated in
 * isolation.
 */
function readToken(name, scope = {}) {
  const re = new RegExp(`export const ${name}[^=]*=\\s*(\\{[\\s\\S]*?\\n\\})`, 'm');
  const match = tokenSrc.match(re);
  if (!match) throw new Error(`Could not find token export "${name}" in tokens.ts`);
  // Strip TS-only syntax the evaluator would choke on.
  const body = match[1].replace(/\s+as const/g, '').replace(/:\s*Palette/g, '');
  const keys = Object.keys(scope);
  return new Function(...keys, `return (${body});`)(...keys.map((k) => scope[k]));
}

const kinetic = readToken('kinetic');
const LIME = tokenSrc.match(/export const lime = '([^']+)'/)?.[1] ?? '#C6FF4D';

const scope = { kinetic, lime: LIME };
const dark = readToken('darkPalette', scope);
const light = readToken('lightPalette', scope);
const space = readToken('space');
const radius = readToken('radius');
const type = readToken('type');

/* ------------------------------------------------------------------ *
 * Logo
 * ------------------------------------------------------------------ */

const LETTER = (fill) => `
  <g transform="translate(8, 0) skewX(-7)">
    <rect x="6"  y="25.5" width="10" height="5"  rx="2.5" fill="${fill}" opacity="0.30"/>
    <rect x="1"  y="47.5" width="15" height="5"  rx="2.5" fill="${fill}" opacity="0.55"/>
    <rect x="7"  y="69.5" width="9"  height="5"  rx="2.5" fill="${fill}" opacity="0.30"/>
    <rect x="22" y="13"   width="15" height="74" rx="4"   fill="${fill}"/>
    <path d="M 80 18 L 49.5 50 L 82 82" stroke="${fill}" stroke-width="15"
          stroke-linejoin="miter" stroke-linecap="butt" fill="none"/>
  </g>`;

let gradSeq = 0;
function logo(size, { flat = null, badge = false } = {}) {
  const id = `kg${gradSeq++}`;
  const fill = flat ?? `url(#${id})`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" fill="none">
    ${
      flat
        ? ''
        : `<defs><linearGradient id="${id}" x1="0.12" y1="1" x2="0.92" y2="0">
             <stop offset="0" stop-color="${kinetic[600]}"/>
             <stop offset="0.45" stop-color="#17E48F"/>
             <stop offset="1" stop-color="${LIME}"/>
           </linearGradient>
           <linearGradient id="${id}t" x1="0" y1="0" x2="0.6" y2="1">
             <stop offset="0" stop-color="#16221E"/><stop offset="1" stop-color="#080D0B"/>
           </linearGradient></defs>`
    }
    ${badge ? `<rect width="100" height="100" rx="24" fill="url(#${id}t)"/>` : ''}
    ${LETTER(fill)}
  </svg>`;
}

/* ------------------------------------------------------------------ *
 * Page shell
 * ------------------------------------------------------------------ */

const BASE_CSS = `
*, *::before, *::after { box-sizing: border-box; }
body {
  margin: 0; padding: 28px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: ${dark.bg}; color: ${dark.text};
  -webkit-font-smoothing: antialiased;
}
h1 { font-size: 22px; font-weight: 700; letter-spacing: -.4px; margin: 0 0 4px; }
.sub { font-size: 13px; color: ${dark.textMuted}; margin: 0 0 24px; }
.grid { display: grid; gap: 14px; }
.row { display: flex; gap: 14px; flex-wrap: wrap; align-items: flex-start; }
.panel {
  background: ${dark.surface}; border: 1px solid ${dark.border};
  border-radius: ${radius.xl}px; padding: 18px;
}
.panel.light { background: ${light.surface}; border-color: ${light.border}; color: ${light.text}; }
.eyebrow {
  font-size: 11px; font-weight: 700; letter-spacing: 1.1px;
  text-transform: uppercase; color: ${dark.textFaint}; margin-bottom: 10px;
}
.panel.light .eyebrow { color: ${light.textFaint}; }
.mono { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 11px; }
.muted { color: ${dark.textMuted}; }
.faint { color: ${dark.textFaint}; }
`;

function page(title, cardGroup, body, extraCss = '') {
  return `<!-- @dsCard group="${cardGroup}" -->
<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Kinetic — ${title}</title>
<style>${BASE_CSS}${extraCss}</style>
</head><body>${body}</body></html>`;
}

/* ------------------------------------------------------------------ *
 * Pages
 * ------------------------------------------------------------------ */

const pages = [];

/* --- Brand ------------------------------------------------------- */

pages.push({
  path: 'brand/logo.html',
  group: 'Brand',
  html: page(
    'Logo',
    'Brand',
    `
<h1>The Kinetic mark</h1>
<p class="sub">A geometric K leaning 7° into the direction of travel. Solid stem, detached chevron, three motion trails off the back edge.</p>

<div class="row">
  <div class="panel" style="flex:1; min-width:260px; text-align:center">
    <div class="eyebrow">Primary — gradient</div>
    <div style="padding:20px 0">${logo(150)}</div>
    <div class="mono faint">${kinetic[600]} → #17E48F → ${LIME}</div>
  </div>
  <div class="panel light" style="flex:1; min-width:260px; text-align:center">
    <div class="eyebrow">On light</div>
    <div style="padding:20px 0">${logo(150)}</div>
    <div class="mono" style="color:${light.textFaint}">Same gradient, no adjustment needed</div>
  </div>
</div>

<div style="height:14px"></div>

<div class="row">
  <div class="panel" style="flex:1; text-align:center">
    <div class="eyebrow">App icon</div>
    <div style="padding:14px 0">${logo(104, { badge: true })}</div>
  </div>
  <div class="panel" style="flex:1; text-align:center">
    <div class="eyebrow">Monochrome</div>
    <div style="padding:14px 0">${logo(104, { flat: dark.text })}</div>
  </div>
  <div class="panel" style="flex:1; text-align:center">
    <div class="eyebrow">Single colour</div>
    <div style="padding:14px 0">${logo(104, { flat: kinetic[400] })}</div>
  </div>
</div>

<div style="height:14px"></div>

<div class="panel">
  <div class="eyebrow">Minimum sizes</div>
  <div class="row" style="align-items:flex-end; gap:32px">
    ${[
      [96, 'Splash'],
      [56, 'Header'],
      [38, 'Nav'],
      [26, 'Inline'],
      [20, 'Minimum'],
    ]
      .map(
        ([s, label]) => `
      <div style="text-align:center">
        ${logo(s, { flat: kinetic[400] })}
        <div class="mono faint" style="margin-top:8px">${label}<br>${s}px</div>
      </div>`,
      )
      .join('')}
  </div>
  <p class="sub" style="margin:18px 0 0">
    Below 20px the counter between stem and chevron closes up and the letter reads as “I&lt;”. Use the monochrome mark at small sizes — the gradient has nothing to resolve at that scale.
  </p>
</div>`,
  ),
});

/* --- Colour ------------------------------------------------------ */

function swatchRow(entries, textOn = '#fff') {
  return entries
    .map(
      ([name, value]) => `
    <div style="flex:1; min-width:96px">
      <div style="height:56px; border-radius:${radius.md}px; background:${value};
                  border:1px solid rgba(127,127,127,.22)"></div>
      <div style="margin-top:7px; font-size:12px; font-weight:600; color:${textOn}">${name}</div>
      <div class="mono faint">${value}</div>
    </div>`,
    )
    .join('');
}

pages.push({
  path: 'foundations/color.html',
  group: 'Foundations',
  html: page(
    'Colour',
    'Foundations',
    `
<h1>Colour</h1>
<p class="sub">One brand ramp, two semantic palettes. Nothing in the app references a hex directly — every surface resolves through a palette key.</p>

<div class="panel">
  <div class="eyebrow">Kinetic green ramp</div>
  <div class="row" style="gap:10px">${swatchRow(Object.entries(kinetic))}</div>
  <div class="row" style="gap:10px; margin-top:16px">
    ${swatchRow([['lime (gradient tip)', LIME]])}
  </div>
</div>

<div style="height:14px"></div>

<div class="row">
  <div class="panel" style="flex:1; min-width:300px">
    <div class="eyebrow">Dark — default</div>
    <div class="row" style="gap:10px">
      ${swatchRow([
        ['bg', dark.bg],
        ['surface', dark.surface],
        ['surfaceAlt', dark.surfaceAlt],
        ['border', dark.border],
      ])}
    </div>
    <div class="row" style="gap:10px; margin-top:14px">
      ${swatchRow([
        ['text', dark.text],
        ['textMuted', dark.textMuted],
        ['textFaint', dark.textFaint],
        ['brand', dark.brand],
      ])}
    </div>
  </div>

  <div class="panel light" style="flex:1; min-width:300px">
    <div class="eyebrow">Light</div>
    <div class="row" style="gap:10px">
      ${swatchRow(
        [
          ['bg', light.bg],
          ['surface', light.surface],
          ['surfaceAlt', light.surfaceAlt],
          ['border', light.border],
        ],
        light.text,
      )}
    </div>
    <div class="row" style="gap:10px; margin-top:14px">
      ${swatchRow(
        [
          ['text', light.text],
          ['textMuted', light.textMuted],
          ['textFaint', light.textFaint],
          ['brand', light.brand],
        ],
        light.text,
      )}
    </div>
  </div>
</div>

<div style="height:14px"></div>

<div class="panel">
  <div class="eyebrow">Contrast</div>
  <p class="sub" style="margin:0">
    Body and muted text clear 4.5:1 against their own surface in both themes. Brand green is used for
    accents, icons and large text — never for body copy on a light background, where ${light.brand}
    on ${light.surface} sits below the AA threshold at small sizes. The dark theme brightens brand to
    ${dark.brand} so it holds up on near-black.
  </p>
</div>`,
  ),
});

/* --- Type -------------------------------------------------------- */

pages.push({
  path: 'foundations/type.html',
  group: 'Foundations',
  html: page(
    'Type',
    'Foundations',
    `
<h1>Type</h1>
<p class="sub">System UI throughout — SF Pro on iOS, Roboto on Android. Metric styles run tabular so live-updating numbers don't jitter.</p>

<div class="panel">
  ${Object.entries(type)
    .map(
      ([name, t]) => `
    <div style="display:flex; align-items:baseline; gap:20px; padding:12px 0;
                border-bottom:1px solid ${dark.border}">
      <div class="mono faint" style="width:96px; flex:none">${name}</div>
      <div style="flex:1; font-size:${Math.min(t.size, 44)}px; line-height:1.15;
                  font-weight:${t.weight}; letter-spacing:${t.tracking}px;
                  ${name.startsWith('metric') ? 'font-variant-numeric: tabular-nums;' : ''}
                  ${name === 'label' ? 'text-transform:uppercase;' : ''}">
        ${name.startsWith('metric') ? '12.84' : 'Kinetic'}
      </div>
      <div class="mono faint" style="width:150px; flex:none; text-align:right">
        ${t.size}/${t.lineHeight} · ${t.weight} · ${t.tracking}px
      </div>
    </div>`,
    )
    .join('')}
</div>`,
  ),
});

/* --- Scale ------------------------------------------------------- */

pages.push({
  path: 'foundations/scale.html',
  group: 'Foundations',
  html: page(
    'Spacing & radius',
    'Foundations',
    `
<h1>Spacing &amp; radius</h1>
<p class="sub">A 4pt grid. Radius climbs with surface size — pills for controls, 22 for cards, 28 for the floating nav.</p>

<div class="row">
  <div class="panel" style="flex:1; min-width:280px">
    <div class="eyebrow">Space</div>
    ${Object.entries(space)
      .map(
        ([k, v]) => `
      <div style="display:flex; align-items:center; gap:14px; padding:5px 0">
        <div class="mono faint" style="width:36px">${k}</div>
        <div style="height:14px; width:${v}px; background:${kinetic[400]};
                    border-radius:3px; opacity:.85"></div>
        <div class="mono faint">${v}</div>
      </div>`,
      )
      .join('')}
  </div>

  <div class="panel" style="flex:1; min-width:280px">
    <div class="eyebrow">Radius</div>
    <div class="row" style="gap:12px">
      ${Object.entries(radius)
        .map(
          ([k, v]) => `
        <div style="text-align:center">
          <div style="width:62px; height:62px; background:${dark.surfaceAlt};
                      border:1px solid ${dark.borderStrong};
                      border-radius:${Math.min(v, 31)}px"></div>
          <div class="mono faint" style="margin-top:7px">${k}<br>${v}</div>
        </div>`,
        )
        .join('')}
    </div>
  </div>
</div>

<div style="height:14px"></div>
<div class="panel">
  <div class="eyebrow">Touch targets</div>
  <p class="sub" style="margin:0">Every interactive element is at least 44×44pt. Smaller glyphs — the back chevron, section actions — carry hit slop to reach it without growing visually.</p>
</div>`,
  ),
});

/* --- Buttons ----------------------------------------------------- */

const btnCss = `
.btn {
  display:inline-flex; align-items:center; justify-content:center; gap:8px;
  height:48px; padding:0 22px; border-radius:${radius.pill}px;
  font-size:15px; font-weight:600; border:0; cursor:default;
}
.btn.lg { height:56px; padding:0 26px; }
.btn.primary { background:linear-gradient(135deg, #8CFF6B, ${kinetic[500]}); color:${dark.onBrand}; }
.btn.secondary { background:${dark.surfaceAlt}; color:${dark.text}; }
.btn.ghost { background:transparent; color:${dark.textMuted}; }
.btn.danger { background:${dark.surfaceAlt}; color:${dark.danger}; border:1px solid ${dark.danger}55; }
.btn.disabled { opacity:.45; }
.light .btn.secondary { background:${light.surfaceAlt}; color:${light.text}; }
.light .btn.ghost { color:${light.textMuted}; }
`;

pages.push({
  path: 'components/buttons.html',
  group: 'Components',
  html: page(
    'Buttons',
    'Components',
    `
<h1>Buttons</h1>
<p class="sub">Pill geometry across the board. One gradient primary per screen — if two things are equally important, neither is primary.</p>

<div class="row">
  <div class="panel" style="flex:1; min-width:300px">
    <div class="eyebrow">Dark</div>
    <div class="row">
      <button class="btn primary">Start run</button>
      <button class="btn secondary">Pause</button>
      <button class="btn ghost">Cancel</button>
    </div>
    <div class="row" style="margin-top:14px">
      <button class="btn danger">Discard</button>
      <button class="btn primary disabled">Waiting for GPS</button>
    </div>
    <div class="row" style="margin-top:14px">
      <button class="btn primary lg" style="flex:1">Large — full width</button>
    </div>
  </div>

  <div class="panel light" style="flex:1; min-width:300px">
    <div class="eyebrow">Light</div>
    <div class="row">
      <button class="btn primary">Start run</button>
      <button class="btn secondary">Pause</button>
      <button class="btn ghost">Cancel</button>
    </div>
  </div>
</div>

<div style="height:14px"></div>
<div class="panel">
  <div class="eyebrow">The start control</div>
  <div class="row" style="align-items:center; gap:28px">
    <div style="width:156px; height:156px; border-radius:78px; background:${kinetic[400]};
                display:flex; align-items:center; justify-content:center;
                color:${dark.onBrand}; font-size:28px; font-weight:700; letter-spacing:2px">START</div>
    <div style="width:156px; height:156px; border-radius:78px; background:${dark.surfaceAlt};
                display:flex; align-items:center; justify-content:center;
                color:${dark.textFaint}; font-size:28px; font-weight:700; letter-spacing:2px;
                outline:2px solid ${kinetic[400]}; outline-offset:8px">START</div>
    <p class="sub" style="margin:0; max-width:280px">
      156pt circle — the only control on the pre-run screen, reachable with a thumb.
      While GPS is still acquiring it drops to a disabled fill and a halo pulses outward
      until a fix lands within 25m.
    </p>
  </div>
</div>`,
    btnCss,
  ),
});

/* --- Data display ------------------------------------------------ */

const ringCircumference = 2 * Math.PI * 60.5;

pages.push({
  path: 'components/data-display.html',
  group: 'Components',
  html: page(
    'Data display',
    'Components',
    `
<h1>Data display</h1>
<p class="sub">Every metric is label-over-value with the unit typeset small and baseline-aligned, so the eye lands on the magnitude first.</p>

<div class="row">
  <div class="panel" style="flex:1; min-width:280px">
    <div class="eyebrow">Stat tile</div>
    <div class="row" style="gap:34px">
      ${[
        ['Distance', '12.84', 'km'],
        ['Time', '1:04:22', ''],
        ['Pace', '5:01', '/km'],
      ]
        .map(
          ([l, v, u]) => `
        <div>
          <div class="eyebrow" style="margin-bottom:5px">${l}</div>
          <div style="display:flex; align-items:baseline; gap:4px">
            <span style="font-size:34px; font-weight:700; letter-spacing:-1.2px;
                         font-variant-numeric:tabular-nums">${v}</span>
            <span style="font-size:13px; color:${dark.textMuted}">${u}</span>
          </div>
        </div>`,
        )
        .join('')}
    </div>
  </div>

  <div class="panel" style="width:220px; text-align:center">
    <div class="eyebrow">Progress ring</div>
    <svg width="132" height="132" viewBox="0 0 132 132">
      <defs><linearGradient id="ring" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0" stop-color="${kinetic[500]}"/><stop offset="1" stop-color="#8CFF6B"/>
      </linearGradient></defs>
      <circle cx="66" cy="66" r="60.5" stroke="${dark.surfaceAlt}" stroke-width="11" fill="none"/>
      <circle cx="66" cy="66" r="60.5" stroke="url(#ring)" stroke-width="11" fill="none"
              stroke-linecap="round" transform="rotate(-90 66 66)"
              stroke-dasharray="${ringCircumference * 0.68} ${ringCircumference}"/>
      <text x="66" y="66" text-anchor="middle" fill="${dark.text}" font-size="24"
            font-weight="700" font-family="sans-serif">68</text>
      <text x="66" y="84" text-anchor="middle" fill="${dark.textFaint}" font-size="10"
            font-weight="700" letter-spacing="1.1" font-family="sans-serif">PERCENT</text>
    </svg>
  </div>
</div>

<div style="height:14px"></div>

<div class="row">
  <div class="panel" style="flex:1">
    <div class="eyebrow">Weekly bars</div>
    <div style="display:flex; align-items:flex-end; gap:8px; height:116px">
      ${[0, 8.2, 0, 5.0, 12.4, 0, 6.1]
        .map((v, i) => {
          const max = 12.4;
          const h = v > 0 ? Math.max(6, (v / max) * 90) : 4;
          const last = i === 6;
          const bg = v === 0 ? dark.surfaceAlt : last ? dark.brand : dark.brandMuted;
          return `<div style="flex:1; display:flex; flex-direction:column;
                              align-items:center; justify-content:flex-end; gap:6px">
              <div style="width:100%; height:${h}px; border-radius:8px; background:${bg}"></div>
              <div class="eyebrow" style="margin:0; ${last ? `color:${dark.brand}` : ''}">
                ${['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}
              </div>
            </div>`;
        })
        .join('')}
    </div>
    <p class="sub" style="margin:14px 0 0">Rest days keep a 4pt stub so the week reads as seven columns instead of collapsing into gaps.</p>
  </div>

  <div class="panel" style="flex:1">
    <div class="eyebrow">Splits</div>
    ${[
      [1, '5:22', 0.82],
      [2, '5:04', 1.0],
      [3, '5:31', 0.7],
      [4, '5:48', 0.55],
    ]
      .map(
        ([n, pace, frac]) => `
      <div style="display:flex; align-items:center; gap:12px; padding:9px 0">
        <span class="mono faint" style="width:18px">${n}</span>
        <div style="flex:1; height:8px; border-radius:8px; background:${dark.surfaceAlt}; overflow:hidden">
          <div style="height:100%; width:${frac * 100}%; border-radius:8px;
                      background:${frac === 1 ? dark.brand : dark.brandMuted}"></div>
        </div>
        <span style="font-size:15px; font-weight:600; font-variant-numeric:tabular-nums">${pace}</span>
      </div>`,
      )
      .join('')}
    <p class="sub" style="margin:10px 0 0">Bar length is the fastest split's pace over each split's, cubed — raw ratios sit in too narrow a band to read.</p>
  </div>
</div>`,
  ),
});

/* --- Route trace ------------------------------------------------- */

/** A believable-looking loop for the preview, generated the same way seed runs are. */
function demoRoute(w, h) {
  const pts = [];
  for (let i = 0; i <= 220; i++) {
    const t = (i / 220) * Math.PI * 2;
    const r =
      1 * (1 + 0.18 * Math.sin(3 * t + 0.6)) * (1 + 0.09 * Math.sin(5 * t + 2.1)) *
      (1 + 0.05 * Math.sin(8 * t));
    pts.push([Math.cos(t) * r, Math.sin(t) * r]);
  }
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const pad = 20;
  const scale = Math.min((w - pad * 2) / (maxX - minX), (h - pad * 2) / (maxY - minY));
  const ox = (w - (maxX - minX) * scale) / 2;
  const oy = (h - (maxY - minY) * scale) / 2;
  return pts
    .map(
      (p, i) =>
        `${i === 0 ? 'M' : 'L'} ${(ox + (p[0] - minX) * scale).toFixed(1)} ${(
          oy + (p[1] - minY) * scale
        ).toFixed(1)}`,
    )
    .join(' ');
}

pages.push({
  path: 'components/route-trace.html',
  group: 'Components',
  html: page(
    'Route trace',
    'Components',
    `
<h1>Route trace</h1>
<p class="sub">The run's shape as a vector, not a map tile. No API key, no network, identical in both themes — and at card size a tile layer is noise anyway.</p>

<div class="row">
  <div class="panel" style="flex:1; text-align:center">
    <div class="eyebrow">Detail — 300×210</div>
    <svg width="300" height="210">
      <defs><linearGradient id="r1" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0" stop-color="${kinetic[500]}"/><stop offset="1" stop-color="#8CFF6B"/>
      </linearGradient></defs>
      <path d="${demoRoute(300, 210)}" stroke="${kinetic[400]}" stroke-opacity=".18"
            stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${demoRoute(300, 210)}" stroke="url(#r1)" stroke-width="3.5" fill="none"
            stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </div>
  <div class="panel" style="width:210px; text-align:center">
    <div class="eyebrow">Card thumb — 74×74</div>
    <div style="display:flex; justify-content:center; padding:16px 0">
      <div style="width:74px; height:74px; background:${dark.surfaceAlt}; border-radius:16px">
        <svg width="74" height="74">
          <path d="${demoRoute(74, 74)}" stroke="${kinetic[400]}" stroke-width="2.5" fill="none"
                stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    </div>
  </div>
</div>

<div style="height:14px"></div>
<div class="panel">
  <div class="eyebrow">Projection</div>
  <p class="sub" style="margin:0">
    Longitude degrees are scaled by cos(latitude) before projection. Without that correction a
    north–south route renders visibly squashed and the shape stops being an honest record of where
    you went. Aspect ratio is preserved and the path is centred in its box.
  </p>
</div>`,
  ),
});

/* --- Navigation -------------------------------------------------- */

pages.push({
  path: 'components/navigation.html',
  group: 'Components',
  html: page(
    'Navigation',
    'Components',
    `
<h1>Navigation</h1>
<p class="sub">A floating bar with the run action raised into the middle. Starting a run pushes a modal, so the tab bar is unreachable mid-record — a stray thumb can't abandon a recording.</p>

${[
  ['Dark', dark],
  ['Light', light],
]
  .map(
    ([name, p]) => `
<div class="panel ${name === 'Light' ? 'light' : ''}" style="margin-bottom:14px; background:${p.bg}">
  <div class="eyebrow">${name}</div>
  <div style="position:relative; padding:24px 16px 16px">
    <div style="display:flex; align-items:center; background:${p.surface};
                border:1px solid ${p.border}; border-radius:28px; padding:8px 4px">
      ${['Home', 'Activity', null, 'Stats', 'Profile']
        .map((label, i) => {
          if (label === null) return '<div style="width:74px"></div>';
          const active = i === 0;
          return `<div style="flex:1; text-align:center">
            <div style="height:21px; margin-bottom:4px; display:flex; justify-content:center;
                        align-items:center; color:${active ? p.brand : p.textFaint};
                        font-size:17px">●</div>
            <div style="font-size:11px; font-weight:700; letter-spacing:1.1px;
                        text-transform:uppercase;
                        color:${active ? p.brand : p.textFaint}">${label}</div>
          </div>`;
        })
        .join('')}
    </div>
    <div style="position:absolute; left:0; right:0; top:4px; display:flex; justify-content:center">
      <div style="width:62px; height:62px; border-radius:31px;
                  background:linear-gradient(135deg, #8CFF6B, ${kinetic[500]});
                  border:4px solid ${p.bg}; display:flex; align-items:center;
                  justify-content:center; color:${p.onBrand}; font-size:11px;
                  font-weight:700; letter-spacing:1.1px">RUN</div>
    </div>
  </div>
</div>`,
  )
  .join('')}`,
  ),
});

/* --- Screens ----------------------------------------------------- */

const phoneCss = `
.phone {
  width:375px; border-radius:34px; padding:16px;
  background:${dark.bg}; border:1px solid ${dark.border}; overflow:hidden;
}
.phone.light { background:${light.bg}; border-color:${light.border}; color:${light.text}; }
.c { border-radius:${radius.xl}px; padding:16px; }
.metric { font-size:34px; font-weight:700; letter-spacing:-1.2px; font-variant-numeric:tabular-nums; }
.hero { font-size:60px; font-weight:800; letter-spacing:-3px; font-variant-numeric:tabular-nums; line-height:1; }
`;

function homeScreen(p) {
  const isLight = p === light;
  return `
<div class="phone ${isLight ? 'light' : ''}">
  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px">
    <div>
      <div style="font-size:13px; color:${p.textMuted}">Good morning</div>
      <div style="font-size:28px; font-weight:700; letter-spacing:-.6px">Runner</div>
    </div>
    ${logo(38)}
  </div>

  <div class="c" style="background:${p.surface}; border:1px solid ${p.border}; margin-bottom:14px">
    <div style="display:flex; gap:20px; align-items:center">
      <svg width="118" height="118" viewBox="0 0 132 132" style="flex:none">
        <defs><linearGradient id="hr${isLight ? 'L' : 'D'}" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stop-color="${kinetic[500]}"/><stop offset="1" stop-color="#8CFF6B"/>
        </linearGradient></defs>
        <circle cx="66" cy="66" r="60.5" stroke="${p.surfaceAlt}" stroke-width="11" fill="none"/>
        <circle cx="66" cy="66" r="60.5" stroke="url(#hr${isLight ? 'L' : 'D'})" stroke-width="11"
                fill="none" stroke-linecap="round" transform="rotate(-90 66 66)"
                stroke-dasharray="${ringCircumference * 0.64} ${ringCircumference}"/>
        <text x="66" y="70" text-anchor="middle" fill="${p.text}" font-size="24" font-weight="700"
              font-family="sans-serif">64</text>
        <text x="66" y="87" text-anchor="middle" fill="${p.textFaint}" font-size="10"
              font-weight="700" letter-spacing="1.1" font-family="sans-serif">PERCENT</text>
      </svg>
      <div style="flex:1">
        <div style="font-size:11px; font-weight:700; letter-spacing:1.1px; text-transform:uppercase;
                    color:${p.textFaint}">This week</div>
        <div style="display:flex; align-items:baseline; gap:4px">
          <span class="metric">19.3</span>
          <span style="font-size:13px; color:${p.textMuted}">/ 30 km</span>
        </div>
        <div style="font-size:13px; color:${p.textMuted}; margin:8px 0 10px">10.7 km to go</div>
        <div style="display:flex; gap:18px">
          <div>
            <div style="font-size:11px; font-weight:700; letter-spacing:1.1px;
                        text-transform:uppercase; color:${p.textFaint}">Runs</div>
            <div style="font-size:15px; font-weight:600">3</div>
          </div>
          <div>
            <div style="font-size:11px; font-weight:700; letter-spacing:1.1px;
                        text-transform:uppercase; color:${p.textFaint}">Time</div>
            <div style="font-size:15px; font-weight:600">1h 47m</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="c" style="background:${p.surface}; border:1px solid ${p.border}; margin-bottom:14px">
    <div style="font-size:17px; font-weight:600; margin-bottom:12px">Last 7 days</div>
    <div style="display:flex; align-items:flex-end; gap:8px; height:100px">
      ${[0, 8.2, 0, 5.0, 12.4, 0, 6.1]
        .map((v, i) => {
          const h = v > 0 ? Math.max(6, (v / 12.4) * 76) : 4;
          const last = i === 6;
          const bg = v === 0 ? p.surfaceAlt : last ? p.brand : p.brandMuted;
          return `<div style="flex:1; display:flex; flex-direction:column; align-items:center;
                              justify-content:flex-end; gap:6px">
            <div style="width:100%; height:${h}px; border-radius:8px; background:${bg}"></div>
            <div style="font-size:11px; font-weight:700; letter-spacing:1.1px;
                        color:${last ? p.brand : p.textFaint}">${['M','T','W','T','F','S','S'][i]}</div>
          </div>`;
        })
        .join('')}
    </div>
  </div>

  <div class="c" style="background:${p.surface}; border:1px solid ${p.border}">
    <div style="display:flex; gap:16px; align-items:center">
      <div style="width:74px; height:74px; border-radius:16px; background:${p.surfaceAlt}; flex:none">
        <svg width="74" height="74">
          <path d="${demoRoute(74, 74)}" stroke="${p.brand}" stroke-width="2.5" fill="none"
                stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div style="flex:1">
        <div style="font-size:17px; font-weight:600">Morning Run</div>
        <div style="font-size:13px; color:${p.textFaint}; margin-bottom:8px">Yesterday · 06:14</div>
        <div style="display:flex; gap:16px; font-size:15px; font-weight:600;
                    font-variant-numeric:tabular-nums">
          <span>8.20<span style="font-size:11px; color:${p.textFaint}"> km</span></span>
          <span>5:22<span style="font-size:11px; color:${p.textFaint}"> /km</span></span>
          <span>44m 03s</span>
        </div>
      </div>
    </div>
  </div>
</div>`;
}

pages.push({
  path: 'screens/home.html',
  group: 'Screens',
  html: page(
    'Home',
    'Screens',
    `
<h1>Home</h1>
<p class="sub">Weekly goal first, trend second, most recent run third. The question a runner opens the app with is “am I on track this week?”</p>
<div class="row" style="gap:24px">
  ${homeScreen(dark)}
  ${homeScreen(light)}
</div>`,
    phoneCss,
  ),
});

pages.push({
  path: 'screens/run.html',
  group: 'Screens',
  html: page(
    'Run tracking',
    'Screens',
    `
<h1>Run tracking</h1>
<p class="sub">Distance is the hero — it's what a runner glances down for. Everything else is one tier smaller, and the controls sit in the bottom third within thumb reach.</p>

<div class="row" style="gap:24px">
  <div class="phone">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:28px">
      <div style="width:40px; height:40px; border-radius:20px; background:${dark.surfaceAlt};
                  display:flex; align-items:center; justify-content:center;
                  color:${dark.textMuted}">✕</div>
      <div style="display:flex; align-items:center; gap:8px; background:${dark.surfaceAlt};
                  padding:7px 12px; border-radius:999px">
        <div style="width:8px; height:8px; border-radius:4px; background:${dark.brand}"></div>
        <span style="font-size:11px; font-weight:700; letter-spacing:1.1px;
                     color:${dark.textMuted}">GPS READY</span>
      </div>
      <div style="width:40px"></div>
    </div>

    <div style="text-align:center; margin-bottom:36px">
      <div style="display:flex; justify-content:center; margin-bottom:16px">${logo(104)}</div>
      <div style="font-size:28px; font-weight:700; letter-spacing:-.6px">Ready to run</div>
      <div style="font-size:15px; color:${dark.textMuted}">GPS locked. Hit start when you are.</div>
    </div>

    <div style="display:flex; justify-content:center; gap:32px; margin-bottom:24px">
      ${[
        ['Distance', '0.00 km'],
        ['Time', '0:00'],
        ['Pace', '—:— /km'],
      ]
        .map(
          ([l, v]) => `<div style="text-align:center">
        <div style="font-size:11px; font-weight:700; letter-spacing:1.1px; text-transform:uppercase;
                    color:${dark.textFaint}">${l}</div>
        <div style="font-size:15px; font-weight:600; color:${dark.textFaint}">${v}</div>
      </div>`,
        )
        .join('')}
    </div>

    <div style="display:flex; justify-content:center; margin-bottom:16px">
      <div style="width:156px; height:156px; border-radius:78px; background:${dark.brand};
                  display:flex; align-items:center; justify-content:center; color:${dark.onBrand};
                  font-size:28px; font-weight:700; letter-spacing:2px">START</div>
    </div>
  </div>

  <div class="phone">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px">
      <div style="width:40px; height:40px; border-radius:20px; background:${dark.surfaceAlt};
                  display:flex; align-items:center; justify-content:center;
                  color:${dark.textMuted}">✕</div>
      <div style="display:flex; align-items:center; gap:8px; background:${dark.surfaceAlt};
                  padding:7px 12px; border-radius:999px">
        <div style="width:8px; height:8px; border-radius:4px; background:${dark.danger}"></div>
        <span style="font-size:11px; font-weight:700; letter-spacing:1.1px;
                     color:${dark.textMuted}">RECORDING</span>
      </div>
      <div style="width:40px"></div>
    </div>

    <div style="text-align:center; margin-bottom:16px">
      <div style="font-size:11px; font-weight:700; letter-spacing:1.1px; text-transform:uppercase;
                  color:${dark.textFaint}">Distance</div>
      <div style="display:flex; align-items:baseline; justify-content:center; gap:6px">
        <span class="hero">5.42</span>
        <span style="font-size:22px; font-weight:700; color:${dark.textMuted}">km</span>
      </div>
    </div>

    <div class="c" style="background:${dark.surfaceAlt}; margin-bottom:14px">
      <div style="display:flex; justify-content:space-between">
        ${[
          ['Time', '28:44', ''],
          ['Pace', '5:18', '/km'],
          ['Calories', '412', 'kcal'],
        ]
          .map(
            ([l, v, u]) => `<div style="text-align:center">
          <div style="font-size:11px; font-weight:700; letter-spacing:1.1px;
                      text-transform:uppercase; color:${dark.textFaint}">${l}</div>
          <div style="display:flex; align-items:baseline; gap:3px; justify-content:center">
            <span style="font-size:24px; font-weight:700; letter-spacing:-.8px;
                         font-variant-numeric:tabular-nums">${v}</span>
            <span style="font-size:11px; color:${dark.textFaint}">${u}</span>
          </div>
        </div>`,
          )
          .join('')}
      </div>
    </div>

    <div class="c" style="background:${dark.surface}; border:1px solid ${dark.border};
                          margin-bottom:14px; display:flex; justify-content:center">
      <svg width="290" height="180">
        <path d="${demoRoute(290, 180)}" stroke="${kinetic[400]}" stroke-opacity=".18"
              stroke-width="11" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="${demoRoute(290, 180)}" stroke="${kinetic[400]}" stroke-width="4" fill="none"
              stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>

    <div style="display:flex; gap:12px">
      <div style="flex:1; height:56px; border-radius:999px; background:${dark.surfaceAlt};
                  display:flex; align-items:center; justify-content:center; gap:8px;
                  font-size:15px; font-weight:600">Finish</div>
      <div style="flex:1; height:56px; border-radius:999px;
                  background:linear-gradient(135deg, #8CFF6B, ${kinetic[500]});
                  display:flex; align-items:center; justify-content:center; gap:8px;
                  color:${dark.onBrand}; font-size:15px; font-weight:600">Pause</div>
    </div>
  </div>
</div>`,
    phoneCss,
  ),
});

/* ------------------------------------------------------------------ *
 * Write
 * ------------------------------------------------------------------ */

for (const p of pages) {
  const dest = path.join(OUT, p.path);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, p.html, 'utf8');
  console.log(`✓ design-system/${p.path}  [${p.group}]`);
}

console.log(`\n${pages.length} preview pages written to design-system/`);
