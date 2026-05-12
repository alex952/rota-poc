# Aplicación de Asignación de Guardias Médicas

## 1. Visión y alcance

Aplicación para la planificación automática de guardias en hospitales españoles. Cubre dos rotas anuales: **AC** (Atención Continuada) y **AP** (Atención Primaria). El sistema asegura el cumplimiento de los mínimos horarios anuales, equidad entre profesionales y la cobertura mínima de personal por día.

Esta es una Prueba de Concepto (PoC): sin autenticación, sin multi-ciudad, sin deshacer, sin diseño móvil ni CI/CD productivo.

## 2. Modelo de dominio: AC y AP

AC y AP son dos rotas independientes en cuanto a generación, pero conectadas en cuanto al servicio que prestan:

- Los profesionales de **AC** trabajan exclusivamente como guardias y son los responsables principales de la cobertura del día.
- Los profesionales de **AP** **refuerzan cada día** la cobertura de AC. Aunque la rota se genera por separado, el rol funcional en el calendario es el de **refuerzo del día**.

Un médico pertenece a un único grupo (AC o AP) y nunca participa en la rota del otro.

## 3. Reglas de cobertura diaria

- **Cada día** debe haber, como mínimo, **1 AC** asignado y **1 AP** asignado.
- **En festivos** (incluye domingos clasificados como festivos por la regulación) hay **2 AP** asignados con turnos de **12 h cada uno** (10:00 a 22:00).
- **Cuando un AC asignado tiene horario reducido** (`hours_reduced_per_day > 0`) ese día se añade automáticamente **un AC de refuerzo** que cubre la jornada con él/ella. Este refuerzo:
  - Es otro médico AC del pool.
  - **No puede tener horario reducido** (ni en la generación inicial ni en reemplazos manuales).

## 4. Duraciones de turno por rota y tipo de día

| Rota / rol            | Laborable             | Sábado                | Festivo / Domingo     |
|-----------------------|-----------------------|-----------------------|-----------------------|
| AC (primary)          | 17 h (15:00–08:00+1)  | 18 h (15:00–09:00+1)  | 23 h (09:00–08:00+1)  |
| Refuerzo AC           | 7 h (15:00–22:00)     | 7 h (15:00–22:00)     | 12 h (10:00–22:00)    |
| AP (refuerzo del día) | 7 h (15:00–22:00)     | 7 h (15:00–22:00)     | 12 h × 2 (10:00–22:00) |

## 5. Restricciones duras (validadas por el algoritmo)

1. **Mínimo anual por médico**:
   - AC: 1.620 h/año (135 h/mes × 12).
   - AP: 425 h/año.
   - El algoritmo lanza error si algún profesional queda por debajo.
2. **Día de descanso**: un médico de guardia el día D queda libre el D+1 dentro de la misma rota. Restricción suavizable en pools muy pequeños.
3. **Reducción horaria es exclusiva de AC**. Médicos AP nunca tienen reducción horaria.
4. **Un AC con horario reducido nunca puede asignarse como refuerzo** de otro AC.
5. **AC y AP se generan de forma independiente**: un mismo médico no puede aparecer en ambas rotas.

## 6. Equidad

Las asignaciones se distribuyen equitativamente entre los profesionales del pool por tipo de día (laborable, sábado, festivo) y por horas totales acumuladas vs. objetivo personal anual. El puntero round-robin deslizante evita bloqueos sistemáticos en pools pequeños. Para detalles, ver `docs/ALGORITHM.md`.

## 7. Datos de entrada

```json
{
  "year": 2026,
  "rota_type": "AC",
  "pool": [
    {
      "id": "doc-001",
      "name": "Dra. García",
      "department": "Medicina General",
      "hours_reduced_per_day": 0
    },
    {
      "id": "doc-002",
      "name": "Dr. López",
      "department": "Pediatría",
      "hours_reduced_per_day": 2
    }
  ]
}
```

`hours_reduced_per_day` sólo tiene efecto cuando `rota_type = "AC"`. Si se envía para AP se ignora.

## 8. Datos de salida

Se devuelve un calendario anual con:

- Asignaciones primary por día (1 médico para AC, 1 ó 2 médicos para AP).
- Refuerzos vinculados (sólo AC, cuando el primary tiene horario reducido).
- Estadísticas por médico: horas totales, horas vs. objetivo, número de turnos por tipo de día, horas mensuales.
- Avisos (`warnings`) si el algoritmo no pudo asignar todos los refuerzos esperados (por ejemplo, tras un reemplazo manual).

## 9. Persistencia y consultas

- La rota se almacena para acceso rápido posterior.
- Se puede consultar la rota completa, filtrar por médico o reemplazar un profesional concreto en un día concreto.
- El reemplazo respeta todas las restricciones (descanso, exclusión de reducidos como refuerzos, conflicto mismo día).

## 10. Servicio de festivos

El sistema consulta una API externa de festivos españoles (por defecto `https://date.nager.at/api/v3`) según la ciudad del hospital (variable de entorno `CITY`, por defecto `Madrid`). Los festivos se cachean en la base de datos.

## 11. Componentes del producto

### 11.1 Servicio de asignación (backend)

- **Stack**: NestJS 11, TypeScript, class-validator, TypeORM, PostgreSQL.
- **Endpoints principales**:
  - `POST /api/v1/rota/generate` — genera la rota anual.
  - `GET /api/v1/rota/:year/:rotaType` — consulta una rota (soporta filtro por `doctor_id`).
  - `GET /api/v1/rota/:year` — devuelve las rotas (AC y AP) del año.
  - `PATCH /api/v1/rota/:year/:rotaType/replace` — reemplaza un profesional.
  - `GET /api/v1/holidays/:year` — festivos del año para la ciudad configurada.

### 11.2 Interfaz de calendario (frontend)

- **Stack**: Angular 19+, signals, Angular CDK (drag-and-drop).
- **Layout** en dos columnas:
  - **Izquierda**: pool de médicos (cards arrastrables) con botones para añadir profesionales y generar/regenerar la rota. Se prepopula desde un archivo de configuración estática.
  - **Derecha**: vista mensual del calendario con las asignaciones del año. Cada celda diaria muestra:
    - **AC**: 1 ó 2 médicos. Cuando hay reducción horaria, el AC reducido aparece **primero y en cursiva**; debajo el AC de refuerzo, en estilo normal. No se usa la etiqueta "Refuerzo" porque el dominio interno la reserva al refuerzo AC del reducido.
    - **AP**: 1 ó 2 médicos, cada uno prefijado con `R:` para reflejar su rol funcional de refuerzo del día.
  - **Panel oculto** con estadísticas por médico (horas, turnos, horas vs. objetivo).
- **Botón Generar**:
  - Si no hay rota para el año: "Generate Rota".
  - Si ya existe: "Re-generate Rota" con diálogo de confirmación.

## 12. Exclusiones del alcance PoC

- Sin autenticación ni gestión de usuarios.
- Sin soporte multi-ciudad simultáneo (una ciudad por entorno).
- Sin deshacer ni historial de versiones de rota.
- Sin diseño responsivo móvil.
- Sin pipeline CI/CD ni despliegue productivo.

## 13. Otros requisitos

- Versiones modernas de frameworks y lenguajes.
- Ejecución local (`npm run start:dev` backend, `ng serve` frontend) y entorno completo dockerizado (`docker compose up --build`).
- ATDD: los criterios de aceptación tienen tests automatizados antes de la implementación.
