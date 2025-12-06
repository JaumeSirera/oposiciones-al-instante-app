import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { planesService } from "@/services/planesService";
import { testService, Proceso } from "@/services/testService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ArrowLeft, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export default function CrearPlanEstudio() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [generandoIA, setGenerandoIA] = useState(false);
  const [generandoDescripcion, setGenerandoDescripcion] = useState(false);
  
  // Estados para selección de contenidos
  const [procesos, setProcesos] = useState<Proceso[]>([]);
  const [selectedProceso, setSelectedProceso] = useState<number | null>(null);
  const [secciones, setSecciones] = useState<string[]>([]);
  const [selectedSecciones, setSelectedSecciones] = useState<string[]>([]);
  const [temas, setTemas] = useState<string[]>([]);
  const [selectedTemas, setSelectedTemas] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    titulo: "",
    descripcion: "",
    fecha_inicio: new Date().toISOString().split("T")[0],
    fecha_fin: "",
  });

  useEffect(() => {
    cargarProcesos();
  }, []);

  // Cargar secciones cuando se selecciona un proceso
  useEffect(() => {
    if (selectedProceso) {
      loadSeccionesYTemas();
    } else {
      setSecciones([]);
      setTemas([]);
      setSelectedSecciones([]);
      setSelectedTemas([]);
    }
  }, [selectedProceso]);

  // Cargar temas cuando se seleccionan secciones
  useEffect(() => {
    if (selectedProceso && selectedSecciones.length > 0) {
      loadTemasPorSecciones();
    } else {
      setTemas([]);
      setSelectedTemas([]);
    }
  }, [selectedSecciones]);

  const cargarProcesos = async () => {
    try {
      const data = await testService.getProcesos(user?.id);
      setProcesos(data);
    } catch (error) {
      toast.error(t('studyPlans.errorLoadingProcesses'));
    }
  };

  const loadSeccionesYTemas = async () => {
    if (!selectedProceso) return;
    
    try {
      setLoading(true);
      const data = await testService.getSeccionesYTemas(selectedProceso);
      if (data.success) {
        setSecciones(data.secciones || []);
      } else {
        toast.error(t('studyPlans.errorLoadingSections'));
      }
    } catch (error) {
      toast.error(t('studyPlans.errorLoadingSections'));
    } finally {
      setLoading(false);
    }
  };

  const loadTemasPorSecciones = async () => {
    if (!selectedProceso || selectedSecciones.length === 0) return;

    try {
      setLoading(true);
      const allTemas = await Promise.all(
        selectedSecciones.map(seccion =>
          testService.getTemasPorSeccion(selectedProceso, seccion)
        )
      );
      
      const uniqueTemas = Array.from(
        new Set(allTemas.flat())
      ).sort();
      
      setTemas(uniqueTemas);
      setSelectedTemas([]);
    } catch (error) {
      toast.error(t('studyPlans.errorLoadingTopics'));
    } finally {
      setLoading(false);
    }
  };

  const toggleSeccion = (seccion: string) => {
    setSelectedSecciones(prev =>
      prev.includes(seccion)
        ? prev.filter(s => s !== seccion)
        : [...prev, seccion]
    );
  };

  const toggleTema = (tema: string) => {
    setSelectedTemas(prev =>
      prev.includes(tema)
        ? prev.filter(t => t !== tema)
        : [...prev, tema]
    );
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const generarDescripcion = async () => {
    if (!formData.titulo || formData.titulo.trim().length < 5) {
      toast.error(t('studyPlans.writeLongerTitle'));
      return;
    }

    setGenerandoDescripcion(true);
    try {
      const proceso = procesos.find((p) => p.id === selectedProceso);
      const temasList = selectedTemas.length > 0 
        ? selectedTemas.slice(0, 5).join(", ") + (selectedTemas.length > 5 ? "..." : "")
        : t('studyPlans.generalTopics');

      const { data, error } = await supabase.functions.invoke("generar-descripcion-plan", {
        body: {
          titulo: formData.titulo,
          proceso: proceso?.descripcion || "",
          temas: temasList,
          fecha_inicio: formData.fecha_inicio,
          fecha_fin: formData.fecha_fin,
        },
      });

      if (error) throw error;

      if (data?.descripcion) {
        setFormData((prev) => ({ ...prev, descripcion: data.descripcion }));
        toast.success(t('studyPlans.descriptionGenerated'));
      } else {
        toast.error(t('studyPlans.couldNotGenerateDescription'));
      }
    } catch (error) {
      console.error("Error generando descripción:", error);
      toast.error(t('studyPlans.errorGeneratingDescription'));
    } finally {
      setGenerandoDescripcion(false);
    }
  };

  const generarPlanConIA = async (idPlan: number) => {
    setGenerandoIA(true);
    try {
      const proceso = procesos.find((p) => p.id === selectedProceso);
      
      const { data, error } = await supabase.functions.invoke("generar-plan-estudio", {
        body: {
          id_plan: idPlan,
          titulo: formData.titulo,
          descripcion: formData.descripcion,
          fecha_inicio: formData.fecha_inicio,
          fecha_fin: formData.fecha_fin,
          proceso: proceso?.descripcion || "",
          secciones: selectedSecciones,
          temas: selectedTemas,
        },
      });

      if (error) throw error;
      
      if (data?.success) {
        toast.success(t('studyPlans.planGeneratedSuccess'));
      } else {
        toast.warning(t('studyPlans.planCreatedNoAI'));
      }
    } catch (error) {
      console.error("Error generando plan IA:", error);
      toast.error(t('studyPlans.errorGeneratingAIPlan'));
    } finally {
      setGenerandoIA(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.id) {
      toast.error(t('studyPlans.userNotAuthenticated'));
      return;
    }

    if (!formData.titulo || !selectedProceso || !formData.fecha_fin) {
      toast.error(t('studyPlans.completeRequiredFields'));
      return;
    }

    if (selectedTemas.length === 0) {
      toast.error(t('studyPlans.selectAtLeastOneTopic'));
      return;
    }

    setLoading(true);
    try {
      const result = await planesService.crearPlan({
        id_usuario: user.id,
        id_proceso: selectedProceso,
        titulo: formData.titulo,
        descripcion: formData.descripcion,
        fecha_inicio: formData.fecha_inicio,
        fecha_fin: formData.fecha_fin,
      });

      if (result.success && result.id_plan) {
        toast.success(t('studyPlans.planCreatedSuccess'));
        
        // Generar plan con IA
        await generarPlanConIA(result.id_plan);
        
        navigate(`/plan-estudio/${result.id_plan}`);
      } else {
        toast.error(result.error || t('studyPlans.errorCreatingPlan'));
      }
    } catch (error) {
      toast.error(t('studyPlans.errorCreatingPlan'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Button
        variant="ghost"
        onClick={() => navigate("/planes-estudio")}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t('common.back')}
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t('studyPlans.createStudyPlan')}
          </CardTitle>
          <CardDescription>
            {t('studyPlans.createDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="titulo">{t('studyPlans.planTitle')} *</Label>
              <Input
                id="titulo"
                value={formData.titulo}
                onChange={(e) => handleChange("titulo", e.target.value)}
                placeholder={t('studyPlans.planTitlePlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="descripcion">{t('studyPlans.description')}</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={generarDescripcion}
                  disabled={generandoDescripcion || !formData.titulo}
                >
                  <Sparkles className="mr-2 h-3 w-3" />
                  {generandoDescripcion ? t('studyPlans.generating') : t('studyPlans.generateWithAI')}
                </Button>
              </div>
              <Textarea
                id="descripcion"
                value={formData.descripcion}
                onChange={(e) => handleChange("descripcion", e.target.value)}
                placeholder={t('studyPlans.descriptionPlaceholder')}
                rows={3}
              />
            </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fecha_inicio">{t('studyPlans.startDate')} *</Label>
                  <Input
                    id="fecha_inicio"
                    type="date"
                    value={formData.fecha_inicio}
                    onChange={(e) => handleChange("fecha_inicio", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fecha_fin">{t('studyPlans.endDate')} *</Label>
                  <Input
                    id="fecha_fin"
                    type="date"
                    value={formData.fecha_fin}
                    onChange={(e) => handleChange("fecha_fin", e.target.value)}
                    min={formData.fecha_inicio}
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">{t('studyPlans.contentSelection')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('studyPlans.selectProcessAndTopics')}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="proceso">{t('studyPlans.processOpposition')} *</Label>
                <Select
                  value={selectedProceso?.toString()}
                  onValueChange={(value) => setSelectedProceso(parseInt(value))}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('studyPlans.selectProcess')} />
                  </SelectTrigger>
                  <SelectContent>
                    {procesos.map((proceso) => (
                      <SelectItem key={proceso.id} value={proceso.id.toString()}>
                        {proceso.descripcion}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedProceso && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label>{t('studyPlans.sections')}</Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      {t('studyPlans.selectSections')}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {secciones.map((seccion) => (
                        <Badge
                          key={seccion}
                          variant={selectedSecciones.includes(seccion) ? 'default' : 'outline'}
                          className="cursor-pointer hover:opacity-80 px-3 py-2"
                          onClick={() => toggleSeccion(seccion)}
                        >
                          {seccion}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {selectedSecciones.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label>{t('studyPlans.topics')} *</Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      {t('studyPlans.selectTopics')}
                    </p>
                    {temas.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">{t('studyPlans.loadingTopics')}</p>
                    ) : (
                      <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto p-2 border rounded-md">
                        {temas.map((tema) => (
                          <Badge
                            key={tema}
                            variant={selectedTemas.includes(tema) ? 'default' : 'outline'}
                            className="cursor-pointer hover:opacity-80 px-3 py-2"
                            onClick={() => toggleTema(tema)}
                          >
                            {tema}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {selectedTemas.length > 0 && (
                      <p className="text-sm text-muted-foreground mt-2">
                        {t('studyPlans.topicsSelected', { count: selectedTemas.length })}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/planes-estudio")}
                disabled={loading || generandoIA}
              >
                {t('common.cancel')}
              </Button>
              <Button 
                type="submit" 
                disabled={loading || generandoIA || selectedTemas.length === 0} 
                className="flex-1"
              >
                {loading ? t('studyPlans.creating') : generandoIA ? t('studyPlans.generatingWithAI') : t('studyPlans.createPlan')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
