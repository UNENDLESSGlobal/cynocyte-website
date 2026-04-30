import { Helmet } from 'react-helmet-async'

interface BreadcrumbItem {
  name: string
  url: string
}

interface BreadcrumbSchemaProps {
  items: BreadcrumbItem[]
}

/**
 * BreadcrumbSchema Component
 * Adds JSON-LD breadcrumb schema for better navigation SEO
 */
export default function BreadcrumbSchema({ items }: BreadcrumbSchemaProps) {
  const breadcrumbList = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(breadcrumbList)}</script>
    </Helmet>
  )
}
