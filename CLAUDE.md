# CLAUDE.md

## Idioma

A partir de ahora, toda la comunicación, documentación y comentarios de código nuevos deben escribirse en **español**.

## Descripción del Proyecto

Aplicación de Asignación de Guardias Médicas — una PoC para la planificación automatizada de guardias para médicos en hospitales españoles. Monorepo con un backend NestJS y un frontend Angular 19+.

## Estructura del Repositorio

- `backend/` — NestJS 11 / TypeScript / TypeORM / PostgreSQL
- `frontend/` — Angular 19+ / TypeScript / Angular CDK
- `docs/` — PRD, Diseño Técnico, Referencia de Backend, Guía de Implementación
- `docker-compose.yml` — Stack completo (db, backend, frontend)

## Comandos Rápidos

### Backend

```bash
cd backend
npm install
npm test
npm run build
npm run start:dev
npm run migration:run
```

### Frontend

```bash
cd frontend
npx ng test --watch=false       # ejecutar los 83 tests del frontend
npx ng build                    # build de producción
npx ng serve --port 4200 --proxy-config src/proxy.conf.json  # servidor de desarrollo
```

### Docker

```bash
docker compose up --build       # stack completo
docker compose up db            # solo PostgreSQL (para desarrollo local del backend)
```

## Arquitectura

- **API Backend** en `/api/v1`: config, CRUD de rota, festivos, health
- **Base de datos**: PostgreSQL con 4 tablas — rotas, rota_doctors, rota_assignments, holidays
- **Frontend**: Componentes standalone de Angular con estado basado en signals
- **Algoritmo**: Round-robin equilibrado independiente por tipo con `doctorsPerDay` calculado automáticamente, día de descanso, puntero round-robin deslizante y restricciones de equidad en `backend/src/scheduling/assignment.service.ts`

## Configuración Principal

Variables de entorno (backend):
- `DATABASE_URL` — Cadena de conexión a PostgreSQL
- `HOLIDAY_API_URL` — API de festivos española (por defecto: date.nager.at)
- `CITY` — Ciudad del hospital (por defecto: Madrid), determina la resolución de festivos y la visualización en la interfaz

## Convenciones de Código

### Backend (NestJS/TypeScript)
- Mantener la capa HTTP delgada: los controladores delegan en servicios
- La validación de DTOs reside en `src/**/dto/` y es aplicada por el `ValidationPipe` global
- La persistencia usa entidades TypeORM y migraciones en `src/database/`
- La lógica de planificación permanece en `src/scheduling/`, no en los controladores
- Las pruebas usan Jest; la cobertura e2e se ejecuta contra `sql.js` más `fetch` simulado

### Frontend (Angular/TypeScript)
- Componentes standalone de Angular 19+ — sin NgModules
- Gestión de estado basada en signals (no sujetos RxJS para el estado de componentes)
- Test runner vitest (no Jasmine/Karma) — NO usar `fail()`, usar `throw new Error()`
- `provideHttpClient()` + `provideHttpClientTesting()` para tests de servicios
- Los tests de componentes usan `TestBed.configureTestingModule()`
- SCSS para estilos, inline en los componentes

## Pruebas

- Backend: `npm test` — cobertura unitaria y e2e con Jest desde `backend/test/`
- Frontend: `vitest` — 83 tests (14 de servicio, 53 de componente, 15 de integración)
- Todos los criterios de aceptación del PRD tienen casos de prueba correspondientes (ver docs/IMPLEMENTATION.md sección 4.4)
- Las pruebas deben escribirse ANTES de la implementación (enfoque ATDD)

## Reglas de Negocio (Críticas)

Estas reglas son aplicadas por el algoritmo y verificadas por las pruebas:
1. AC y AP tienen **grupos de médicos separados** — un médico pertenece a un solo grupo, rotas generadas de forma independiente
2. Un médico de guardia el día D está **libre el D+1** dentro del mismo tipo de rota (día de descanso — restricción blanda para grupos pequeños)
3. Horas mínimas: **1.620h/año AC** (135h/mes × 12), **425h/año AP** por médico — **restricción dura** (genera error si no se cumple)
4. `doctors_per_day` se **calcula automáticamente**: `ceil(tamaño_grupo × horas_min / total_horas_anuales)`
5. Festivo > Sábado > Laborable para la clasificación de tipo de día
6. Las asignaciones deben tener máxima variación de grupo y ser equitativas (el puntero round-robin deslizante evita el bloqueo de grupo)

## Documentación

- `docs/PRD.md` — Requisitos de producto con todos los criterios de aceptación
- `docs/TECHNICAL_DESIGN.md` — Contratos de API, esquema de BD, diseño del algoritmo
- `docs/BACKEND_ARCHITECTURE_REFERENCE.md` — Módulos NestJS y estructura de persistencia
- `docs/IMPLEMENTATION.md` — Guía para desarrolladores, jerarquía de componentes, estrategia de pruebas
- `docs/ALGORITHM.md` — Diseño del algoritmo de asignación, restricciones y compromisos

## Exclusiones del Alcance PoC

Sin autenticación, sin multi-ciudad, sin deshacer, sin diseño móvil, sin CI/CD, sin despliegue en producción. Ver docs/PRD.md sección 4 para la lista completa.
