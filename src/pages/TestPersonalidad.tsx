import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Download, CheckCircle, AlertTriangle } from 'lucide-react';

type Item = {
  id: number;
  texto: string;
  factor: 'EE' | 'AI' | 'TE' | 'DC' | 'IR' | 'OS' | 'IP' | 'INC';
  invertido: boolean;
};

type ApiPayload = {
  version: string;
  anchors: string[];
  items: Item[];
  pares_inconsistencia: [number, number][];
};

const API_PERSONALIDAD = 'https://oposiciones-test.com/api/generar_personalidad.php';

function invertir(x: number) { return 6 - x; }
function score0_100(media: number) { return ((media - 1) / 4) * 100; }
const rango = (s: number) => (s < 35 ? 'Bajo' : s < 65 ? 'Medio' : 'Alto');

export default function TestPersonalidad() {
  const { user } = useAuth();
  const { toast } = useToast();
  const user_id = user?.id || null;
  const username = user?.username || null;

  const [cargando, setCargando] = useState(true);
  const [data, setData] = useState<ApiPayload | null>(null);
  const [respuestas, setRespuestas] = useState<Record<number, number>>({});
  const [guardado, setGuardado] = useState(false);

  const storageKey = useMemo(() => `personalidad_${user_id || 'anon'}_v1`, [user_id]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(API_PERSONALIDAD);
        const json: ApiPayload = await res.json();
        if (!mounted) return;
        setData(json);

        const raw = localStorage.getItem(storageKey);
        if (raw) {
          try {
            const saved = JSON.parse(raw);
            if (saved?.version === json.version && typeof saved?.respuestas === 'object') {
              setRespuestas(saved.respuestas);
            }
          } catch {/* noop */}
        }
      } catch {
        toast({ title: 'Error', description: 'No se pudo cargar el test de personalidad', variant: 'destructive' });
      } finally {
        if (mounted) setCargando(false);
      }
    })();
    return () => { mounted = false; };
  }, [storageKey, toast]);

  useEffect(() => {
    if (data) {
      const payload = { version: data.version, respuestas };
      try {
        localStorage.setItem(storageKey, JSON.stringify(payload));
      } catch {/* noop */}
    }
  }, [respuestas, data, storageKey]);

  const totalContestados = useMemo(() => Object.keys(respuestas).length, [respuestas]);

  const onElegir = (itemId: number, val: number) => {
    setRespuestas(prev => ({ ...prev, [itemId]: val }));
  };

  const resultado = useMemo(() => {
    if (!data) return null;
    const factores = ['EE', 'AI', 'TE', 'DC', 'IR', 'OS'] as const;

    const sum: Record<string, { n: number; total: number }> = {};
    factores.forEach(f => sum[f] = { n: 0, total: 0 });

    const ipIds = [37, 38, 39];
    let ipTotal = 0, ipN = 0;

    for (const it of data.items) {
      const val = respuestas[it.id];
      if (!val) continue;
      let v = val;
      if (it.invertido && it.factor !== 'IP') v = invertir(v);

      if ((factores as readonly string[]).includes(it.factor)) {
        sum[it.factor].n++; sum[it.factor].total += v;
      }
      if (ipIds.includes(it.id)) { ipN++; ipTotal += val; }
    }

    const subescalas: Record<string, { media: number; score0_100: number }> = {};
    factores.forEach(f => {
      const media = sum[f].n ? sum[f].total / sum[f].n : 0;
      subescalas[f] = { media, score0_100: score0_100(media) };
    });

    const IP_media = ipN ? ipTotal / ipN : 0;
    const IP_score = score0_100(IP_media);

    const incDetalles = data.pares_inconsistencia.map(([a, b]) => {
      const ra = respuestas[a], rb = respuestas[b];
      const diff = (ra && rb) ? Math.abs(ra - rb) : null;
      const bandera = diff !== null && diff > 2;
      return { a, b, ra, rb, diff, bandera };
    });
    const INC_banderas = incDetalles.filter(d => d.bandera).length;

    return {
      subescalas,
      validez: { IP_media, IP_score, INC_banderas },
      incDetalles
    };
  }, [data, respuestas]);

  const finalizar = () => {
    if (!data) return;
    if (totalContestados < data.items.length) {
      const quedan = data.items.length - totalContestados;
      toast({ title: 'Incompleto', description: `Te quedan ${quedan} ítems por responder.`, variant: 'destructive' });
      return;
    }

    setGuardado(true);
    toast({ title: 'Completado', description: 'Test finalizado. Se muestra tu perfil.' });
  };

  const formatFecha = (d = new Date()) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const buildInformeHTML = () => {
    if (!resultado || !data) return '';
    const S = resultado.subescalas;
    const inconsistentes = (resultado.incDetalles || []).filter(d => d.bandera);
    return `
<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>Informe IPF-B</title>
<style>
  body{ font-family: -apple-system,Segoe UI,Roboto,Helvetica,Arial; color:#222; margin:40px; }
  h1{ color:#374fc7; font-size:20px; margin:0 0 8px; }
  h2{ color:#2b437d; font-size:16px; margin:16px 0 6px; }
  .muted{ color:#666; font-size:12px; }
  .block{ margin:6px 0; }
  .line{ margin:2px 0; }
  .small{ font-size:12px; }
</style>
</head>
<body>
  <h1>Test de Personalidad (IPF-B)</h1>
  <div class="muted">${formatFecha()}</div>
  <div class="muted">${username ? (`Usuario: ${username} · `) : ''}${user_id ? (`ID: ${user_id} · `) : ''}Versión: ${data.version}</div>

  <h2>Resultados (0–100)</h2>
  <div class="block">
    <div class="line">EE — Estabilidad emocional: <b>${S['EE'].score0_100.toFixed(1)}/100</b> <i>(${rango(S['EE'].score0_100)})</i></div>
    <div class="line">AI — Autocontrol/Impulsividad: <b>${S['AI'].score0_100.toFixed(1)}/100</b> <i>(${rango(S['AI'].score0_100)})</i></div>
    <div class="line">TE — Trabajo en equipo: <b>${S['TE'].score0_100.toFixed(1)}/100</b> <i>(${rango(S['TE'].score0_100)})</i></div>
    <div class="line">DC — Disciplina/Cumplimiento: <b>${S['DC'].score0_100.toFixed(1)}/100</b> <i>(${rango(S['DC'].score0_100)})</i></div>
    <div class="line">IR — Iniciativa/Resolución: <b>${S['IR'].score0_100.toFixed(1)}/100</b> <i>(${rango(S['IR'].score0_100)})</i></div>
    <div class="line">OS — Orientación al servicio: <b>${S['OS'].score0_100.toFixed(1)}/100</b> <i>(${rango(S['OS'].score0_100)})</i></div>
  </div>

  <h2>Validez</h2>
  <div class="block">
    <div class="line">Impresión positiva (IP) — media: <b>${resultado.validez.IP_media.toFixed(2)}</b> · score: <b>${resultado.validez.IP_score.toFixed(1)}/100</b></div>
    <div class="line">Inconsistencia (pares &gt; 2): <b>${resultado.validez.INC_banderas}</b></div>
    ${inconsistentes.length ? `
      <div class="small" style="margin-top:6px;">
        <div><i>Pares con diferencia &gt; 2:</i></div>
        ${inconsistentes.map(d => `<div class="line">- Ítems (${d.a}, ${d.b}): ${d.ra} vs ${d.rb} — dif: ${d.diff}</div>`).join('')}
      </div>
    ` : ''}
  </div>

  <h2>Interpretación rápida</h2>
  <div class="small">
    <div>EE — Calma y recuperación ante estrés.</div>
    <div>AI — Control de impulsos y previsión.</div>
    <div>TE — Cooperación y coordinación.</div>
    <div>DC — Adhesión a normas y cadena de mando.</div>
    <div>IR — Proactividad y priorización.</div>
    <div>OS — Trato, comunicación y empatía.</div>
    <div>IP — Si muy alto, posible deseabilidad social.</div>
    <div>INC — Si ≥4 pares inconsistentes, revisar respuestas.</div>
  </div>
</body>
</html>
    `.trim();
  };

  const descargarPDF = () => {
    if (!resultado || !data) {
      toast({ title: 'Aviso', description: 'Finaliza el test para generar el informe.' });
      return;
    }

    const html = buildInformeHTML();
    const w = window.open('', '_blank');
    if (!w) {
      toast({ title: 'Aviso', description: 'Permite las ventanas emergentes para descargar el PDF.' });
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 300);
  };

  if (cargando || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando test de personalidad...</p>
        </div>
      </div>
    );
  }

  const legend = ['1', '2', '3', '4', '5'];
  const progreso = (totalContestados / data.items.length) * 100;

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <Card>
        <CardHeader>
          <CardTitle>Test de Personalidad (IPF-B)</CardTitle>
          <CardDescription>
            Marca una opción por afirmación (1 = Totalmente en desacuerdo · 5 = Totalmente de acuerdo)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground mb-1">
              <span>Contestadas: {totalContestados} / {data.items.length}</span>
              <span>{progreso.toFixed(0)}%</span>
            </div>
            <Progress value={progreso} />
          </div>

          <div className="space-y-6">
            {data.items.map((it) => (
              <div key={it.id} className="space-y-3 pb-4 border-b last:border-0">
                <p className="font-medium">
                  {it.id}. {it.texto}
                </p>
                <RadioGroup
                  value={respuestas[it.id]?.toString() || ''}
                  onValueChange={(val) => onElegir(it.id, Number(val))}
                  className="flex gap-4"
                >
                  {legend.map((opt) => (
                    <div key={opt} className="flex items-center space-x-2">
                      <RadioGroupItem value={opt} id={`${it.id}-${opt}`} />
                      <Label htmlFor={`${it.id}-${opt}`} className="cursor-pointer">{opt}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            ))}
          </div>

          <Button onClick={finalizar} className="w-full" size="lg">
            <CheckCircle className="mr-2 h-5 w-5" />
            Finalizar y ver perfil
          </Button>

          {guardado && resultado && (
            <div className="space-y-6 mt-8">
              <Card className="bg-muted/50">
                <CardHeader>
                  <CardTitle className="text-lg">Tu perfil</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid gap-2">
                    <div className="flex justify-between">
                      <span>EE (Estabilidad emocional):</span>
                      <span className="font-semibold">{resultado.subescalas['EE'].score0_100.toFixed(1)} / 100</span>
                    </div>
                    <div className="flex justify-between">
                      <span>AI (Autocontrol/Impulsividad):</span>
                      <span className="font-semibold">{resultado.subescalas['AI'].score0_100.toFixed(1)} / 100</span>
                    </div>
                    <div className="flex justify-between">
                      <span>TE (Trabajo en equipo):</span>
                      <span className="font-semibold">{resultado.subescalas['TE'].score0_100.toFixed(1)} / 100</span>
                    </div>
                    <div className="flex justify-between">
                      <span>DC (Disciplina/Cumplimiento):</span>
                      <span className="font-semibold">{resultado.subescalas['DC'].score0_100.toFixed(1)} / 100</span>
                    </div>
                    <div className="flex justify-between">
                      <span>IR (Iniciativa/Resolución):</span>
                      <span className="font-semibold">{resultado.subescalas['IR'].score0_100.toFixed(1)} / 100</span>
                    </div>
                    <div className="flex justify-between">
                      <span>OS (Orientación al servicio):</span>
                      <span className="font-semibold">{resultado.subescalas['OS'].score0_100.toFixed(1)} / 100</span>
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div className="space-y-1 text-sm">
                    <p>Validez — IP media: {resultado.validez.IP_media.toFixed(2)} · IP score: {resultado.validez.IP_score.toFixed(1)} / 100</p>
                    <p className="flex items-center gap-2">
                      Validez — Inconsistencia (pares {'>'} 2): {resultado.validez.INC_banderas}
                      {resultado.validez.INC_banderas >= 4 && (
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      )}
                      <span className="text-muted-foreground">
                        {resultado.validez.INC_banderas >= 4 ? 'Alta (revisar respuestas)' :
                          resultado.validez.INC_banderas === 3 ? 'En el límite' : 'Correcta'}
                      </span>
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Cómo interpretar tu perfil</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <span className="font-medium">EE — Estabilidad emocional: </span>
                    <span className="font-bold">{rango(resultado.subescalas['EE'].score0_100)}</span>
                    <span className="text-muted-foreground"> — Mantener calma y recuperarse del estrés.</span>
                  </div>
                  <div>
                    <span className="font-medium">AI — Autocontrol/Impulsividad: </span>
                    <span className="font-bold">{rango(resultado.subescalas['AI'].score0_100)}</span>
                    <span className="text-muted-foreground"> — Control de impulsos y previsión.</span>
                  </div>
                  <div>
                    <span className="font-medium">TE — Trabajo en equipo: </span>
                    <span className="font-bold">{rango(resultado.subescalas['TE'].score0_100)}</span>
                    <span className="text-muted-foreground"> — Cooperación y coordinación.</span>
                  </div>
                  <div>
                    <span className="font-medium">DC — Disciplina/Cumplimiento: </span>
                    <span className="font-bold">{rango(resultado.subescalas['DC'].score0_100)}</span>
                    <span className="text-muted-foreground"> — Adhesión a normas y cadena de mando.</span>
                  </div>
                  <div>
                    <span className="font-medium">IR — Iniciativa/Resolución: </span>
                    <span className="font-bold">{rango(resultado.subescalas['IR'].score0_100)}</span>
                    <span className="text-muted-foreground"> — Proactividad y priorización.</span>
                  </div>
                  <div>
                    <span className="font-medium">OS — Orientación al servicio: </span>
                    <span className="font-bold">{rango(resultado.subescalas['OS'].score0_100)}</span>
                    <span className="text-muted-foreground"> — Trato, comunicación y empatía.</span>
                  </div>

                  <Separator className="my-4" />

                  <div className="space-y-2">
                    <Alert variant={resultado.validez.IP_media >= 4.3 ? 'destructive' : 'default'}>
                      <AlertDescription>
                        Validez — Impresión positiva (IP): {resultado.validez.IP_media.toFixed(2)} (media 1–5).{' '}
                        {resultado.validez.IP_media >= 4.3 ? 'Posible deseabilidad social.' : 'Respuesta natural.'}
                      </AlertDescription>
                    </Alert>

                    {Array.isArray(resultado.incDetalles) && resultado.incDetalles.some(d => d.bandera) && (
                      <Alert variant="destructive">
                        <AlertDescription>
                          <div className="font-medium mb-2">Pares con diferencia {'>'} 2:</div>
                          {resultado.incDetalles.filter(d => d.bandera).map((d, i) => (
                            <div key={i} className="text-xs">
                              Ítems ({d.a}, {d.b}): {d.ra} vs {d.rb} — dif: {d.diff}
                            </div>
                          ))}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>

                  <Button onClick={descargarPDF} variant="outline" className="w-full mt-4">
                    <Download className="mr-2 h-4 w-4" />
                    Descargar informe (PDF)
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
