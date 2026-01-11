import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Bell, 
  Clock, 
  Calendar,
  Send,
  History,
  Loader2,
  CheckCircle2,
  BrainCircuit
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useFlashcardStats } from "@/hooks/useFlashcardStats";

interface Config {
  id_usuario: number;
  activo: number;
  frecuencia: string;
  hora_envio: string;
  dias_semana: string;
  min_pendientes: number;
  ultimo_envio: string | null;
}

interface HistorialItem {
  id: number;
  fecha_envio: string;
  pending_count: number;
}

const DIAS_SEMANA = [
  { value: "1", label: "Lunes" },
  { value: "2", label: "Martes" },
  { value: "3", label: "Miércoles" },
  { value: "4", label: "Jueves" },
  { value: "5", label: "Viernes" },
  { value: "6", label: "Sábado" },
  { value: "7", label: "Domingo" },
];

export default function ConfigurarRecordatoriosFlashcards() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { pendingCount, loading: statsLoading } = useFlashcardStats();
  
  const [config, setConfig] = useState<Config | null>(null);
  const [historial, setHistorial] = useState<HistorialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  // Estado del formulario
  const [activo, setActivo] = useState(true);
  const [frecuencia, setFrecuencia] = useState("diario");
  const [horaEnvio, setHoraEnvio] = useState("09:00");
  const [diasSeleccionados, setDiasSeleccionados] = useState<string[]>(["1", "2", "3", "4", "5"]);
  const [minPendientes, setMinPendientes] = useState(5);

  useEffect(() => {
    if (user?.id) {
      cargarConfiguracion();
      cargarHistorial();
    }
  }, [user?.id]);

  const cargarConfiguracion = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const { data, error } = await supabase.functions.invoke("php-api-proxy", {
        body: {
          endpoint: `recordatorios_flashcards.php?action=obtener_config&id_usuario=${user?.id}`,
          method: "GET",
        },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (error) throw error;

      if (data.success && data.config) {
        const cfg = data.config;
        setConfig(cfg);
        setActivo(cfg.activo === 1);
        setFrecuencia(cfg.frecuencia || "diario");
        setHoraEnvio(cfg.hora_envio?.substring(0, 5) || "09:00");
        setDiasSeleccionados(cfg.dias_semana?.split(",") || ["1", "2", "3", "4", "5"]);
        setMinPendientes(cfg.min_pendientes || 5);
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error al cargar configuración");
    } finally {
      setLoading(false);
    }
  };

  const cargarHistorial = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const { data, error } = await supabase.functions.invoke("php-api-proxy", {
        body: {
          endpoint: `recordatorios_flashcards.php?action=obtener_historial&id_usuario=${user?.id}&limit=10`,
          method: "GET",
        },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (error) throw error;

      if (data.success) {
        setHistorial(data.historial || []);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const guardarConfiguracion = async () => {
    if (!user?.id) return;

    setSaving(true);
    try {
      const token = localStorage.getItem("auth_token");
      const { data, error } = await supabase.functions.invoke("php-api-proxy", {
        body: {
          endpoint: "recordatorios_flashcards.php",
          method: "POST",
          action: "guardar_config",
          id_usuario: user.id,
          activo: activo ? 1 : 0,
          frecuencia,
          hora_envio: horaEnvio,
          dias_semana: diasSeleccionados.join(","),
          min_pendientes: minPendientes,
        },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (error) throw error;

      if (data.success) {
        toast.success("Configuración guardada correctamente");
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error("Error:", error);
      toast.error("Error al guardar configuración");
    } finally {
      setSaving(false);
    }
  };

  const enviarRecordatorioAhora = async () => {
    if (!user?.id) return;

    setSending(true);
    try {
      const token = localStorage.getItem("auth_token");
      const { data, error } = await supabase.functions.invoke("php-api-proxy", {
        body: {
          endpoint: "recordatorios_flashcards.php",
          method: "POST",
          action: "enviar_ahora",
          id_usuario: user.id,
        },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (error) throw error;

      if (data.success) {
        toast.success("Recordatorio enviado a tu email");
        cargarHistorial();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error("Error:", error);
      toast.error(error.message || "Error al enviar recordatorio");
    } finally {
      setSending(false);
    }
  };

  const toggleDia = (dia: string) => {
    setDiasSeleccionados(prev => 
      prev.includes(dia) 
        ? prev.filter(d => d !== dia)
        : [...prev, dia].sort()
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Configurar Recordatorios de Flashcards | Oposiciones Test</title>
      </Helmet>

      <div className="container mx-auto py-8 px-4 space-y-6 max-w-3xl">
        <div className="flex items-center gap-3">
          <BrainCircuit className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Recordatorios de Flashcards</h1>
            <p className="text-muted-foreground">
              Configura notificaciones por email cuando tengas flashcards pendientes
            </p>
          </div>
        </div>

        {/* Estado actual */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Estado actual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant={pendingCount > 0 ? "default" : "secondary"}>
                    {statsLoading ? "..." : pendingCount} pendientes
                  </Badge>
                  {config?.ultimo_envio && (
                    <span className="text-sm text-muted-foreground">
                      Último envío: {format(new Date(config.ultimo_envio), "dd MMM yyyy HH:mm", { locale: es })}
                    </span>
                  )}
                </div>
              </div>
              <Button 
                onClick={enviarRecordatorioAhora} 
                disabled={sending || pendingCount === 0}
                variant="outline"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Enviar recordatorio ahora
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Configuración */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Configuración de envío
            </CardTitle>
            <CardDescription>
              Define cuándo y cómo quieres recibir los recordatorios
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Activar/Desactivar */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Recordatorios activos</Label>
                <p className="text-sm text-muted-foreground">
                  Recibe emails cuando tengas flashcards pendientes
                </p>
              </div>
              <Switch
                checked={activo}
                onCheckedChange={setActivo}
              />
            </div>

            {activo && (
              <>
                {/* Frecuencia */}
                <div className="space-y-2">
                  <Label>Frecuencia</Label>
                  <Select value={frecuencia} onValueChange={setFrecuencia}>
                    <SelectTrigger className="w-full sm:w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="diario">Diario</SelectItem>
                      <SelectItem value="semanal">Semanal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Hora de envío */}
                <div className="space-y-2">
                  <Label>Hora de envío</Label>
                  <Input
                    type="time"
                    value={horaEnvio}
                    onChange={(e) => setHoraEnvio(e.target.value)}
                    className="w-full sm:w-[200px]"
                  />
                </div>

                {/* Días de la semana */}
                <div className="space-y-2">
                  <Label>Días de envío</Label>
                  <div className="flex flex-wrap gap-2">
                    {DIAS_SEMANA.map((dia) => (
                      <label
                        key={dia.value}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                          diasSeleccionados.includes(dia.value)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-input hover:bg-accent"
                        }`}
                      >
                        <Checkbox
                          checked={diasSeleccionados.includes(dia.value)}
                          onCheckedChange={() => toggleDia(dia.value)}
                          className="hidden"
                        />
                        <span className="text-sm">{dia.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Mínimo de pendientes */}
                <div className="space-y-2">
                  <Label>Mínimo de flashcards pendientes para notificar</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={minPendientes}
                    onChange={(e) => setMinPendientes(parseInt(e.target.value) || 5)}
                    className="w-full sm:w-[200px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    Solo recibirás email si tienes al menos {minPendientes} flashcards pendientes
                  </p>
                </div>
              </>
            )}

            <Button onClick={guardarConfiguracion} disabled={saving} className="w-full sm:w-auto">
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Guardar configuración
            </Button>
          </CardContent>
        </Card>

        {/* Historial */}
        {historial.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Historial de recordatorios
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Flashcards pendientes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historial.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {format(new Date(item.fecha_envio), "dd MMM yyyy HH:mm", { locale: es })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.pending_count}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
