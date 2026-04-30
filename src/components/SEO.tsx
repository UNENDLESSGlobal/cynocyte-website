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

/**
 * SEO Component
 * Manages metadata for page optimization across all pages.
 * Uses react-helmet-async to update document head.
 */
export default function SEO({
  title = 'Cynocyte — Intelligent Products & Experimental Platforms',
  description = 'Cynocyte builds intelligent products and experimental platforms. Explore Cynocyte Play Labs for 55 AI-powered browser experiments running on your device.',
  canonicalUrl = 'https://cynocyte.vercel.app',
  ogImage = 'https://cynocyte.vercel.app/logos/cynocyte%20long%20logo%20for%20dark%20theme.png',
  ogType = 'website',
  keywords = 'Cynocyte, AI experiments, computer vision, hand tracking, face detection, pose estimation, interactive AI, Play Labs, browser experiments, web AI, MediaPipe',
  author = 'Cynocyte Systems',
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
      
      {/* Canonical URL for SEO */}
      <link rel="canonical" href={canonicalUrl} />
      
      {/* Open Graph Tags */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content="Cynocyte" />
      
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
