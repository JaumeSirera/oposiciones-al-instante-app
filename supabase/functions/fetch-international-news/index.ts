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

// RSS feeds de empleo público por idioma - usando rss2json para evitar CORS y parsear RSS
const RSS_FEEDS: Record<string, { name: string; url: string }[]> = {
  en: [
    // UK Government Jobs - Indeed UK Public Sector
    { name: 'UK Public Sector Jobs', url: 'https://www.indeed.co.uk/rss?q=civil+service&l=United+Kingdom' },
    { name: 'UK Gov Jobs', url: 'https://www.indeed.co.uk/rss?q=public+sector+government&l=United+Kingdom' },
  ],
  fr: [
    // Francia - Empleos función pública
    { name: 'Emploi Public France', url: 'https://www.indeed.fr/rss?q=fonction+publique+concours&l=France' },
    { name: 'Concours Fonction Publique', url: 'https://www.indeed.fr/rss?q=concours+administratif&l=France' },
  ],
  de: [
    // Alemania - Empleos servicio público
    { name: 'Öffentlicher Dienst', url: 'https://de.indeed.com/rss?q=%C3%B6ffentlicher+dienst&l=Deutschland' },
    { name: 'Beamte Stellen', url: 'https://de.indeed.com/rss?q=beamte+verwaltung&l=Deutschland' },
  ],
  pt: [
    // Portugal - Empleos administración pública
    { name: 'Emprego Público Portugal', url: 'https://pt.indeed.com/rss?q=administra%C3%A7%C3%A3o+p%C3%BAblica&l=Portugal' },
    { name: 'Concursos Públicos', url: 'https://pt.indeed.com/rss?q=concurso+p%C3%BAblico&l=Portugal' },
  ],
};

// Mensajes y textos por idioma
const MESSAGES: Record<string, { noJobs: string; searching: string }> = {
  en: { noJobs: 'No public sector job listings found', searching: 'Public sector jobs' },
  fr: { noJobs: 'Aucune offre d\'emploi public trouvée', searching: 'Emplois fonction publique' },
  de: { noJobs: 'Keine Stellenangebote im öffentlichen Dienst gefunden', searching: 'Öffentlicher Dienst Jobs' },
  pt: { noJobs: 'Nenhuma oferta de emprego público encontrada', searching: 'Empregos públicos' },
};

async function fetchViaRss2Json(rssUrl: string, sourceName: string): Promise<NewsItem[]> {
  try {
    // Usar rss2json.com como proxy para parsear RSS (servicio gratuito)
    const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
    
    console.log(`Fetching via rss2json: ${rssUrl}`);
    
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.log(`rss2json failed for ${rssUrl}: ${response.status}`);
      return [];
    }

    const data = await response.json();
    
    if (data.status !== 'ok' || !data.items) {
      console.log(`rss2json returned error or no items for ${rssUrl}`);
      return [];
    }

    const items: NewsItem[] = data.items.slice(0, 5).map((item: any) => ({
      title: item.title || '',
      link: item.link || '',
      summary: (item.description || '').replace(/<[^>]*>/g, '').substring(0, 200),
      date: item.pubDate ? new Date(item.pubDate).toLocaleDateString() : '',
      image: item.thumbnail || item.enclosure?.link || '',
      source: sourceName,
    }));

    console.log(`Got ${items.length} items from ${sourceName}`);
    return items;
  } catch (error) {
    console.error(`Error fetching via rss2json ${rssUrl}:`, error);
    return [];
  }
}

async function fetchDirectRSS(url: string, sourceName: string): Promise<NewsItem[]> {
  try {
    console.log(`Fetching RSS directly from: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; JobsBot/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
    });

    if (!response.ok) {
      console.log(`Failed to fetch ${url}: ${response.status}`);
      return [];
    }

    const text = await response.text();
    const items: NewsItem[] = [];

    // Parse RSS items using regex
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    const titleRegex = /<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i;
    const linkRegex = /<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i;
    const descRegex = /<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i;
    const pubDateRegex = /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i;

    let match;
    while ((match = itemRegex.exec(text)) !== null && items.length < 5) {
      const itemContent = match[1];
      
      const titleMatch = titleRegex.exec(itemContent);
      const linkMatch = linkRegex.exec(itemContent);
      const descMatch = descRegex.exec(itemContent);
      const dateMatch = pubDateRegex.exec(itemContent);

      if (titleMatch && linkMatch) {
        let summary = descMatch?.[1] || '';
        summary = summary.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]*>/g, '').trim();
        summary = summary.substring(0, 200);

        items.push({
          title: titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
          link: linkMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
          summary,
          date: dateMatch?.[1] ? new Date(dateMatch[1]).toLocaleDateString() : '',
          image: '',
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { language } = await req.json();
    const lang = (language || 'en').split('-')[0].toLowerCase();
    
    console.log(`Fetching public sector jobs for language: ${lang}`);

    // Skip Spanish - usa los endpoints PHP existentes
    if (lang === 'es') {
      return new Response(JSON.stringify({ news: [], message: 'Use PHP endpoints for Spanish' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const feeds = RSS_FEEDS[lang] || RSS_FEEDS['en'];
    const messages = MESSAGES[lang] || MESSAGES['en'];
    let allNews: NewsItem[] = [];

    // Intentar obtener noticias de cada feed
    for (const feed of feeds) {
      // Primero intentar con rss2json (más confiable para CORS)
      let news = await fetchViaRss2Json(feed.url, feed.name);
      
      // Si falla, intentar directamente
      if (news.length === 0) {
        news = await fetchDirectRSS(feed.url, feed.name);
      }
      
      allNews = [...allNews, ...news];
      if (allNews.length >= 5) break;
    }

    // Si no hay noticias, devolver mensaje informativo
    if (allNews.length === 0) {
      console.log(`No job listings found for ${lang}`);
      allNews = [{
        title: messages.noJobs,
        link: '',
        summary: '',
        date: new Date().toLocaleDateString(),
        image: '',
        source: messages.searching,
      }];
    }

    allNews = allNews.slice(0, 5);

    console.log(`Returning ${allNews.length} job listings for ${lang}`);

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
