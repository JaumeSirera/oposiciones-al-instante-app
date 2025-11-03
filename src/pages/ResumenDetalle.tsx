import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Loader2, ArrowLeft, Brain, FileText, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Detalle {
  id: number;
  tema?: string;
  seccion?: string;
  resumen?: string;
  archivo_nombre?: string;
  archivo_tipo?: string;
  archivo_tamano?: number;
  fecha?: string;
}

export default function ResumenDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [techVisible, setTechVisible] = useState(false);
  const [techText, setTechText] = useState('');
  const [techLoading, setTechLoading] = useState(false);
  const [techSaving, setTechSaving] = useState(false);
  const [techGenerating, setTechGenerating] = useState(false);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const cargarDetalle = useCallback(async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      const response = await fetch(
        `https://oposiciones-test.com/api/detalle_resumen.php?id=${id}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) throw new Error('Error al cargar el resumen');
      
      const data = await response.json();
      
      if (data?.resumen) {
        setDetalle(data.resumen);
      } else if (data?.error) {
        throw new Error(data.error);
      } else {
        throw new Error('Formato de respuesta inválido');
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || 'No se pudo cargar el resumen'
      });
      navigate('/resumenes');
    } finally {
      setLoading(false);
    }
  }, [id, supabaseUrl, supabaseKey, navigate, toast]);

  const cargarTecnica = useCallback(async () => {
    if (!id) return;
    
    setTechLoading(true);
    try {
      const response = await fetch(
        `https://oposiciones-test.com/api/tecnica_resumen.php?resumen_id=${id}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) throw new Error('Error al cargar la técnica');
      
      const data = await response.json();
      
      if (data?.tecnica) {
        setTechText(data.tecnica);
      }
    } catch (error: any) {
      console.error('Error cargando técnica:', error);
    } finally {
      setTechLoading(false);
    }
  }, [id, supabaseUrl, supabaseKey]);

  const guardarTecnica = useCallback(async () => {
    if (!id) return;
    
    setTechSaving(true);
    try {
      const response = await fetch(
        `https://oposiciones-test.com/api/tecnica_resumen.php`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            resumen_id: Number(id),
            tecnica: techText,
          }),
        }
      );
      
      if (!response.ok) throw new Error('Error al guardar la técnica');
      
      const data = await response.json();
      
      if (data?.success) {
        toast({
          title: "Éxito",
          description: "Técnica guardada correctamente",
        });
        setTechVisible(false);
      } else {
        throw new Error(data?.error || 'Error al guardar');
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || 'No se pudo guardar la técnica'
      });
    } finally {
      setTechSaving(false);
    }
  }, [id, techText, supabaseUrl, supabaseKey, toast]);

  useEffect(() => {
    cargarDetalle();
  }, [cargarDetalle]);

  const generarConGemini = useCallback(async (metodo: string) => {
    if (!detalle) return;
    
    setTechGenerating(true);
    try {
      const response = await fetch(
        `${supabaseUrl}/functions/v1/generar-tecnica`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            resumen: detalle.resumen,
            tema: detalle.tema,
            seccion: detalle.seccion,
            metodo: metodo,
          }),
        }
      );
      
      if (!response.ok) throw new Error('Error al generar la técnica');
      
      const data = await response.json();
      
      if (data?.tecnica) {
        setTechText(data.tecnica);
        toast({
          title: "Éxito",
          description: "Técnica generada con Gemini",
        });
      } else {
        throw new Error(data?.error || 'Error al generar');
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || 'No se pudo generar la técnica'
      });
    } finally {
      setTechGenerating(false);
    }
  }, [detalle, supabaseUrl, supabaseKey, toast]);

  const insertTemplate = (template: string) => {
    const templates: Record<string, string> = {
      'loci': `# Método de Loci (palacio de la memoria)
1) Elige un lugar que conozcas muy bien (casa/recorrido).
2) Divide el resumen en 8-12 ideas clave.
3) Asigna cada idea a un "locus" (habitación/objeto) y crea una imagen vívida y exagerada.
4) Recorre mentalmente el itinerario para recordar las ideas en orden.
5) Repaso espaciado: 10 min, 1 día, 3 días, 1 semana, 1 mes.`,
      'feynman': `# Técnica Feynman
1) Escribe el tema como si se lo explicaras a un niño de 12 años.
2) Detecta lagunas (donde uses jerga o no puedas simplificar).
3) Vuelve a la fuente, comprende y reescribe con palabras simples.
4) Crea un ejemplo numérico del resumen y una analogía cotidiana.
5) Repite hasta que puedas contarlo en 2 minutos sin mirar.`,
      'acronimo': `# Acrónimo / Acróstico
1) Toma las palabras clave del resumen.
2) Extrae iniciales y forma un acrónimo fácil de pronunciar (o una frase).
3) Refuerza con una imagen mental que conecte el acrónimo con el tema.
4) Practica evocación: intenta recordar cada palabra a partir del acrónimo.`,
      'flashcards': `# Flashcards + Repetición espaciada
1) Divide el resumen en preguntas y respuestas breves.
2) Crea tarjetas (anverso pregunta, reverso respuesta).
3) Usa un algoritmo de espaciamiento (2d, 4d, 7d, 15d…).
4) Marca como "difícil" lo que falle y reduce el intervalo.
5) Mezcla tarjetas y autoexplica la respuesta en voz alta.`,
    };
    
    const txt = templates[template] || '';
    setTechText((prev) => (prev ? (prev + '\n\n' + txt) : txt));
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '-';
    return (bytes / 1024).toFixed(1) + ' KB';
  };

  const formatDate = (fecha?: string) => {
    if (!fecha) return '-';
    const date = new Date(fecha);
    if (isNaN(date.getTime())) return fecha;
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!detalle) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive mb-4">Resumen no encontrado</p>
            <Button onClick={() => navigate('/resumenes')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a resúmenes
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => navigate('/resumenes')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a resúmenes
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-start gap-2">
              <FileText className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
              <span>{detalle.tema || '(Sin tema)'}</span>
            </CardTitle>
            {detalle.seccion && (
              <CardDescription className="text-base font-medium">
                {detalle.seccion}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground mb-2">Resumen:</h3>
              <p className="text-base leading-relaxed whitespace-pre-wrap">
                {detalle.resumen || 'Sin contenido'}
              </p>
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {detalle.archivo_nombre && (
                <div>
                  <h3 className="font-semibold text-muted-foreground mb-1">Archivo original:</h3>
                  <p className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    {detalle.archivo_nombre}
                    {detalle.archivo_tamano && ` (${formatFileSize(detalle.archivo_tamano)})`}
                  </p>
                </div>
              )}
              
              {detalle.archivo_tipo && (
                <div>
                  <h3 className="font-semibold text-muted-foreground mb-1">Tipo:</h3>
                  <p>{detalle.archivo_tipo}</p>
                </div>
              )}
              
              {detalle.fecha && (
                <div>
                  <h3 className="font-semibold text-muted-foreground mb-1">Fecha:</h3>
                  <p className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {formatDate(detalle.fecha)}
                  </p>
                </div>
              )}
            </div>

            <Separator />

            <Dialog open={techVisible} onOpenChange={setTechVisible}>
              <DialogTrigger asChild>
                <Button 
                  className="w-full" 
                  variant="default"
                  onClick={() => {
                    setTechVisible(true);
                    cargarTecnica();
                  }}
                >
                  <Brain className="w-4 h-4 mr-2" />
                  Técnica de memorización
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Memorizar este resumen</DialogTitle>
                  <DialogDescription>
                    Añade tu propia técnica o inserta una plantilla
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-2">Generar con IA (Gemini):</p>
                    <div className="flex flex-wrap gap-2">
                      <Button 
                        size="sm" 
                        variant="default" 
                        onClick={() => generarConGemini('feynman')}
                        disabled={techGenerating}
                      >
                        {techGenerating ? 'Generando...' : 'Generar Feynman'}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="default" 
                        onClick={() => generarConGemini('loci')}
                        disabled={techGenerating}
                      >
                        {techGenerating ? 'Generando...' : 'Generar Loci'}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="default" 
                        onClick={() => generarConGemini('mapa')}
                        disabled={techGenerating}
                      >
                        {techGenerating ? 'Generando...' : 'Generar Mapa Mental'}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="default" 
                        onClick={() => generarConGemini('preguntas')}
                        disabled={techGenerating}
                      >
                        {techGenerating ? 'Generando...' : 'Generar Q&A'}
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <p className="text-sm font-medium mb-2">O inserta una plantilla:</p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => insertTemplate('loci')}>
                        Loci
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => insertTemplate('feynman')}>
                        Feynman
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => insertTemplate('acronimo')}>
                        Acrónimo
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => insertTemplate('flashcards')}>
                        Flashcards
                      </Button>
                    </div>
                  </div>

                  {techLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                  ) : (
                    <>
                      <Textarea
                        value={techText}
                        onChange={(e) => setTechText(e.target.value)}
                        placeholder="Describe aquí cómo memorizarás este contenido (pasos, imágenes mentales, repaso espaciado, etc.)"
                        className="min-h-[300px]"
                      />
                      <p className="text-sm text-muted-foreground">
                        {techText.length} caracteres
                      </p>
                    </>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setTechVisible(false)}
                    >
                      Cerrar
                    </Button>
                    <Button
                      onClick={guardarTecnica}
                      disabled={techSaving || techLoading}
                    >
                      {techSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Guardar
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
