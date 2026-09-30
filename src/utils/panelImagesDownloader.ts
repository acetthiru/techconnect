/**
 * TECH BRIDGE '26 - OFFLINE PANEL IMAGES DOWNLOAD ENGINE
 * 
 * Provides automated ZIP archive and standalone visual folio generation for all 
 * competition rebus clue panels (Photographic scenes, Vector SVGs, and Combined Cards).
 */

import JSZip from 'jszip';
import { Question } from '../types';
import { getRealisticImagesForQuestion, generateRealisticPhotographicSvg, REALISTIC_REBUS_CATALOG } from './realisticRebusImages';

// Dictionary of vector artwork SVG inner content for all known panel types
const VECTOR_ART_MAP: Record<string, string> = {
  brain: `
    <path d="M30 40C22 40 18 46 18 54C18 64 26 68 32 72C36 74 40 82 50 82C60 82 64 74 68 72C74 68 82 64 82 54C82 46 78 40 70 40C70 30 62 22 50 22C38 22 30 30 30 40Z" stroke="#06b6d4" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="rgba(6,182,212,0.06)" />
    <path d="M50 22V82M35 34C40 38 45 42 50 42C55 42 60 38 65 34M30 52C38 52 42 58 50 58C58 58 62 52 70 52M32 68C40 66 45 70 50 70C55 70 60 66 68 68" stroke="#06b6d4" stroke-width="2" stroke-dasharray="3 3" opacity="0.8" />
    <circle cx="34" cy="44" r="2.5" fill="#38bdf8" />
    <circle cx="66" cy="44" r="2.5" fill="#38bdf8" />
    <circle cx="50" cy="58" r="3" fill="#06b6d4" />
  `,
  leak: `
    <rect x="25" y="24" width="50" height="12" rx="2" stroke="#38bdf8" stroke-width="2.5" fill="rgba(56,189,248,0.1)" />
    <rect x="42" y="36" width="16" height="18" stroke="#38bdf8" stroke-width="2.5" fill="rgba(56,189,248,0.15)" />
    <path d="M50 54C50 54 44 64 44 70C44 73.3 46.7 76 50 76C53.3 76 56 73.3 56 70C56 64 50 54 50 54Z" fill="#38bdf8" />
    <path d="M50 79C50 79 46 84 46 87C46 89.2 47.8 91 50 91C52.2 91 54 89.2 54 87C54 84 50 79 50 79Z" fill="#0284c7" opacity="0.85" />
    <ellipse cx="50" cy="94" rx="22" ry="3" fill="rgba(56,189,248,0.3)" />
  `,
  plates: `
    <ellipse cx="50" cy="80" rx="36" ry="7" stroke="#fbbf24" stroke-width="2.5" fill="rgba(251,191,36,0.1)" />
    <ellipse cx="50" cy="66" rx="34" ry="7" stroke="#fbbf24" stroke-width="2.5" fill="rgba(251,191,36,0.15)" />
    <ellipse cx="50" cy="52" rx="32" ry="7" stroke="#fbbf24" stroke-width="2.5" fill="rgba(251,191,36,0.2)" />
    <ellipse cx="50" cy="38" rx="30" ry="7" stroke="#fbbf24" stroke-width="2.5" fill="rgba(251,191,36,0.25)" />
    <ellipse cx="50" cy="24" rx="28" ry="7" stroke="#fbbf24" stroke-width="2.5" fill="rgba(251,191,36,0.3)" />
    <path d="M50 14V18M45 16H55" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" />
  `,
  overflow: `
    <path d="M28 35H72L65 82H35L28 35Z" stroke="#f43f5e" stroke-width="2.5" fill="rgba(244,63,94,0.08)" />
    <path d="M24 38C32 42 42 32 50 38C58 44 68 34 76 38" stroke="#f43f5e" stroke-width="2" fill="none" />
    <circle cx="20" cy="72" r="3" fill="#f43f5e" />
    <circle cx="80" cy="74" r="3" fill="#f43f5e" />
    <path d="M50 20V28M46 24L50 28L54 24" stroke="#f43f5e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  `,
  road_deadlock: `
    <rect x="20" y="20" width="60" height="60" rx="4" stroke="#e2e8f0" stroke-width="2" fill="#0f172a" />
    <line x1="50" y1="20" x2="50" y2="80" stroke="#fbbf24" stroke-width="2" stroke-dasharray="4 4" />
    <line x1="20" y1="50" x2="80" y2="50" stroke="#fbbf24" stroke-width="2" stroke-dasharray="4 4" />
    <rect x="42" y="24" width="16" height="20" rx="3" fill="#ef4444" stroke="#ffffff" stroke-width="1.5" />
    <rect x="56" y="42" width="20" height="16" rx="3" fill="#3b82f6" stroke="#ffffff" stroke-width="1.5" />
    <rect x="42" y="56" width="16" height="20" rx="3" fill="#10b981" stroke="#ffffff" stroke-width="1.5" />
    <rect x="24" y="42" width="20" height="16" rx="3" fill="#f59e0b" stroke="#ffffff" stroke-width="1.5" />
  `,
  lock_key: `
    <rect x="30" y="44" width="40" height="36" rx="6" stroke="#fbbf24" stroke-width="2.5" fill="rgba(251,191,36,0.15)" />
    <path d="M38 44V32C38 25.4 43.4 20 50 20C56.6 20 62 25.4 62 32V44" stroke="#fbbf24" stroke-width="3" stroke-linecap="round" fill="none" />
    <circle cx="50" cy="58" r="4" fill="#fbbf24" />
    <path d="M50 62V70" stroke="#fbbf24" stroke-width="2.5" stroke-linecap="round" />
  `,
  docker_whale: `
    <rect x="36" y="32" width="8" height="8" fill="#38bdf8" rx="1" />
    <rect x="46" y="32" width="8" height="8" fill="#38bdf8" rx="1" />
    <rect x="56" y="32" width="8" height="8" fill="#38bdf8" rx="1" />
    <rect x="26" y="42" width="8" height="8" fill="#38bdf8" rx="1" />
    <rect x="36" y="42" width="8" height="8" fill="#38bdf8" rx="1" />
    <rect x="46" y="42" width="8" height="8" fill="#38bdf8" rx="1" />
    <rect x="56" y="42" width="8" height="8" fill="#38bdf8" rx="1" />
    <rect x="66" y="42" width="8" height="8" fill="#38bdf8" rx="1" />
    <path d="M20 52H80C82 52 84 54 84 56C84 68 74 76 56 76C40 76 26 72 18 64C16 60 16 56 20 52Z" fill="#0284c7" />
    <circle cx="28" cy="60" r="2" fill="#ffffff" />
  `,
  cpu: `
    <rect x="26" y="26" width="48" height="48" rx="6" stroke="#06b6d4" stroke-width="2.5" fill="rgba(6,182,212,0.12)" />
    <rect x="36" y="36" width="28" height="28" rx="3" stroke="#38bdf8" stroke-width="2" fill="rgba(56,189,248,0.2)" />
    <path d="M34 16V26M50 16V26M66 16V26M34 74V84M50 74V84M66 74V84" stroke="#06b6d4" stroke-width="2.5" stroke-linecap="round" />
    <path d="M16 34H26M16 50H26M16 66H26M74 34H84M74 50H84M74 66H84" stroke="#06b6d4" stroke-width="2.5" stroke-linecap="round" />
    <circle cx="50" cy="50" r="4" fill="#38bdf8" />
  `,
  tree: `
    <circle cx="50" cy="24" r="8" stroke="#10b981" stroke-width="2" fill="rgba(16,185,129,0.2)" />
    <circle cx="32" cy="48" r="7" stroke="#10b981" stroke-width="2" fill="rgba(16,185,129,0.2)" />
    <circle cx="68" cy="48" r="7" stroke="#10b981" stroke-width="2" fill="rgba(16,185,129,0.2)" />
    <circle cx="22" cy="74" r="6" stroke="#34d399" stroke-width="2" fill="rgba(52,211,153,0.2)" />
    <circle cx="42" cy="74" r="6" stroke="#34d399" stroke-width="2" fill="rgba(52,211,153,0.2)" />
    <circle cx="78" cy="74" r="6" stroke="#34d399" stroke-width="2" fill="rgba(52,211,153,0.2)" />
    <line x1="45" y1="30" x2="36" y2="42" stroke="#10b981" stroke-width="2" />
    <line x1="55" y1="30" x2="64" y2="42" stroke="#10b981" stroke-width="2" />
    <line x1="28" y1="54" x2="24" y2="68" stroke="#34d399" stroke-width="2" />
    <line x1="36" y1="54" x2="40" y2="68" stroke="#34d399" stroke-width="2" />
    <line x1="72" y1="54" x2="76" y2="68" stroke="#34d399" stroke-width="2" />
  `,
  cloud: `
    <path d="M30 68H72C80 68 86 62 86 54C86 46.5 80.5 40.5 73 40C72 28 62 18 50 18C40 18 31.5 24.5 28.5 34C21 35 15 41.5 15 49.5C15 59.5 21.5 68 30 68Z" stroke="#38bdf8" stroke-width="2.5" fill="rgba(56,189,248,0.12)" />
    <path d="M40 76L46 84M54 76L60 84M32 76L38 84" stroke="#0284c7" stroke-width="2" stroke-linecap="round" />
  `,
  network_packet: `
    <rect x="22" y="32" width="56" height="36" rx="4" stroke="#0891b2" stroke-width="2" fill="rgba(8,145,178,0.1)" />
    <path d="M22 44H78M38 32V68M56 32V68" stroke="#0891b2" stroke-width="1.5" stroke-dasharray="2 2" />
    <circle cx="30" cy="38" r="2.5" fill="#38bdf8" />
    <circle cx="68" cy="56" r="3" fill="#10b981" />
    <path d="M12 50H22M78 50H88" stroke="#0891b2" stroke-width="2" stroke-linecap="round" />
  `,
  firewall: `
    <rect x="18" y="24" width="64" height="52" rx="4" stroke="#f97316" stroke-width="2" fill="rgba(249,115,22,0.1)" />
    <line x1="18" y1="37" x2="82" y2="37" stroke="#f97316" stroke-width="1.5" />
    <line x1="18" y1="50" x2="82" y2="50" stroke="#f97316" stroke-width="1.5" />
    <line x1="18" y1="63" x2="82" y2="63" stroke="#f97316" stroke-width="1.5" />
    <line x1="34" y1="24" x2="34" y2="37" stroke="#f97316" stroke-width="1.5" />
    <line x1="66" y1="24" x2="66" y2="37" stroke="#f97316" stroke-width="1.5" />
    <line x1="50" y1="37" x2="50" y2="50" stroke="#f97316" stroke-width="1.5" />
    <line x1="34" y1="50" x2="34" y2="63" stroke="#f97316" stroke-width="1.5" />
    <line x1="66" y1="50" x2="66" y2="63" stroke="#f97316" stroke-width="1.5" />
    <path d="M50 42C44 50 44 60 50 64C56 60 56 50 50 42Z" fill="#ef4444" opacity="0.8" />
  `,
};

/**
 * Generate a standalone full SVG document for a given vector panel
 */
export function generatePanelSvg(
  panelNumber: number,
  svgType: string,
  subText: string = '',
  description: string = '',
  questionContext: string = ''
): string {
  const innerArt = VECTOR_ART_MAP[svgType] || `
    <rect x="20" y="20" width="60" height="60" rx="8" stroke="#0891b2" stroke-width="2" fill="rgba(8,145,178,0.1)" />
    <circle cx="50" cy="50" r="16" stroke="#0891b2" stroke-width="2" fill="rgba(8,145,178,0.2)" />
    <text x="50" y="55" font-family="sans-serif" font-size="14" fill="#0891b2" text-anchor="middle" font-weight="bold">${svgType.toUpperCase().slice(0, 4)}</text>
  `;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#f8fafc" />
    </linearGradient>
    <filter id="cardShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="rgba(15,23,42,0.08)" />
    </filter>
  </defs>

  <!-- Card Background -->
  <rect width="500" height="500" rx="20" fill="url(#bgGrad)" stroke="#dce6f0" stroke-width="3" filter="url(#cardShadow)" />

  <!-- Top Header Banner -->
  <rect x="20" y="20" width="460" height="50" rx="10" fill="#ecfeff" stroke="#06b6d4" stroke-width="1.5" />
  <text x="40" y="52" font-family="'Outfit', -apple-system, sans-serif" font-size="18" font-weight="bold" fill="#0891b2">PANEL ${panelNumber} &bull; VISUAL REBUS CLUE</text>
  ${questionContext ? `<text x="460" y="52" font-family="monospace" font-size="14" font-weight="bold" fill="#64748b" text-anchor="end">${questionContext}</text>` : ''}

  <!-- Central Artwork Container -->
  <g transform="translate(100, 100) scale(3)">
    ${innerArt}
  </g>

  <!-- Watermark & Footer -->
  <line x1="30" y1="420" x2="470" y2="420" stroke="#e2e8f0" stroke-width="2" />
  <text x="250" y="450" font-family="'Outfit', -apple-system, sans-serif" font-size="14" font-weight="bold" fill="#0f172a" text-anchor="middle">${subText || svgType.toUpperCase()}</text>
  <text x="250" y="475" font-family="monospace" font-size="11" fill="#64748b" text-anchor="middle">TECH BRIDGE '26 &bull; OFFICIAL EVALUATION ASSET</text>
</svg>`;
}

/**
 * Generate a complete combined Question Card SVG with all panels together
 */
export function generateQuestionCardSvg(q: Question): string {
  const panelCount = q.cluePanels.length;
  const cardWidth = 350 * panelCount + 100;
  const cardHeight = 520;

  const panelsContent = q.cluePanels.map((p, idx) => {
    const xOffset = 50 + idx * 350;
    const innerArt = VECTOR_ART_MAP[p.svgType] || `
      <rect x="20" y="20" width="60" height="60" rx="6" stroke="#0891b2" stroke-width="2" fill="rgba(8,145,178,0.1)" />
      <text x="50" y="55" font-family="sans-serif" font-size="14" fill="#0891b2" text-anchor="middle">${p.svgType.slice(0, 4)}</text>
    `;

    return `
      <!-- Panel ${idx + 1} Container -->
      <g transform="translate(${xOffset}, 110)">
        <rect width="300" height="300" rx="14" fill="#ffffff" stroke="#cbd5e1" stroke-width="2" />
        <rect x="15" y="15" width="270" height="35" rx="6" fill="#f1f5f9" />
        <text x="150" y="38" font-family="'Outfit', sans-serif" font-size="13" font-weight="bold" fill="#0891b2" text-anchor="middle">PANEL ${p.panelNumber || idx + 1}</text>
        <g transform="translate(60, 75) scale(1.8)">
          ${innerArt}
        </g>
        <text x="150" y="275" font-family="sans-serif" font-size="12" font-weight="bold" fill="#1e293b" text-anchor="middle">${p.subText || p.svgType.toUpperCase()}</text>
      </g>
      ${idx < panelCount - 1 ? `
        <!-- Plus Sign -->
        <circle cx="${xOffset + 325}" cy="260" r="18" fill="#0891b2" />
        <text x="${xOffset + 325}" y="266" font-family="sans-serif" font-size="22" font-weight="bold" fill="#ffffff" text-anchor="middle">+</text>
      ` : ''}
    `;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cardWidth} ${cardHeight}" width="${cardWidth}" height="${cardHeight}">
  <defs>
    <linearGradient id="mainBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f8fafc" />
      <stop offset="100%" stop-color="#e2e8f0" />
    </linearGradient>
  </defs>

  <rect width="${cardWidth}" height="${cardHeight}" rx="24" fill="url(#mainBg)" stroke="#94a3b8" stroke-width="3" />

  <!-- Top Title Banner -->
  <rect x="40" y="30" width="${cardWidth - 80}" height="60" rx="12" fill="#0f172a" />
  <text x="65" y="67" font-family="'Outfit', sans-serif" font-size="18" font-weight="bold" fill="#38bdf8">QUESTION #${q.questionNumber} &bull; ROUND ${q.round} (SET ${q.set || 'A'})</text>
  <text x="${cardWidth - 65}" y="67" font-family="monospace" font-size="14" fill="#94a3b8" text-anchor="end">DOMAIN: ${q.domain}</text>

  <!-- Panels -->
  ${panelsContent}

  <!-- Footer Rebus Formula -->
  <rect x="40" y="435" width="${cardWidth - 80}" height="55" rx="10" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" />
  <text x="65" y="468" font-family="monospace" font-size="14" font-weight="bold" fill="#0f172a">REBUS FORMULA: ${q.rebusFormulaText}</text>
  <text x="${cardWidth - 65}" y="468" font-family="monospace" font-size="13" font-weight="bold" fill="#0891b2" text-anchor="end">POINTS: ${q.points} PT(S)</text>
</svg>`;
}

/**
 * Downloads all panel images bundled in a structured ZIP archive
 */
export async function downloadAllPanelImagesZip(
  questions: Question[],
  roundFilter: string = 'ALL',
  setFilter: string = 'ALL',
  onProgress?: (progressText: string) => void
): Promise<void> {
  const zip = new JSZip();

  onProgress?.('Preparing Panel Image Files...');

  // Create Root Folders
  const rootFolder = zip.folder(`TechBridge26_Panel_Images_R${roundFilter}_Set${setFilter}`);
  if (!rootFolder) throw new Error('Could not initialize ZIP folder');

  const photosFolder = rootFolder.folder('01_Photographic_Clues');
  const vectorPanelsFolder = rootFolder.folder('02_Vector_Clue_Panels');
  const combinedCardsFolder = rootFolder.folder('03_Combined_Question_Cards');

  // Loop through questions
  let count = 0;
  for (const q of questions) {
    count++;
    onProgress?.(`Processing Question ${count} of ${questions.length} (${q.id})...`);

    const qSlug = `R${q.round}_Set${q.set || 'A'}_Q${String(q.questionNumber).padStart(2, '0')}_${q.correctAnswer.replace(/[^a-zA-Z0-9]/g, '_')}`;

    // 1. Vector Clue Panels
    q.cluePanels.forEach((p, pIdx) => {
      const panelSvg = generatePanelSvg(
        p.panelNumber || pIdx + 1,
        p.svgType,
        p.subText,
        p.description,
        `Q#${q.questionNumber} R${q.round}`
      );
      const filename = `${qSlug}_Panel${p.panelNumber || pIdx + 1}_${p.svgType}.svg`;
      vectorPanelsFolder?.file(filename, panelSvg);
    });

    // 2. Combined Question Card SVG
    const combinedSvg = generateQuestionCardSvg(q);
    combinedCardsFolder?.file(`${qSlug}_Combined_Card.svg`, combinedSvg);

    // 3. Photographic Rebus Clues
    const defaultPair = getRealisticImagesForQuestion(q.id, q.explanation);
    const spec = REALISTIC_REBUS_CATALOG[q.id];

    if (spec && spec.panels) {
      spec.panels.forEach((p, idx) => {
        const photoSvg = generateRealisticPhotographicSvg(p.scene, p.icon, p.gradient);
        photosFolder?.file(`${qSlug}_PhotoClue${idx + 1}_${p.panelId}.svg`, photoSvg);
      });
    } else if (defaultPair && defaultPair.length > 0) {
      defaultPair.forEach((url, idx) => {
        if (url.startsWith('data:image/svg+xml')) {
          const rawSvg = decodeURIComponent(url.split(',')[1]);
          photosFolder?.file(`${qSlug}_PhotoClue${idx + 1}.svg`, rawSvg);
        }
      });
    }
  }

  // 4. Standalone HTML Offline Gallery Viewer
  onProgress?.('Generating Offline Interactive Gallery Viewer...');
  const galleryHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>TECH BRIDGE '26 - Master Visual Panel Images Gallery</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    .header { text-align: center; border-bottom: 2px solid #334155; padding-bottom: 20px; margin-bottom: 30px; }
    h1 { color: #38bdf8; font-size: 24px; margin: 0 0 8px 0; }
    .sub { color: #94a3b8; font-size: 14px; font-family: monospace; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 16px; transition: transform 0.2s; }
    .card:hover { transform: translateY(-3px); border-color: #38bdf8; }
    .qtitle { font-size: 15px; font-weight: bold; color: #38bdf8; margin-bottom: 6px; }
    .meta { font-size: 11px; color: #94a3b8; font-family: monospace; margin-bottom: 12px; }
    .panels-row { display: flex; gap: 8px; justify-content: center; }
    .pbox { background: #0f172a; border: 1px solid #475569; border-radius: 8px; padding: 10px; text-align: center; flex: 1; }
    .pnum { font-size: 10px; font-weight: bold; color: #06b6d4; margin-bottom: 4px; }
    .pname { font-size: 12px; font-weight: 600; }
    .formula { margin-top: 12px; padding: 8px; background: #0f172a; border-radius: 6px; font-size: 12px; font-family: monospace; color: #e2e8f0; }
    .ans { margin-top: 8px; padding: 8px; background: #064e3b; border: 1px solid #059669; border-radius: 6px; font-size: 12px; font-weight: bold; color: #a7f3d0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>TECH BRIDGE '26 &bull; VISUAL REBUS PANEL IMAGES GALLERY</h1>
    <div class="sub">Round: ${roundFilter} &bull; Question Set: ${setFilter} &bull; Total Questions: ${questions.length}</div>
    <div style="margin-top: 10px; font-size: 12px; color: #64748b;">Stand-alone Offline Image Package &bull; Achariya College of Engineering Technology</div>
  </div>
  <div class="grid">
    ${questions.map(q => `
      <div class="card">
        <div class="qtitle">Q#${q.questionNumber} &bull; Round ${q.round} (Set ${q.set || 'A'})</div>
        <div class="meta">Domain: ${q.domain} &bull; ${q.points} pt(s)</div>
        <div class="panels-row">
          ${q.cluePanels.map((p, idx) => `
            <div class="pbox">
              <div class="pnum">PANEL ${p.panelNumber || idx + 1}</div>
              <div class="pname">${p.subText || p.svgType.toUpperCase()}</div>
            </div>
          `).join('')}
        </div>
        <div class="formula"><strong>Formula:</strong> ${q.rebusFormulaText}</div>
        <div class="ans"><strong>Answer:</strong> ${q.correctAnswer}</div>
      </div>
    `).join('')}
  </div>
</body>
</html>
  `;
  rootFolder.file('VIEWER_GALLERY.html', galleryHtml);

  // Readme
  const readme = `TECH BRIDGE '26 - OFFICIAL OFFLINE PANEL IMAGES PACKET
================================================================================
Round Filter: ${roundFilter}
Set Filter: ${setFilter}
Total Questions: ${questions.length}
Exported: ${new Date().toLocaleString()}

FOLDER CONTENTS:
- 01_Photographic_Clues/      : 16:9 Realistic photographic scenes for every question
- 02_Vector_Clue_Panels/      : Individual high-res SVG vector clue panels (Panel 1, Panel 2, etc.)
- 03_Combined_Question_Cards/ : Full-card SVG graphics combining all panels per question
- VIEWER_GALLERY.html         : Standalone double-clickable visual catalog (works offline in any browser)

Organized by: Department of Computer Science & Engineering
Achariya College of Engineering Technology
`;
  rootFolder.file('README.txt', readme);

  onProgress?.('Compressing ZIP Archive...');
  const content = await zip.generateAsync({ type: 'blob' });

  // Trigger Download
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = `TechBridge26_Panel_Images_R${roundFilter}_Set${setFilter}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Downloads a standalone HTML visual panel dossier with all embedded SVG panel art
 */
export function downloadPanelImagesDossierHtml(
  questions: Question[],
  roundFilter: string = 'ALL',
  setFilter: string = 'ALL'
): void {
  const cardsHtml = questions.map(q => {
    const qImgs = (q.images && q.images.length > 0) 
      ? q.images.filter(Boolean) 
      : (q.customImageUrl ? [q.customImageUrl] : getRealisticImagesForQuestion(q.id, q.explanation));

    const photosHtml = qImgs.length > 0 ? `
      <div style="display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; justify-content: flex-start; align-items: stretch;">
        ${qImgs.map((imgUrl, idx) => `
          <div style="flex: 1; min-width: 220px; max-width: 320px; border: 1.5px solid #cbd5e1; border-radius: 12px; overflow: hidden; background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
            <div style="font-size: 11px; font-weight: bold; color: #0284c7; padding: 6px 10px; background: #f0f9ff; border-bottom: 1px solid #e0f2fe; display: flex; justify-content: space-between;">
              <span>CLUE #${idx + 1}</span>
              <span>REAL IMAGE</span>
            </div>
            <img src="${imgUrl}" alt="Clue ${idx + 1}" style="width: 100%; height: 160px; object-fit: cover; display: block;" onerror="this.style.display='none'" />
          </div>
        `).join('')}
      </div>
    ` : '';

    return `
      <div style="border: 2px solid #94a3b8; border-radius: 16px; padding: 20px; margin-bottom: 24px; background: #f8fafc; page-break-inside: avoid;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 10px; margin-bottom: 16px;">
          <div>
            <strong style="font-size: 16px; color: #0f172a;">QUESTION #${q.questionNumber} &bull; ROUND ${q.round} (SET ${q.set || 'A'})</strong>
            <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Domain: ${q.domain} &bull; Points: ${q.points} pt(s)</div>
          </div>
          <div style="font-size: 12px; font-family: monospace; font-weight: bold; background: #e2e8f0; padding: 4px 8px; border-radius: 6px;">ID: ${q.id}</div>
        </div>

        <div style="font-size: 13px; font-weight: 600; color: #1e293b; margin-bottom: 10px;">
          Visual Technical Rebus Clue Images:
        </div>

        ${photosHtml}

        <div style="background: #ecfdf5; border: 1px solid #6ee7b7; border-radius: 8px; padding: 10px; font-size: 13px; color: #065f46;">
          <strong>CORRECT ANSWER:</strong> ${q.correctAnswer}
          ${q.aliases && q.aliases.length > 0 ? `<div style="font-size: 11px; color: #047857; margin-top: 2px;">Aliases: ${q.aliases.join(', ')}</div>` : ''}
          ${q.explanation ? `<div style="font-size: 11px; color: #047857; margin-top: 4px;"><strong>Technical Explanation:</strong> ${q.explanation}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  const htmlDoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>TechBridge26_Panel_Images_Folio_R${roundFilter}_Set${setFilter}</title>
  <style>
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; color: #0f172a; max-width: 960px; margin: 0 auto; background: #ffffff; }
    .header { border-bottom: 3px solid #0f172a; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start; }
    .title { font-size: 22px; font-weight: 800; color: #0f172a; }
    .sub { font-size: 13px; color: #475569; margin-top: 2px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div style="font-size: 11px; font-weight: bold; color: #0284c7; letter-spacing: 0.5px;">DEPARTMENT OF COMPUTER SCIENCE &amp; ENGINEERING &bull; ACET</div>
      <div class="title">TECH BRIDGE '26 &bull; VISUAL REBUS PANEL IMAGES FOLIO</div>
      <div class="sub">HIGH-RESOLUTION STANDALONE PANEL IMAGES &amp; REBUS DIAGRAMS</div>
    </div>
    <div style="text-align: right; font-size: 12px; font-family: monospace;">
      <div>Round: ${roundFilter} &bull; Set: ${setFilter}</div>
      <div>Total Questions: ${questions.length}</div>
      <div>Date: March 2026</div>
    </div>
  </div>
  ${cardsHtml}
</body>
</html>`;

  const blob = new Blob([htmlDoc], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `TechBridge26_Panel_Images_R${roundFilter}_Set${setFilter}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
