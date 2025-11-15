import { useState, useEffect } from "react";
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
      toast.error("Error al cargar procesos");
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
        toast.error("Error al cargar secciones");
      }
    } catch (error) {
      toast.error("Error al cargar secciones");
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
      toast.error("Error al cargar temas");
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
      toast.error("Escribe un título más descriptivo");
      return;
    }

    setGenerandoDescripcion(true);
    try {
      const proceso = procesos.find((p) => p.id === selectedProceso);
      const temasList = selectedTemas.length > 0 
        ? selectedTemas.slice(0, 5).join(", ") + (selectedTemas.length > 5 ? "..." : "")
        : "temas generales";

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
        toast.success("Descripción generada con IA");
      } else {
        toast.error("No se pudo generar la descripción");
      }
    } catch (error) {
      console.error("Error generando descripción:", error);
      toast.error("Error al generar descripción");
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
        toast.success("Plan generado con IA exitosamente");
      } else {
        toast.warning("Plan creado pero sin generación IA");
      }
    } catch (error) {
      console.error("Error generando plan IA:", error);
      toast.error("Error al generar plan con IA");
    } finally {
      setGenerandoIA(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.id) {
      toast.error("Usuario no autenticado");
      return;
    }

    if (!formData.titulo || !selectedProceso || !formData.fecha_fin) {
      toast.error("Completa todos los campos requeridos");
      return;
    }

    if (selectedTemas.length === 0) {
      toast.error("Selecciona al menos un tema para el plan");
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
        toast.success("Plan creado exitosamente");
        
        // Generar plan con IA
        await generarPlanConIA(result.id_plan);
        
        navigate(`/plan-estudio/${result.id_plan}`);
      } else {
        toast.error(result.error || "Error al crear el plan");
      }
    } catch (error) {
      toast.error("Error al crear el plan");
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
        Volver
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Crear Plan de Estudio
          </CardTitle>
          <CardDescription>
            Selecciona los temas que quieres estudiar y genera un plan personalizado con IA
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="titulo">Título del Plan *</Label>
              <Input
                id="titulo"
                value={formData.titulo}
                onChange={(e) => handleChange("titulo", e.target.value)}
                placeholder="Ej: Plan intensivo Policía Local 2025"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="descripcion">Descripción</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={generarDescripcion}
                  disabled={generandoDescripcion || !formData.titulo}
                >
                  <Sparkles className="mr-2 h-3 w-3" />
                  {generandoDescripcion ? "Generando..." : "Generar con IA"}
                </Button>
              </div>
              <Textarea
                id="descripcion"
                value={formData.descripcion}
                onChange={(e) => handleChange("descripcion", e.target.value)}
                placeholder="Describe tus objetivos y características del plan, o genera una descripción automática con IA"
                rows={3}
              />
            </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fecha_inicio">Fecha Inicio *</Label>
                  <Input
                    id="fecha_inicio"
                    type="date"
                    value={formData.fecha_inicio}
                    onChange={(e) => handleChange("fecha_inicio", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fecha_fin">Fecha Fin *</Label>
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
                <h3 className="text-lg font-semibold mb-2">Selección de Contenidos</h3>
                <p className="text-sm text-muted-foreground">
                  Elige el proceso y los temas que quieres incluir en tu plan
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="proceso">Proceso / Oposición *</Label>
                <Select
                  value={selectedProceso?.toString()}
                  onValueChange={(value) => setSelectedProceso(parseInt(value))}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un proceso" />
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
                    <Label>Secciones</Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      Selecciona las secciones que quieres estudiar
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
                    <Label>Temas *</Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      Selecciona los temas específicos que quieres incluir en el plan
                    </p>
                    {temas.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">Cargando temas...</p>
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
                        {selectedTemas.length} tema(s) seleccionado(s)
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
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={loading || generandoIA || selectedTemas.length === 0} 
                className="flex-1"
              >
                {loading ? "Creando..." : generandoIA ? "Generando con IA..." : "Crear Plan"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
