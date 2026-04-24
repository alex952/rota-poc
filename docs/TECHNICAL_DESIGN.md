# Diseño Técnico

## Visión General

El sistema es un monorepo pequeño con:

- `backend/`: API NestJS, motor de planificación, resolución de festivos y persistencia en PostgreSQL
- `frontend/`: Interfaz Angular para grupos de médicos, generación de rota, visualización de calendario y flujos de sustitución
- `docker-compose.yml`: PostgreSQL local más contenedores de backend y frontend

## Arquitectura en Tiempo de Ejecución

```text
Frontend Angular  <->  API NestJS (/api/v1)  <->  PostgreSQL
                                |
                                +-> API de Festivos (date.nager.at)
```

## Diseño del Backend

### Elecciones de Framework

- NestJS 11 sobre Fastify para una capa HTTP ligera
- TypeORM para entidades y migraciones
- `class-validator` y `class-transformer` para validación de solicitudes
- Servicios TypeScript puros para la lógica de planificación y estadísticas

### Límites de Módulos

- `config`: sirve configuración en tiempo de ejecución al frontend
- `holidays`: resuelve y cachea datos de festivos por ciudad
- `rota`: generar, leer, listar y reemplazar asignaciones de rota
- `scheduling`: reglas de planificación puras y estadísticas
- `database`: opciones de TypeORM y migraciones
- `health`: endpoint de liveness

### Contrato de API

- `GET /health` devuelve `{ status: "ok" }`
- `GET /api/v1/config` devuelve la ciudad configurada
- `GET /api/v1/holidays/:year` devuelve los festivos cacheados u obtenidos para la ciudad configurada
- `POST /api/v1/rota/generate` genera y persiste un tipo de rota
- `GET /api/v1/rota/:year/:rotaType` devuelve una rota almacenada, opcionalmente filtrada por `doctor_id`
- `GET /api/v1/rota/:year` devuelve todas las rotas de un año
- `PATCH /api/v1/rota/:year/:rotaType/replace` intercambia una sola asignación

## Diseño de Persistencia

El backend almacena cuatro tablas:

- `rotas`
- `rota_doctors`
- `rota_assignments`
- `holidays`

Las migraciones residen en `backend/src/database/migrations/` y se ejecutan mediante la CLI de TypeORM.

## Diseño del Algoritmo de Planificación

El algoritmo de rota se mantiene deliberadamente fuera de los decoradores NestJS y las preocupaciones de transporte.

- La clasificación de días se deriva de los domingos más la caché de festivos
- `doctorsPerDay` se calcula automáticamente
- AC y AP se generan de forma independiente
- Los médicos de AC con horas reducidas generan asignaciones de `refuerzo` vinculadas
- Las estadísticas se recalculan a partir de las asignaciones persistidas para garantizar la consistencia de la respuesta

Consulta [ALGORITHM.md](./ALGORITHM.md) para el conjunto de reglas detallado.

## Integración con el Frontend

El frontend Angular llama al backend a través de `/api/v1/*` y espera:

- campos de respuesta estables en snake_case
- cargas de rota AC y AP separadas
- flujos de sustitución para asignaciones `primary` y `refuerzo`
- la ciudad configurada a través de `/api/v1/config`

## Desarrollo Local

### Backend

```bash
cd backend
npm install
npm run migration:run
npm run start:dev
```

### Frontend

```bash
cd frontend
npm install
npx ng serve --port 4200 --proxy-config src/proxy.conf.json
```

### Docker

```bash
docker compose up --build
```

## Estrategia de Pruebas

- `backend`: pruebas unitarias y e2e con Jest
- `frontend`: pruebas de componentes y servicios con Angular CLI
- La suite e2e del backend usa `sql.js` y respuestas simuladas de la API de festivos para validar el contrato HTTP público
