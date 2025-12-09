import React, { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare, Lightbulb, NotebookPen } from "lucide-react";

const ProfesorVirtual: React.FC = () => {
  const { t } = useTranslation();
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="min-h-screen bg-white">
      <Helmet>
        <title>{t('profesorVirtual.pageTitle')}</title>
        <meta name="description" content={t('profesorVirtual.metaDescription')} />
        <link rel="canonical" href="https://oposiciones-test.com/profesor-virtual-oposiciones" />
      </Helmet>

      <div className="container mx-auto px-4 py-12">
        <header className="max-w-3xl">
          <h1 className="text-4xl font-extrabold text-gray-900">{t('profesorVirtual.title')}</h1>
          <p className="mt-3 text-lg text-gray-700">
            {t('profesorVirtual.subtitle')}
          </p>
        </header>

        <section className="mt-10 grid md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <MessageSquare className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{t('profesorVirtual.instantDoubts')}</h3>
              <p className="text-gray-700">{t('profesorVirtual.instantDoubtsDesc')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <Lightbulb className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{t('profesorVirtual.examplesTricks')}</h3>
              <p className="text-gray-700">{t('profesorVirtual.examplesTricksDesc')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <NotebookPen className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{t('profesorVirtual.guidedExercises')}</h3>
              <p className="text-gray-700">{t('profesorVirtual.guidedExercisesDesc')}</p>
            </CardContent>
          </Card>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold text-gray-900">{t('profesorVirtual.learnWithAI')}</h2>
          <p className="mt-2 text-gray-700">
            {t('profesorVirtual.learnWithAIDesc')}
          </p>
          <div className="mt-6 flex gap-3">
            <Link to="/auth"><Button className="bg-blue-600 hover:bg-blue-700">{t('profesorVirtual.talkToProfessor')}</Button></Link>
            <Link to="/agente-ia-oposiciones"><Button variant="outline">{t('profesorVirtual.backToAgent')}</Button></Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ProfesorVirtual;
