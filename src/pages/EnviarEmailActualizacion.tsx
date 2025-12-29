import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Send, Mail, Smartphone, Loader2, CheckCircle, Users, RefreshCw, Search, History, Clock, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { authService } from "@/services/authService";

interface Usuario {
  id: number;
  email: string;
  nombre: string;
}

interface HistorialEmail {
  id: number;
  subject: string;
  message: string;
  recipients_count: number;
  sent_by: string | null;
  sent_at: string;
  status: string;
  errors: string | null;
}

const EnviarEmailActualizacion = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isLoadingHistorial, setIsLoadingHistorial] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [historial, setHistorial] = useState<HistorialEmail[]>([]);
  
  const [subject, setSubject] = useState("¡Nueva actualización disponible en Play Store!");
  const [message, setMessage] = useState(
    `¡Hola!\n\nHay una nueva versión de Oposiciones-Test disponible en Google Play Store.\n\nNovedades de esta versión:\n- Mejoras de rendimiento\n- Nuevas funcionalidades\n- Corrección de errores\n\nActualiza ahora para disfrutar de la mejor experiencia.\n\n¡Gracias por usar Oposiciones-Test!`
  );

  const fetchUsuarios = async () => {
    setIsLoadingUsers(true);
    try {
      const token = authService.getToken();
      const response = await fetch("https://oposiciones-tests.es/api/obtener_usuarios_email.php", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Error al obtener usuarios");
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      setUsuarios(data);
      // Select all users by default
      setSelectedUsers(new Set(data.map((u: Usuario) => u.id)));
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudieron cargar los usuarios",
        variant: "destructive",
      });
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const fetchHistorial = async () => {
    setIsLoadingHistorial(true);
    try {
      const response = await fetch("https://oposiciones-tests.es/api/obtener_historial_email.php?limit=50");
      
      if (!response.ok) {
        throw new Error("Error al obtener historial");
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || "Error desconocido");
      }

      setHistorial(data.data || []);
    } catch (error: any) {
      console.error("Error fetching historial:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo cargar el historial",
        variant: "destructive",
      });
    } finally {
      setIsLoadingHistorial(false);
    }
  };

  const guardarHistorial = async (emailData: {
    subject: string;
    message: string;
    recipients_count: number;
    sent_by: string | null;
    status: string;
    errors: string | null;
  }) => {
    try {
      const response = await fetch("https://oposiciones-tests.es/api/guardar_historial_email.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(emailData),
      });

      const data = await response.json();
      
      if (!data.success) {
        console.error("Error guardando historial:", data.error);
      } else {
        // Refresh historial
        fetchHistorial();
      }
    } catch (error) {
      console.error("Error guardando historial:", error);
    }
  };

  useEffect(() => {
    fetchUsuarios();
    fetchHistorial();
  }, []);

  const filteredUsers = usuarios.filter(
    (u) =>
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.nombre && u.nombre.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const toggleUser = (userId: number) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const selectAll = () => {
    setSelectedUsers(new Set(filteredUsers.map((u) => u.id)));
  };

  const selectNone = () => {
    setSelectedUsers(new Set());
  };

  const handleSendEmail = async () => {
    if (!subject.trim() || !message.trim()) {
      toast({
        title: "Error",
        description: "Por favor, completa el asunto y el mensaje",
        variant: "destructive",
      });
      return;
    }

    if (selectedUsers.size === 0) {
      toast({
        title: "Error",
        description: "Selecciona al menos un usuario para enviar el email",
        variant: "destructive",
      });
      return;
    }

    const selectedEmails = usuarios
      .filter((u) => selectedUsers.has(u.id))
      .map((u) => ({ email: u.email, nombre: u.nombre }));

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("enviar-email-actualizacion", {
        body: { 
          subject, 
          message,
          recipients: selectedEmails 
        },
      });

      if (error) throw error;

      // Guardar en historial
      await guardarHistorial({
        subject,
        message,
        recipients_count: data.emailsSent || selectedEmails.length,
        sent_by: authService.getCurrentUser()?.username || null,
        status: "sent",
        errors: data.errors ? JSON.stringify(data.errors) : null,
      });

      setIsSent(true);
      toast({
        title: "¡Emails enviados!",
        description: `Se han enviado ${data.emailsSent || 0} emails correctamente`,
      });
    } catch (error: any) {
      console.error("Error sending emails:", error);
      
      // Guardar error en historial
      await guardarHistorial({
        subject,
        message,
        recipients_count: selectedEmails.length,
        sent_by: authService.getCurrentUser()?.username || null,
        status: "error",
        errors: error.message || "Error desconocido",
      });

      toast({
        title: "Error al enviar",
        description: error.message || "No se pudieron enviar los emails",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <Link to="/dashboard" className="inline-flex items-center text-primary hover:underline mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('common.back')}
        </Link>

        <Tabs defaultValue="enviar" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="enviar" className="flex items-center gap-2">
              <Send className="w-4 h-4" />
              Enviar Email
            </TabsTrigger>
            <TabsTrigger value="historial" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Historial ({historial.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="enviar">
            <Card className="border-2 border-primary/20">
              <CardHeader className="text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center mb-4">
                  <Smartphone className="w-8 h-8 text-white" />
                </div>
                <CardTitle className="text-2xl">Enviar Email de Actualización</CardTitle>
                <CardDescription>
                  Selecciona los usuarios y envía un email para que actualicen la app
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
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Left column - Email content */}
                    <div className="space-y-4">
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
                          className="min-h-[250px]"
                        />
                      </div>
                    </div>

                    {/* Right column - User selection */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          Destinatarios ({selectedUsers.size} de {usuarios.length})
                        </Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={fetchUsuarios}
                          disabled={isLoadingUsers}
                        >
                          <RefreshCw className={`w-4 h-4 ${isLoadingUsers ? 'animate-spin' : ''}`} />
                        </Button>
                      </div>

                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar por email o nombre..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-9"
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={selectAll}>
                          Seleccionar todos
                        </Button>
                        <Button variant="outline" size="sm" onClick={selectNone}>
                          Ninguno
                        </Button>
                      </div>

                      {isLoadingUsers ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-primary" />
                          <span className="ml-2 text-muted-foreground">Cargando usuarios...</span>
                        </div>
                      ) : (
                        <ScrollArea className="h-[280px] rounded-md border p-2">
                          {filteredUsers.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                              No se encontraron usuarios
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {filteredUsers.map((usuario) => (
                                <div
                                  key={usuario.id}
                                  className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                                  onClick={() => toggleUser(usuario.id)}
                                >
                                  <Checkbox
                                    checked={selectedUsers.has(usuario.id)}
                                    onCheckedChange={() => toggleUser(usuario.id)}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">
                                      {usuario.nombre || "Sin nombre"}
                                    </p>
                                    <p className="text-xs text-muted-foreground truncate">
                                      {usuario.email}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </ScrollArea>
                      )}
                    </div>

                    {/* Send button - full width */}
                    <div className="md:col-span-2">
                      <div className="bg-muted/50 rounded-lg p-4 border mb-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="w-4 h-4" />
                          <span>
                            {selectedUsers.size === 0
                              ? "Selecciona al menos un usuario"
                              : `Se enviará el email a ${selectedUsers.size} usuario${selectedUsers.size !== 1 ? 's' : ''}`}
                          </span>
                        </div>
                      </div>

                      <Button 
                        onClick={handleSendEmail} 
                        disabled={isLoading || selectedUsers.size === 0}
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
                            Enviar email a {selectedUsers.size} usuario{selectedUsers.size !== 1 ? 's' : ''}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="historial">
            <Card className="border-2 border-primary/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <History className="w-5 h-5" />
                      Historial de Emails Enviados
                    </CardTitle>
                    <CardDescription>
                      Registro de todos los emails de actualización enviados
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchHistorial}
                    disabled={isLoadingHistorial}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingHistorial ? 'animate-spin' : ''}`} />
                    Actualizar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingHistorial ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <span className="ml-2 text-muted-foreground">Cargando historial...</span>
                  </div>
                ) : historial.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No hay emails enviados aún</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-4">
                      {historial.map((item) => (
                        <div
                          key={item.id}
                          className="border rounded-lg p-4 hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-semibold text-foreground truncate">
                                  {item.subject}
                                </h4>
                                <Badge
                                  variant={item.status === "sent" ? "default" : "destructive"}
                                  className="shrink-0"
                                >
                                  {item.status === "sent" ? (
                                    <>
                                      <CheckCircle className="w-3 h-3 mr-1" />
                                      Enviado
                                    </>
                                  ) : (
                                    <>
                                      <AlertCircle className="w-3 h-3 mr-1" />
                                      Error
                                    </>
                                  )}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                                {item.message}
                              </p>
                              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Users className="w-3 h-3" />
                                  {item.recipients_count} destinatario{item.recipients_count !== 1 ? 's' : ''}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatDate(item.sent_at)}
                                </span>
                                {item.sent_by && (
                                  <span className="flex items-center gap-1">
                                    <Mail className="w-3 h-3" />
                                    {item.sent_by}
                                  </span>
                                )}
                              </div>
                              {item.errors && (
                                <div className="mt-2 p-2 bg-destructive/10 rounded text-xs text-destructive">
                                  Error: {item.errors}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default EnviarEmailActualizacion;
