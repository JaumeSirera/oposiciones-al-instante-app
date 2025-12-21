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

// RSS feeds de empleo público por idioma - portales oficiales y Indeed
const RSS_FEEDS: Record<string, { name: string; url: string; isIndeed?: boolean }[]> = {
  en: [
    // UK - Portales oficiales
    { name: 'UK Civil Service Jobs', url: 'https://www.indeed.co.uk/rss?q=civil+service&l=United+Kingdom', isIndeed: true },
    { name: 'NHS Jobs', url: 'https://www.indeed.co.uk/rss?q=nhs+public+sector&l=United+Kingdom', isIndeed: true },
    { name: 'Local Government', url: 'https://www.indeed.co.uk/rss?q=local+government+council&l=United+Kingdom', isIndeed: true },
    // USA - Federal Jobs
    { name: 'US Federal Jobs', url: 'https://www.indeed.com/rss?q=federal+government&l=United+States', isIndeed: true },
  ],
  fr: [
    // Francia - Función Pública
    { name: 'Concours Fonction Publique', url: 'https://www.indeed.fr/rss?q=concours+fonction+publique&l=France', isIndeed: true },
    { name: 'Emploi Territorial', url: 'https://www.indeed.fr/rss?q=emploi+territorial+mairie&l=France', isIndeed: true },
    { name: 'Fonction Publique État', url: 'https://www.indeed.fr/rss?q=fonction+publique+%C3%A9tat&l=France', isIndeed: true },
    { name: 'Fonction Publique Hospitalière', url: 'https://www.indeed.fr/rss?q=fonction+publique+hospitali%C3%A8re&l=France', isIndeed: true },
  ],
  de: [
    // Alemania - Öffentlicher Dienst
    { name: 'Öffentlicher Dienst Bund', url: 'https://de.indeed.com/rss?q=%C3%B6ffentlicher+dienst+bund&l=Deutschland', isIndeed: true },
    { name: 'Beamte Verwaltung', url: 'https://de.indeed.com/rss?q=beamte+verwaltung+%C3%B6ffentlich&l=Deutschland', isIndeed: true },
    { name: 'Landesverwaltung', url: 'https://de.indeed.com/rss?q=landesverwaltung+stellenangebot&l=Deutschland', isIndeed: true },
    { name: 'Kommunalverwaltung', url: 'https://de.indeed.com/rss?q=kommunalverwaltung+stadt&l=Deutschland', isIndeed: true },
  ],
  pt: [
    // Portugal - Administração Pública
    { name: 'Concursos Públicos', url: 'https://pt.indeed.com/rss?q=concurso+p%C3%BAblico&l=Portugal', isIndeed: true },
    { name: 'Administração Pública', url: 'https://pt.indeed.com/rss?q=administra%C3%A7%C3%A3o+p%C3%BAblica&l=Portugal', isIndeed: true },
    { name: 'Função Pública', url: 'https://pt.indeed.com/rss?q=fun%C3%A7%C3%A3o+p%C3%BAblica&l=Portugal', isIndeed: true },
    { name: 'Autarquias Locais', url: 'https://pt.indeed.com/rss?q=autarquia+c%C3%A2mara+municipal&l=Portugal', isIndeed: true },
  ],
  it: [
    // Italia - Pubblica Amministrazione
    { name: 'Concorsi Pubblici', url: 'https://it.indeed.com/rss?q=concorso+pubblico&l=Italia', isIndeed: true },
    { name: 'Pubblica Amministrazione', url: 'https://it.indeed.com/rss?q=pubblica+amministrazione&l=Italia', isIndeed: true },
  ],
  nl: [
    // Países Bajos - Overheid
    { name: 'Overheid Vacatures', url: 'https://nl.indeed.com/rss?q=overheid+rijksoverheid&l=Nederland', isIndeed: true },
    { name: 'Gemeente Banen', url: 'https://nl.indeed.com/rss?q=gemeente+overheid&l=Nederland', isIndeed: true },
  ],
};

// Portales oficiales de referencia por idioma (para mostrar como enlaces útiles)
const OFFICIAL_PORTALS: Record<string, { name: string; url: string; description: string }[]> = {
  en: [
    { name: 'Civil Service Jobs UK', url: 'https://www.civilservicejobs.service.gov.uk/', description: 'Official UK Government recruitment portal' },
    { name: 'NHS Jobs', url: 'https://www.jobs.nhs.uk/', description: 'National Health Service vacancies' },
    { name: 'USAJobs', url: 'https://www.usajobs.gov/', description: 'Official US Federal Government job site' },
  ],
  fr: [
    { name: 'Place de l\'Emploi Public', url: 'https://place-emploi-public.gouv.fr/', description: 'Portail officiel de l\'emploi public' },
    { name: 'CNFPT', url: 'https://www.cnfpt.fr/', description: 'Centre National de la Fonction Publique Territoriale' },
    { name: 'Concours Territoriaux', url: 'https://www.emploi-territorial.fr/', description: 'Offres d\'emploi territorial' },
  ],
  de: [
    { name: 'Bund.de Stellenangebote', url: 'https://www.service.bund.de/Content/DE/Stellen/Suche/Formulare/Stellensuche_Formular.html', description: 'Offizielle Stellenbörse des Bundes' },
    { name: 'Interamt.de', url: 'https://www.interamt.de/', description: 'Das Stellenportal des öffentlichen Dienstes' },
  ],
  pt: [
    { name: 'BEP - Bolsa de Emprego Público', url: 'https://www.bep.gov.pt/', description: 'Portal oficial de emprego público' },
    { name: 'DGAEP', url: 'https://www.dgaep.gov.pt/', description: 'Direção-Geral da Administração e do Emprego Público' },
  ],
  it: [
    { name: 'InPA', url: 'https://www.inpa.gov.it/', description: 'Portale del reclutamento' },
    { name: 'Concorsi Pubblici', url: 'https://www.gazzettaufficiale.it/30telegiornali/concorsi/', description: 'Gazzetta Ufficiale - Concorsi' },
  ],
  nl: [
    { name: 'Werken voor Nederland', url: 'https://www.werkenbijdeoverheid.nl/', description: 'Officiële overheid vacatures' },
  ],
};

// Mensajes por idioma
const MESSAGES: Record<string, { noJobs: string; searching: string; checkOfficial: string }> = {
  en: { noJobs: 'Check official portals for latest openings', searching: 'Public Sector Jobs', checkOfficial: 'Visit official government job portals' },
  fr: { noJobs: 'Consultez les portails officiels', searching: 'Emplois Fonction Publique', checkOfficial: 'Visitez les portails officiels' },
  de: { noJobs: 'Besuchen Sie die offiziellen Portale', searching: 'Öffentlicher Dienst', checkOfficial: 'Offizielle Stellenportale besuchen' },
  pt: { noJobs: 'Consulte os portais oficiais', searching: 'Emprego Público', checkOfficial: 'Visite os portais oficiais' },
  it: { noJobs: 'Consultare i portali ufficiali', searching: 'Concorsi Pubblici', checkOfficial: 'Visita i portali ufficiali' },
  nl: { noJobs: 'Bekijk officiële portalen', searching: 'Overheid Vacatures', checkOfficial: 'Bezoek officiële portalen' },
};

async function fetchViaRss2Json(rssUrl: string, sourceName: string): Promise<NewsItem[]> {
  try {
    const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
    
    console.log(`Fetching via rss2json: ${sourceName}`);
    
    const response = await fetch(apiUrl, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      console.log(`rss2json failed for ${sourceName}: ${response.status}`);
      return [];
    }

    const data = await response.json();
    
    if (data.status !== 'ok' || !data.items) {
      console.log(`rss2json returned error for ${sourceName}`);
      return [];
    }

    const items: NewsItem[] = data.items.slice(0, 3).map((item: any) => ({
      title: item.title || '',
      link: item.link || '',
      summary: (item.description || '').replace(/<[^>]*>/g, '').substring(0, 150),
      date: item.pubDate ? new Date(item.pubDate).toLocaleDateString() : new Date().toLocaleDateString(),
      image: item.thumbnail || '',
      source: sourceName,
    }));

    console.log(`Got ${items.length} items from ${sourceName}`);
    return items;
  } catch (error) {
    console.error(`Error fetching ${sourceName}:`, error);
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
    const portals = OFFICIAL_PORTALS[lang] || OFFICIAL_PORTALS['en'];
    let allNews: NewsItem[] = [];

    // Obtener ofertas de empleo de múltiples fuentes
    const fetchPromises = feeds.slice(0, 3).map(feed => 
      fetchViaRss2Json(feed.url, feed.name)
    );

    const results = await Promise.all(fetchPromises);
    
    for (const news of results) {
      allNews = [...allNews, ...news];
    }

    // Eliminar duplicados por título
    const seen = new Set();
    allNews = allNews.filter(item => {
      const key = item.title.toLowerCase().substring(0, 50);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Si no hay ofertas, añadir enlaces a portales oficiales
    if (allNews.length === 0) {
      console.log(`No job listings found for ${lang}, adding official portal links`);
      allNews = portals.slice(0, 3).map(portal => ({
        title: portal.name,
        link: portal.url,
        summary: portal.description,
        date: new Date().toLocaleDateString(),
        image: '',
        source: messages.checkOfficial,
      }));
    }

    allNews = allNews.slice(0, 6);

    console.log(`Returning ${allNews.length} job listings for ${lang}`);

    return new Response(JSON.stringify({ 
      news: allNews,
      officialPortals: portals 
    }), {
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
