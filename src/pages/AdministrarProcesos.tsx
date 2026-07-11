import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { adminProcesosService, type AdminProceso } from "@/services/adminProcesosService";
import { Loader2, Pencil, Trash2, Plus, Search } from "lucide-react";

const ESTADOS = ["activo", "inactivo", "finalizado"];

type FormState = {
  id?: number;
  descripcion: string;
  estado: string;
  fecha_inicio: string;
  fecha_fin: string;
};

const empty: FormState = { descripcion: "", estado: "activo", fecha_inicio: "", fecha_fin: "" };

export default function AdministrarProcesos() {
  const { isSuperAdmin, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<AdminProceso[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminProceso | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminProceso | null>(null);

  const load = async (q = "") => {
    setLoading(true);
    try {
      const data = await adminProcesosService.list({ q });
      setItems(data);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error al cargar procesos", description: e?.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) load();
  }, [isSuperAdmin]);

  if (authLoading) return null;
  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;

  const openCreate = () => { setEditing(null); setForm(empty); setDialogOpen(true); };
  const openEdit = (p: AdminProceso) => {
    setEditing(p);
    setForm({
      id: p.id,
      descripcion: p.descripcion || "",
      estado: p.estado || "activo",
      fecha_inicio: p.fecha_inicio ? String(p.fecha_inicio).slice(0, 10) : "",
      fecha_fin: p.fecha_fin ? String(p.fecha_fin).slice(0, 10) : "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.descripcion.trim()) {
      toast({ variant: "destructive", title: "La descripción es obligatoria" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        descripcion: form.descripcion.trim(),
        estado: form.estado,
        fecha_inicio: form.fecha_inicio || null,
        fecha_fin: form.fecha_fin || null,
      };
      const res = editing
        ? await adminProcesosService.update(editing.id, payload)
        : await adminProcesosService.create(payload);
      if (res?.error) throw new Error(res.error);
      toast({ title: editing ? "Proceso actualizado" : "Proceso creado" });
      setDialogOpen(false);
      load(search);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error al guardar", description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await adminProcesosService.remove(deleteTarget.id);
      if (res?.error) throw new Error(res.error);
      toast({ title: "Proceso eliminado" });
      setDeleteTarget(null);
      load(search);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error al eliminar", description: e?.message });
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
          <CardTitle>Administrar procesos</CardTitle>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" /> Nuevo proceso
          </Button>
        </CardHeader>
        <CardContent>
          <form className="flex gap-2 mb-4" onSubmit={(e) => { e.preventDefault(); load(search); }}>
            <Input placeholder="Buscar por descripción" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Button type="submit" variant="secondary">
              <Search className="h-4 w-4 mr-2" /> Buscar
            </Button>
          </form>

          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">ID</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="w-28">Estado</TableHead>
                    <TableHead className="w-28">Inicio</TableHead>
                    <TableHead className="w-28">Fin</TableHead>
                    <TableHead className="w-24">Visibilidad</TableHead>
                    <TableHead className="w-[130px] text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                        No hay procesos.
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{p.id}</TableCell>
                        <TableCell className="font-medium">{p.descripcion}</TableCell>
                        <TableCell>{p.estado}</TableCell>
                        <TableCell>{p.fecha_inicio ? String(p.fecha_inicio).slice(0, 10) : "—"}</TableCell>
                        <TableCell>{p.fecha_fin ? String(p.fecha_fin).slice(0, 10) : "—"}</TableCell>
                        <TableCell>{p.es_publico ? "Público" : "Privado"}</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteTarget(p)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar proceso" : "Nuevo proceso"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Descripción</Label>
              <Input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={form.estado} onValueChange={(v) => setForm({ ...form, estado: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ESTADOS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fecha inicio</Label>
                <Input type="date" value={form.fecha_inicio} onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })} />
              </div>
              <div>
                <Label>Fecha fin</Label>
                <Input type="date" value={form.fecha_fin} onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar proceso?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <b>{deleteTarget?.descripcion}</b>. Esta acción no se puede deshacer y podría afectar preguntas y tests asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
