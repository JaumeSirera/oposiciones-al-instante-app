import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Layout } from "@/components/Layout";

// Públicas
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Landing from "./pages/Landing";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import NotFound from "./pages/NotFound";

// Públicas SEO
import AgenteIA from "./pages/AgenteIA";
import PlanesIA from "./pages/PlanesIA";
import ResumenesIA from "./pages/ResumenesIA";
import Psicotecnicos from "./pages/Psicotecnicos";
import PreparacionFisicaIA from "./pages/PreparacionFisicaIA";
import ProfesorVirtual from "./pages/ProfesorVirtual";
import DonacionPublica from "./pages/DonacionPublica";

// Protegidas
import Profile from "./pages/Profile";
import Resumenes from "./pages/Resumenes";
import ResumenDetalle from "./pages/ResumenDetalle";
import CrearResumen from "./pages/CrearResumen";
import CrearTest from "./pages/CrearTest";
import CrearPsicotecnicos from "./pages/CrearPsicotecnicos";
import PlanesEstudio from "./pages/PlanesEstudio";
import CrearPlanEstudio from "./pages/CrearPlanEstudio";
import GenerarPlanIA from "./pages/GenerarPlanIA";
import PlanEstudioDetalle from "./pages/PlanEstudioDetalle";
import PlanesFisicos from "./pages/PlanesFisicos";
import PlanFisicoDetalle from "./pages/PlanFisicoDetalle";
import TestPersonalidad from "./pages/TestPersonalidad";
import TestPage from "./pages/TestPage";
import EstadisticasPage from "./pages/EstadisticasPage";
import HistorialPage from "./pages/HistorialPage";
import RankingPage from "./pages/RankingPage";
import Donacion from "./pages/Donacion";

const queryClient = new QueryClient();

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <HelmetProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                {/* Públicas */}
                <Route path="/" element={<Landing />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/auth/reset-password" element={<ResetPassword />} />
                <Route path="/privacy-policy" element={<PrivacyPolicy />} />

                {/* Públicas SEO */}
                <Route path="/agente-ia-oposiciones" element={<AgenteIA />} />
                <Route path="/planes-de-estudio-ia" element={<PlanesIA />} />
                <Route path="/resumenes-ia-oposiciones" element={<ResumenesIA />} />
                <Route path="/psicotecnicos-online" element={<Psicotecnicos />} />
                <Route path="/preparacion-fisica-ia" element={<PreparacionFisicaIA />} />
                <Route path="/profesor-virtual-oposiciones" element={<ProfesorVirtual />} />
                <Route path="/donacion-publica" element={<DonacionPublica />} />

                {/* Protegidas */}
                <Route
                  element={
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/dashboard" element={<Index />} />
                  <Route path="/test" element={<TestPage mode="simulacion" />} />
                  <Route path="/simulacro" element={<TestPage mode="examen" />} />
                  <Route path="/test-psicotecnico" element={<TestPage mode="simulacion" isPsicotecnico />} />
                  <Route path="/simulacro-psicotecnico" element={<TestPage mode="examen" isPsicotecnico />} />
                  <Route path="/estadisticas" element={<EstadisticasPage />} />
                  <Route path="/historial" element={<HistorialPage />} />
                  <Route path="/ranking" element={<RankingPage />} />
                  <Route path="/donacion" element={<Donacion />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/resumenes" element={<Resumenes />} />
                  <Route path="/resumenes/:id" element={<ResumenDetalle />} />
                  <Route path="/crear-resumen" element={<CrearResumen />} />
                  <Route path="/crear-test" element={<CrearTest />} />
                  <Route path="/crear-psicotecnicos" element={<CrearPsicotecnicos />} />
                  <Route path="/planes-estudio" element={<PlanesEstudio />} />
                  <Route path="/crear-plan-estudio" element={<CrearPlanEstudio />} />
                  <Route path="/generar-plan-ia" element={<GenerarPlanIA />} />
                  <Route path="/plan-estudio/:id" element={<PlanEstudioDetalle />} />
                  <Route path="/planes-fisicos" element={<PlanesFisicos />} />
                  <Route path="/planes-fisicos/:id" element={<PlanFisicoDetalle />} />
                  <Route path="/test-personalidad" element={<TestPersonalidad />} />
                </Route>

                {/* Fallback global */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </HelmetProvider>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
