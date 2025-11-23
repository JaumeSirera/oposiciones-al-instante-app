import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
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
      
      const params = new URLSearchParams();
      if (filtroTipoPlan !== "todos") params.append("tipo_plan", filtroTipoPlan);
      if (filtroEnviado !== "todos") params.append("enviado", filtroEnviado === "enviados" ? "1" : "0");
      if (filtroFechaDesde) params.append("fecha_desde", filtroFechaDesde);
      if (filtroFechaHasta) params.append("fecha_hasta", filtroFechaHasta);

      const { data, error } = await supabase.functions.invoke("php-api-proxy", {
        body: {
          endpoint: `recordatorios_plan.php?action=obtener_todos&${params.toString()}`,
          method: "GET",
        },
      });

      if (error) throw error;

      if (data.success) {
        setRecordatorios(data.recordatorios || []);
      } else {
        throw new Error(data.error || "Error al cargar recordatorios");
      }
    } catch (error: any) {
      console.error("Error:", error);
      toast.error("Error al cargar recordatorios");
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
        if (!Array.isArray(temas)) throw new Error("Los temas deben ser un array");
      } catch {
        toast.error("Formato JSON inválido para temas");
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
        toast.success("Recordatorio actualizado");
        setEditandoRecordatorio(null);
        cargarRecordatorios();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error("Error:", error);
      toast.error("Error al actualizar recordatorio");
    }
  };

  const eliminarRecordatorio = async (id: number) => {
    if (!confirm("¿Estás seguro de eliminar este recordatorio?")) return;

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
        toast.success("Recordatorio eliminado");
        cargarRecordatorios();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error("Error:", error);
      toast.error("Error al eliminar recordatorio");
    }
  };

  const enviarRecordatorioAhora = async (id: number) => {
    if (!confirm("¿Enviar este recordatorio ahora?")) return;

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
        toast.success("Recordatorio enviado");
        cargarRecordatorios();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error("Error:", error);
      toast.error("Error al enviar recordatorio");
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
        <title>Administrar Recordatorios | Oposiciones Test</title>
      </Helmet>

      <div className="container mx-auto py-8 px-4 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Administrar Recordatorios</h1>
            <p className="text-muted-foreground mt-2">
              Gestiona todos los recordatorios de planes de estudio y físicos
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
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label>Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Plan, usuario, email..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div>
                <Label>Tipo de Plan</Label>
                <Select value={filtroTipoPlan} onValueChange={setFiltroTipoPlan}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="estudio">Estudio</SelectItem>
                    <SelectItem value="fisico">Físico</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Estado</Label>
                <Select value={filtroEnviado} onValueChange={setFiltroEnviado}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="pendientes">Pendientes</SelectItem>
                    <SelectItem value="enviados">Enviados</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Fecha Desde</Label>
                <Input
                  type="date"
                  value={filtroFechaDesde}
                  onChange={(e) => setFiltroFechaDesde(e.target.value)}
                />
              </div>

              <div>
                <Label>Fecha Hasta</Label>
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
              <span>Recordatorios ({recordatoriosFiltrados.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Cargando...</div>
            ) : recordatoriosFiltrados.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay recordatorios con los filtros seleccionados
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Temas</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
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
                            {recordatorio.tipo_plan === "estudio" ? "Estudio" : "Físico"}
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
                            {recordatorio.temas.length} tema(s)
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {recordatorio.enviado ? (
                            <div className="flex items-center gap-2 text-green-600">
                              <CheckCircle2 className="h-4 w-4" />
                              Enviado
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-orange-600">
                              <Clock className="h-4 w-4" />
                              Pendiente
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
            <DialogTitle>Editar Recordatorio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Fecha</Label>
              <Input
                type="date"
                value={editFecha}
                onChange={(e) => setEditFecha(e.target.value)}
              />
            </div>
            <div>
              <Label>Temas (JSON)</Label>
              <Textarea
                value={editTemas}
                onChange={(e) => setEditTemas(e.target.value)}
                rows={10}
                className="font-mono text-sm"
                placeholder='["Tema 1", "Tema 2", "Tema 3"]'
              />
              <p className="text-xs text-muted-foreground mt-1">
                Formato JSON de array de strings
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditandoRecordatorio(null)}>
              Cancelar
            </Button>
            <Button onClick={guardarEdicion}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
