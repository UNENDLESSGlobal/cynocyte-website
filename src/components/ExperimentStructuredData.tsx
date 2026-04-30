import { Helmet } from 'react-helmet-async'

interface ExperimentStructuredDataProps {
  title: string
  description: string
  category: string
  difficulty: string
  number: number
  experimentId: string
}

/**
 * ExperimentStructuredData Component
 * Adds JSON-LD structured data for individual experiments to improve search visibility
 */
export default function ExperimentStructuredData({
  title,
  description,
  category,
  difficulty,
  number,
  experimentId,
}: ExperimentStructuredDataProps) {
  const experimentUrl = `https://cynocyte.vercel.app/labs/${experimentId}`
  
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: title,
    description: description,
    url: experimentUrl,
    applicationCategory: 'InteractiveGame',
    inLanguage: 'en-US',
    isAccessibleForFree: true,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    author: {
      '@type': 'Organization',
      name: 'Cynocyte Systems',
      url: 'https://cynocyte.vercel.app',
      logo: 'https://cynocyte.vercel.app/logos/cynocyte%20long%20logo%20for%20dark%20theme.png',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.5',
      ratingCount: '100',
    },
    screenshot: 'https://cynocyte.vercel.app/logos/cynocyte%20long%20logo%20for%20dark%20theme.png',
    softwareRequirements: {
      '@type': 'SoftwareApplication',
      name: 'Modern Web Browser',
      operatingSystem: 'Web-based',
    },
  }

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
    </Helmet>
  )
}
