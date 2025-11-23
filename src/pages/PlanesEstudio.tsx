import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { planesService, Plan } from "@/services/planesService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Plus, Calendar, BookOpen, TrendingUp } from "lucide-react";
import { toast } from "sonner";

export default function PlanesEstudio() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarPlanes();
  }, [user]);

  const cargarPlanes = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const data = await planesService.listarPlanes(user.id);
      setPlanes(data);
    } catch (error) {
      toast.error("Error al cargar planes");
    } finally {
      setLoading(false);
    }
  };

  const getEstadoBadge = (estado: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      activo: "default",
      completado: "secondary",
      pausado: "outline",
    };
    return <Badge variant={variants[estado] || "outline"}>{estado}</Badge>;
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">Cargando planes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Planes de Estudio</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona y realiza seguimiento de tus planes de preparación
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => navigate("/crear-plan-estudio")}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Plan
          </Button>
          <Button variant="outline" onClick={() => navigate("/generar-plan-ia")}>
            <TrendingUp className="mr-2 h-4 w-4" />
            Generar con IA
          </Button>
        </div>
      </div>

      {planes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No tienes planes de estudio</h3>
            <p className="text-muted-foreground mb-4 text-center">
              Crea tu primer plan de estudio personalizado
            </p>
            <Button onClick={() => navigate("/crear-plan-estudio")}>
              <Plus className="mr-2 h-4 w-4" />
              Crear Plan
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {planes.map((plan) => (
            <Card
              key={plan.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(`/plan-estudio/${plan.id}`)}
            >
              <CardHeader>
                <div className="flex justify-between items-start mb-2">
                  <CardTitle className="text-lg">{plan.titulo}</CardTitle>
                  {getEstadoBadge(plan.estado)}
                </div>
                <CardDescription className="line-clamp-2">
                  {plan.descripcion || "Sin descripción"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {new Date(plan.fecha_inicio).toLocaleDateString()} -{" "}
                      {new Date(plan.fecha_fin).toLocaleDateString()}
                    </span>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Progreso</span>
                      <span className="font-medium">
                        {parseFloat(plan.progreso).toFixed(0)}%
                      </span>
                    </div>
                    <Progress value={parseFloat(plan.progreso)} />
                  </div>

                  {plan.tieneIA && (
                    <div className="flex items-center gap-2 text-sm">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      <span className="text-muted-foreground">
                        Plan IA: {plan.total_sesiones} sesiones completadas
                      </span>
                    </div>
                  )}

                  {plan.resumen_ia && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {plan.resumen_ia}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
