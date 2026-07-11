# Ver todos los procesos de la comunidad al configurar tests

## Objetivo
En las pantallas de configuración de **Test personalizado**, **Simulacro cronometrado**, **Test psicotécnico** y **Simulacro psicotécnico**, el desplegable "Proceso / Manual" debe listar **todos los procesos activos de la comunidad** (igual que ve el rol SA), no solo los públicos + propios.

El usuario solo podrá **usarlos para generar sus tests** (lectura). No se añade ninguna acción de editar/borrar procesos ajenos en estas pantallas, así que la restricción de "solo lectura" queda garantizada por la ausencia de UI de edición (y por las validaciones que ya existen en el backend PHP para modificar procesos).

## Cambios

### 1. `src/services/testService.ts`
Añadir un nuevo método `getAllProcesosComunidad()` que llame a `procesos.php` **sin** `id_usuario`, ya que en esa modalidad el PHP devuelve todos los procesos sin filtro por rol.

```ts
async getAllProcesosComunidad(): Promise<Proceso[]> {
  const data = await this.callAPI('procesos.php');
  // normalización igual que getProcesos
}
```

No se modifica `getProcesos` para no afectar al resto de pantallas (CrearResumen, CrearPlanEstudio, GenerarPlanIA) que deben seguir con la visibilidad actual por rol.

### 2. Sustituir la llamada en las 4 pantallas de tests
Reemplazar `testService.getProcesos(user?.id)` por `testService.getAllProcesosComunidad()` en:

- `src/components/ConfigTest.tsx` (línea ~162) — usado por Test personalizado y Simulacro cronometrado
- `src/pages/CrearTest.tsx` (línea ~74)
- `src/pages/CrearPsicotecnicos.tsx` (línea ~85) — usado por Test psicotécnico y Simulacro psicotécnico

(Confirmar que ConfigTest cubre simulacro cronometrado; si el simulacro psicotécnico usa una página distinta, aplicar el mismo cambio ahí.)

### 3. Sin cambios en el backend PHP
`procesos.php` sin `id_usuario` ya devuelve todos los procesos activos. No hace falta tocar SQL, RLS, ni el proxy.

### 4. Sin cambios en permisos
No hay pantalla de edición de procesos accesible desde estos formularios. El PHP de modificación de procesos ya valida ownership/rol, así que el "solo lectura" está cubierto sin código nuevo.

## Alcance excluido
- No se cambia visibilidad en Resúmenes, Planes de estudio, ni Planes IA.
- No se cambia la lógica de roles ni el filtrado en `procesos_usuario.php`.
- No se añade badge "creado por otro usuario" (se puede añadir en una iteración posterior si lo quieres).
