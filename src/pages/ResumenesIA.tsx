import React, { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Layers, ClipboardList } from "lucide-react";

const ResumenesIA: React.FC = () => {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="min-h-screen bg-white">
      <Helmet>
        <title>Resúmenes IA para Oposiciones | Oposiciones-Tests</title>
        <meta name="description" content="Genera resúmenes de temario con IA: esquemas claros y tarjetas de memoria para repasar más rápido y mejor." />
        <link rel="canonical" href="https://oposiciones-test.com/resumenes-ia-oposiciones" />
      </Helmet>

      <div className="container mx-auto px-4 py-12">
        <header className="max-w-3xl">
          <h1 className="text-4xl font-extrabold text-gray-900">Resúmenes de Temario con IA</h1>
          <p className="mt-3 text-lg text-gray-700">
            Sube tus temas y obtén resúmenes precisos, esquemas y tarjetas de memoria listas para repasar.
          </p>
        </header>

        <section className="mt-10 grid md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Resúmenes claros</h3>
              <p className="text-gray-700">Ideas clave, definiciones y ejemplos esenciales sin paja.</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <Layers className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Esquemas y mapas</h3>
              <p className="text-gray-700">Estructura visual por apartados para estudiar más rápido.</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <ClipboardList className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Tarjetas de memoria</h3>
              <p className="text-gray-700">Preguntas/Respuesta para repaso activo y espaciado.</p>
            </CardContent>
          </Card>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold text-gray-900">Cómo lo hacemos</h2>
          <p className="mt-2 text-gray-700">
            Detectamos conceptos, relaciones y definiciones clave para convertir tu temario en contenido comprimido y fácil de retener.
          </p>
          <div className="mt-6 flex gap-3">
            <Link to="/auth"><Button className="bg-blue-600 hover:bg-blue-700">Probar resúmenes IA</Button></Link>
            <Link to="/agente-ia-oposiciones"><Button variant="outline">Volver al Agente IA</Button></Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ResumenesIA;
