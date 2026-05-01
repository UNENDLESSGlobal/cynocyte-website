import { Helmet } from 'react-helmet-async'

interface SEOProps {
  title?: string
  description?: string
  canonicalUrl?: string
  ogImage?: string
  ogType?: string
  keywords?: string
  author?: string
  twitterCard?: string
  children?: React.ReactNode
}

/** All target keywords — invisible to users, readable by crawlers */
const HIDDEN_KEYWORDS = 'cynocyte, cynocyte systems, unendless, swarnadeep mukherjee, revisit, student manager, student daily life management, student academic manager, academic planner, academic tracker, student productivity, AI experiments, computer vision browser, hand tracking, face detection, MediaPipe, interactive AI, browser AI, no download AI, play labs, AI platform, intelligent products, experimental platforms'

/**
 * SEO Component
 * Manages metadata for page optimization across all pages.
 * Uses react-helmet-async to update document head.
 * Title format: "Cynocyte" on home, "[Page] | Cynocyte" on sub-pages.
 */
export default function SEO({
  title = 'Cynocyte',
  description = 'Cynocyte builds intelligent products and experimental AI platforms. Explore Revisit for academic life management and Cynocyte Play Labs for 55+ interactive browser AI experiences. A division of UNENDLESS.',
  canonicalUrl = 'https://cynocyte.vercel.app',
  ogImage = 'https://cynocyte.vercel.app/logos/cynocyte-long-logo-for-dark-theme.png',
  ogType = 'website',
  keywords = HIDDEN_KEYWORDS,
  author = 'Cynocyte',
  twitterCard = 'summary_large_image',
  children,
}: SEOProps) {
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="author" content={author} />
      <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
      <meta name="googlebot" content="index, follow" />
      
      {/* Hidden keyword meta tags — invisible to users, readable by crawlers */}
      <meta name="subject" content="Student academic management, AI browser experiments, computer vision platform" />
      <meta name="classification" content="Technology, Artificial Intelligence, Student Productivity" />
      <meta name="category" content="AI Platform, Student App, Computer Vision" />
      <meta name="news_keywords" content="Cynocyte, AI experiments, student app, Revisit, Swarnadeep Mukherjee, UNENDLESS" />

      {/* Canonical URL for SEO */}
      <link rel="canonical" href={canonicalUrl} />
      
      {/* Language */}
      <link rel="alternate" hrefLang="en" href={canonicalUrl} />

      {/* Open Graph Tags */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content="Cynocyte" />
      <meta property="og:locale" content="en_US" />
      
      {/* Twitter Card Tags */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      <meta name="twitter:site" content="@cynocyte" />
      
      {/* Additional Meta Tags */}
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="theme-color" content="#0A0A1A" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      
      {/* Children for additional custom tags */}
      {children}
    </Helmet>
  )
}
