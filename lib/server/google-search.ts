// Lightweight, dependency-free Google + DuckDuckGo search wrapper

import { scrapeMultipleUrls, type ScrapedContent } from './web-scraper'

export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
  scrapedContent?: ScrapedContent;
  thumbnail?: string;
  image?: string;
}

export async function googleSearch(
  query: string,
  num = 5,
  enableScraping = true
): Promise<SearchHit[]> {
  // Create a safe version of the query
  const safeQuery = query.trim();
  if (!safeQuery) {
    console.error("[Google Search] Empty query provided");
    return [];
  }

  // Get API credentials and verify they exist
  const key = process.env.GOOGLE_SEARCH_KEY;
  const cx = process.env.GOOGLE_SEARCH_CX;
  
  // Removed sensitive credential logging
  
  if (!key || !cx) {
    console.error("[Google Search] API credentials missing or invalid");
    throw new Error(
      "Google search env vars missing (GOOGLE_SEARCH_KEY / GOOGLE_SEARCH_CX)"
    );
  }

  // Log the query we're sending to Google
  // Query logging removed for privacy
  
  try {
    // Prepare the request parameters
    const params = new URLSearchParams({
      key,
      cx,
      q: safeQuery,
      num: String(num),
      hl: "en",
      gl: "us",
      safe: "active",
      fields: "items(title,link,snippet,pagemap)",
    });

    const url = `https://customsearch.googleapis.com/customsearch/v1?${params}`;

    // Attempt the fetch with a timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
      console.error("[Google Search] Request timed out after 5 seconds");
    }, 5000); // 5 second timeout
    
    // Log detailed request information
    // Request detail logging removed
    
    // Implement retry logic
    let retries = 2;
    let res;
    
    while (retries >= 0) {
      try {
        res = await fetch(url, { 
          headers: { 
            "User-Agent": "coasty-ai",
            "Accept": "application/json"
          },
          signal: controller.signal,
          cache: "no-store" // Ensure we're not using cached results
        });
        
        // If successful, break out of the retry loop
        if (res.ok) break;
        
        // Otherwise log and retry if attempts remain
        const statusText = await res.text().catch(() => "Could not read response body");
        console.warn(`[Google Search] Attempt failed (${retries} retries left): Status ${res.status} - ${statusText.substring(0, 100)}`);
        
        retries--;
        if (retries >= 0) {
          // Wait before retrying (exponential backoff)
          const delay = Math.pow(2, 2-retries) * 500; // 500ms, 1s
          console.log(`[Google Search] Retrying in ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (fetchError) {
        console.error("[Google Search] Fetch error:", fetchError);
        retries--;
        if (retries < 0) throw fetchError;
        
        // Wait before retrying
        const delay = Math.pow(2, 2-retries) * 500;
        console.log(`[Google Search] Retrying after error in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    clearTimeout(timeout);
    
    // If we exited the loop without a valid response
    if (!res || !res.ok) {
      throw new Error(`Google Search failed after retries: ${res?.status || 'No response'}`);
    }
    
    // Handle non-200 responses
    if (!res.ok) {
      const body = await res.text();
      console.error(`[Google Search] API error: ${res.status} – ${body.slice(0, 120)}…`);
      
      // If it's a 403/401, likely an API key issue
      if (res.status === 403 || res.status === 401) {
        console.error("[Google Search] Authentication error - check API key validity");
      }
      
      throw new Error(`Google ${res.status} – ${body.slice(0, 120)}…`);
    }

    // Parse the response
    const data = await res.json();
    
    // Log the response structure for debugging
    console.log(`[Google Search] Response status: ${res.status}`);
    console.log(`[Google Search] Response structure:`, {
      hasItems: !!data.items,
      itemCount: data.items?.length || 0,
      hasSearchInfo: !!data.searchInformation,
      totalResults: data.searchInformation?.totalResults || 0
    });
    
    // Check if we have valid results
    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
      console.warn("[Google Search] No search results found in response");
      return [];
    }

    // Map the results to our SearchHit format
    const results = data.items.map((item: any) => {
      // Extract image from pagemap
      let thumbnail = undefined;
      let image = undefined;
      
      if (item.pagemap) {
        // Try to get OpenGraph image first
        if (item.pagemap.metatags && item.pagemap.metatags[0]) {
          image = item.pagemap.metatags[0]['og:image'] || 
                  item.pagemap.metatags[0]['twitter:image'] ||
                  item.pagemap.metatags[0]['image'];
        }
        
        // Try to get thumbnail from cse_thumbnail
        if (item.pagemap.cse_thumbnail && item.pagemap.cse_thumbnail[0]) {
          thumbnail = item.pagemap.cse_thumbnail[0].src;
        }
        
        // Fallback to cse_image if no thumbnail
        if (!thumbnail && item.pagemap.cse_image && item.pagemap.cse_image[0]) {
          thumbnail = item.pagemap.cse_image[0].src;
        }
      }
      
      return {
        title: item.title || "No title",
        url: item.link || "#",
        snippet: item.snippet || "No description available",
        thumbnail,
        image: image || thumbnail, // Use image or fallback to thumbnail
      };
    });

    console.log(`[Google Search] Successfully returning ${results.length} results`);
    
    // Scrape content from each URL if enabled
    if (enableScraping && results.length > 0) {
      console.log(`[Google Search] Starting web scraping for ${results.length} results`);
      
      try {
        const urls = results
          .map((result: SearchHit) => result.url)
          .filter((url: string) => {
            // Filter out invalid URLs
            if (url === "#") return false;
            
            // Filter out known non-HTML file types
            const lowerUrl = url.toLowerCase();
            const nonHtmlExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip', '.rar', '.tar', '.gz', '.mp3', '.mp4', '.avi', '.mov', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'];
            
            if (nonHtmlExtensions.some(ext => lowerUrl.endsWith(ext))) {
              console.log(`[Google Search] Skipping non-HTML file: ${url}`);
              return false;
            }
            
            return true;
          });
        
        const scrapedContents = await scrapeMultipleUrls(urls, {
          maxContentLength: 3000, // Limit content length for chat context
          timeout: 6000,
          retryAttempts: 2,
          retryDelay: 1000,
          logLevel: 'warn' // Only log warnings and errors during search
        });
        
        // Match scraped content with search results
        let scrapedIndex = 0;
        results.forEach((result: SearchHit) => {
          // Check if this URL was included in scraping (not filtered out)
          if (urls.includes(result.url) && scrapedIndex < scrapedContents.length) {
            result.scrapedContent = scrapedContents[scrapedIndex];
            scrapedIndex++;
          }
        });
        
        console.log(`[Google Search] Successfully scraped content for ${scrapedContents.length} results`);
      } catch (error) {
        console.error(`[Google Search] Error during web scraping:`, error);
        // Continue without scraped content if scraping fails
      }
    }
    
    return results;
  } catch (error: unknown) {
    console.error("[Google Search] Error during search:", error);
    
    // Create better error messages based on the type of error
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.error("[Google Search] Request timed out after 5 seconds");
      } else if (error.message.includes('fetch failed')) {
        console.error("[Google Search] Network error - possibly offline or CORS issue");
      }
    }
    
    // Rethrow to be handled by the caller
    throw error;
  }
}