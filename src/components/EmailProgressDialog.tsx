import { useEffect, useRef, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Loader2, RefreshCw, CheckCircle, AlertCircle, Clock, RotateCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";

interface Recipient {
  id: number;
  email: string;
  nombre: string | null;
  status: "pending" | "sent" | "failed";
  attempts: number;
  last_error: string | null;
  sent_at: string | null;
  updated_at: string;
}
interface Stats { total: number; sent: number; failed: number; pending: number; }

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  historyId: number | null;
  subject: string;
  message: string;
}

export default function EmailProgressDialog({ open, onOpenChange, historyId, subject, message }: Props) {
  const { toast } = useToast();
  const [items, setItems] = useState<Recipient[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, sent: 0, failed: 0, pending: 0 });
  const [loading, setLoading] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const pollRef = useRef<number | null>(null);

  const fetchProgress = useCallback(async () => {
    if (!historyId) return;
    try {
      const res = await fetch(`https://oposiciones-test.com/api/obtener_email_recipients.php?email_history_id=${historyId}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Error");
      setItems(data.data || []);
      setStats(data.stats || { total: 0, sent: 0, failed: 0, pending: 0 });
    } catch (e: any) {
      console.error(e);
    }
  }, [historyId]);

  useEffect(() => {
    if (!open || !historyId) return;
    setLoading(true);
    fetchProgress().finally(() => setLoading(false));
  }, [open, historyId, fetchProgress]);

  // Polling while pending > 0
  useEffect(() => {
    if (!open || !historyId) return;
    if (stats.pending > 0) {
      pollRef.current = window.setInterval(fetchProgress, 3000);
      return () => { if (pollRef.current) window.clearInterval(pollRef.current); };
    } else if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [stats.pending, open, historyId, fetchProgress]);

  const handleRetryFailed = async () => {
    if (!historyId) return;
    const failed = items.filter(i => i.status === "failed");
    if (failed.length === 0) {
      toast({ title: "Nada que reintentar", description: "No hay destinatarios fallidos." });
      return;
    }
    setRetrying(true);
    try {
      // Mark as pending on server so UI reflects new attempt immediately
      await Promise.all(failed.map(f =>
        fetch("https://oposiciones-test.com/api/actualizar_email_recipient.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: f.id, status: "pending" }),
        })
      ));

      const { data, error } = await supabase.functions.invoke("enviar-email-actualizacion", {
        body: {
          subject,
          message,
          historyId,
          recipients: failed.map(f => ({ email: f.email, nombre: f.nombre, recipientId: f.id })),
        },
      });
      if (error) throw error;

      toast({
        title: "Reintento iniciado",
        description: `Reenviando a ${failed.length} destinatario${failed.length !== 1 ? "s" : ""} fallido${failed.length !== 1 ? "s" : ""}.`,
      });
      await fetchProgress();
    } catch (e: any) {
      toast({ title: "Error al reintentar", description: e.message, variant: "destructive" });
    } finally {
      setRetrying(false);
    }
  };

  const pct = stats.total > 0 ? Math.round(((stats.sent + stats.failed) / stats.total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" /> Progreso del envío #{historyId}
          </DialogTitle>
          <DialogDescription className="truncate">{subject}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="rounded border p-2">
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="text-lg font-semibold">{stats.total}</div>
            </div>
            <div className="rounded border p-2 bg-green-50 dark:bg-green-950/30">
              <div className="text-xs text-muted-foreground">Enviados</div>
              <div className="text-lg font-semibold text-green-600">{stats.sent}</div>
            </div>
            <div className="rounded border p-2 bg-red-50 dark:bg-red-950/30">
              <div className="text-xs text-muted-foreground">Fallidos</div>
              <div className="text-lg font-semibold text-red-600">{stats.failed}</div>
            </div>
            <div className="rounded border p-2 bg-yellow-50 dark:bg-yellow-950/30">
              <div className="text-xs text-muted-foreground">Pendientes</div>
              <div className="text-lg font-semibold text-yellow-600">{stats.pending}</div>
            </div>
          </div>

          <div>
            <Progress value={pct} />
            <p className="text-xs text-muted-foreground mt-1">{pct}% procesado {stats.pending > 0 && "· actualizando cada 3s…"}</p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchProgress} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Actualizar
            </Button>
            <Button size="sm" onClick={handleRetryFailed} disabled={retrying || stats.failed === 0}>
              {retrying ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RotateCw className="w-4 h-4 mr-1" />}
              Reintentar fallidos ({stats.failed})
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 mt-2 border rounded">
          {loading && items.length === 0 ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Sin datos de destinatarios. Este envío puede ser anterior al sistema de seguimiento.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="text-left">
                  <th className="p-2">Email</th>
                  <th className="p-2 w-24">Estado</th>
                  <th className="p-2 w-16">Int.</th>
                  <th className="p-2">Error</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-t">
                    <td className="p-2">
                      <div className="font-medium truncate max-w-[220px]">{it.nombre || "—"}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[220px]">{it.email}</div>
                    </td>
                    <td className="p-2">
                      {it.status === "sent" && <Badge className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" />Enviado</Badge>}
                      {it.status === "failed" && <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Fallido</Badge>}
                      {it.status === "pending" && <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pendiente</Badge>}
                    </td>
                    <td className="p-2">{it.attempts}</td>
                    <td className="p-2 text-xs text-destructive truncate max-w-[200px]">{it.last_error || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
