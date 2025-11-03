import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Brain, TrendingUp, Users, Target, Award, Heart, Menu, X } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/logo.png";

const Landing = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [openMenu, setOpenMenu] = useState(false);

  // Canonical absoluta (usa env si la tienes, si no window.location.origin)
  const siteUrl = import.meta.env.VITE_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "https://oposiciones-test.com");
  const canonical = useMemo(() => `${siteUrl}/`, [siteUrl]);

  useEffect(() => {
    if (isAuthenticated) navigate("/dashboard", { replace: true });
  }, [isAuthenticated, navigate]);

  const closeMenu = () => setOpenMenu(false);

  const MenuLinks = () => (
    <>
      <Link to="/agente-ia-oposiciones" className="text-gray-200 hover:text-white transition-colors" onClick={closeMenu}>
        Agente IA
      </Link>
      <Link to="/planes-de-estudio-ia" className="text-gray-200 hover:text-white transition-colors" onClick={closeMenu}>
        Planes de Estudio
      </Link>
      <Link to="/resumenes-ia-oposiciones" className="text-gray-200 hover:text-white transition-colors" onClick={closeMenu}>
        Resúmenes IA
      </Link>
      <Link to="/psicotecnicos-online" className="text-gray-200 hover:text-white transition-colors" onClick={closeMenu}>
        Psicotécnicos
      </Link>
      <Link to="/preparacion-fisica-ia" className="text-gray-200 hover:text-white transition-colors" onClick={closeMenu}>
        Preparación Física
      </Link>
      <Link to="/profesor-virtual-oposiciones" className="text-gray-200 hover:text-white transition-colors" onClick={closeMenu}>
        Profesor Virtual
      </Link>
    </>
  );

  // JSON-LD SoftwareApplication para home
  const appJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Oposiciones-Tests · Agente IA",
    "applicationCategory": "EducationalApplication",
    "operatingSystem": "Web, Android, iOS",
    "url": siteUrl,
    "image": `${siteUrl}/og/og-image.jpg`,
    "description": "Agente IA para Oposiciones: tests para oposiciones, resúmenes automáticos, profesor virtual, planes de estudio y preparación física.",
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "EUR" },
    "publisher": { "@type": "Organization", "name": "Oposiciones-Tests" }
  };

  return (
    <div className="min-h-screen relative overflow-x-hidden">
      <Helmet>
        <title>Agente IA para Oposiciones | Tests para Oposiciones y Resúmenes</title>
        <meta
          name="description"
          content="Oposiciones-Tests: Agente IA para Oposiciones. Crea planes de estudio, tests para oposiciones y simulacros, resúmenes de temario y profesor virtual 24/7. Empieza gratis."
        />
        <link rel="canonical" href={canonical} />

        {/* OG / Twitter */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Agente IA para Oposiciones | Tests para Oposiciones y Resúmenes" />
        <meta property="og:description" content="Tu agente IA para preparar oposiciones: tests, simulacros, resúmenes y planes de estudio personalizados." />
        <meta property="og:url" content={canonical} />
        <meta property="og:image" content={`${siteUrl}/og/og-image.jpg`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Agente IA para Oposiciones | Tests para Oposiciones y Resúmenes" />
        <meta name="twitter:description" content="Tests para oposiciones, resúmenes con IA, profesor virtual y planes personalizados." />
        <meta name="twitter:image" content={`${siteUrl}/og/og-image.jpg`} />

        {/* (Opcional) Meta keywords: hoy tienen poco peso, pero no molestan */}
        <meta
          name="keywords"
          content="oposiciones, test para oposiciones, oposiciones test, agente ia para oposiciones, preparar oposiciones, simulacros, resúmenes, plan de estudio, profesor virtual"
        />

        {/* JSON-LD */}
        <script type="application/ld+json">{JSON.stringify(appJsonLd)}</script>
      </Helmet>

      {/* Video Background */}
      <div className="fixed inset-0 z-0" aria-hidden>
        <video autoPlay loop muted playsInline className="w-full h-full object-cover">
          <source src="https://oposiciones-test.com/api/videos/bomberos.webm" type="video/webm" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/80" />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <header className="container mx-auto px-4 py-6">
          <nav className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={logo} alt="Oposiciones-Tests · Agente IA" className="w-12 h-12 object-contain" />
              <span className="text-2xl font-bold text-white">
                Oposiciones-<span className="text-blue-400">Tests</span>
              </span>
            </div>

            {/* Menú DESKTOP */}
            <div className="hidden md:flex items-center gap-5">
              <MenuLinks />
            </div>

            {/* Acciones */}
            <div className="flex items-center gap-3">
              <Link to="/donacion-publica" onClick={closeMenu}>
                <Button variant="outline" className="bg-white/10 text-white border-white/20 hover:bg-white/20">
                  <Heart className="w-4 h-4 mr-2" />
                  Apoyar Proyecto
                </Button>
              </Link>
              <Link to="/auth" onClick={closeMenu}>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">Acceso Alumnos</Button>
              </Link>
              {/* Hamburguesa móvil */}
              <button
                className="md:hidden inline-flex items-center justify-center p-2 rounded-lg text-white border border-white/20 hover:bg-white/10"
                aria-label="Abrir menú"
                onClick={() => setOpenMenu((v) => !v)}
              >
                {openMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>

            {/* Menú móvil */}
            {openMenu && (
              <div className="md:hidden absolute left-0 right-0 top-full mt-3 rounded-xl bg-black/75 backdrop-blur border border-white/10 p-4 shadow-xl">
                <div className="flex flex-col gap-3 text-center">
                  <MenuLinks />
                </div>
              </div>
            )}
          </nav>
        </header>

        {/* Hero */}
        <section className="container mx-auto px-4 py-20 md:py-32">
          <div className="max-w-5xl mx-auto text-center">
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
              Tu <span className="text-blue-400">Agente IA</span> para aprobar la oposición
            </h1>
            <p className="text-xl md:text-2xl text-gray-200 mb-8 leading-relaxed">
              Tests para oposiciones, simulacros cronometrados, resúmenes de temario, profesor virtual 24/7 y planes de
              estudio personalizados. Todo en una sola plataforma.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link to="/auth" onClick={closeMenu}>
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white text-lg px-8 py-6">
                  Empezar gratis con IA
                </Button>
              </Link>
              <a href="#features">
                <Button size="lg" variant="outline" className="bg-white/10 text-white border-white/20 hover:bg-white/20 text-lg px-8 py-6">
                  ¿Cómo funciona?
                </Button>
              </a>
            </div>

            {/* Bullets con keywords */}
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 text-gray-200">
              <p><strong>✔ Tests de oposiciones:</strong> por dificultad y asignaturas, con corrección al instante.</p>
              <p><strong>✔ Resúmenes con IA:</strong> esquemas y tarjetas para memorizar más rápido.</p>
              <p><strong>✔ Simulacros reales:</strong> cronómetro, ranking y estadísticas detalladas.</p>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="container mx-auto px-4 py-20">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl font-bold text-white text-center mb-4">Un Agente IA especializado en Oposiciones</h2>
            <p className="text-xl text-gray-300 text-center mb-12">
              Planificación, explicación y práctica continua para subir tu nota media.
            </p>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="bg-white/10 backdrop-blur-md border-white/20">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4">
                    <BookOpen className="w-6 h-6 text-blue-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Planes de estudio con IA</h3>
                  <p className="text-gray-300">
                    Objetivos, calendario y repaso espaciado. Prioriza lo difícil y ajusta según tus resultados.
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white/10 backdrop-blur-md border-white/20">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mb-4">
                    <Brain className="w-6 h-6 text-green-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Profesor virtual 24/7</h3>
                  <p className="text-gray-300">Explicaciones paso a paso y resolución de dudas cuando lo necesites.</p>
                </CardContent>
              </Card>

              <Card className="bg-white/10 backdrop-blur-md border-white/20">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-4">
                    <TrendingUp className="w-6 h-6 text-purple-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Tests y simulacros</h3>
                  <p className="text-gray-300">Crea tests para oposiciones y practica con tiempos reales de examen.</p>
                </CardContent>
              </Card>

              <Card className="bg-white/10 backdrop-blur-md border-white/20">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-red-500/20 rounded-lg flex items-center justify-center mb-4">
                    <Target className="w-6 h-6 text-red-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Resúmenes automáticos</h3>
                  <p className="text-gray-300">Convierte el temario en resúmenes, esquemas y tarjetas de memoria.</p>
                </CardContent>
              </Card>

              <Card className="bg-white/10 backdrop-blur-md border-white/20">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-yellow-500/20 rounded-lg flex items-center justify-center mb-4">
                    <Users className="w-6 h-6 text-yellow-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Psicotécnicos y preparación física</h3>
                  <p className="text-gray-300">Entrena cálculo, memoria y espacial; genera plan físico si tu oposición lo exige.</p>
                </CardContent>
              </Card>

              <Card className="bg-white/10 backdrop-blur-md border-white/20">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center mb-4">
                    <Award className="w-6 h-6 text-orange-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Estadísticas y boletines</h3>
                  <p className="text-gray-300">Mide tu progreso, ranking y consulta últimas convocatorias por CCAA.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="container mx-auto px-4 py-20">
          <div className="max-w-4xl mx-auto">
            <Card className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 backdrop-blur-md border-white/20">
              <CardContent className="p-12 text-center">
                <h2 className="text-4xl font-bold text-white mb-4">Empieza hoy con tu Agente IA</h2>
				<p className="text-xl text-white mb-8 drop-shadow-md">
				  Define tu objetivo, genera tu plan y practica tests para oposiciones hasta el aprobado.
				</p>

                <Link to="/auth" onClick={closeMenu}>
                  <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-100 text-lg px-8 py-6">
                    Crear cuenta gratuita
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Footer */}
        <footer className="container mx-auto px-4 py-8 border-t border-white/10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <img src={logo} alt="Oposiciones-Tests" className="w-8 h-8 object-contain" />
              <span className="text-white font-semibold">Oposiciones-Tests</span>
            </div>
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-4 text-center">
              <Link to="/agente-ia-oposiciones" className="text-gray-300 hover:text-white transition-colors">Agente IA</Link>
              <Link to="/planes-de-estudio-ia" className="text-gray-300 hover:text-white transition-colors">Planes de Estudio</Link>
              <Link to="/resumenes-ia-oposiciones" className="text-gray-300 hover:text-white transition-colors">Resúmenes IA</Link>
              <Link to="/psicotecnicos-online" className="text-gray-300 hover:text-white transition-colors">Psicotécnicos</Link>
              <Link to="/preparacion-fisica-ia" className="text-gray-300 hover:text-white transition-colors">Preparación Física</Link>
              <Link to="/profesor-virtual-oposiciones" className="text-gray-300 hover:text-white transition-colors">Profesor Virtual</Link>
              <Link to="/privacy-policy" className="text-gray-300 hover:text-white transition-colors">Política de Privacidad</Link>
              <Link to="/donacion-publica" className="text-gray-300 hover:text-white transition-colors">Apoyar Proyecto</Link>
            </div>
            <p className="text-gray-400 text-sm text-center md:text-right">© 2025 Oposiciones-Tests. Todos los derechos reservados.</p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Landing;
