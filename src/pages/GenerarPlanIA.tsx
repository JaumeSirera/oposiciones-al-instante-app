import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { testService, Proceso } from "@/services/testService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ArrowLeft, Sparkles, Calendar, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Checkbox } from "@/components/ui/checkbox";

interface PlanGenerado {
  titulo: string;
  descripcion: string;
  fecha_inicio: string;
  fecha_fin: string;
  secciones: string[];
  temas: string[];
  resumen: string;
}

export default function GenerarPlanIA() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [generando, setGenerando] = useState(false);
  
  const [procesos, setProcesos] = useState<Proceso[]>([]);
  const [selectedProceso, setSelectedProceso] = useState<number | null>(null);
  const [semanas, setSemanas] = useState<number>(8);
  
  const [planGenerado, setPlanGenerado] = useState<PlanGenerado | null>(null);
  const [notificacionesEmail, setNotificacionesEmail] = useState(true);
  const [horaNotificacion, setHoraNotificacion] = useState("09:00");

  useEffect(() => {
    cargarProcesos();
  }, []);

  const cargarProcesos = async () => {
    try {
      const data = await testService.getProcesos(user?.id);
      setProcesos(data);
    } catch (error) {
      toast.error("Error al cargar procesos");
    }
  };

  const generarPlanAutomatico = async () => {
    if (!user?.id || !selectedProceso) {
      toast.error("Selecciona un proceso");
      return;
    }

    if (semanas < 1 || semanas > 52) {
      toast.error("Las semanas deben estar entre 1 y 52");
      return;
    }

    setGenerando(true);
    try {
      const proceso = procesos.find((p) => p.id === selectedProceso);
      
      const { data, error } = await supabase.functions.invoke("generar-plan-automatico", {
        body: {
          id_usuario: user.id,
          id_proceso: selectedProceso,
          proceso_descripcion: proceso?.descripcion || "",
          semanas: semanas,
          notificaciones_email: notificacionesEmail,
          hora_notificacion: horaNotificacion,
        },
      });

      if (error) throw error;

      if (data?.success && data?.plan) {
        setPlanGenerado(data.plan);
        toast.success("Plan generado con IA exitosamente");
      } else {
        toast.error(data?.error || "Error al generar plan");
      }
    } catch (error: any) {
      console.error("Error generando plan:", error);
      toast.error(error.message || "Error al generar plan con IA");
    } finally {
      setGenerando(false);
    }
  };

  const confirmarYGuardar = async () => {
    if (!planGenerado || !user?.id || !selectedProceso) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("guardar-plan-generado", {
        body: {
          id_usuario: user.id,
          id_proceso: selectedProceso,
          plan: planGenerado,
          notificaciones_email: notificacionesEmail,
          hora_notificacion: horaNotificacion,
        },
      });

      if (error) throw error;

      if (data?.success && data?.id_plan) {
        toast.success("Plan guardado exitosamente");
        navigate(`/plan-estudio/${data.id_plan}`);
      } else {
        toast.error("Error al guardar el plan");
      }
    } catch (error) {
      console.error("Error guardando plan:", error);
      toast.error("Error al guardar el plan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Button
        variant="ghost"
        onClick={() => navigate("/")}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Volver al Dashboard
      </Button>

      {!planGenerado ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Generar Plan de Estudio con IA
            </CardTitle>
            <CardDescription>
              La IA creará un plan completo con fechas, temas y calendario de estudio personalizado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="proceso">Proceso / Oposición *</Label>
                <Select
                  value={selectedProceso?.toString()}
                  onValueChange={(value) => setSelectedProceso(parseInt(value))}
                  disabled={generando}
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

              <div className="space-y-2">
                <Label htmlFor="semanas">Duración del Plan (semanas) *</Label>
                <Input
                  id="semanas"
                  type="number"
                  min="1"
                  max="52"
                  value={semanas}
                  onChange={(e) => setSemanas(parseInt(e.target.value) || 1)}
                  disabled={generando}
                />
                <p className="text-sm text-muted-foreground">
                  El plan cubrirá aproximadamente {semanas} semanas de estudio
                </p>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-semibold">Configuración de Notificaciones</h3>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="notificaciones"
                    checked={notificacionesEmail}
                    onCheckedChange={(checked) => setNotificacionesEmail(checked as boolean)}
                    disabled={generando}
                  />
                  <Label htmlFor="notificaciones" className="cursor-pointer">
                    Recibir recordatorios por email
                  </Label>
                </div>

                {notificacionesEmail && (
                  <div className="space-y-2 ml-6">
                    <Label htmlFor="hora">Hora de notificación</Label>
                    <Input
                      id="hora"
                      type="time"
                      value={horaNotificacion}
                      onChange={(e) => setHoraNotificacion(e.target.value)}
                      disabled={generando}
                    />
                    <p className="text-sm text-muted-foreground">
                      Recibirás un email diario con el contenido a estudiar
                    </p>
                  </div>
                )}
              </div>

              <Button
                onClick={generarPlanAutomatico}
                disabled={!selectedProceso || generando}
                className="w-full"
                size="lg"
              >
                {generando ? (
                  <>
                    <Sparkles className="mr-2 h-4 w-4 animate-spin" />
                    Generando Plan...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generar Plan Automáticamente
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Plan Generado - Revisa y Confirma
            </CardTitle>
            <CardDescription>
              Puedes revisar los detalles antes de guardar el plan
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">Título</h3>
              <p className="text-lg">{planGenerado.titulo}</p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Descripción</h3>
              <p className="text-muted-foreground">{planGenerado.descripcion}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold mb-2">Fecha Inicio</h3>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{new Date(planGenerado.fecha_inicio).toLocaleDateString()}</span>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Fecha Fin</h3>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{new Date(planGenerado.fecha_fin).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Secciones Incluidas</h3>
              <div className="flex flex-wrap gap-2">
                {planGenerado.secciones.map((seccion, idx) => (
                  <Badge key={idx} variant="secondary">
                    {seccion}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Temas Seleccionados ({planGenerado.temas.length})</h3>
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2 border rounded-md">
                {planGenerado.temas.map((tema, idx) => (
                  <Badge key={idx} variant="outline">
                    {tema}
                  </Badge>
                ))}
              </div>
            </div>

            {planGenerado.resumen && (
              <div className="bg-muted p-4 rounded-lg">
                <h3 className="font-semibold mb-2">Resumen del Plan</h3>
                <p className="text-sm text-muted-foreground">{planGenerado.resumen}</p>
              </div>
            )}

            <Separator />

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setPlanGenerado(null)}
                disabled={loading}
              >
                Generar Otro
              </Button>
              <Button
                onClick={confirmarYGuardar}
                disabled={loading}
                className="flex-1"
              >
                {loading ? "Guardando..." : "Confirmar y Guardar Plan"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
