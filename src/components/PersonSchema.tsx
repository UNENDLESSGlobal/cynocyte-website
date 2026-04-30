import { Helmet } from 'react-helmet-async'

/**
 * PersonSchema Component
 * Outputs JSON-LD structured data for "Swarnadeep Mukherjee" as the
 * founder and developer of Cynocyte Systems. Crucial for name ranking.
 */
export default function PersonSchema() {
  const personData = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: 'Swarnadeep Mukherjee',
    jobTitle: 'Founder & Developer',
    description:
      'Swarnadeep Mukherjee is the founder and developer of Cynocyte Systems, building intelligent products and experimental AI platforms.',
    url: 'https://cynocyte.vercel.app/about',
    worksFor: {
      '@type': 'Organization',
      name: 'Cynocyte Systems',
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
