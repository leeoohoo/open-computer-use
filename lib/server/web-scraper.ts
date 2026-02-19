/**
 * Web Scraping Utility
 * 
 * This module provides comprehensive web scraping functionality for extracting content
 * from web pages. It's designed to work with the search functionality to provide
 * full content instead of just metadata.
 * 
 * Features:
 * - Extracts clean text content from HTML pages
 * - Handles timeouts and error conditions gracefully
 * - Supports parallel scraping with rate limiting
 * - Extracts metadata (title, author, publish date, etc.)
 * - Calculates reading time and word count
 * - Removes unwanted elements (ads, navigation, etc.)
 * 
 * Usage:
 * ```typescript
 * import { scrapeWebContent, scrapeMultipleUrls } from './web-scraper'
 * 
 * // Single URL
 * const content = await scrapeWebContent('https://example.com')
 * 
 * // Multiple URLs with rate limiting
 * const contents = await scrapeMultipleUrls(['url1', 'url2'], { maxContentLength: 3000 })
 * ```
 * 
 * @author Coasty
 * @version 1.0.0
 */
import * as cheerio from 'cheerio'

export interface ScrapedContent {
  title: string
  content: string
  description: string
  author?: string
  publishedDate?: string
  wordCount: number
  readingTime: number
  language?: string
  error?: string
  errorType?: 'timeout' | 'forbidden' | 'not_html' | 'network' | 'invalid_url' | 'unknown'
  statusCode?: number
}

export interface ScrapingOptions {
  maxContentLength?: number
  timeout?: number
  includeImages?: boolean
  includeLinks?: boolean
  userAgent?: string
  retryAttempts?: number
  retryDelay?: number
  logLevel?: 'error' | 'warn' | 'info' | 'debug'
}

const DEFAULT_OPTIONS: ScrapingOptions = {
  maxContentLength: 5000,
  timeout: 8000,
  includeImages: false,
  includeLinks: false,
  userAgent: 'Mozilla/5.0 (compatible; Coasty/1.0; +https://coasty.ai/bot)',
  retryAttempts: 2,
  retryDelay: 1000,
  logLevel: 'error'
}

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
}

function log(level: keyof typeof LOG_LEVELS, message: string, options: ScrapingOptions) {
  const currentLevel = LOG_LEVELS[options.logLevel || 'error']
  if (LOG_LEVELS[level] <= currentLevel) {
    const prefix = `[Web Scraper][${level.toUpperCase()}]`
    if (level === 'error') {
      console.error(`${prefix} ${message}`)
    } else {
      console.log(`${prefix} ${message}`)
    }
  }
}

/**
 * Scrapes content from a web page URL
 */
async function attemptScrape(
  url: string,
  opts: Required<ScrapingOptions>,
  attempt: number = 1
): Promise<ScrapedContent> {
  try {
    log('info', `Attempt ${attempt}: Scraping content from: ${url}`, opts)
    
    // Validate URL
    if (!url || !isValidUrl(url)) {
      const error = new Error('Invalid URL provided')
      ;(error as any).errorType = 'invalid_url'
      throw error
    }
    
    // Set up fetch with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      controller.abort()
      log('warn', `Request timed out after ${opts.timeout}ms`, opts)
    }, opts.timeout)
    
    // Fetch the page
    const response = await fetch(url, {
      headers: {
        'User-Agent': opts.userAgent!,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`)
      ;(error as any).errorType = response.status === 403 ? 'forbidden' : 'network'
      ;(error as any).statusCode = response.status
      throw error
    }
    
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      const error = new Error(`Content is not HTML (${contentType})`)
      ;(error as any).errorType = 'not_html'
      ;(error as any).contentType = contentType
      throw error
    }
    
    const html = await response.text()
    
    // Parse with cheerio
    const $ = cheerio.load(html)
    
    // Extract content
    const scrapedContent = extractContent($, opts)
    
    log('info', `Successfully scraped ${scrapedContent.wordCount} words from ${url}`, opts)
    
    return scrapedContent
    
  } catch (error: any) {
    // Determine error type
    let errorType: ScrapedContent['errorType'] = 'unknown'
    if (error.errorType) {
      errorType = error.errorType
    } else if (error.name === 'AbortError') {
      errorType = 'timeout'
    } else if (error.message?.includes('fetch')) {
      errorType = 'network'
    }
    
    log('error', `Error scraping ${url} (${errorType}): ${error.message}`, opts)
    
    // Check if we should retry
    if (attempt < opts.retryAttempts && errorType !== 'invalid_url' && errorType !== 'not_html') {
      log('info', `Retrying after ${opts.retryDelay}ms...`, opts)
      await new Promise(resolve => setTimeout(resolve, opts.retryDelay))
      return attemptScrape(url, opts, attempt + 1)
    }
    
    return {
      title: getErrorTitle(errorType),
      content: '',
      description: getErrorDescription(errorType, error),
      wordCount: 0,
      readingTime: 0,
      error: error.message,
      errorType,
      statusCode: error.statusCode
    }
  }
}

export async function scrapeWebContent(
  url: string,
  options: ScrapingOptions = {}
): Promise<ScrapedContent> {
  const opts = { ...DEFAULT_OPTIONS, ...options } as Required<ScrapingOptions>
  return attemptScrape(url, opts)
}

function getErrorTitle(errorType: ScrapedContent['errorType']): string {
  switch (errorType) {
    case 'forbidden':
      return 'Access Denied'
    case 'timeout':
      return 'Request Timeout'
    case 'not_html':
      return 'Unsupported Content Type'
    case 'invalid_url':
      return 'Invalid URL'
    case 'network':
      return 'Network Error'
    default:
      return 'Error Loading Content'
  }
}

function getErrorDescription(errorType: ScrapedContent['errorType'], error: any): string {
  switch (errorType) {
    case 'forbidden':
      return 'The website has blocked access to this content. This may be due to bot protection or access restrictions.'
    case 'timeout':
      return 'The request took too long to complete. The website may be slow or unresponsive.'
    case 'not_html':
      return `This appears to be a ${error.contentType?.includes('pdf') ? 'PDF' : 'non-HTML'} file. Currently, only HTML content is supported.`
    case 'invalid_url':
      return 'The provided URL is not valid. Please check the URL and try again.'
    case 'network':
      return 'Failed to connect to the website. Please check your internet connection or try again later.'
    default:
      return 'Unable to load content from this URL. Please try again later.'
  }
}

/**
 * Extract and clean content from the parsed HTML
 */
function extractContent($: any, options: ScrapingOptions): ScrapedContent {
  // Remove unwanted elements
  $('script, style, nav, header, footer, aside, .advertisement, .ads, .sidebar, .popup').remove()
  
  // Extract title
  const title = $('title').text().trim() || 
                $('h1').first().text().trim() || 
                $('meta[property="og:title"]').attr('content') || 
                'No title found'
  
  // Extract description
  const description = $('meta[name="description"]').attr('content') || 
                     $('meta[property="og:description"]').attr('content') || 
                     $('p').first().text().trim().slice(0, 200) + '...' || 
                     'No description available'
  
  // Extract author
  const author = $('meta[name="author"]').attr('content') || 
                $('meta[property="article:author"]').attr('content') || 
                $('.author').text().trim() || 
                $('[rel="author"]').text().trim()
  
  // Extract publish date
  const publishedDate = $('meta[property="article:published_time"]').attr('content') || 
                       $('meta[name="date"]').attr('content') || 
                       $('time').attr('datetime') || 
                       $('.date').text().trim()
  
  // Extract main content
  let content = ''
  
  // Try to find main content area
  const contentSelectors = [
    'main',
    'article',
    '.content',
    '.post-content',
    '.entry-content',
    '.article-content',
    '.story-body',
    '.post-body',
    '#content',
    '.main-content'
  ]
  
  for (const selector of contentSelectors) {
    const element = $(selector)
    if (element.length && element.text().trim().length > 200) {
      content = element.text().trim()
      break
    }
  }
  
  // Fallback to body content if no main content found
  if (!content) {
    content = $('body').text().trim()
  }
  
  // Clean up content
  content = cleanContent(content)
  
  // Limit content length
  if (options.maxContentLength && content.length > options.maxContentLength) {
    content = content.slice(0, options.maxContentLength) + '...'
  }
  
  // Calculate reading metrics
  const wordCount = content.split(/\s+/).filter(word => word.length > 0).length
  const readingTime = Math.ceil(wordCount / 200) // Average reading speed
  
  // Extract language
  const language = $('html').attr('lang') || 
                  $('meta[http-equiv="content-language"]').attr('content') || 
                  'en'
  
  return {
    title: title.slice(0, 200),
    content,
    description: description.slice(0, 300),
    author,
    publishedDate,
    wordCount,
    readingTime,
    language
  }
}

/**
 * Clean and normalize text content
 */
function cleanContent(content: string): string {
  return content
    .replace(/\s+/g, ' ')           // Replace multiple spaces with single space
    .replace(/\n\s*\n/g, '\n\n')    // Clean up line breaks
    .replace(/[^\S\n]+/g, ' ')      // Replace non-newline whitespace with spaces
    .trim()
}

/**
 * Validate if a string is a valid URL
 */
function isValidUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Scrape multiple URLs in parallel with rate limiting
 */
export async function scrapeMultipleUrls(
  urls: string[],
  options: ScrapingOptions = {},
  concurrency: number = 3
): Promise<ScrapedContent[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options } as Required<ScrapingOptions>
  log('info', `Scraping ${urls.length} URLs with concurrency ${concurrency}`, opts)
  
  const results: ScrapedContent[] = []
  
  // Process URLs in batches to avoid overwhelming servers
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency)
    
    const batchResults = await Promise.allSettled(
      batch.map(url => scrapeWebContent(url, options))
    )
    
    // Extract results from Promise.allSettled
    const scrapedBatch = batchResults.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value
      } else {
        log('error', `Failed to scrape ${batch[index]}: ${result.reason}`, opts)
        return {
          title: 'Error loading content',
          content: '',
          description: 'Unable to load content from this URL',
          wordCount: 0,
          readingTime: 0,
          error: result.reason?.message || 'Unknown error'
        }
      }
    })
    
    results.push(...scrapedBatch)
    
    // Add delay between batches to be respectful
    if (i + concurrency < urls.length) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }
  
  const successCount = results.filter(r => !r.error).length
  const failureCount = results.length - successCount
  
  log('info', `Completed scraping ${results.length} URLs (${successCount} successful, ${failureCount} failed)`, opts)
  return results
} 