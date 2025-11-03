import React, { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dumbbell, Activity, HeartPulse } from "lucide-react";

const PreparacionFisicaIA: React.FC = () => {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="min-h-screen bg-white">
      <Helmet>
        <title>Preparación Física con IA | Oposiciones-Tests</title>
        <meta name="description" content="Plan físico con IA para oposiciones: pruebas específicas, progresiones, técnica y seguimiento de marcas." />
        <link rel="canonical" href="https://oposiciones-test.com/preparacion-fisica-ia" />
      </Helmet>

      <div className="container mx-auto px-4 py-12">
        <header className="max-w-3xl">
          <h1 className="text-4xl font-extrabold text-gray-900">Preparación Física con IA</h1>
          <p className="mt-3 text-lg text-gray-700">
            Si tu oposición incluye físicas, genera un plan adaptado a tus marcas, tiempos y calendario.
          </p>
        </header>

        <section className="mt-10 grid md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <Dumbbell className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Pruebas específicas</h3>
              <p className="text-gray-700">Carrera, dominadas, circuito, salto… según tu oposición.</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <Activity className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Progresiones y técnica</h3>
              <p className="text-gray-700">Mejora por bloques, semanas y deload para rendir el día clave.</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <HeartPulse className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Seguimiento</h3>
              <p className="text-gray-700">Registra marcas y recibe ajustes automáticos del plan.</p>
            </CardContent>
          </Card>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold text-gray-900">Listo para entrenar</h2>
          <p className="mt-2 text-gray-700">
            Combina el plan físico con tu calendario de estudio y llega a tope al examen.
          </p>
          <div className="mt-6 flex gap-3">
            <Link to="/auth"><Button className="bg-blue-600 hover:bg-blue-700">Crear mi plan físico</Button></Link>
            <Link to="/agente-ia-oposiciones"><Button variant="outline">Volver al Agente IA</Button></Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default PreparacionFisicaIA;
