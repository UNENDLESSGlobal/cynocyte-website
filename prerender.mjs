/**
 * Prerender Script for Cynocyte Website
 * 
 * Runs after `vite build` to generate static HTML files for SEO.
 * Uses Puppeteer to render each route and save the fully-rendered HTML,
 * including React Helmet metadata and JSON-LD structured data.
 * 
 * Usage: node prerender.mjs
 */

import { launch } from 'puppeteer';
import { createServer } from 'http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = join(__dirname, 'dist');
const PORT = 4173;

// Routes to prerender
const ROUTES = [
  '/',
  '/about',
  '/labs',
];

// Dynamically read experiment IDs from the built registry to prerender all experiment pages
// We extract IDs from the source file since the built JS is bundled
function getExperimentIds() {
  try {
    const registryPath = join(__dirname, 'src', 'experiments', 'registry.ts');
    const content = readFileSync(registryPath, 'utf-8');
    const idMatches = content.matchAll(/id:\s*'([^']+)'/g);
    const ids = [];
    for (const match of idMatches) {
      ids.push(match[1]);
    }
    return ids;
  } catch (e) {
    console.warn('⚠️  Could not read experiment registry, skipping experiment routes:', e.message);
    return [];
  }
}

// Simple static file server for the dist directory
function createStaticServer() {
  return new Promise((resolve) => {
    const MIME_TYPES = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.webp': 'image/webp',
    };

    const server = createServer((req, res) => {
      let filePath = join(DIST_DIR, req.url === '/' ? 'index.html' : req.url);
      
      // SPA fallback: if file doesn't exist and no extension, serve index.html
      if (!existsSync(filePath) && !extname(filePath)) {
        filePath = join(DIST_DIR, 'index.html');
      }

      try {
        const content = readFileSync(filePath);
        const ext = extname(filePath);
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      } catch {
        // Fallback to index.html for SPA routing
        try {
          const content = readFileSync(join(DIST_DIR, 'index.html'));
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(content);
        } catch {
          res.writeHead(404);
          res.end('Not Found');
        }
      }
    });

    server.listen(PORT, () => {
      console.log(`📦 Static server running on http://localhost:${PORT}`);
      resolve(server);
    });
  });
}

async function prerender() {
  console.log('\n🚀 Starting prerender...\n');
  
  // Add experiment routes
  const experimentIds = getExperimentIds();
  const allRoutes = [
    ...ROUTES,
    ...experimentIds.map(id => `/labs/${id}`),
  ];

  console.log(`📄 Routes to prerender: ${allRoutes.length}`);
  
  // Start static server
  const server = await createStaticServer();
  
  // Launch Puppeteer
  const browser = await launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  let successCount = 0;
  let errorCount = 0;

  for (const route of allRoutes) {
    try {
      const page = await browser.newPage();
      
      // Navigate and wait for React to render + Helmet to inject tags
      await page.goto(`http://localhost:${PORT}${route}`, {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });

      // Wait a bit more for React Helmet to update the head
      await page.waitForFunction(() => {
        return document.querySelector('title') !== null;
      }, { timeout: 5000 }).catch(() => {
        // Title might already exist from index.html
      });

      // Get the full rendered HTML
      const html = await page.content();

      // Determine output path
      const outputDir = route === '/'
        ? DIST_DIR
        : join(DIST_DIR, ...route.split('/').filter(Boolean));

      // Create directory if needed
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }

      // Write the HTML file
      const outputPath = join(outputDir, 'index.html');
      writeFileSync(outputPath, html, 'utf-8');
      
      successCount++;
      // Log progress every 10 routes or for static pages
      if (successCount <= 4 || successCount % 10 === 0) {
        console.log(`  ✅ ${route} → ${outputPath.replace(DIST_DIR, 'dist')}`);
      }

      await page.close();
    } catch (err) {
      errorCount++;
      console.error(`  ❌ ${route}: ${err.message}`);
    }
  }

  await browser.close();
  server.close();

  console.log(`\n🎉 Prerender complete: ${successCount} pages rendered, ${errorCount} errors\n`);
  
  if (errorCount > 0) {
    process.exit(1);
  }
}

prerender().catch((err) => {
  console.error('Fatal prerender error:', err);
  process.exit(1);
});
