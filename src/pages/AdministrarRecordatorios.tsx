import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Calendar, 
  Mail, 
  Trash2, 
  Edit, 
  Filter, 
  RefreshCw,
  Send,
  CheckCircle2,
  Clock,
  Search
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Recordatorio {
  id_recordatorio: number;
  id_plan: number;
  id_usuario: number;
  fecha: string;
  temas: string[];
  enviado: number;
  fecha_envio: string | null;
  tipo_plan: "estudio" | "fisico";
  nombre_usuario: string;
  email_usuario: string;
  titulo_plan: string;
}

export default function AdministrarRecordatorios() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [recordatorios, setRecordatorios] = useState<Recordatorio[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipoPlan, setFiltroTipoPlan] = useState<string>("todos");
  const [filtroEnviado, setFiltroEnviado] = useState<string>("todos");
  const [filtroFechaDesde, setFiltroFechaDesde] = useState("");
  const [filtroFechaHasta, setFiltroFechaHasta] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [editandoRecordatorio, setEditandoRecordatorio] = useState<Recordatorio | null>(null);
  const [editFecha, setEditFecha] = useState("");
  const [editTemas, setEditTemas] = useState("");

  useEffect(() => {
    cargarRecordatorios();
  }, [filtroTipoPlan, filtroEnviado, filtroFechaDesde, filtroFechaHasta]);

  const cargarRecordatorios = async () => {
    try {
      setLoading(true);
      
      // Obtener rol del usuario
      const nivel = localStorage.getItem("nivel") || "";
      
      const params = new URLSearchParams();
      
      // Si no es SA, filtrar por id_usuario
      if (nivel !== "SA" && user?.id) {
        params.append("id_usuario", user.id.toString());
      }
      
      if (filtroTipoPlan !== "todos") params.append("tipo_plan", filtroTipoPlan);
      if (filtroEnviado !== "todos") params.append("enviado", filtroEnviado === "enviados" ? "1" : "0");
      if (filtroFechaDesde) params.append("fecha_desde", filtroFechaDesde);
      if (filtroFechaHasta) params.append("fecha_hasta", filtroFechaHasta);

      const paramsString = params.toString();
      const endpoint = paramsString
        ? `recordatorios_plan.php?${paramsString}`
        : `recordatorios_plan.php`;

      const token = localStorage.getItem("auth_token");
      const { data, error } = await supabase.functions.invoke("php-api-proxy", {
        body: {
          endpoint,
          method: "GET",
          action: "obtener_todos",
        },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (error) throw error;

      if (data.success) {
        setRecordatorios(data.recordatorios || []);
      } else {
        throw new Error(data.error || t('reminders.errorLoading'));
      }
    } catch (error: any) {
      console.error("Error:", error);
      toast.error(t('reminders.errorLoading'));
    } finally {
      setLoading(false);
    }
  };

  const abrirEdicion = (recordatorio: Recordatorio) => {
    setEditandoRecordatorio(recordatorio);
    setEditFecha(recordatorio.fecha);
    setEditTemas(JSON.stringify(recordatorio.temas, null, 2));
  };

  const guardarEdicion = async () => {
    if (!editandoRecordatorio) return;

    try {
      let temas: string[];
      try {
        temas = JSON.parse(editTemas);
        if (!Array.isArray(temas)) throw new Error(t('reminders.topicsMustBeArray'));
      } catch {
        toast.error(t('reminders.invalidJsonFormat'));
        return;
      }

      const { data, error } = await supabase.functions.invoke("php-api-proxy", {
        body: {
          endpoint: "recordatorios_plan.php",
          method: "POST",
          action: "editar",
          id_recordatorio: editandoRecordatorio.id_recordatorio,
          fecha: editFecha,
          temas,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast.success(t('reminders.updated'));
        setEditandoRecordatorio(null);
        cargarRecordatorios();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error("Error:", error);
      toast.error(t('reminders.errorUpdating'));
    }
  };

  const eliminarRecordatorio = async (id: number) => {
    if (!confirm(t('reminders.confirmDelete'))) return;

    try {
      const { data, error } = await supabase.functions.invoke("php-api-proxy", {
        body: {
          endpoint: "recordatorios_plan.php",
          method: "POST",
          action: "eliminar",
          id_recordatorio: id,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast.success(t('reminders.deleted'));
        cargarRecordatorios();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error("Error:", error);
      toast.error(t('reminders.errorDeleting'));
    }
  };

  const enviarRecordatorioAhora = async (id: number) => {
    if (!confirm(t('reminders.confirmSendNow'))) return;

    try {
      const { data, error } = await supabase.functions.invoke("php-api-proxy", {
        body: {
          endpoint: "recordatorios_plan.php",
          method: "POST",
          action: "enviar_ahora",
          id_recordatorio: id,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast.success(t('reminders.sent'));
        cargarRecordatorios();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error("Error:", error);
      toast.error(t('reminders.errorSending'));
    }
  };

  const recordatoriosFiltrados = recordatorios.filter((r) => {
    const busquedaLower = busqueda.toLowerCase();
    return (
      r.titulo_plan.toLowerCase().includes(busquedaLower) ||
      r.nombre_usuario.toLowerCase().includes(busquedaLower) ||
      r.email_usuario.toLowerCase().includes(busquedaLower)
    );
  });

  return (
    <>
      <Helmet>
        <title>{t('reminders.pageTitle')} | Oposiciones Test</title>
      </Helmet>

      <div className="container mx-auto py-8 px-4 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t('reminders.title')}</h1>
            <p className="text-muted-foreground mt-2">
              {t('reminders.subtitle')}
            </p>
          </div>
          <Button onClick={cargarRecordatorios} variant="outline" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              {t('reminders.filters')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label>{t('reminders.search')}</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t('reminders.searchPlaceholder')}
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div>
                <Label>{t('reminders.planType')}</Label>
                <Select value={filtroTipoPlan} onValueChange={setFiltroTipoPlan}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">{t('reminders.all')}</SelectItem>
                    <SelectItem value="estudio">{t('reminders.study')}</SelectItem>
                    <SelectItem value="fisico">{t('reminders.physical')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{t('reminders.status')}</Label>
                <Select value={filtroEnviado} onValueChange={setFiltroEnviado}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">{t('reminders.all')}</SelectItem>
                    <SelectItem value="pendientes">{t('reminders.pending')}</SelectItem>
                    <SelectItem value="enviados">{t('reminders.sentStatus')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{t('reminders.dateFrom')}</Label>
                <Input
                  type="date"
                  value={filtroFechaDesde}
                  onChange={(e) => setFiltroFechaDesde(e.target.value)}
                />
              </div>

              <div>
                <Label>{t('reminders.dateTo')}</Label>
                <Input
                  type="date"
                  value={filtroFechaHasta}
                  onChange={(e) => setFiltroFechaHasta(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabla de Recordatorios */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{t('reminders.reminders')} ({recordatoriosFiltrados.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">{t('reminders.loading')}</div>
            ) : recordatoriosFiltrados.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {t('reminders.noReminders')}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('reminders.date')}</TableHead>
                      <TableHead>{t('reminders.plan')}</TableHead>
                      <TableHead>{t('reminders.type')}</TableHead>
                      <TableHead>{t('reminders.user')}</TableHead>
                      <TableHead>{t('reminders.email')}</TableHead>
                      <TableHead>{t('reminders.topics')}</TableHead>
                      <TableHead>{t('reminders.statusColumn')}</TableHead>
                      <TableHead className="text-right">{t('reminders.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recordatoriosFiltrados.map((recordatorio) => (
                      <TableRow key={recordatorio.id_recordatorio}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {format(new Date(recordatorio.fecha), "dd MMM yyyy", {
                              locale: es,
                            })}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {recordatorio.titulo_plan}
                        </TableCell>
                        <TableCell>
                          <Badge variant={recordatorio.tipo_plan === "estudio" ? "default" : "secondary"}>
                            {recordatorio.tipo_plan === "estudio" ? t('reminders.study') : t('reminders.physical')}
                          </Badge>
                        </TableCell>
                        <TableCell>{recordatorio.nombre_usuario}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            {recordatorio.email_usuario}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {recordatorio.temas.length} {t('reminders.topicsCount')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {recordatorio.enviado ? (
                            <div className="flex items-center gap-2 text-green-600">
                              <CheckCircle2 className="h-4 w-4" />
                              {t('reminders.sentStatus')}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-orange-600">
                              <Clock className="h-4 w-4" />
                              {t('reminders.pending')}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => abrirEdicion(recordatorio)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {!recordatorio.enviado && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  enviarRecordatorioAhora(recordatorio.id_recordatorio)
                                }
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                eliminarRecordatorio(recordatorio.id_recordatorio)
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Diálogo de Edición */}
      <Dialog
        open={!!editandoRecordatorio}
        onOpenChange={(open) => !open && setEditandoRecordatorio(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('reminders.editReminder')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('reminders.date')}</Label>
              <Input
                type="date"
                value={editFecha}
                onChange={(e) => setEditFecha(e.target.value)}
              />
            </div>
            <div>
              <Label>{t('reminders.topicsJson')}</Label>
              <Textarea
                value={editTemas}
                onChange={(e) => setEditTemas(e.target.value)}
                rows={10}
                className="font-mono text-sm"
                placeholder='["Tema 1", "Tema 2", "Tema 3"]'
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t('reminders.jsonFormat')}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditandoRecordatorio(null)}>
              {t('reminders.cancel')}
            </Button>
            <Button onClick={guardarEdicion}>{t('reminders.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
