# Configuración de API Keys para Generación con IA

Este archivo explica cómo configurar las claves de API para que el sistema de generación de planes físicos funcione correctamente.

## Sistema de Fallback Inteligente

El sistema ahora utiliza un mecanismo de fallback automático:
1. **Primero intenta con Google Gemini** (gratuito pero con límites de cuota)
2. **Si Gemini falla** (error 429 - cuota excedida, o cualquier otro error), automáticamente cambia a **OpenAI GPT-4o-mini**

## Configuración de API Keys

Debes configurar las API keys en tu archivo `config.php` (en la raíz del servidor):

```php
<?php
// Google Gemini API Key (gratis pero con límites)
$GOOGLE_API_KEY = 'TU_CLAVE_DE_GOOGLE_GEMINI_AQUI';

// OpenAI API Key (de pago pero sin límites de cuota diarios)
$OPENAI_API_KEY = 'TU_CLAVE_DE_OPENAI_AQUI';
?>
```

## Obtener las API Keys

### Google Gemini (Recomendado para empezar - GRATIS)
1. Ve a: https://ai.google.dev/
2. Haz clic en "Get API Key"
3. Copia tu clave y pégala en `$GOOGLE_API_KEY`
4. **Límites gratuitos:** 15 peticiones por minuto, 1500 peticiones por día

### OpenAI (Fallback de pago)
1. Ve a: https://platform.openai.com/api-keys
2. Crea una nueva API key
3. Copia tu clave y pégala en `$OPENAI_API_KEY`
4. **Costo aproximado:** $0.15 por 1000 tokens de entrada, $0.60 por 1000 tokens de salida
5. Necesitas tener créditos en tu cuenta de OpenAI

## ¿Qué sucede si no configuro OpenAI?

Si solo configuras Google Gemini:
- ✅ El sistema funcionará mientras no excedas la cuota gratuita
- ❌ Cuando se exceda la cuota, las generaciones fallarán hasta que se reinicie el límite diario

Si configuras ambas claves:
- ✅ El sistema siempre funcionará
- ✅ Usa Gemini gratis mientras pueda
- ✅ Cambia automáticamente a OpenAI cuando Gemini falla

## Recomendación

**Para uso normal:** Solo configura Google Gemini (gratis)
**Para uso intensivo o producción:** Configura ambas claves para tener fallback automático

## Logs

El sistema registra en `error_log` qué servicio está utilizando:
- `[PF][Gemini]` - Usando Google Gemini
- `[PF][OpenAI]` - Usando OpenAI GPT
- `[PF] Cambiando a OpenAI...` - Fallback activado
