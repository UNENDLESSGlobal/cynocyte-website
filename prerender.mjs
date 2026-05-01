/**
 * Template-Based Prerender Script for Cynocyte Website
 * 
 * Generates static HTML files for each route by injecting route-specific
 * <title>, <meta>, and JSON-LD structured data into the built index.html.
 * 
 * No browser or Puppeteer required — works on any CI/CD (including Vercel).
 * Googlebot executes JavaScript natively, so the injected metadata gives
 * crawlers immediate access to SEO-critical signals while React hydrates.
 * 
 * Usage: node prerender.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = join(__dirname, 'dist');
const SITE_URL = 'https://cynocyte.vercel.app';

// ─── Route Metadata ─────────────────────────────────────────────────────────

const STATIC_ROUTES = [
  {
    path: '/',
    title: 'Cynocyte',
    description: 'Cynocyte builds intelligent products and experimental AI platforms. Explore Revisit, the student academic life manager, and Cynocyte Play Labs \u2014 55 browser-based AI experiments. Founded by Swarnadeep Mukherjee under UNENDLESS.',
    keywords: 'cynocyte, cynocyte systems, unendless, swarnadeep mukherjee, revisit, student manager, student daily life management, student academic manager, academic planner, academic tracker, student productivity, AI experiments, computer vision browser, hand tracking, face detection, MediaPipe, interactive AI, browser AI, no download AI, play labs, AI platform, intelligent products, experimental platforms',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Cynocyte', item: SITE_URL }],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Cynocyte',
        url: SITE_URL,
        logo: `${SITE_URL}/logos/cynocyte-long-logo-for-dark-theme.png`,
        description: 'Cynocyte builds intelligent products and experimental AI platforms, including Cynocyte Play Labs and Revisit.',
        founder: { '@type': 'Person', name: 'Swarnadeep Mukherjee', url: `${SITE_URL}/about` },
        parentOrganization: { '@type': 'Organization', name: 'UNENDLESS' },
        department: { '@type': 'Organization', name: 'Cynocyte Systems', description: 'Interactive computer vision infrastructure division of Cynocyte' },
        contactPoint: { '@type': 'ContactPoint', email: 'cynocyte@gmail.com', contactType: 'Customer Support' },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: 'Swarnadeep Mukherjee',
        jobTitle: 'Founder & Developer',
        description: 'Swarnadeep Mukherjee is the founder and developer of Cynocyte.',
        url: `${SITE_URL}/about`,
        worksFor: { '@type': 'Organization', name: 'Cynocyte', url: SITE_URL },
      },
    ],
  },
  {
    path: '/about',
    title: 'About | Cynocyte',
    description: 'Cynocyte is a technology company under UNENDLESS, building intelligent products and AI platforms. Learn about Cynocyte Systems, Revisit, and founder Swarnadeep Mukherjee.',
    keywords: 'Cynocyte, Cynocyte Systems, Play Labs, AI experiments, computer vision, hand tracking, browser-based AI, MediaPipe, educational AI, swarnadeep mukherjee, cynocyte founder, unendless, revisit app developer',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Cynocyte', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'About', item: `${SITE_URL}/about` },
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: 'Swarnadeep Mukherjee',
        jobTitle: 'Founder & Developer',
        description: 'Swarnadeep Mukherjee is the founder and developer of Cynocyte.',
        url: `${SITE_URL}/about`,
        worksFor: { '@type': 'Organization', name: 'Cynocyte', url: SITE_URL },
      },
    ],
  },
  {
    path: '/labs',
    title: 'Play Labs | Cynocyte',
    description: 'Explore 55 interactive browser AI experiments by Cynocyte. Hand tracking, face detection, music synthesis \u2014 no download required. Powered by Cynocyte Systems.',
    keywords: 'Cynocyte, Cynocyte Systems, Play Labs, AI experiments, hand tracking, face detection, pose estimation, music synthesis, computer vision, interactive AI, browser AI, no download AI',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Cynocyte', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Play Labs', item: `${SITE_URL}/labs` },
        ],
      },
    ],
  },
  {
    path: '/systems',
    title: 'Systems | Cynocyte',
    description: 'Cynocyte Systems builds intelligent digital systems, automation infrastructure, and scalable business technology for modern enterprises. A technology services division of Cynocyte under UNENDLESS.',
    keywords: 'Cynocyte Systems, intelligent digital systems, automation infrastructure, business technology, website systems, custom digital infrastructure, scalable technology, enterprise automation, Cynocyte, UNENDLESS, Swarnadeep Mukherjee',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Cynocyte', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Systems', item: `${SITE_URL}/systems` },
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Cynocyte Systems',
        url: `${SITE_URL}/systems`,
        description: 'Cynocyte Systems builds intelligent digital systems, automation infrastructure, and scalable business technology for modern enterprises.',
        parentOrganization: { '@type': 'Organization', name: 'Cynocyte', url: SITE_URL },
        founder: { '@type': 'Person', name: 'Swarnadeep Mukherjee' },
      },
    ],
  },
];

// ─── Parse experiment data from source registry ─────────────────────────────

function getExperimentRoutes() {
  try {
    const registryPath = join(__dirname, 'src', 'experiments', 'registry.ts');
    const content = readFileSync(registryPath, 'utf-8');

    // Split into individual experiment blocks
    const experimentBlocks = content.split(/\{\s*\n\s*id:/g).slice(1);
    const routes = [];

    for (const block of experimentBlocks) {
      const idMatch = block.match(/^[\s]*'([^']+)'/);
      const titleMatch = block.match(/title:\s*'([^']+)'/);
      const descMatch = block.match(/description:\s*'([^']+)'/);
      const categoryMatch = block.match(/category:\s*'([^']+)'/);
      const taglineMatch = block.match(/tagline:\s*'([^']+)'/);

      if (!idMatch || !titleMatch) continue;

      const id = idMatch[1];
      const title = titleMatch[1];
      const description = descMatch ? descMatch[1] : `Interactive AI experiment from Cynocyte Play Labs.`;
      const category = categoryMatch ? categoryMatch[1] : 'AI';
      const tagline = taglineMatch ? taglineMatch[1] : '';

      routes.push({
        path: `/labs/${id}`,
        title: `${title} | Cynocyte`,
        description: `${description} Interactive AI experiment by Cynocyte Systems.`,
        keywords: `${title}, ${category}, Cynocyte, Cynocyte Systems, AI experiments, Play Labs, ${tagline}`,
        jsonLd: [
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
              { '@type': 'ListItem', position: 2, name: 'Play Labs', item: `${SITE_URL}/labs` },
              { '@type': 'ListItem', position: 3, name: title, item: `${SITE_URL}/labs/${id}` },
            ],
          },
          {
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: title,
            description: description,
            url: `${SITE_URL}/labs/${id}`,
            applicationCategory: 'InteractiveGame',
            isAccessibleForFree: true,
            author: {
              '@type': 'Organization',
              name: 'Cynocyte',
              url: SITE_URL,
            },
          },
        ],
      });
    }

    return routes;
  } catch (e) {
    console.warn('⚠️  Could not parse experiment registry:', e.message);
    return [];
  }
}

// ─── HTML Injection ─────────────────────────────────────────────────────────

function injectMetadata(html, route) {
  const { title, description, keywords, jsonLd, path } = route;
  const canonicalUrl = `${SITE_URL}${path === '/' ? '' : path}`;

  // Build the metadata block to inject right after the opening <head> tag
  const metaBlock = [
    `<!-- Prerendered SEO metadata for ${path} -->`,
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeAttr(description)}" />`,
    `<meta name="keywords" content="${escapeAttr(keywords)}" />`,
    `<meta name="author" content="Cynocyte" />`,
    `<link rel="canonical" href="${canonicalUrl}" />`,
    `<meta property="og:title" content="${escapeAttr(title)}" />`,
    `<meta property="og:description" content="${escapeAttr(description)}" />`,
    `<meta property="og:url" content="${canonicalUrl}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Cynocyte" />`,
    `<meta property="og:image" content="${SITE_URL}/logos/cynocyte-long-logo-for-dark-theme.png" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeAttr(title)}" />`,
    `<meta name="twitter:description" content="${escapeAttr(description)}" />`,
    `<meta name="twitter:image" content="${SITE_URL}/logos/cynocyte-long-logo-for-dark-theme.png" />`,
    ...jsonLd.map(ld => `<script type="application/ld+json">${JSON.stringify(ld)}</script>`),
    `<!-- End prerendered metadata -->`,
  ].join('\n    ');

  // Inject after <head> opening tag (before existing content)
  return html.replace('<head>', `<head>\n    ${metaBlock}`);
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Main ───────────────────────────────────────────────────────────────────

function prerender() {
  console.log('\n🚀 Starting prerender...\n');

  // Read the built index.html template
  const templatePath = join(DIST_DIR, 'index.html');
  if (!existsSync(templatePath)) {
    console.error('❌ dist/index.html not found. Run vite build first.');
    process.exit(1);
  }
  const template = readFileSync(templatePath, 'utf-8');

  // Collect all routes
  const experimentRoutes = getExperimentRoutes();
  const allRoutes = [...STATIC_ROUTES, ...experimentRoutes];

  console.log(`📄 Routes to prerender: ${allRoutes.length}`);
  console.log(`   Static: ${STATIC_ROUTES.length} | Experiments: ${experimentRoutes.length}\n`);

  let successCount = 0;

  for (const route of allRoutes) {
    try {
      const html = injectMetadata(template, route);

      // Determine output path
      const outputDir = route.path === '/'
        ? DIST_DIR
        : join(DIST_DIR, ...route.path.split('/').filter(Boolean));

      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }

      const outputPath = join(outputDir, 'index.html');
      writeFileSync(outputPath, html, 'utf-8');
      successCount++;

      // Log progress
      if (successCount <= 4 || successCount % 10 === 0 || successCount === allRoutes.length) {
        console.log(`  ✅ ${route.path} → ${outputPath.replace(DIST_DIR, 'dist')}`);
      }
    } catch (err) {
      console.error(`  ❌ ${route.path}: ${err.message}`);
    }
  }

  console.log(`\n🎉 Prerender complete: ${successCount}/${allRoutes.length} pages generated\n`);
}

prerender();
