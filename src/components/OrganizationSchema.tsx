import { Helmet } from 'react-helmet-async'

/**
 * OrganizationSchema Component
 * Outputs JSON-LD structured data for the "Cynocyte Systems" organization.
 * Helps Google understand the brand entity and its founder.
 */
export default function OrganizationSchema() {
  const organizationData = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Cynocyte Systems',
    url: 'https://cynocyte.vercel.app',
    logo: 'https://cynocyte.vercel.app/logos/cynocyte%20long%20logo%20for%20dark%20theme.png',
    description:
      'Cynocyte Systems builds intelligent products and experimental AI platforms, including Cynocyte Play Labs and Revisit.',
    founder: {
      '@type': 'Person',
      name: 'Swarnadeep Mukherjee',
      url: 'https://cynocyte.vercel.app/about',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'cynocyte@gmail.com',
      contactType: 'Customer Support',
      url: 'https://cynocyte.vercel.app',
    },
    sameAs: [
      'https://twitter.com/cynocyte',
      'https://www.instagram.com/cynocyte/',
      'https://www.youtube.com/@Cynocyte',
      'https://github.com/cynocyte',
    ],
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'IN',
    },
  }

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(organizationData)}</script>
    </Helmet>
  )
}
