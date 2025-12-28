import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Send, Mail, Smartphone, Loader2, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";

const EnviarEmailActualizacion = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  
  const [subject, setSubject] = useState("¡Nueva actualización disponible en Play Store!");
  const [message, setMessage] = useState(
    `¡Hola!\n\nHay una nueva versión de Oposiciones-Test disponible en Google Play Store.\n\nNovedades de esta versión:\n- Mejoras de rendimiento\n- Nuevas funcionalidades\n- Corrección de errores\n\nActualiza ahora para disfrutar de la mejor experiencia.\n\n¡Gracias por usar Oposiciones-Test!`
  );

  const handleSendEmail = async () => {
    if (!subject.trim() || !message.trim()) {
      toast({
        title: "Error",
        description: "Por favor, completa el asunto y el mensaje",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("enviar-email-actualizacion", {
        body: { subject, message },
      });

      if (error) throw error;

      setIsSent(true);
      toast({
        title: "¡Emails enviados!",
        description: `Se han enviado ${data.emailsSent || 0} emails correctamente`,
      });
    } catch (error: any) {
      console.error("Error sending emails:", error);
      toast({
        title: "Error al enviar",
        description: error.message || "No se pudieron enviar los emails",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="inline-flex items-center text-primary hover:underline mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('common.back')}
        </Link>

        <Card className="border-2 border-primary/20">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center mb-4">
              <Smartphone className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl">Enviar Email de Actualización</CardTitle>
            <CardDescription>
              Envía un email a todos los usuarios para que actualicen la app en Play Store
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isSent ? (
              <div className="text-center py-8">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  ¡Emails enviados correctamente!
                </h3>
                <p className="text-muted-foreground mb-6">
                  Los usuarios recibirán la notificación de actualización.
                </p>
                <Button onClick={() => setIsSent(false)} variant="outline">
                  Enviar otro email
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="subject">Asunto del email</Label>
                  <Input
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Asunto del email..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Mensaje</Label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Escribe el mensaje..."
                    className="min-h-[200px]"
                  />
                </div>

                <div className="bg-muted/50 rounded-lg p-4 border">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="w-4 h-4" />
                    <span>El email se enviará a todos los usuarios registrados con email válido</span>
                  </div>
                </div>

                <Button 
                  onClick={handleSendEmail} 
                  disabled={isLoading}
                  className="w-full"
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enviando emails...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Enviar email a todos los usuarios
                    </>
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EnviarEmailActualizacion;
