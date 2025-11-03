import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, BookOpen, Repeat } from "lucide-react";

const PlanesIA: React.FC = () => {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="min-h-screen bg-white">
      <Helmet>
        <title>Planes de Estudio con IA | Oposiciones-Tests</title>
        <meta name="description" content="Genera un plan de estudio con IA: objetivos, repaso espaciado y prioridades por tema. Ajuste automático según tus resultados." />
        <link rel="canonical" href="https://oposiciones-test.com/planes-de-estudio-ia" />
      </Helmet>

      <div className="container mx-auto px-4 py-12">
        <header className="max-w-3xl">
          <h1 className="text-4xl font-extrabold text-gray-900">Planes de Estudio con IA</h1>
          <p className="mt-3 text-lg text-gray-700">
            Indica oposición, horas disponibles y fecha objetivo. La IA crea un calendario con repaso espaciado y prioriza según tus puntos débiles.
          </p>
        </header>

        <section className="mt-10 grid md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Calendario por objetivos</h3>
              <p className="text-gray-700">Sesiones distribuidas por semanas y bloques, con hitos y simulacros.</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <Repeat className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Repaso espaciado</h3>
              <p className="text-gray-700">Retención óptima con revisiones escalonadas y alertas de repaso.</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <BookOpen className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Prioridad inteligente</h3>
              <p className="text-gray-700">Más tiempo a lo difícil; ajustes automáticos según tus resultados reales.</p>
            </CardContent>
          </Card>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold text-gray-900">Cómo funciona</h2>
          <ol className="mt-3 list-decimal list-inside space-y-2 text-gray-700">
            <li>Elige tu oposición y fecha objetivo.</li>
            <li>Indica tus horas semanales y preferencias.</li>
            <li>La IA genera tu calendario con repasos y simulacros.</li>
            <li>Estudia y realiza tests; el plan se ajusta con tus resultados.</li>
          </ol>
          <div className="mt-6 flex gap-3">
            <Link to="/auth"><Button className="bg-blue-600 hover:bg-blue-700">Crear plan ahora</Button></Link>
            <Link to="/agente-ia-oposiciones"><Button variant="outline">Volver al Agente IA</Button></Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default PlanesIA;
