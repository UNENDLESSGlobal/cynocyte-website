import { Helmet } from 'react-helmet-async'

/**
 * OrganizationSchema Component
 * Outputs JSON-LD structured data establishing the Branded House hierarchy:
 *   UNENDLESS (parent) → Cynocyte (primary) → Cynocyte Systems (division)
 *   with Swarnadeep Mukherjee as founder.
 * 
 * INVISIBLE SEO: This component renders NO visible DOM — only JSON-LD in <head>.
 */
export default function OrganizationSchema() {
  const organizationData = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Cynocyte',
    url: 'https://cynocyte.vercel.app',
    logo: 'https://cynocyte.vercel.app/logos/cynocyte%20long%20logo%20for%20dark%20theme.png',
    description:
      'Cynocyte builds intelligent products and experimental AI platforms, including Cynocyte Play Labs and Revisit.',
    founder: {
      '@type': 'Person',
      name: 'Swarnadeep Mukherjee',
      url: 'https://cynocyte.vercel.app/about',
    },
    parentOrganization: {
      '@type': 'Organization',
      name: 'UNENDLESS',
    },
    department: {
      '@type': 'Organization',
      name: 'Cynocyte Systems',
      description:
        'Cynocyte Systems is the interactive computer vision infrastructure division of Cynocyte, powering Play Labs and experimental AI platforms.',
      url: 'https://cynocyte.vercel.app/systems',
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
