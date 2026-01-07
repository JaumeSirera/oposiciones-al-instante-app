import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Brain, TrendingUp, Users, Target, Award, Heart, Menu, X, FileText, Sparkles } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/logo.png";
import { LanguageSelector } from "@/components/LanguageSelector";

const Landing = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [openMenu, setOpenMenu] = useState(false);

  const siteUrl = import.meta.env.VITE_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "https://oposiciones-test.com");
  const canonical = useMemo(() => `${siteUrl}/`, [siteUrl]);
  
  // Mapeo de idiomas a imágenes OG y locales
  const ogImageMap: Record<string, string> = {
    es: `${siteUrl}/og/og-image.jpg`,
    en: `${siteUrl}/og/og-image-en.jpg`,
    fr: `${siteUrl}/og/og-image-fr.jpg`,
    de: `${siteUrl}/og/og-image-de.jpg`,
    pt: `${siteUrl}/og/og-image-pt.jpg`,
  };
  
  const ogLocaleMap: Record<string, string> = {
    es: "es_ES",
    en: "en_US",
    fr: "fr_FR",
    de: "de_DE",
    pt: "pt_PT",
  };
  
  const currentLang = i18n.language?.split("-")[0] || "es";
  const ogImage = ogImageMap[currentLang] || ogImageMap.es;
  const ogLocale = ogLocaleMap[currentLang] || ogLocaleMap.es;

  useEffect(() => {
    if (isAuthenticated) navigate("/dashboard", { replace: true });
  }, [isAuthenticated, navigate]);

  const closeMenu = () => setOpenMenu(false);

  const MenuLinks = () => (
    <>
      <Link to="/agente-ia-oposiciones" className="text-gray-200 hover:text-white transition-colors" onClick={closeMenu}>
        {t('landing.menu.aiAgent')}
      </Link>
      <Link to="/planes-de-estudio-ia" className="text-gray-200 hover:text-white transition-colors" onClick={closeMenu}>
        {t('landing.menu.studyPlans')}
      </Link>
      <Link to="/resumenes-ia-oposiciones" className="text-gray-200 hover:text-white transition-colors" onClick={closeMenu}>
        {t('landing.menu.summaries')}
      </Link>
      <Link to="/psicotecnicos-online" className="text-gray-200 hover:text-white transition-colors" onClick={closeMenu}>
        {t('landing.menu.psychotechnics')}
      </Link>
      <Link to="/preparacion-fisica-ia" className="text-gray-200 hover:text-white transition-colors" onClick={closeMenu}>
        {t('landing.menu.physicalPrep')}
      </Link>
      <Link to="/profesor-virtual-oposiciones" className="text-gray-200 hover:text-white transition-colors" onClick={closeMenu}>
        {t('landing.menu.virtualProfessor')}
      </Link>
    </>
  );

  const appJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Oposiciones-Tests · Agente IA",
    "applicationCategory": "EducationalApplication",
    "operatingSystem": "Web, Android, iOS",
    "url": siteUrl,
    "image": `${siteUrl}/og/og-image.jpg`,
    "description": t('landing.metaDescription'),
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "EUR" },
    "publisher": { "@type": "Organization", "name": "Oposiciones-Tests" }
  };

  return (
    <div className="min-h-screen relative overflow-x-hidden">
      <Helmet>
        <html lang={currentLang} />
        <title>{t('landing.title')}</title>
        <meta name="description" content={t('landing.metaDescription')} />
        <link rel="canonical" href={canonical} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={t('landing.title')} />
        <meta property="og:description" content={t('landing.metaDescription')} />
        <meta property="og:url" content={canonical} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="640" />
        <meta property="og:locale" content={ogLocale} />
        <meta property="og:locale:alternate" content="es_ES" />
        <meta property="og:locale:alternate" content="en_US" />
        <meta property="og:locale:alternate" content="fr_FR" />
        <meta property="og:locale:alternate" content="de_DE" />
        <meta property="og:locale:alternate" content="pt_PT" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={t('landing.title')} />
        <meta name="twitter:description" content={t('landing.metaDescription')} />
        <meta name="twitter:image" content={ogImage} />
        <script type="application/ld+json">{JSON.stringify(appJsonLd)}</script>
      </Helmet>

      <div className="fixed inset-0 z-0" aria-hidden>
        <video autoPlay loop muted playsInline className="w-full h-full object-cover">
          <source src="https://oposiciones-test.com/api/videos/bomberos.webm" type="video/webm" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/80" />
      </div>

      <div className="relative z-10">
        <header className="container mx-auto px-4 py-6">
          <nav className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={logo} alt="Oposiciones-Tests · Agente IA" className="w-12 h-12 object-contain" />
              <span className="text-2xl font-bold text-white">
                Oposiciones-<span className="text-blue-400">Tests</span>
              </span>
            </div>

            <div className="hidden lg:flex items-center gap-5">
              <MenuLinks />
            </div>

            {/* Desktop: todos los botones visibles */}
            <div className="hidden sm:flex items-center gap-3">
              <LanguageSelector />
              <Link to="/donacion-publica">
                <Button variant="outline" className="bg-white/10 text-white border-white/20 hover:bg-white/20 px-4">
                  <Heart className="w-4 h-4 mr-2" />
                  <span>{t('landing.menu.supportProject')}</span>
                </Button>
              </Link>
              <Link to="/auth">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white px-4">
                  <Users className="w-4 h-4 mr-2" />
                  <span>{t('landing.menu.studentAccess')}</span>
                </Button>
              </Link>
            </div>

            {/* Mobile: solo botón de menú y acceso rápido */}
            <div className="flex sm:hidden items-center gap-2">
              <Link to="/auth" onClick={closeMenu}>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Users className="w-4 h-4" />
                </Button>
              </Link>
              <button
                className="inline-flex items-center justify-center p-2 rounded-lg text-white border border-white/20 hover:bg-white/10"
                aria-label="Abrir menú"
                onClick={() => setOpenMenu((v) => !v)}
              >
                {openMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>

            {openMenu && (
              <>
                <div 
                  className="sm:hidden fixed inset-0 z-40" 
                  onClick={closeMenu}
                  aria-hidden
                />
                <div className="sm:hidden absolute left-0 right-0 top-full mt-3 rounded-xl bg-black/95 backdrop-blur border border-white/10 p-4 shadow-xl z-50">
                  <div className="flex flex-col gap-3 text-center">
                    <MenuLinks />
                    <div className="border-t border-white/10 pt-3 mt-1 flex flex-col gap-3">
                      <div className="flex justify-center">
                        <LanguageSelector />
                      </div>
                      <Link to="/donacion-publica" onClick={closeMenu} className="w-full">
                        <Button variant="outline" className="w-full bg-white/10 text-white border-white/20 hover:bg-white/20">
                          <Heart className="w-4 h-4 mr-2" />
                          {t('landing.menu.supportProject')}
                        </Button>
                      </Link>
                      <Link to="/auth" onClick={closeMenu} className="w-full">
                        <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                          <Users className="w-4 h-4 mr-2" />
                          {t('landing.menu.studentAccess')}
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </>
            )}
          </nav>
        </header>

        <section className="container mx-auto px-4 py-20 md:py-32">
          <div className="max-w-5xl mx-auto text-center">
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-4 leading-tight">
              {t('landing.hero.titlePart1')}<span className="text-blue-400">{t('landing.hero.titleHighlight')}</span>{t('landing.hero.titlePart2')}
            </h1>
            
            {/* Destacado: Tests personalizados */}
            <div className="p-4 md:p-6 rounded-2xl bg-gradient-to-r from-purple-600/40 to-blue-600/40 backdrop-blur-lg border-2 border-purple-400/50 mb-6 shadow-2xl shadow-purple-500/20 animate-pulse-slow">
              <div className="flex flex-col items-center justify-center gap-2 text-center">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-purple-300" />
                  <p className="text-lg md:text-xl text-white font-bold">
                    {t('landing.hero.customTests.highlight')}
                  </p>
                  <Sparkles className="w-6 h-6 text-purple-300" />
                </div>
                <p className="text-purple-200 text-sm">
                  ✨ Sube un PDF, Word o pega texto → Obtén tests listos para practicar
                </p>
              </div>
            </div>

            <p className="text-xl md:text-2xl text-gray-200 mb-8 leading-relaxed">
              {t('landing.hero.subtitle')}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link to="/auth" onClick={closeMenu}>
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white text-lg px-8 py-6">
                  {t('landing.hero.startFree')}
                </Button>
              </Link>
              <a href="#features">
                <Button size="lg" variant="outline" className="bg-white/10 text-white border-white/20 hover:bg-white/20 text-lg px-8 py-6">
                  {t('landing.hero.howItWorks')}
                </Button>
              </a>
            </div>

            <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 text-gray-200">
              <p><strong>✔ {t('landing.hero.bullet1Title')}</strong> {t('landing.hero.bullet1Text')}</p>
              <p><strong>✔ {t('landing.hero.bullet2Title')}</strong> {t('landing.hero.bullet2Text')}</p>
              <p><strong>✔ {t('landing.hero.bullet3Title')}</strong> {t('landing.hero.bullet3Text')}</p>
            </div>
          </div>
        </section>

        <section id="features" className="container mx-auto px-4 py-20">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl font-bold text-white text-center mb-4">{t('landing.features.title')}</h2>
            <p className="text-xl text-gray-300 text-center mb-12">{t('landing.features.subtitle')}</p>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="bg-white/10 backdrop-blur-md border-white/20">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4">
                    <BookOpen className="w-6 h-6 text-blue-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{t('landing.features.studyPlans.title')}</h3>
                  <p className="text-gray-300">{t('landing.features.studyPlans.description')}</p>
                </CardContent>
              </Card>

              <Card className="bg-white/10 backdrop-blur-md border-white/20">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mb-4">
                    <Brain className="w-6 h-6 text-green-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{t('landing.features.virtualProfessor.title')}</h3>
                  <p className="text-gray-300">{t('landing.features.virtualProfessor.description')}</p>
                </CardContent>
              </Card>

              <Card className="bg-white/10 backdrop-blur-md border-white/20">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-4">
                    <TrendingUp className="w-6 h-6 text-purple-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{t('landing.features.tests.title')}</h3>
                  <p className="text-gray-300">{t('landing.features.tests.description')}</p>
                </CardContent>
              </Card>

              <Card className="bg-white/10 backdrop-blur-md border-white/20">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-red-500/20 rounded-lg flex items-center justify-center mb-4">
                    <Target className="w-6 h-6 text-red-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{t('landing.features.summaries.title')}</h3>
                  <p className="text-gray-300">{t('landing.features.summaries.description')}</p>
                </CardContent>
              </Card>

              <Card className="bg-white/10 backdrop-blur-md border-white/20">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-yellow-500/20 rounded-lg flex items-center justify-center mb-4">
                    <Users className="w-6 h-6 text-yellow-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{t('landing.features.psychoPhysical.title')}</h3>
                  <p className="text-gray-300">{t('landing.features.psychoPhysical.description')}</p>
                </CardContent>
              </Card>

              <Card className="bg-white/10 backdrop-blur-md border-white/20">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center mb-4">
                    <Award className="w-6 h-6 text-orange-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{t('landing.features.stats.title')}</h3>
                  <p className="text-gray-300">{t('landing.features.stats.description')}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-20">
          <div className="max-w-4xl mx-auto">
            <Card className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 backdrop-blur-md border-white/20">
              <CardContent className="p-12 text-center">
                <h2 className="text-4xl font-bold text-white mb-4">{t('landing.cta.title')}</h2>
                <p className="text-xl text-white mb-8 drop-shadow-md">{t('landing.cta.subtitle')}</p>
                <Link to="/auth" onClick={closeMenu}>
                  <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-100 text-lg px-8 py-6">
                    {t('landing.cta.button')}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </section>

        <footer className="container mx-auto px-4 py-8 border-t border-white/10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <img src={logo} alt="Oposiciones-Tests" className="w-8 h-8 object-contain" />
              <span className="text-white font-semibold">Oposiciones-Tests</span>
            </div>
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-4 text-center">
              <Link to="/agente-ia-oposiciones" className="text-gray-300 hover:text-white transition-colors">{t('landing.menu.aiAgent')}</Link>
              <Link to="/planes-de-estudio-ia" className="text-gray-300 hover:text-white transition-colors">{t('landing.menu.studyPlans')}</Link>
              <Link to="/resumenes-ia-oposiciones" className="text-gray-300 hover:text-white transition-colors">{t('landing.menu.summaries')}</Link>
              <Link to="/psicotecnicos-online" className="text-gray-300 hover:text-white transition-colors">{t('landing.menu.psychotechnics')}</Link>
              <Link to="/preparacion-fisica-ia" className="text-gray-300 hover:text-white transition-colors">{t('landing.menu.physicalPrep')}</Link>
              <Link to="/profesor-virtual-oposiciones" className="text-gray-300 hover:text-white transition-colors">{t('landing.menu.virtualProfessor')}</Link>
              <Link to="/privacy-policy" className="text-gray-300 hover:text-white transition-colors">{t('landing.menu.privacyPolicy')}</Link>
              <Link to="/donacion-publica" className="text-gray-300 hover:text-white transition-colors">{t('landing.menu.supportProject')}</Link>
            </div>
            <p className="text-gray-400 text-sm text-center md:text-right">{t('landing.footer.copyright')}</p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Landing;