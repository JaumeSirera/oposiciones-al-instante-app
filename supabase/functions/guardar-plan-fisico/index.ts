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

    // Algunos endpoints devuelven id_plan, otros id; unificamos aquí
    const idPlan = result.id_plan || result.id || result.plan_id || null;

    if (!result.success || !idPlan) {
      return new Response(
        JSON.stringify({ success: false, error: result.error || "Error al guardar plan" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }
 
    // Si se solicitaron notificaciones, crear recordatorios
    if (notificaciones_email && idPlan && hora_notificacion) {
      console.log("Creando recordatorios para plan físico...");
      
      const recordatorios = [];
      
      // Mapeo de días de la semana a números (0 = Domingo, 1 = Lunes, etc.)
      const diasSemanaMap: Record<string, number> = {
        'domingo': 0,
        'lunes': 1,
        'martes': 2,
        'miércoles': 3,
        'miercoles': 3,
        'jueves': 4,
        'viernes': 5,
        'sábado': 6,
        'sabado': 6,
      };

      // Crear recordatorio para cada semana con sus sesiones
      if (plan.semanas && Array.isArray(plan.semanas)) {
        for (const semana of plan.semanas) {
          if (!semana.sesiones || !Array.isArray(semana.sesiones)) continue;
          
          const fechaInicioSemana = new Date(semana.fecha_inicio);
          
          for (const sesion of semana.sesiones) {
            const diaNombre = (sesion.dia || '').toLowerCase().trim();
            const diaNumero = diasSemanaMap[diaNombre];
            
            if (diaNumero === undefined) {
              console.warn(`Día no reconocido: ${sesion.dia}`);
              continue;
            }
            
            // Calcular la fecha exacta de la sesión
            const fechaSesion = new Date(fechaInicioSemana);
            const diaActualSemana = fechaSesion.getDay();
            let diasAjuste = diaNumero - diaActualSemana;
            
            // Si el día ya pasó en esta semana, no lo incluimos
            if (diasAjuste < 0) {
              continue;
            }
            
            fechaSesion.setDate(fechaSesion.getDate() + diasAjuste);
            
            // Construir descripción de la sesión
            const descripcionSesion = [];
            for (const bloque of sesion.bloques || []) {
              if (bloque.tipo && bloque.ejercicios && bloque.ejercicios.length > 0) {
                const ejerciciosNombres = bloque.ejercicios
                  .map((ej: any) => ej.nombre)
                  .filter(Boolean)
                  .join(', ');
                if (ejerciciosNombres) {
                  descripcionSesion.push(`${bloque.tipo}: ${ejerciciosNombres}`);
                }
              }
            }
            
            recordatorios.push({
              fecha: fechaSesion.toISOString().split("T")[0],
              temas: descripcionSesion.length > 0 
                ? descripcionSesion 
                : [`${semana.titulo} - ${sesion.dia}`],
            });
          }
        }
      }

      console.log(`Se crearon ${recordatorios.length} recordatorios`);

      if (recordatorios.length > 0) {
        const recordResponse = await fetch(`${supabaseUrl}/functions/v1/php-api-proxy`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${php_token}`,
            apikey: supabaseKey,
          },
          body: JSON.stringify({
            endpoint: "recordatorios_plan.php",
            method: "POST",
            action: "crear",
            id_plan: result.id_plan,
            id_usuario,
            recordatorios,
            tipo_plan: "fisico",
            hora: hora_notificacion,
          }),
        });

        const recordResult = await recordResponse.json();
        console.log("Resultado creación recordatorios:", recordResult);
      } else {
        console.warn("No se generaron recordatorios: el plan no tiene sesiones válidas");
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
