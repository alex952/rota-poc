# CLAUDE.md

## Idioma

A partir de ahora, toda la comunicación, documentación y comentarios de código nuevos deben escribirse en **español**.

## Descripción del Proyecto

Aplicación de Asignación de Guardias Médicas — una PoC para la planificación automatizada de guardias para médicos en hospitales españoles. Monorepo con un backend NestJS y un frontend Angular 19+.

## Estructura del Repositorio

- `backend/` — NestJS 11 / TypeScript / TypeORM / MySQL
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
npx ng test --watch=false       # ejecutar los 137 tests del frontend
npx ng build                    # build de producción
npx ng serve --port 4200 --proxy-config src/proxy.conf.json  # servidor de desarrollo
```

### Docker

```bash
docker compose up --build       # stack completo
docker compose up db            # solo MySQL (para desarrollo local del backend)
```

## Arquitectura

- **API Backend** en `/api/v1`: config, CRUD de rota, festivos, health. `POST /rota/generate` genera **AC y AP a la vez** (`{ year, ac_pool, ap_pool, strategy? }` → `[AC, AP]`)
- **Base de datos**: MySQL 8.4 con 4 tablas — rotas, rota_doctors, rota_assignments, holidays
- **Frontend**: Componentes standalone de Angular con estado basado en signals
- **Algoritmo**: Dos estrategias de asignación seleccionables con `strategy` en `POST /rota/generate`, en `backend/src/scheduling/strategies/`: `balanced` (predeterminada) y `wheels` (ruedas: laborables, sábados, domingos y festivos, con punteros iniciales escalonados 0/⌊N/4⌋/⌊2N/4⌋/⌊3N/4⌋, «saltar y conservar turno», deuda contada y, con exactamente 5 médicos, un salto sin deuda cada lunes de semana completa para romper la resonancia semanal). Común a ambas, en `backend/src/scheduling/assignment.service.ts`: `generateRotas` genera AC, reserva los refuerzos AC por déficit mensual (`planAcRefuerzos`) y después AP; `doctorsPerDay` fijo en 1, día de descanso, puntero round-robin deslizante y equidad por papel (guardia/refuerzo) y tipo de día. La guardia AP y los refuerzos usan `apShiftDetails` (7h L-S, 12h festivo, en `scheduling/shifts.ts`) y `refuerzosForDay` da 2 refuerzos en festivos especiales y en el segundo de dos festivos consecutivos. Los festivos especiales de sanidad están en `backend/src/common/sanidad-holidays.ts`.

## Configuración Principal

Variables de entorno (backend):
- `DATABASE_URL` — Cadena de conexión a MySQL
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

- Backend: `npm test` — cobertura unitaria y e2e con Jest desde `backend/test/` (99 tests actualmente)
- Frontend: `vitest` — 137 tests cubriendo servicios, componentes y la integración del app shell
- Todos los criterios de aceptación del PRD tienen casos de prueba correspondientes (ver docs/IMPLEMENTATION.md sección 4.4)
- Las pruebas deben escribirse ANTES de la implementación (enfoque ATDD)

## Verificación Visual (obligatoria antes del commit)

Las builds y los tests no ven la aplicación. Un cambio puede compilar, pasar los
236 tests y aun así llegar roto al usuario: texto desbordado, una cadena que
ningún test comprueba, un mensaje que la librería genera en inglés. Por eso, todo
cambio que toque algo visible para el usuario —frontend, o mensajes del backend,
que llegan literalmente a la interfaz vía `extractErrorMessage` en
`frontend/src/app/app.ts`— se revisa **en el navegador, con el stack levantado**,
antes de commitear.

Esta etapa va **después del simplify pass y antes del commit**. Si el cambio es
puramente interno (algoritmo, persistencia, refactor sin efecto visible), se
omite y se dice explícitamente en el informe por qué no aplica.

### 1. Levantar el stack

```bash
docker compose up --build -d
```

Frontend en `http://localhost:4200`, backend en `http://localhost:8000`, MySQL
en `3306`. La ciudad es `Alicante` y el grupo de médicos se sirve del cliente
desde `frontend/src/assets/doctors.json`, no de la base de datos.

Espera a que respondan antes de abrir el navegador (`db` tiene healthcheck, el
backend no):

```bash
for i in $(seq 1 30); do curl -sf http://localhost:8000/api/v1/config >/dev/null && curl -sf http://localhost:4200 >/dev/null && { echo listo; break; }; sleep 1; done
```

Ojo: el endpoint de health **no** cuelga de `/api/v1`. Para comprobar que el
backend vive, usa `/api/v1/config`, que devuelve `{"city":"Alicante"}`.

### 2. Revisar en el navegador

Abre `http://localhost:4200` con las herramientas de navegador y recorre las
pantallas, haciendo captura de cada una:

1. **Carga inicial sin cuadrante** — cabecera, banner de aviso, grupo de médicos, calendario vacío
2. **Generar** los cuadrantes (un único botón para AC y AP) — notificación de éxito, calendario poblado con bloques AC / AP / REFUERZO, prefijo `R:` en los refuerzos y `(AC)` en los que cubre un AC; festivos especiales con estrella
3. **Panel de estadísticas** — etiquetas, totales, insignias Lab/Sáb/Fest
4. **Diálogos** — confirmación de regeneración, añadir médico al grupo, añadir o sustituir médico (al soltar un médico sobre un día)
5. **Menú contextual** (clic derecho en un día) — marcar/desmarcar festivo y su notificación
6. **Vista de día** (clic en una celda) — cabecera con la fecha larga en español

Qué se está buscando, más allá de que "se vea bien":

- Texto cortado, desbordado o que rompe su contenedor. El español es un 15-25 %
  más largo que el inglés: los botones y las etiquetas de una sola línea son lo
  primero que revienta.
- Tildes y `ñ` mal renderizadas, incluso en mayúsculas (`DESVIACIÓN`, `MÉDICOS`).
- Texto que no cuadra con el resto: tuteo donde el resto usa usted, un término
  fuera del glosario, una cadena que cita el nombre de un botón que ya cambió.
- Cadenas que ningún test cubre. Son las que sobreviven a un refactor sin que
  nadie se entere.

### 3. Provocar los errores, no sólo el camino feliz

Los mensajes de error son la mitad del texto que ve el usuario y casi nunca se
ven al pulsar por la interfaz. Fuérzalos contra la API:

```bash
curl -s -X POST http://localhost:8000/api/v1/holidays/2026 -H 'Content-Type: application/json' -d '{"date":"08-09-2026"}'
curl -s -X POST http://localhost:8000/api/v1/rota/generate -H 'Content-Type: application/json' -d '{"year":"x","ac_pool":"no","ap_pool":"no"}'
curl -s -X DELETE http://localhost:8000/api/v1/holidays/2026/2026-12-24
curl -s 'http://localhost:8000/api/v1/rota/2035?rota_type=AC'
```

Revisa la respuesta entera, no sólo el primer mensaje. **Los decoradores de
class-validator sin opción `message` generan su texto por defecto en inglés**
(`"name must be a string"`, `"pool must be an array"`): no son literales del
código, así que no aparecen en ninguna búsqueda por el repositorio y sólo se ven
así.

### 4. Trampas conocidas

- **Tras tocar el frontend**, la imagen hay que reconstruirla; el contenedor no
  recarga en caliente: `docker compose up -d --build frontend`.
- **El navegador cachea `assets/doctors.json`.** Si cambias los datos semilla y
  la interfaz sigue mostrando los viejos, es caché, no un fallo del build.
  Confírmalo con `curl -s http://localhost:4200/assets/doctors.json` y fuerza la
  recarga.
- **Para iterar**, reconstruir la imagen en cada cambio es lento. Levanta sólo
  los servicios de datos y sirve el frontend en local:
  `docker compose up -d db backend` y
  `npx ng serve --port 4200 --proxy-config src/proxy.conf.json`.
  La comprobación **final**, la que cierra la etapa, va contra el stack Docker
  completo.

### 5. Cerrar

```bash
docker compose down
```

En el informe final, di qué pantallas revisaste y qué encontraste. Si la etapa
descubrió algo, arréglalo y vuelve a pasarla: no se commitea con un hallazgo
visual abierto.

## Reglas de Negocio (Críticas)

Estas reglas son aplicadas por el algoritmo y verificadas por las pruebas:
1. AC y AP tienen **grupos de médicos separados** — un médico pertenece a un solo grupo (en los dos grupos → 400). Los dos cuadrantes se generan **juntos con una sola acción**, porque los refuerzos que hace un AC se descuentan de los de AP.
2. Un médico de guardia o refuerzo el día D está **libre el D+1** dentro de su grupo y nunca hace guardia y refuerzo el mismo día (día de descanso — restricción blanda para grupos pequeños). El refuerzo de un AC va a propósito el día anterior a su guardia.
3. Límites de horas: **mínimo 135h/mes y 1.620h/año AC**, **máximo 425h/año AP** por médico — **restricción blanda**: si algún médico no cumple (AC por debajo, AP por encima), el cuadrante se genera igualmente con un aviso (`warnings`) y las estadísticas muestran la desviación. Si un AC no llega a 135h en un mes, hace **refuerzos el día anterior a sus guardias de ese mes**, tantos como necesite y donde haya hueco; si no hay hueco, aviso «No hay hueco para más refuerzos …».
4. **Cobertura diaria fija**: **1 guardia AC, 1 guardia AP y 1 refuerzo** (de AP, salvo los que cubre un AC). Hay **2 refuerzos** en los **festivos especiales de sanidad** (24, 25 y 31 dic, 1 y 6 ene: se añaden siempre a los festivos del año, `special: true`, no se pueden desmarcar) y en el segundo de dos festivos consecutivos (los domingos cuentan como festivo); nunca más de 2. `doctors_per_day` vale siempre 1. La adición manual (`POST /rota/:year/:rotaType/add`, sin validaciones de reglas) añade una guardia en AC y un refuerzo en AP. Si el pool AC excede la capacidad anual de cobertura («El grupo … es demasiado grande …») o el pool AP es tan pequeño que superaría el máximo de 425h («El grupo … es demasiado pequeño …»), el cuadrante se genera con ese aviso en lugar de fallar. `InfeasiblePoolError` queda sólo para grupos demasiado pequeños.
5. **Duraciones por rota**:
   - AC: 17h laborable, 18h sábado, 23h festivo (15:00 → 08:00+1 / 09:00+1, festivo 09:00 → 08:00+1).
   - Guardia AP y todos los refuerzos (también el de un AC): 7h L-Sábado (15:00–22:00), 12h festivo (10:00–22:00).
   - Los festivos especiales son festivo a todos los efectos (AC 23h desde las 09:00).
6. Festivo > Sábado > Laborable para la clasificación de tipo de día.
7. Las asignaciones deben tener máxima variación de grupo y ser equitativas (el puntero round-robin deslizante evita el bloqueo de grupo)
8. **UI**: cada día muestra los bloques AC, AP y REFUERZO; los refuerzos van prefijados con `R:` y el que cubre un AC lleva el sufijo `(AC)`.

## Documentación

- `docs/PRD.md` — Requisitos de producto con todos los criterios de aceptación
- `docs/TECHNICAL_DESIGN.md` — Contratos de API, esquema de BD, diseño del algoritmo
- `docs/BACKEND_ARCHITECTURE_REFERENCE.md` — Módulos NestJS y estructura de persistencia
- `docs/IMPLEMENTATION.md` — Guía para desarrolladores, jerarquía de componentes, estrategia de pruebas
- `docs/ALGORITHM.md` — Diseño del algoritmo de asignación, restricciones y compromisos
- `docs/visualizations/ruedas.html` — Visualización interactiva de la estrategia de ruedas (HTML autocontenido; si cambia `wheels.strategy.ts`, actualizar también su copia de la lógica)

## Exclusiones del Alcance PoC

Sin autenticación, sin multi-ciudad, sin deshacer, sin diseño móvil, sin CI/CD, sin despliegue en producción. Ver docs/PRD.md sección 4 para la lista completa.
