import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getNewsConfigForLanguage } from '@/config/newsSourcesConfig';

export function OfficialBulletinsCard() {
  const { i18n, t } = useTranslation();
  const config = getNewsConfigForLanguage(i18n.language);

  if (config.officialBulletins.length === 0) {
    return null;
  }

  return (
    <Card className="overflow-hidden bg-white shadow-md border-indigo-100">
      <CardHeader className="bg-gradient-to-r from-indigo-50 to-white">
        <CardTitle className="text-indigo-900 flex items-center gap-2">
          <span>{config.flag}</span>
          {t('home.officialBulletins', { country: config.country })}
        </CardTitle>
        <CardDescription className="text-gray-600">
          {t('home.officialBulletinsDesc')}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {config.officialBulletins.map((bulletin, index) => (
            <a
              key={index}
              href={bulletin.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-indigo-50 to-white hover:from-indigo-100 hover:to-indigo-50 transition-all border border-indigo-200 shadow-sm hover:shadow-md"
            >
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-indigo-900 text-sm">{bulletin.name}</h3>
                <p className="text-xs text-gray-600 line-clamp-1">{bulletin.description}</p>
              </div>
              <ExternalLink className="w-4 h-4 text-indigo-600 flex-shrink-0" />
            </a>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
