import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { adminUsuariosService, type AdminUser } from "@/services/adminUsuariosService";
import { Loader2, Pencil, Trash2, Plus, Search, KeyRound } from "lucide-react";

type FormState = {
  id?: number;
  username: string;
  email: string;
  password: string;
  nivel: string;
};

const NIVELES = ["user", "admin", "SA"];

export default function AdministrarUsuarios() {
  const { isSuperAdmin, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [form, setForm] = useState<FormState>({
    username: "",
    email: "",
    password: "",
    nivel: "user",
  });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [pwDialog, setPwDialog] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const load = async (q = "") => {
    setLoading(true);
    try {
      const data = await adminUsuariosService.list(q);
      setUsers(data);
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Error al cargar usuarios",
        description: e?.message || "Inténtalo de nuevo.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) load();
  }, [isSuperAdmin]);

  if (authLoading) return null;
  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;

  const openCreate = () => {
    setEditing(null);
    setForm({ username: "", email: "", password: "", nivel: "user" });
    setDialogOpen(true);
  };

  const openEdit = (u: AdminUser) => {
    setEditing(u);
    setForm({
      id: u.id,
      username: u.username,
      email: u.email,
      password: "",
      nivel: u.nivel || "user",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.username.trim() || !form.email.trim()) {
      toast({ variant: "destructive", title: "Rellena usuario y email" });
      return;
    }
    if (!editing && form.password.length < 6) {
      toast({ variant: "destructive", title: "La contraseña debe tener al menos 6 caracteres" });
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const payload: any = {
          id: editing.id,
          username: form.username.trim(),
          email: form.email.trim(),
          nivel: form.nivel,
        };
        if (form.password) payload.password = form.password;
        const res = await adminUsuariosService.update(payload);
        if (res?.error) throw new Error(res.error);
        toast({ title: "Usuario actualizado" });
      } else {
        const res = await adminUsuariosService.create({
          username: form.username.trim(),
          email: form.email.trim(),
          password: form.password,
          nivel: form.nivel,
        });
        if (res?.error) throw new Error(res.error);
        toast({ title: "Usuario creado" });
      }
      setDialogOpen(false);
      load(search);
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Error al guardar",
        description: e?.message || "Inténtalo de nuevo.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await adminUsuariosService.remove(deleteTarget.id);
      if (res?.error) throw new Error(res.error);
      toast({ title: "Usuario eliminado" });
      setDeleteTarget(null);
      load(search);
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Error al eliminar",
        description: e?.message || "Inténtalo de nuevo.",
      });
    }
  };

  const handleChangePassword = async () => {
    if (!pwDialog) return;
    if (newPassword.length < 6) {
      toast({ variant: "destructive", title: "Mínimo 6 caracteres" });
      return;
    }
    try {
      const res = await adminUsuariosService.update({
        id: pwDialog.id,
        password: newPassword,
      });
      if (res?.error) throw new Error(res.error);
      toast({ title: "Contraseña actualizada" });
      setPwDialog(null);
      setNewPassword("");
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Error al cambiar contraseña",
        description: e?.message || "Inténtalo de nuevo.",
      });
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
          <CardTitle>Administrar usuarios</CardTitle>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" /> Nuevo usuario
          </Button>
        </CardHeader>
        <CardContent>
          <form
            className="flex gap-2 mb-4"
            onSubmit={(e) => {
              e.preventDefault();
              load(search);
            }}
          >
            <Input
              placeholder="Buscar por usuario o email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button type="submit" variant="secondary">
              <Search className="h-4 w-4 mr-2" /> Buscar
            </Button>
          </form>

          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">ID</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="w-24">Nivel</TableHead>
                    <TableHead className="w-[180px] text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                        No hay usuarios.
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>{u.id}</TableCell>
                        <TableCell className="font-medium">{u.username}</TableCell>
                        <TableCell className="truncate max-w-[240px]">{u.email}</TableCell>
                        <TableCell>{u.nivel}</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(u)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setPwDialog(u);
                              setNewPassword("");
                            }}
                            title="Cambiar contraseña"
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => setDeleteTarget(u)}
                          >
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

      {/* Crear / Editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar usuario" : "Nuevo usuario"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Usuario</Label>
              <Input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <Label>Nivel</Label>
              <Select
                value={form.nivel}
                onValueChange={(v) => setForm({ ...form, nivel: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NIVELES.map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>
                Contraseña {editing && <span className="text-muted-foreground text-xs">(dejar vacío para no cambiar)</span>}
              </Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={editing ? "Sin cambios" : "Mínimo 6 caracteres"}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cambiar contraseña */}
      <Dialog open={!!pwDialog} onOpenChange={(o) => !o && setPwDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar contraseña de {pwDialog?.username}</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Nueva contraseña</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPwDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={handleChangePassword}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar borrado */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <b>{deleteTarget?.username}</b> ({deleteTarget?.email}). Esta acción no se puede deshacer.
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
