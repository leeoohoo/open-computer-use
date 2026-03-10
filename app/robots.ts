import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/auth/error',
          '/c/*/edit',
          '/p/*/settings',
        ],
        crawlDelay: 1,
      },
      {
        userAgent: ['Googlebot', 'Bingbot'],
        allow: '/',
        crawlDelay: 0,
      },
      {
        userAgent: 'GPTBot',
        allow: ['/', '/blog/', '/results/', '/compare/'],
        disallow: ['/api/', '/c/'],
      },
      {
        userAgent: ['ChatGPT-User', 'Google-Extended', 'Anthropic-AI', 'ClaudeBot', 'PerplexityBot', 'Cohere-AI', 'Bytespider', 'YouBot'],
        allow: '/',
        disallow: ['/api/', '/c/'],
      },
      {
        userAgent: ['AhrefsBot', 'SemrushBot', 'MJ12bot', 'DotBot', 'PetalBot', 'BLEXBot'],
        disallow: '/',
      },
    ],
    sitemap: 'https://coasty.ai/sitemap.xml',
  }
}
