import React, { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare, Lightbulb, NotebookPen } from "lucide-react";

const ProfesorVirtual: React.FC = () => {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="min-h-screen bg-white">
      <Helmet>
        <title>Profesor Virtual para Oposiciones | Oposiciones-Tests</title>
        <meta name="description" content="Profesor virtual 24/7: explica temas, resuelve dudas y propone ejercicios. Aprende con ejemplos y técnicas de memoria." />
        <link rel="canonical" href="https://oposiciones-test.com/profesor-virtual-oposiciones" />
      </Helmet>

      <div className="container mx-auto px-4 py-12">
        <header className="max-w-3xl">
          <h1 className="text-4xl font-extrabold text-gray-900">Profesor Virtual 24/7</h1>
          <p className="mt-3 text-lg text-gray-700">
            Explicaciones paso a paso, resolución de dudas y ejemplos prácticos. Como un preparador personal disponible siempre.
          </p>
        </header>

        <section className="mt-10 grid md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <MessageSquare className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Dudas al instante</h3>
              <p className="text-gray-700">Pregunta cualquier concepto y obtén la explicación precisa.</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <Lightbulb className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Ejemplos y trucos</h3>
              <p className="text-gray-700">Analogías, reglas mnemotécnicas y métodos de memorización.</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <NotebookPen className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Ejercicios guiados</h3>
              <p className="text-gray-700">Resuelve paso a paso y aprende de tus errores.</p>
            </CardContent>
          </Card>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold text-gray-900">Aprende acompañado por IA</h2>
          <p className="mt-2 text-gray-700">
            Integra el profesor virtual con tus tests, resúmenes y plan de estudio para mejorar cada semana.
          </p>
          <div className="mt-6 flex gap-3">
            <Link to="/auth"><Button className="bg-blue-600 hover:bg-blue-700">Hablar con el profesor</Button></Link>
            <Link to="/agente-ia-oposiciones"><Button variant="outline">Volver al Agente IA</Button></Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ProfesorVirtual;
