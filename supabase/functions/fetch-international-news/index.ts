import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NewsItem {
  title: string;
  link: string;
  summary: string;
  date: string;
  image: string;
  source: string;
}

// RSS feeds configuration per language/country
const RSS_FEEDS: Record<string, { name: string; url: string }[]> = {
  en: [
    { name: 'UK Civil Service', url: 'https://www.civilservicejobs.service.gov.uk/csr/index.cgi?SID=cGFnZWNsYXNzPUpvYnMmcGFnZWFjdGlvbj1zZWFyY2hieWNvbnRleHRpZCZvd25lcj01MDcwMDAwJm93bmVydHlwZT1mYWlyJmNvbnRleHRpZD01MDcwMDAwJnJlcXNpZz0xNzM0ODAwNzE2LTZkYzkyNGQ4OGU0NjcwZDlmNWRlOGVhYjlmOTE0Zjk3MTE4YzNlOTk=&rss=1' },
  ],
  fr: [
    { name: 'Emploi Territorial', url: 'https://www.emploi-territorial.fr/page.php?controller=rss' },
    { name: 'Fonction Publique', url: 'https://www.lagazettedescommunes.com/rubriques/emploi/feed/' },
  ],
  de: [
    { name: 'Bund.de Stellenangebote', url: 'https://www.bund.de/SiteGlobals/Functions/RSSFeed/RSSNewsFeed/RSSNewsFeed.xml' },
    { name: 'Oeffentlicher Dienst News', url: 'https://oeffentlicher-dienst-news.de/feed/' },
  ],
  pt: [
    { name: 'BEP Portugal', url: 'https://www.bep.gov.pt/rss/feed.aspx' },
    { name: 'Sapo Emprego Público', url: 'https://emprego.sapo.pt/emprego/administracao-publica/rss' },
  ],
};

// Fallback general news feeds if specific job feeds fail
const FALLBACK_FEEDS: Record<string, { name: string; url: string }> = {
  en: { name: 'BBC News', url: 'https://feeds.bbci.co.uk/news/rss.xml' },
  fr: { name: 'Le Monde', url: 'https://www.lemonde.fr/rss/une.xml' },
  de: { name: 'Tagesschau', url: 'https://www.tagesschau.de/xml/rss2/' },
  pt: { name: 'Público', url: 'https://feeds.feedburner.com/PublicoRSS' },
};

async function fetchAndParseRSS(url: string, sourceName: string): Promise<NewsItem[]> {
  try {
    console.log(`Fetching RSS from: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
    });

    if (!response.ok) {
      console.log(`Failed to fetch ${url}: ${response.status}`);
      return [];
    }

    const text = await response.text();
    const items: NewsItem[] = [];

    // Parse RSS items using regex (simple parser for Deno)
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    const titleRegex = /<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i;
    const linkRegex = /<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i;
    const descRegex = /<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i;
    const pubDateRegex = /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i;
    const imageRegex = /<enclosure[^>]*url=["']([^"']+)["'][^>]*>/i;
    const mediaRegex = /<media:content[^>]*url=["']([^"']+)["'][^>]*>/i;
    const imgTagRegex = /<img[^>]*src=["']([^"']+)["'][^>]*>/i;

    let match;
    while ((match = itemRegex.exec(text)) !== null && items.length < 5) {
      const itemContent = match[1];
      
      const titleMatch = titleRegex.exec(itemContent);
      const linkMatch = linkRegex.exec(itemContent);
      const descMatch = descRegex.exec(itemContent);
      const dateMatch = pubDateRegex.exec(itemContent);
      const imageMatch = imageRegex.exec(itemContent) || mediaRegex.exec(itemContent) || imgTagRegex.exec(descMatch?.[1] || '');

      if (titleMatch && linkMatch) {
        // Clean HTML tags from description
        let summary = descMatch?.[1] || '';
        summary = summary.replace(/<[^>]*>/g, '').trim();
        summary = summary.substring(0, 200);

        items.push({
          title: titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
          link: linkMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
          summary,
          date: dateMatch?.[1] ? new Date(dateMatch[1]).toLocaleDateString() : '',
          image: imageMatch?.[1] || '',
          source: sourceName,
        });
      }
    }

    console.log(`Parsed ${items.length} items from ${sourceName}`);
    return items;
  } catch (error) {
    console.error(`Error fetching RSS from ${url}:`, error);
    return [];
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { language } = await req.json();
    const lang = (language || 'en').split('-')[0].toLowerCase();
    
    console.log(`Fetching news for language: ${lang}`);

    // Skip Spanish as it uses the existing PHP endpoints
    if (lang === 'es') {
      return new Response(JSON.stringify({ news: [], message: 'Use PHP endpoints for Spanish' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const feeds = RSS_FEEDS[lang] || RSS_FEEDS['en'];
    let allNews: NewsItem[] = [];

    // Try each feed for the language
    for (const feed of feeds) {
      const news = await fetchAndParseRSS(feed.url, feed.name);
      allNews = [...allNews, ...news];
      if (allNews.length >= 5) break;
    }

    // If no news found, try fallback
    if (allNews.length === 0) {
      console.log(`No news found for ${lang}, trying fallback`);
      const fallback = FALLBACK_FEEDS[lang] || FALLBACK_FEEDS['en'];
      allNews = await fetchAndParseRSS(fallback.url, fallback.name);
    }

    // Limit to 5 items
    allNews = allNews.slice(0, 5);

    console.log(`Returning ${allNews.length} news items for ${lang}`);

    return new Response(JSON.stringify({ news: allNews }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in fetch-international-news:', error);
    return new Response(JSON.stringify({ error: error.message, news: [] }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
