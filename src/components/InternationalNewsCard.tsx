import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, ExternalLink, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getNewsConfigForLanguage, isSpanishLanguage } from '@/config/newsSourcesConfig';
import { supabase } from '@/integrations/supabase/client';

interface NewsItem {
  title: string;
  link: string;
  summary?: string;
  date?: string;
  image?: string;
  source?: string;
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
        // Usar la edge function para obtener noticias
        const { data, error } = await supabase.functions.invoke('fetch-international-news', {
          body: { language: i18n.language },
        });

        if (error) {
          console.error('Error fetching international news:', error);
          setNews([]);
        } else if (data?.news && Array.isArray(data.news)) {
          setNews(data.news);
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
  }, [i18n.language, isSpanish]);

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
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-green-900 line-clamp-2">{n.title}</h3>
                  </div>
                  {n.summary && (
                    <p className="text-sm text-gray-700 line-clamp-2 mt-1">{n.summary}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    {n.source && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">{n.source}</span>}
                    {n.date && <span className="text-xs text-gray-500">{n.date}</span>}
                  </div>
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
