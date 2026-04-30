import { Helmet } from 'react-helmet-async'

/**
 * PersonSchema Component
 * Outputs JSON-LD structured data for "Swarnadeep Mukherjee" as the
 * founder of Cynocyte (the primary organization).
 * 
 * INVISIBLE SEO: This component renders NO visible DOM — only JSON-LD in <head>.
 */
export default function PersonSchema() {
  const personData = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: 'Swarnadeep Mukherjee',
    jobTitle: 'Founder & Developer',
    description:
      'Swarnadeep Mukherjee is the founder and developer of Cynocyte, building intelligent products and experimental AI platforms.',
    url: 'https://cynocyte.vercel.app/about',
    worksFor: {
      '@type': 'Organization',
      name: 'Cynocyte',
      url: 'https://cynocyte.vercel.app',
    },
    knowsAbout: [
      'Artificial Intelligence',
      'Computer Vision',
      'Web Development',
      'React',
      'MediaPipe',
      'Machine Learning',
    ],
  }

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(personData)}</script>
    </Helmet>
  )
}
