import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://coasty.ai'

  const blogPostIds = [
    'desktop-control-agi',
    'coasty-reddit-marketing',
    'qa-testing-itself',
    'osworld-benchmark',
    'prospecting-outreach',
    'yc-application',
    'job-application-agent',
    'hacker-news-engagement',
    'multi-model-orchestration',
    'electron-local-agent',
    'browser-agent-architecture',
    'email-automation-case',
    'sandboxed-execution',
    'ai-employee-economics',
    'customer-support-agent',
    'byok-philosophy',
    'linkedin-recruiting',
    'prompt-caching-tokens',
    'future-ai-agents',
    'open-source-movement',
  ]

  const competitorSlugs = [
    'anthropic-computer-use',
    'openai-operator',
    'adept-ai',
    'multion',
    'browserbase',
    'induced-ai',
    'uipath',
    'automation-anywhere',
    'virtual-assistant',
    'devin-ai',
  ]

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/results`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/download`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.85,
    },
    {
      url: `${baseUrl}/compare`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.85,
    },
    {
      url: `${baseUrl}/auth`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
  ]

  const blogPages: MetadataRoute.Sitemap = blogPostIds.map((id) => ({
    url: `${baseUrl}/blog/${id}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  const comparePages: MetadataRoute.Sitemap = competitorSlugs.map((slug) => ({
    url: `${baseUrl}/compare/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }))

  return [...staticPages, ...blogPages, ...comparePages]
}
