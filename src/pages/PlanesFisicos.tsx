import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { Calendar as CalendarIcon, Dumbbell, Pencil, Trash2, Plus, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface PlanFisico {
  id: number;
  titulo: string;
  descripcion: string;
  tipo_prueba: string;
  fecha_inicio: string;
  fecha_fin: string;
  ia_avance_ratio: number;
}

export default function PlanesFisicos() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [planes, setPlanes] = useState<PlanFisico[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    titulo: '',
    descripcion: '',
    tipo_prueba: '',
    fecha_inicio: undefined as Date | undefined,
    fecha_fin: undefined as Date | undefined,
  });

  const [errors, setErrors] = useState({
    titulo: '',
    tipo_prueba: '',
    fecha_inicio: '',
    fecha_fin: '',
  });

  useEffect(() => {
    if (user) {
      fetchPlanes();
    }
  }, [user]);

  const fetchPlanes = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('php-api-proxy', {
        body: {
          endpoint: `planes_fisicos.php?action=listar&id_usuario=${user.id}`,
          method: 'GET'
        }
      });
      
      if (error) throw error;
      
      if (data.success) {
        setPlanes(data.planes || []);
      } else {
        toast.error(data.error || 'Error al cargar los planes físicos');
      }
    } catch (error) {
      console.error('Error al cargar planes físicos:', error);
      toast.error('Error de conexión al cargar planes');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors = {
      titulo: '',
      tipo_prueba: '',
      fecha_inicio: '',
      fecha_fin: '',
    };

    if (!formData.titulo.trim()) {
      newErrors.titulo = 'El título es obligatorio';
    }
    if (!formData.tipo_prueba.trim()) {
      newErrors.tipo_prueba = 'El tipo de prueba es obligatorio';
    }
    if (!formData.fecha_inicio) {
      newErrors.fecha_inicio = 'Selecciona la fecha de inicio';
    }
    if (!formData.fecha_fin) {
      newErrors.fecha_fin = 'Selecciona la fecha de fin';
    }

    setErrors(newErrors);
    return !Object.values(newErrors).some((err) => err);
  };

  const resetForm = () => {
    setFormData({
      titulo: '',
      descripcion: '',
      tipo_prueba: '',
      fecha_inicio: undefined,
      fecha_fin: undefined,
    });
    setErrors({
      titulo: '',
      tipo_prueba: '',
      fecha_inicio: '',
      fecha_fin: '',
    });
    setEditingId(null);
    setEditMode(false);
  };

  const handleCreate = () => {
    resetForm();
    setEditMode(false);
    setModalOpen(true);
  };

  const handleEdit = (plan: PlanFisico) => {
    setEditMode(true);
    setEditingId(plan.id);
    setFormData({
      titulo: plan.titulo,
      descripcion: plan.descripcion,
      tipo_prueba: plan.tipo_prueba,
      fecha_inicio: new Date(plan.fecha_inicio),
      fecha_fin: new Date(plan.fecha_fin),
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!validateForm() || !user?.id) return;

    setSaving(true);
    try {
      const payload = {
        id_usuario: user.id,
        titulo: formData.titulo.trim(),
        descripcion: formData.descripcion.trim(),
        tipo_prueba: formData.tipo_prueba.trim(),
        fecha_inicio: format(formData.fecha_inicio!, 'yyyy-MM-dd'),
        fecha_fin: format(formData.fecha_fin!, 'yyyy-MM-dd'),
      };

      const endpoint = editMode
        ? `planes_fisicos.php?action=actualizar&id_plan=${editingId}`
        : `planes_fisicos.php?action=crear`;

      const { data, error } = await supabase.functions.invoke('php-api-proxy', {
        body: {
          endpoint,
          method: editMode ? 'PUT' : 'POST',
          ...payload
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(editMode ? 'Plan actualizado' : 'Plan creado');
        setModalOpen(false);
        resetForm();
        fetchPlanes();
      } else {
        toast.error(data.error || 'Error al guardar el plan');
      }
    } catch (error) {
      console.error('Error al guardar plan físico:', error);
      toast.error('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('¿Seguro que quieres eliminar este plan?')) return;
    if (!user?.id) return;

    setDeletingId(id);
    try {
      const { data, error } = await supabase.functions.invoke('php-api-proxy', {
        body: {
          endpoint: 'planes_fisicos.php?action=eliminar',
          method: 'POST',
          id_plan: id,
          id_usuario: user.id
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Plan eliminado');
        fetchPlanes();
      } else {
        toast.error(data.error || 'Error al eliminar el plan');
      }
    } catch (error) {
      console.error('Error al eliminar plan físico:', error);
      toast.error('Error de conexión');
    } finally {
      setDeletingId(null);
    }
  };

  const formatFecha = (fecha: string) => {
    return format(new Date(fecha), 'dd/MM/yyyy', { locale: es });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Planes Físicos</h1>
        <p className="text-muted-foreground">
          La IA crea un planning semanal de ejercicios físicos personalizado para ti.
        </p>
      </div>

      <div className="flex gap-3 mb-6">
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo plan físico
        </Button>
        <Button variant="outline" onClick={() => navigate('/generar-plan-fisico-ia')}>
          <Sparkles className="h-4 w-4 mr-2" />
          Generar con IA
        </Button>
      </div>

      {planes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Dumbbell className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No hay planes físicos creados.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {planes.map((plan) => (
            <Card
              key={plan.id}
              className="hover:shadow-lg transition-shadow cursor-pointer relative"
              onClick={() => navigate(`/planes-fisicos/${plan.id}`)}
            >
              {deletingId === plan.id && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-20 rounded-lg">
                  <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <p className="text-sm text-muted-foreground">Eliminando...</p>
                  </div>
                </div>
              )}
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{plan.titulo}</CardTitle>
                    <CardDescription>{plan.tipo_prueba}</CardDescription>
                  </div>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(plan);
                      }}
                      disabled={deletingId === plan.id}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(plan.id);
                      }}
                      disabled={deletingId === plan.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {plan.descripcion || '-'}
                </p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                  <CalendarIcon className="h-4 w-4" />
                  <span>
                    {formatFecha(plan.fecha_inicio)} → {formatFecha(plan.fecha_fin)}
                  </span>
                </div>
                <div className="space-y-2">
                  <Progress value={plan.ia_avance_ratio * 100} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {Math.round(plan.ia_avance_ratio * 100)}% completado
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editMode ? 'Editar plan físico' : 'Crear nuevo plan físico'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="titulo">Título *</Label>
              <Input
                id="titulo"
                value={formData.titulo}
                onChange={(e) => {
                  setFormData({ ...formData, titulo: e.target.value });
                  setErrors({ ...errors, titulo: '' });
                }}
                className={errors.titulo ? 'border-destructive' : ''}
              />
              {errors.titulo && (
                <p className="text-sm text-destructive mt-1">{errors.titulo}</p>
              )}
            </div>

            <div>
              <Label htmlFor="tipo">Tipo de prueba *</Label>
              <Input
                id="tipo"
                placeholder="Ej: Bombero, Policía, Militar..."
                value={formData.tipo_prueba}
                onChange={(e) => {
                  setFormData({ ...formData, tipo_prueba: e.target.value });
                  setErrors({ ...errors, tipo_prueba: '' });
                }}
                className={errors.tipo_prueba ? 'border-destructive' : ''}
              />
              {errors.tipo_prueba && (
                <p className="text-sm text-destructive mt-1">{errors.tipo_prueba}</p>
              )}
            </div>

            <div>
              <Label htmlFor="descripcion">Descripción</Label>
              <Textarea
                id="descripcion"
                value={formData.descripcion}
                onChange={(e) =>
                  setFormData({ ...formData, descripcion: e.target.value })
                }
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Fecha de inicio *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={`w-full justify-start text-left font-normal ${
                        errors.fecha_inicio ? 'border-destructive' : ''
                      }`}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.fecha_inicio
                        ? format(formData.fecha_inicio, 'dd/MM/yyyy', { locale: es })
                        : 'Seleccionar'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.fecha_inicio}
                      onSelect={(date) => {
                        setFormData({ ...formData, fecha_inicio: date });
                        setErrors({ ...errors, fecha_inicio: '' });
                      }}
                      locale={es}
                    />
                  </PopoverContent>
                </Popover>
                {errors.fecha_inicio && (
                  <p className="text-sm text-destructive mt-1">{errors.fecha_inicio}</p>
                )}
              </div>

              <div>
                <Label>Fecha de fin *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={`w-full justify-start text-left font-normal ${
                        errors.fecha_fin ? 'border-destructive' : ''
                      }`}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.fecha_fin
                        ? format(formData.fecha_fin, 'dd/MM/yyyy', { locale: es })
                        : 'Seleccionar'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.fecha_fin}
                      onSelect={(date) => {
                        setFormData({ ...formData, fecha_fin: date });
                        setErrors({ ...errors, fecha_fin: '' });
                      }}
                      locale={es}
                    />
                  </PopoverContent>
                </Popover>
                {errors.fecha_fin && (
                  <p className="text-sm text-destructive mt-1">{errors.fecha_fin}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setModalOpen(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : editMode ? 'Guardar cambios' : 'Crear plan'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
