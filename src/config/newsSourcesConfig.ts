// Configuración de fuentes de noticias y boletines oficiales por idioma/país

export interface NewsSource {
  name: string;
  endpoint?: string; // Para fuentes que usan el proxy PHP
  rssUrl?: string;   // URL RSS directa
  isRss?: boolean;
}

export interface OfficialBulletin {
  name: string;
  url: string;
  description: string;
}

export interface CountryNewsConfig {
  language: string;
  country: string;
  flag: string;
  newsSources: NewsSource[];
  officialBulletins: OfficialBulletin[];
}

export const NEWS_CONFIG: Record<string, CountryNewsConfig> = {
  es: {
    language: 'es',
    country: 'España',
    flag: '🇪🇸',
    newsSources: [
      { name: 'Noticias Oposiciones', endpoint: 'proxy_noticias_oposiciones.php' },
      { name: 'BOE y CCAA', endpoint: 'noticias_oposiciones_multifuente.php' },
    ],
    officialBulletins: [
      { name: 'BOE', url: 'https://www.boe.es/', description: 'Boletín Oficial del Estado' },
      { name: 'INAP', url: 'https://www.inap.es/', description: 'Instituto Nacional de Administración Pública' },
    ],
  },
  fr: {
    language: 'fr',
    country: 'France',
    flag: '🇫🇷',
    newsSources: [
      { name: 'Emploi Public', rssUrl: 'https://www.emploi-collectivites.fr/flux-rss-annonces', isRss: true },
      { name: 'Fonction Publique', rssUrl: 'https://www.fonction-publique.gouv.fr/rss', isRss: true },
    ],
    officialBulletins: [
      { name: 'Journal Officiel', url: 'https://www.journal-officiel.gouv.fr/', description: 'Journal Officiel de la République Française' },
      { name: 'Légifrance', url: 'https://www.legifrance.gouv.fr/', description: 'Service public de diffusion du droit' },
      { name: 'Concours Fonction Publique', url: 'https://www.fonction-publique.gouv.fr/calendrier-concours', description: 'Calendrier des concours' },
      { name: 'CNFPT', url: 'https://www.cnfpt.fr/', description: 'Centre National de la Fonction Publique Territoriale' },
    ],
  },
  de: {
    language: 'de',
    country: 'Deutschland',
    flag: '🇩🇪',
    newsSources: [
      { name: 'Öffentlicher Dienst', rssUrl: 'https://www.bund.de/SiteGlobals/Functions/RSSFeed/RSSNewsFeed/RSSNewsFeed.xml', isRss: true },
    ],
    officialBulletins: [
      { name: 'Bundesgesetzblatt', url: 'https://www.bgbl.de/', description: 'Bundesgesetzblatt (BGBl.)' },
      { name: 'Bund.de', url: 'https://www.bund.de/', description: 'Stellenportal des öffentlichen Dienstes' },
      { name: 'DGB', url: 'https://www.dgb.de/', description: 'Deutscher Gewerkschaftsbund' },
      { name: 'Beamten-Informationen', url: 'https://www.beamten-informationen.de/', description: 'Informationen für Beamte' },
    ],
  },
  pt: {
    language: 'pt',
    country: 'Portugal',
    flag: '🇵🇹',
    newsSources: [
      { name: 'Diário da República', rssUrl: 'https://dre.pt/rss', isRss: true },
    ],
    officialBulletins: [
      { name: 'Diário da República', url: 'https://dre.pt/', description: 'Diário da República Eletrónico' },
      { name: 'BEP', url: 'https://www.bep.gov.pt/', description: 'Bolsa de Emprego Público' },
      { name: 'Concursos Públicos', url: 'https://www.base.gov.pt/', description: 'Portal de contratos públicos' },
      { name: 'DGAEP', url: 'https://www.dgaep.gov.pt/', description: 'Direção-Geral da Administração e do Emprego Público' },
    ],
  },
  en: {
    language: 'en',
    country: 'United Kingdom',
    flag: '🇬🇧',
    newsSources: [
      { name: 'Public Sector Jobs', rssUrl: 'https://www.publicjobs.ie/restapi/rss/jobs/latest', isRss: true },
    ],
    officialBulletins: [
      { name: 'UK Government', url: 'https://www.gov.uk/', description: 'UK Government Portal' },
      { name: 'Civil Service Jobs', url: 'https://www.civilservicejobs.service.gov.uk/', description: 'Official Civil Service Recruitment' },
      { name: 'NHS Jobs', url: 'https://www.jobs.nhs.uk/', description: 'National Health Service Jobs' },
      { name: 'The Gazette', url: 'https://www.thegazette.co.uk/', description: 'Official Public Record' },
    ],
  },
};

// Función para obtener la configuración según el idioma
export function getNewsConfigForLanguage(lang: string): CountryNewsConfig {
  // Normalizar el idioma (ej: "es-ES" -> "es")
  const normalizedLang = lang.split('-')[0].toLowerCase();
  
  // Si existe configuración para el idioma, usarla
  if (NEWS_CONFIG[normalizedLang]) {
    return NEWS_CONFIG[normalizedLang];
  }
  
  // Por defecto, mostrar la configuración en inglés para idiomas no soportados
  return NEWS_CONFIG['en'];
}

// Comprobar si el idioma es español
export function isSpanishLanguage(lang: string): boolean {
  const normalizedLang = lang.split('-')[0].toLowerCase();
  return normalizedLang === 'es';
}
