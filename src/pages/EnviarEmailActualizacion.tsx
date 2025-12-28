import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Send, Mail, Smartphone, Loader2, CheckCircle, Users, RefreshCw, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { authService } from "@/services/authService";

interface Usuario {
  id: number;
  email: string;
  nombre: string;
}

const EnviarEmailActualizacion = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  
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

  useEffect(() => {
    fetchUsuarios();
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
      <div className="max-w-4xl mx-auto">
        <Link to="/dashboard" className="inline-flex items-center text-primary hover:underline mb-6">
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
      </div>
    </div>
  );
};

export default EnviarEmailActualizacion;
