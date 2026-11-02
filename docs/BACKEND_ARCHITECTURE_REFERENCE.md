# Referencia de Arquitectura del Backend

Este documento resume el backend NestJS actual ahora que la implementación en Python ha sido retirada.

## Forma del Sistema

- `backend/src/main.ts` arranca una aplicación Nest basada en Fastify, aplica `/api/v1` como prefijo global, habilita CORS y registra la validación.
- `backend/src/app.module.ts` compone los módulos de config, database, holidays, rota y health.
- TypeORM es la capa de persistencia para MySQL 8.4 en producción y `sql.js` en pruebas.
- La planificación y la clasificación de festivos permanecen en servicios de dominio puros para mantener la capa HTTP delgada.

## Flujo de Solicitudes

1. Un controlador recibe la solicitud HTTP y valida los DTOs de entrada con el `ValidationPipe` global.
2. El servicio relevante carga festivos/config y ejecuta la lógica de planificación cuando es necesario.
3. TypeORM persiste `rotas`, `rota_doctors`, `rota_assignments` y `holidays` en caché.
4. `RotaResponseMapper` reconstruye la forma de respuesta de la API, incluyendo estadísticas y vistas de rota filtradas.
5. `RotaExportService` (`src/rota/rota-export.service.ts`) recibe las `RotaResponse` que devuelve `RotaService.getByYear` y genera con `exceljs` el libro de Excel (`buildWorkbook`); no accede a la base de datos ni recalcula estadísticas. El controlador devuelve el resultado como `StreamableFile`.

## Módulos

- `src/config/` expone la configuración de la aplicación como `CITY`.
- `src/database/` gestiona la configuración de TypeORM y las migraciones.
- `src/holidays/` obtiene los festivos españoles, los filtra por ciudad/región y los almacena en caché.
- `src/scheduling/` contiene el algoritmo de rota y el cálculo de estadísticas. `src/scheduling/strategies/` agrupa los métodos de asignación intercambiables (patrón Strategy): `balanced`, `wheels` y el registro `ASSIGNMENT_STRATEGIES`.
- `src/rota/` gestiona la generación, recuperación, sustitución, exportación a Excel, entidades y mapeo de respuestas.
- `src/health/` proporciona el endpoint de liveness `/health`.

## Superficie de API

- `GET /health`
- `GET /api/v1/config`
- `GET /api/v1/holidays/:year` — lista todos los festivos del año (API + manuales + los especiales de sanidad, con `special: true`)
- `POST /api/v1/holidays/:year` — marca una fecha como festivo manual
- `DELETE /api/v1/holidays/:year/:date` — desmarca un festivo manual (solo si `source = 'manual'` y no es especial)
- `POST /api/v1/rota/generate` — genera AC y AP a la vez (`{ year, ac_pool, ap_pool, strategy? }` → `[AC, AP]`)
- `GET /api/v1/rota/:year/:rotaType`
- `GET /api/v1/rota/:year`
- `GET /api/v1/rota/:year/export`
- `PATCH /api/v1/rota/:year/:rotaType/replace`
- `POST /api/v1/rota/:year/:rotaType/add`

## Modelo de Datos

- `rotas`: una rota persistida por `(año, tipo_rota)` más la instantánea del grupo original.
- `rota_doctors`: miembros del grupo normalizados para una rota.
- `rota_assignments`: una fila por asignación. En AP, un festivo precedido de otro festivo tiene dos filas por fecha (segundo refuerzo), cada una con distinto `doctor_id`. La columna `duration_hours` puede diferir entre rotas para la misma fecha (AC usa la duración del día calendario; AP usa 7h o 12h).
- `holidays`: filas de festivos en caché indexadas por `(año, ciudad, fecha)`. Contiene una columna `source ('api' | 'manual')` para distinguir los festivos obtenidos de la API externa de los creados por el usuario.

Restricciones importantes:

- `rotas(año, tipo_rota)` es único.
- `rota_doctors(rota_id, doctor_id)` es único.
- `rota_assignments(rota_id, fecha, doctor_id)` es único.
- Las filas hijas se eliminan en cascada al borrar una rota.

## Forma de las Pruebas

- `backend/test/unit/assignment.spec.ts` cubre las reglas de generación de rota e invariantes.
- `backend/test/unit/holidays.spec.ts` cubre el comportamiento de filtrado y caché de festivos.
- `backend/test/e2e/app.e2e-spec.ts` cubre el contrato HTTP contra una base de datos `sql.js` en memoria.

## Notas Operativas

- Producción y Docker usan migraciones MySQL mediante `npm run migration:run` o `npm run migration:run:dist`.
- La respuesta de la API preserva el formato de turno nocturno con `+1` sólo cuando el turno realmente cruza medianoche (`formatShiftEnd`). Los turnos AP (15:00–22:00 y 10:00–22:00) se devuelven sin sufijo `+1`.
- El backend no expone Swagger actualmente; el contrato estable está documentado en código y pruebas.
