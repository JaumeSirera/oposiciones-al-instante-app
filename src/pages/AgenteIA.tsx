import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Brain, BookOpen, Target, TrendingUp, Heart } from "lucide-react";

const AgenteIA: React.FC = () => {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "¿Qué es un Agente IA para Oposiciones?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Es un asistente inteligente que planifica tu estudio, crea resúmenes, propone tests y responde tus dudas como un preparador 24/7."
        }
      },
      {
        "@type": "Question",
        "name": "¿Puedo generar un plan de estudio personalizado?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Sí. Indica oposición, horas semanales y fecha objetivo, y la IA generará un plan con repaso espaciado y prioridades."
        }
      },
      {
        "@type": "Question",
        "name": "¿Incluye psicotécnicos y preparación física?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Incluye ejercicios psicotécnicos y, si tu oposición lo exige, también un plan físico adaptado con IA."
        }
      },
      {
        "@type": "Question",
        "name": "¿Cómo empiezo?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Crea tu cuenta gratuita, genera tu plan y comienza a practicar con tests y simulacros."
        }
      }
    ]
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-green-50">
      <Helmet>
        <title>Agente IA para Oposiciones | Oposiciones-Tests</title>
        <meta name="description" content="Agente IA para Oposiciones: planes personalizados, resúmenes, profesor virtual, psicotécnicos y simulacros. Empieza gratis." />
        <link rel="canonical" href="https://oposiciones-test.com/agente-ia-oposiciones" />
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      </Helmet>

      <div className="container mx-auto px-4 py-14">
        <header className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-extrabold text-gray-900">
            Tu <span className="text-blue-600">Agente IA</span> para aprobar la oposición
          </h1>
          <p className="mt-4 text-lg md:text-xl text-gray-700">
            Planes de estudio y físicos con IA, resúmenes automáticos, profesor virtual 24/7 y tests adaptativos. Todo en una plataforma.
          </p>
          <div className="mt-6 flex gap-3 justify-center">
            <Link to="/auth"><Button size="lg" className="bg-blue-600 hover:bg-blue-700">Empezar gratis</Button></Link>
            <Link to="/planes-de-estudio-ia"><Button size="lg" variant="outline">Ver planes de estudio</Button></Link>
          </div>
        </header>

        <section className="mt-12 grid md:grid-cols-3 gap-6">
          <Card className="border-blue-100 shadow-sm">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <BookOpen className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Planes personalizados</h3>
              <p className="text-gray-700">
                Calendario por objetivos, repaso espaciado y priorización por temas y dificultad.
              </p>
              <div className="mt-4 text-sm text-blue-700">
                <Link to="/planes-de-estudio-ia" className="underline">Cómo funciona el plan</Link>
              </div>
            </CardContent>
          </Card>

          <Card className="border-purple-100 shadow-sm">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Tests y simulacros</h3>
              <p className="text-gray-700">
                Practica por dificultad y tiempo. Corrige al instante y ajusta el plan según tus resultados.
              </p>
              <div className="mt-4 text-sm text-purple-700">
                <Link to="/psicotecnicos-online" className="underline">Ver psicotécnicos</Link>
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-100 shadow-sm">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <Brain className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Profesor virtual 24/7</h3>
              <p className="text-gray-700">
                Explicaciones paso a paso, resolución de dudas y técnicas de memorización cuando lo necesites.
              </p>
              <div className="mt-4 text-sm text-green-700">
                <Link to="/profesor-virtual-oposiciones" className="underline">Conoce al profesor virtual</Link>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-12 grid md:grid-cols-2 gap-6">
          <Card className="border-red-100 shadow-sm">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                <Target className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Resúmenes automáticos</h3>
              <p className="text-gray-700">
                Sube tu temario y obtén resúmenes, esquemas y tarjetas de memoria. Ahorra tiempo sin perder calidad.
              </p>
              <div className="mt-4 text-sm text-red-700">
                <Link to="/resumenes-ia-oposiciones" className="underline">Ver cómo resumimos</Link>
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-100 shadow-sm">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mb-4">
                <Heart className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Preparación física con IA</h3>
              <p className="text-gray-700">
                Si tu oposición lo exige, genera un plan físico personalizado y registra tu progreso.
              </p>
              <div className="mt-4 text-sm text-emerald-700">
                <Link to="/preparacion-fisica-ia" className="underline">Ver plan físico con IA</Link>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-14 text-center">
          <h2 className="text-3xl font-extrabold text-gray-900">Empieza hoy con tu Agente IA</h2>
          <p className="mt-3 text-gray-700">
            Define tu objetivo, genera tu plan y deja que la IA te acompañe hasta el aprobado.
          </p>
          <div className="mt-5">
            <Link to="/auth"><Button size="lg" className="bg-blue-600 hover:bg-blue-700">Crear cuenta gratuita</Button></Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AgenteIA;
