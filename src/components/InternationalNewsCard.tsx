import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, ExternalLink, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getNewsConfigForLanguage, isSpanishLanguage } from '@/config/newsSourcesConfig';

interface NewsItem {
  title: string;
  link: string;
  summary?: string;
  date?: string;
  image?: string;
}

export function InternationalNewsCard() {
  const { i18n, t } = useTranslation();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const config = getNewsConfigForLanguage(i18n.language);
  const isSpanish = isSpanishLanguage(i18n.language);

  useEffect(() => {
    // Si es español, no cargar noticias internacionales (ya se cargan las españolas)
    if (isSpanish) {
      setLoading(false);
      return;
    }

    const fetchNews = async () => {
      setLoading(true);
      try {
        // Para fuentes RSS, intentamos cargar a través de un proxy CORS o servicio RSS
        const rssSource = config.newsSources.find(s => s.isRss && s.rssUrl);
        
        if (rssSource?.rssUrl) {
          // Usar un servicio RSS-to-JSON público
          const rssProxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssSource.rssUrl)}`;
          
          const response = await fetch(rssProxyUrl);
          const data = await response.json();
          
          if (data.status === 'ok' && Array.isArray(data.items)) {
            const formattedNews: NewsItem[] = data.items.slice(0, 5).map((item: any) => ({
              title: item.title || '',
              link: item.link || '',
              summary: item.description?.replace(/<[^>]*>/g, '').substring(0, 150) || '',
              date: item.pubDate ? new Date(item.pubDate).toLocaleDateString(i18n.language) : '',
              image: item.enclosure?.link || item.thumbnail || '',
            }));
            setNews(formattedNews);
          } else {
            setNews([]);
          }
        } else {
          setNews([]);
        }
      } catch (error) {
        console.error('Error fetching international news:', error);
        setNews([]);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, [i18n.language, isSpanish, config]);

  // No renderizar si es español (las noticias españolas se muestran en otro componente)
  if (isSpanish) {
    return null;
  }

  return (
    <Card className="bg-white shadow-md border-green-100">
      <CardHeader className="bg-gradient-to-r from-green-50 to-white">
        <CardTitle className="text-green-900 flex items-center gap-2">
          <span>{config.flag}</span>
          {t('home.publicJobNews', { country: config.country })}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-green-600" />
          </div>
        ) : news.length > 0 ? (
          <div className="space-y-3">
            {news.map((n, i) => (
              <a
                key={i}
                href={n.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex gap-3 p-3 rounded-lg bg-gradient-to-r from-green-50 to-white hover:from-green-100 hover:to-green-50 transition-all border border-green-200 shadow-sm hover:shadow-md"
              >
                {n.image && !failedImages.has(`int-news-${i}`) ? (
                  <img
                    src={n.image}
                    alt={n.title}
                    className="w-20 h-20 object-cover rounded-lg shadow-sm"
                    onError={() => setFailedImages(prev => new Set(prev).add(`int-news-${i}`))}
                  />
                ) : (
                  <div className="w-20 h-20 bg-gradient-to-br from-green-100 to-green-200 rounded-lg flex items-center justify-center">
                    <BookOpen className="w-8 h-8 text-green-600" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-green-900 line-clamp-2">{n.title}</h3>
                  {n.summary && (
                    <p className="text-sm text-gray-700 line-clamp-2 mt-1">{n.summary}</p>
                  )}
                  {n.date && <p className="text-xs text-gray-500 mt-1">{n.date}</p>}
                </div>
                <ExternalLink className="w-4 h-4 text-green-600 flex-shrink-0" />
              </a>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-gray-600 text-sm">{t('home.noNewsAvailable')}</p>
            <p className="text-xs text-gray-500 mt-2">{t('home.checkOfficialBulletins')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
