import React, { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calculator, Brain, Timer } from "lucide-react";

const Psicotecnicos: React.FC = () => {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="min-h-screen bg-white">
      <Helmet>
        <title>Psicotécnicos Online | Oposiciones-Tests</title>
        <meta name="description" content="Ejercicios psicotécnicos: cálculo, memoria, razonamiento y espacial. Simulacros cronometrados y corrección instantánea." />
        <link rel="canonical" href="https://oposiciones-test.com/psicotecnicos-online" />
      </Helmet>

      <div className="container mx-auto px-4 py-12">
        <header className="max-w-3xl">
          <h1 className="text-4xl font-extrabold text-gray-900">Psicotécnicos Online</h1>
          <p className="mt-3 text-lg text-gray-700">
            Entrena cálculo, memoria, razonamiento y aptitud espacial. Simulacros cronometrados y resultados al instante.
          </p>
        </header>

        <section className="mt-10 grid md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <Calculator className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Cálculo y lógica</h3>
              <p className="text-gray-700">Series, problemas, aritmética rápida y razonamiento.</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <Brain className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Memoria y verbal</h3>
              <p className="text-gray-700">Retención, comprensión lectora y sinónimos/antónimos.</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <Timer className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Crono y ranking</h3>
              <p className="text-gray-700">Tiempos reales de examen, estadísticas y ranking global.</p>
            </CardContent>
          </Card>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold text-gray-900">Entrena con IA</h2>
          <p className="mt-2 text-gray-700">
            La dificultad se adapta a tu rendimiento y el plan de estudio se ajusta con tus resultados.
          </p>
          <div className="mt-6 flex gap-3">
            <Link to="/auth"><Button className="bg-blue-600 hover:bg-blue-700">Empezar psicotécnicos</Button></Link>
            <Link to="/agente-ia-oposiciones"><Button variant="outline">Volver al Agente IA</Button></Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Psicotecnicos;
