import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      id_usuario,
      plan,
      notificaciones_email,
      hora_notificacion,
      php_token,
    } = await req.json();

    if (!id_usuario || !plan) {
      return new Response(
        JSON.stringify({ success: false, error: "Faltan parámetros requeridos" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    if (!php_token) {
      return new Response(
        JSON.stringify({ success: false, error: "Falta el token de autenticación" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    // Guardar plan en la base de datos PHP usando el proxy
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const phpResponse = await fetch(`${supabaseUrl}/functions/v1/php-api-proxy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${php_token}`,
        apikey: supabaseKey,
      },
      body: JSON.stringify({
        endpoint: "planes_fisicos.php",
        method: "POST",
        action: "crear",
        id_usuario,
        titulo: plan.titulo,
        descripcion: plan.descripcion,
        tipo_prueba: plan.tipo_prueba,
        fecha_inicio: plan.fecha_inicio,
        fecha_fin: plan.fecha_fin,
        plan_json: JSON.stringify(plan),
        resumen: plan.resumen,
        notificaciones_email: notificaciones_email || false,
        hora_notificacion: hora_notificacion || null,
      }),
    });

    const result = await phpResponse.json();

    if (!result.success) {
      return new Response(
        JSON.stringify({ success: false, error: result.error || "Error al guardar plan" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Si se solicitaron notificaciones, crear recordatorios
    if (notificaciones_email && result.id_plan) {
      console.log("Creando recordatorios para plan físico...");
      
      const recordatorios = [];
      const fecha_inicio = new Date(plan.fecha_inicio);
      const fecha_fin = new Date(plan.fecha_fin);
      const dias_totales = Math.ceil(
        (fecha_fin.getTime() - fecha_inicio.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Crear recordatorio para cada semana con sus sesiones
      if (plan.semanas && Array.isArray(plan.semanas)) {
        for (const semana of plan.semanas) {
          for (const sesion of semana.sesiones || []) {
            const fecha = new Date(semana.fecha_inicio);
            recordatorios.push({
              fecha: fecha.toISOString().split("T")[0],
              dia: sesion.dia,
              contenido: `${semana.titulo} - ${sesion.dia}`,
            });
          }
        }
      }

      if (recordatorios.length > 0) {
        await fetch(`${supabaseUrl}/functions/v1/php-api-proxy`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${php_token}`,
            apikey: supabaseKey,
          },
          body: JSON.stringify({
            endpoint: "recordatorios_plan_fisico.php",
            method: "POST",
            action: "crear",
            id_plan: result.id_plan,
            id_usuario,
            recordatorios,
            hora_notificacion,
          }),
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        id_plan: result.id_plan,
        message: "Plan físico guardado exitosamente",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error en guardar-plan-fisico:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
