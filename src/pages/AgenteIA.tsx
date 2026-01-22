import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Brain, BookOpen, Target, TrendingUp, Heart } from "lucide-react";

const AgenteIA: React.FC = () => {
  const { t } = useTranslation();
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": t('agenteIA.faq1Question'),
        "acceptedAnswer": { "@type": "Answer", "text": t('agenteIA.faq1Answer') }
      },
      {
        "@type": "Question",
        "name": t('agenteIA.faq2Question'),
        "acceptedAnswer": { "@type": "Answer", "text": t('agenteIA.faq2Answer') }
      },
      {
        "@type": "Question",
        "name": t('agenteIA.faq3Question'),
        "acceptedAnswer": { "@type": "Answer", "text": t('agenteIA.faq3Answer') }
      },
      {
        "@type": "Question",
        "name": t('agenteIA.faq4Question'),
        "acceptedAnswer": { "@type": "Answer", "text": t('agenteIA.faq4Answer') }
      }
    ]
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-background to-green-50 dark:from-blue-950/20 dark:via-background dark:to-green-950/20">
      <Helmet>
        <title>{t('agenteIA.pageTitle')}</title>
        <meta name="description" content={t('agenteIA.metaDescription')} />
        <link rel="canonical" href="https://oposiciones-test.com/agente-ia-oposiciones" />
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      </Helmet>

      <div className="container mx-auto px-4 py-14">
        <header className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-extrabold text-foreground">
            {t('agenteIA.heroTitle1')}<span className="text-blue-600 dark:text-blue-400">{t('agenteIA.heroTitleHighlight')}</span>{t('agenteIA.heroTitle2')}
          </h1>
          <p className="mt-4 text-lg md:text-xl text-muted-foreground">{t('agenteIA.heroSubtitle')}</p>
          <div className="mt-6 flex gap-3 justify-center">
            <Link to="/auth"><Button size="lg" className="bg-blue-600 hover:bg-blue-700">{t('agenteIA.startFree')}</Button></Link>
            <Link to="/planes-de-estudio-ia"><Button size="lg" variant="outline">{t('agenteIA.viewPlans')}</Button></Link>
          </div>
        </header>

        <section className="mt-12 grid md:grid-cols-3 gap-6">
          <Card className="border-blue-100 dark:border-blue-900/50 shadow-sm">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mb-4"><BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" /></div>
              <h3 className="text-xl font-bold text-foreground mb-2">{t('agenteIA.personalizedPlans')}</h3>
              <p className="text-muted-foreground">{t('agenteIA.personalizedPlansDesc')}</p>
              <div className="mt-4 text-sm text-blue-700 dark:text-blue-400"><Link to="/planes-de-estudio-ia" className="underline">{t('agenteIA.howPlanWorks')}</Link></div>
            </CardContent>
          </Card>
          <Card className="border-purple-100 dark:border-purple-900/50 shadow-sm">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mb-4"><TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" /></div>
              <h3 className="text-xl font-bold text-foreground mb-2">{t('agenteIA.testsSimulations')}</h3>
              <p className="text-muted-foreground">{t('agenteIA.testsSimulationsDesc')}</p>
              <div className="mt-4 text-sm text-purple-700 dark:text-purple-400"><Link to="/psicotecnicos-online" className="underline">{t('agenteIA.viewPsychotechnics')}</Link></div>
            </CardContent>
          </Card>
          <Card className="border-green-100 dark:border-green-900/50 shadow-sm">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mb-4"><Brain className="w-6 h-6 text-green-600 dark:text-green-400" /></div>
              <h3 className="text-xl font-bold text-foreground mb-2">{t('agenteIA.virtualProfessor247')}</h3>
              <p className="text-muted-foreground">{t('agenteIA.virtualProfessor247Desc')}</p>
              <div className="mt-4 text-sm text-green-700 dark:text-green-400"><Link to="/profesor-virtual-oposiciones" className="underline">{t('agenteIA.meetVirtualProfessor')}</Link></div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-12 grid md:grid-cols-2 gap-6">
          <Card className="border-red-100 dark:border-red-900/50 shadow-sm">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center mb-4"><Target className="w-6 h-6 text-red-600 dark:text-red-400" /></div>
              <h3 className="text-xl font-bold text-foreground mb-2">{t('agenteIA.automaticSummaries')}</h3>
              <p className="text-muted-foreground">{t('agenteIA.automaticSummariesDesc')}</p>
              <div className="mt-4 text-sm text-red-700 dark:text-red-400"><Link to="/resumenes-ia-oposiciones" className="underline">{t('agenteIA.howWeSummarize')}</Link></div>
            </CardContent>
          </Card>
          <Card className="border-emerald-100 dark:border-emerald-900/50 shadow-sm">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center mb-4"><Heart className="w-6 h-6 text-emerald-600 dark:text-emerald-400" /></div>
              <h3 className="text-xl font-bold text-foreground mb-2">{t('agenteIA.physicalPrepAI')}</h3>
              <p className="text-muted-foreground">{t('agenteIA.physicalPrepAIDesc')}</p>
              <div className="mt-4 text-sm text-emerald-700 dark:text-emerald-400"><Link to="/preparacion-fisica-ia" className="underline">{t('agenteIA.viewPhysicalPlan')}</Link></div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-14 text-center">
          <h2 className="text-3xl font-extrabold text-foreground">{t('agenteIA.startTodayTitle')}</h2>
          <p className="mt-3 text-muted-foreground">{t('agenteIA.startTodaySubtitle')}</p>
          <div className="mt-5">
            <Link to="/auth"><Button size="lg" className="bg-blue-600 hover:bg-blue-700">{t('agenteIA.createFreeAccount')}</Button></Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AgenteIA;
