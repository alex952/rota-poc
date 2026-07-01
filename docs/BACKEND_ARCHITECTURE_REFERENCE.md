# Referencia de Arquitectura del Backend

Este documento resume el backend NestJS actual ahora que la implementación en Python ha sido retirada.

## Forma del Sistema

- `backend/src/main.ts` arranca una aplicación Nest basada en Fastify, aplica `/api/v1` como prefijo global, habilita CORS y registra la validación.
- `backend/src/app.module.ts` compone los módulos de config, database, holidays, rota y health.
- TypeORM es la capa de persistencia para PostgreSQL en producción y `sql.js` en pruebas.
- La planificación y la clasificación de festivos permanecen en servicios de dominio puros para mantener la capa HTTP delgada.

## Flujo de Solicitudes

1. Un controlador recibe la solicitud HTTP y valida los DTOs de entrada con el `ValidationPipe` global.
2. El servicio relevante carga festivos/config y ejecuta la lógica de planificación cuando es necesario.
3. TypeORM persiste `rotas`, `rota_doctors`, `rota_assignments` y `holidays` en caché.
4. `RotaResponseMapper` reconstruye la forma de respuesta de la API, incluyendo estadísticas y vistas de rota filtradas.

## Módulos

- `src/config/` expone la configuración de la aplicación como `CITY`.
- `src/database/` gestiona la configuración de TypeORM y las migraciones.
- `src/holidays/` obtiene los festivos españoles, los filtra por ciudad/región y los almacena en caché.
- `src/scheduling/` contiene el algoritmo de rota y el cálculo de estadísticas.
- `src/rota/` gestiona la generación, recuperación, sustitución, entidades y mapeo de respuestas.
- `src/health/` proporciona el endpoint de liveness `/health`.

## Superficie de API

- `GET /health`
- `GET /api/v1/config`
- `GET /api/v1/holidays/:year` — lista todos los festivos del año (API + manuales)
- `POST /api/v1/holidays/:year` — marca una fecha como festivo manual
- `DELETE /api/v1/holidays/:year/:date` — desmarca un festivo manual (solo si `source = 'manual'`)
- `POST /api/v1/rota/generate`
- `GET /api/v1/rota/:year/:rotaType`
- `GET /api/v1/rota/:year`
- `PATCH /api/v1/rota/:year/:rotaType/replace`

## Modelo de Datos

- `rotas`: una rota persistida por `(año, tipo_rota)` más la instantánea del grupo original.
- `rota_doctors`: miembros del grupo normalizados para una rota, incluyendo `hours_reduced_per_day`.
- `rota_assignments`: una fila por asignación y tipo de asignación (`primary` o `refuerzo`). En AP festivos hay dos filas `primary` por fecha (cobertura doble). En AC con horario reducido hay una fila `refuerzo` adicional vinculada al primary mediante `linked_primary_doctor_id`. La columna `duration_hours` puede diferir entre rotas para la misma fecha (AC usa la duración del día calendario; AP usa 7h o 12h).
- `holidays`: filas de festivos en caché indexadas por `(año, ciudad, fecha)`. Contiene una columna `source ('api' | 'manual')` para distinguir los festivos obtenidos de la API externa de los creados por el usuario.

Restricciones importantes:

- `rotas(año, tipo_rota)` es único.
- `rota_doctors(rota_id, doctor_id)` es único.
- `rota_assignments(rota_id, fecha, doctor_id, tipo_asignación)` es único.
- Las filas hijas se eliminan en cascada al borrar una rota.

## Forma de las Pruebas

- `backend/test/unit/assignment.spec.ts` cubre las reglas de generación de rota e invariantes.
- `backend/test/unit/holidays.spec.ts` cubre el comportamiento de filtrado y caché de festivos.
- `backend/test/e2e/app.e2e-spec.ts` cubre el contrato HTTP contra una base de datos `sql.js` en memoria.

## Notas Operativas

- Producción y Docker usan migraciones PostgreSQL mediante `npm run migration:run` o `npm run migration:run:dist`.
- La respuesta de la API preserva el formato de turno nocturno con `+1` sólo cuando el turno realmente cruza medianoche (`formatShiftEnd`). Los turnos AP (15:00–22:00 y 10:00–22:00) se devuelven sin sufijo `+1`.
- El backend no expone Swagger actualmente; el contrato estable está documentado en código y pruebas.
