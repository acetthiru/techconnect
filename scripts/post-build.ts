import fs from 'fs';
import path from 'path';

const rootIndexPath = path.resolve(process.cwd(), 'index.html');
const distIndexPath = path.resolve(process.cwd(), 'dist', 'index.html');

if (fs.existsSync(distIndexPath)) {
  let html = fs.readFileSync(distIndexPath, 'utf-8');

  // Ensure critical landing CSS is present in head
  if (!html.includes('critical-landing-css')) {
    const criticalCss = `
    <!-- Critical Inlined CSS for 0ms Instant First Contentful Paint & LCP -->
    <style id="critical-landing-css">
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        background-color: #000000;
        color: #f1f5f9;
        font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        overflow-x: hidden;
        -webkit-tap-highlight-color: transparent;
      }
      #event-landing-root {
        position: fixed;
        inset: 0;
        width: 100%;
        height: 100%;
        height: 100dvh;
        max-width: 100vw;
        max-height: 100dvh;
        overflow: hidden;
        background-color: #000000;
        color: #f1f5f9;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: center;
        user-select: none;
        -webkit-user-select: none;
      }
      #landing-event-poster-img {
        max-width: 100%;
        max-height: 100%;
        width: auto;
        height: auto;
        object-fit: contain;
        object-position: center;
        display: block;
        margin: 0 auto;
        filter: drop-shadow(0 20px 25px rgba(0, 0, 0, 0.7));
      }
      .font-tech {
        font-family: 'Chakra Petch', sans-serif;
      }
      .font-mono-code {
        font-family: 'JetBrains Mono', monospace;
      }
    </style>`;
    html = html.replace('</head>', `${criticalCss}\n  </head>`);
  }

  // Defer render-blocking CSS: Convert external stylesheet link to rel="preload" with non-blocking media swap
  html = html.replace(
    /<link\s+rel=["']stylesheet["']\s+crossorigin\s+href=["'](\/assets\/[^"']+\.css)["']>/gi,
    `<link rel="preload" as="style" href="$1"><link rel="stylesheet" href="$1" media="print" onload="this.media='all'"><noscript><link rel="stylesheet" href="$1"></noscript>`
  ).replace(
    /<link\s+crossorigin\s+rel=["']stylesheet["']\s+href=["'](\/assets\/[^"']+\.css)["']>/gi,
    `<link rel="preload" as="style" href="$1"><link rel="stylesheet" href="$1" media="print" onload="this.media='all'"><noscript><link rel="stylesheet" href="$1"></noscript>`
  );

  fs.writeFileSync(distIndexPath, html, 'utf-8');
  console.log('✅ Successfully optimized dist/index.html with critical inline CSS and deferred CSS loading.');
}
