# Guía de Implementación

## Estructura del Repositorio

```text
rota-poc/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── database/
│   │   ├── health/
│   │   ├── holidays/
│   │   ├── rota/
│   │   └── scheduling/
│   └── test/
├── frontend/
└── docs/
```

## Flujo de Trabajo del Backend

### Instalación y Ejecución

```bash
cd backend
npm install
npm run migration:run
npm run start:dev
```

### Ejecutar Pruebas

```bash
cd backend
npm test
npm run build
```

### Inicio en Producción

La imagen Docker compila TypeScript, ejecuta `npm run migration:run:dist` e inicia `node dist/src/main.js`.

## Convenciones del Backend

- Los controladores son pequeños y delegan en servicios
- Los DTOs definen los contratos de solicitud
- Las entidades representan únicamente filas persistidas
- La adaptación de la forma de respuesta pertenece a `RotaResponseMapper`
- Las reglas de planificación residen en `src/scheduling/`
- El comportamiento de obtención y caché de festivos reside en `src/holidays/`

## Base de Datos y Migraciones

- La configuración de TypeORM reside en `src/database/typeorm.config.ts`
- La fuente de datos de la CLI reside en `src/database/data-source.ts`
- MySQL 8.4 es la base de datos por defecto en tiempo de ejecución
- `sql.js` se usa únicamente para el aislamiento de pruebas
- `src/database/migration-helpers.ts` contiene los helpers idempotentes de las migraciones (`addColumnIfMissing`, `addUniqueIfMissing`, `dropIndexIfExists`, ...): MySQL no admite `IF NOT EXISTS` en el DDL de columnas ni de índices

Comandos de migración:

```bash
cd backend
npm run migration:show
npm run migration:run
npm run migration:revert
```

## Notas de Pruebas

- Las pruebas unitarias cubren la lógica de festivos y los invariantes de planificación
- Las pruebas E2E cubren el contrato HTTP público
- La aplicación de prueba usa la misma forma de bootstrap de Nest que en producción, con `sql.js` en lugar de MySQL
- Las llamadas a la API externa de festivos están simuladas (mocked) en las pruebas

## Expectativas del Frontend

El frontend espera:

- `/api/v1/config` para el banner de ciudad
- `/api/v1/rota/:year` para precargar los calendarios AC y AP juntos
- `/api/v1/rota/generate` para devolver una respuesta completa de rota persistida
- `/api/v1/rota/:year/:rotaType/replace` para devolver la rota actualizada tras la sustitución
- `/api/v1/rota/:year/:rotaType/add` para devolver la rota actualizada tras añadir un médico a una guardia

## Restricciones Operativas Actuales

- Sin autenticación
- Una única ciudad configurada por instancia de backend
- Sin soporte de deshacer
- Sin Swagger/OpenAPI UI todavía
- Docker Compose es el flujo de trabajo principal local para el stack completo
