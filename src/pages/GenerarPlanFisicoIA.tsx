import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services/authService';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Loader2, Calendar as CalendarIcon, Sparkles, ArrowLeft } from 'lucide-react';
import { format, addWeeks } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

interface PlanGenerado {
  titulo: string;
  descripcion: string;
  tipo_prueba: string;
  fecha_inicio: string;
  fecha_fin: string;
  semanas: Array<{
    titulo: string;
    fecha_inicio: string;
    fecha_fin: string;
    resumen: string;
    sesiones: Array<{
      dia: string;
      bloques: Array<any>;
    }>;
  }>;
  resumen: string;
}

const tiposPrueba = [
  'Bombero',
  'Policía Nacional',
  'Policía Local',
  'Guardia Civil',
  'Militar',
  'CrossFit',
  'Hyrox',
  'Hybrid',
  'Otro',
];

export default function GenerarPlanFisicoIA() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [planGenerado, setPlanGenerado] = useState<PlanGenerado | null>(null);

  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [semanas, setSemanas] = useState(6);
  const [diasSemana, setDiasSemana] = useState(4);
  const [nivelFisico, setNivelFisico] = useState('intermedio');
  const [fechaInicio, setFechaInicio] = useState<Date>(new Date());
  const [notificacionesEmail, setNotificacionesEmail] = useState(true);
  const [horaNotificacion, setHoraNotificacion] = useState('09:00');

  const generarPlanConIA = async () => {
    if (!user?.id || !titulo.trim() || !tipo) {
      toast.error(t('physicalPlans.generate.completeRequired'));
      return;
    }

    setGenerando(true);
    try {
      const fechaFin = addWeeks(fechaInicio, semanas);

      const { data, error } = await supabase.functions.invoke('generar-plan-fisico', {
        body: {
          titulo: titulo.trim(),
          tipo_prueba: tipo,
          descripcion: descripcion.trim(),
          semanas,
          dias_semana: diasSemana,
          nivel_fisico: nivelFisico,
          fecha_inicio: format(fechaInicio, 'yyyy-MM-dd'),
          fecha_fin: format(fechaFin, 'yyyy-MM-dd'),
        },
      });

      if (error) throw error;

      if (data?.success && data?.plan) {
        setPlanGenerado(data.plan);
        toast.success(t('physicalPlans.generate.planGenerated'));
      } else {
        toast.error(data?.error || t('physicalPlans.generate.errorGenerating'));
      }
    } catch (error) {
      console.error('Error generando plan:', error);
      toast.error(t('physicalPlans.generate.errorGenerating'));
    } finally {
      setGenerando(false);
    }
  };

  const confirmarYGuardar = async () => {
    if (!planGenerado || !user?.id) return;

    setLoading(true);
    try {
      const token = authService.getToken();
      
      const { data, error } = await supabase.functions.invoke('guardar-plan-fisico', {
        body: {
          id_usuario: user.id,
          plan: planGenerado,
          notificaciones_email: notificacionesEmail,
          hora_notificacion: notificacionesEmail ? horaNotificacion : null,
          php_token: token,
        },
      });

      if (error) throw error;

      if (data?.success && data?.id_plan) {
        toast.success(t('physicalPlans.generate.planSaved'));
        navigate(`/planes-fisicos/${data.id_plan}`);
      } else {
        toast.error(data?.error || t('physicalPlans.generate.errorSaving'));
      }
    } catch (error) {
      console.error('Error guardando plan:', error);
      toast.error(t('physicalPlans.generate.errorSaving'));
    } finally {
      setLoading(false);
    }
  };

  if (!planGenerado) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Button variant="ghost" onClick={() => navigate('/planes-fisicos')} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('common.back')}
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              {t('physicalPlans.generate.title')}
            </CardTitle>
            <CardDescription>
              {t('physicalPlans.generate.subtitle')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="titulo">{t('physicalPlans.generate.planTitle')} *</Label>
                <Input
                  id="titulo"
                  placeholder={t('physicalPlans.generate.planTitlePlaceholder')}
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tipo">{t('physicalPlans.generate.testType')} *</Label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('physicalPlans.generate.selectTestType')} />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposPrueba.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="descripcion">{t('physicalPlans.generate.descriptionObjectives')}</Label>
              <Textarea
                id="descripcion"
                placeholder={t('physicalPlans.generate.descriptionPlaceholder')}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={3}
              />
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="semanas">{t('physicalPlans.generate.durationWeeks')}</Label>
                <Input
                  id="semanas"
                  type="number"
                  min={4}
                  max={6}
                  value={semanas}
                  onChange={(e) => setSemanas(Number(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dias">{t('physicalPlans.generate.daysPerWeek')}</Label>
                <Input
                  id="dias"
                  type="number"
                  min={2}
                  max={7}
                  value={diasSemana}
                  onChange={(e) => setDiasSemana(Number(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nivel">{t('physicalPlans.generate.fitnessLevel')}</Label>
                <Select value={nivelFisico} onValueChange={setNivelFisico}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="principiante">{t('physicalPlans.generate.beginner')}</SelectItem>
                    <SelectItem value="intermedio">{t('physicalPlans.generate.intermediate')}</SelectItem>
                    <SelectItem value="avanzado">{t('physicalPlans.generate.advanced')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('physicalPlans.generate.startDate')}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(fechaInicio, 'dd/MM/yyyy', { locale: es })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={fechaInicio}
                    onSelect={(date) => date && setFechaInicio(date)}
                    locale={es}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-4 p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t('physicalPlans.generate.emailReminders')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('physicalPlans.generate.emailRemindersDesc')}
                  </p>
                </div>
                <Switch
                  checked={notificacionesEmail}
                  onCheckedChange={setNotificacionesEmail}
                />
              </div>

              {notificacionesEmail && (
                <div className="space-y-2">
                  <Label htmlFor="hora">{t('physicalPlans.generate.reminderTime')}</Label>
                  <Input
                    id="hora"
                    type="time"
                    value={horaNotificacion}
                    onChange={(e) => setHoraNotificacion(e.target.value)}
                  />
                </div>
              )}
            </div>

            <Button
              onClick={generarPlanConIA}
              disabled={generando}
              className="w-full"
              size="lg"
            >
              {generando ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('physicalPlans.generate.generating')}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {t('physicalPlans.generate.generateButton')}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Button variant="ghost" onClick={() => setPlanGenerado(null)} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />
        {t('physicalPlans.generate.backToForm')}
      </Button>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{planGenerado.titulo}</CardTitle>
          <CardDescription>{planGenerado.tipo_prueba}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-1">{t('physicalPlans.detail.description')}</h3>
            <p className="text-muted-foreground">{planGenerado.descripcion}</p>
          </div>

          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarIcon className="h-4 w-4" />
            <span>
              {format(new Date(planGenerado.fecha_inicio), 'dd/MM/yyyy', { locale: es })} →{' '}
              {format(new Date(planGenerado.fecha_fin), 'dd/MM/yyyy', { locale: es })}
            </span>
          </div>

          {planGenerado.resumen && (
            <div className="p-3 bg-muted rounded">
              <h3 className="font-semibold mb-1">{t('physicalPlans.generate.aiSummary')}</h3>
              <p className="text-sm">{planGenerado.resumen}</p>
            </div>
          )}

          <div>
            <h3 className="font-semibold mb-2">{t('physicalPlans.generate.trainingPlan')}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {planGenerado.semanas?.length || 0} {t('physicalPlans.generate.weeksScheduled')}
            </p>

            <div className="space-y-2">
              {planGenerado.semanas?.slice(0, 3).map((sem, idx) => (
                <div key={idx} className="p-3 border rounded-lg">
                  <h4 className="font-semibold text-sm">{sem.titulo}</h4>
                  <p className="text-xs text-muted-foreground mt-1">{sem.resumen}</p>
                </div>
              ))}
              {planGenerado.semanas?.length > 3 && (
                <p className="text-sm text-muted-foreground text-center">
                  + {planGenerado.semanas.length - 3} {t('physicalPlans.generate.moreWeeks')}
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={() => setPlanGenerado(null)} disabled={loading}>
              {t('physicalPlans.generate.generateAnother')}
            </Button>
            <Button onClick={confirmarYGuardar} disabled={loading} className="flex-1">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('physicalPlans.generate.saving')}
                </>
              ) : (
                t('physicalPlans.generate.confirmAndSave')
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
