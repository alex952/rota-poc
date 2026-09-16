# Algoritmo de Asignación

**Fuente:** [`backend/src/scheduling/assignment.service.ts`](../backend/src/scheduling/assignment.service.ts)

El algoritmo de planificación genera un calendario de guardias completo para todo el año para un **único tipo de rota** (AC o AP). AC y AP se generan de forma independiente con grupos de médicos separados.

Para **AC**, cada médico tiene el mismo objetivo anual fijo de `1.620h/año` (135h/mes × 12). Cada día se asigna exactamente **1 médico AC**.

Para **AP**, el modelo refleja que los profesionales de AP son **refuerzos diarios de la guardia AC**. La rota se genera por separado, pero las duraciones de turno son distintas de las de AC y los festivos requieren cobertura doble:
- L-Sábado: 1 médico AP con turno de 7 h (15:00–22:00).
- Festivos: 2 médicos AP primary, cada uno con turno de 12 h (10:00–22:00).

---

## Visión General

```
generar_rota(año, tipo_rota, grupo, clasificaciones_días):
  1. Calcular días "efectivos" — duración real del turno por rota (AC usa la duración del día calendario; AP usa apShiftDetails)
  2. Calcular objetivos anuales por médico (1.620h AC / 425h AP para todos)
  3. Fijar `doctors_per_day` base en 1
  4. Para cada día D del año:
     a. Determinar `required = doctorsForDay(tipo_rota, base, día.tipo)` — AP dobla en festivos
     b. Construir el grupo elegible de médicos (filtrado por día de descanso)
     c. Seleccionar `required` médicos (ordenar por equidad de tipo de día → horas totales → posición round-robin)
     d. Actualizar seguimiento (horas, recuentos de turnos, fecha última asignación)
  5. Validar horas mínimas (restricción DURA)
  6. Devolver calendario + estadísticas
```

---

## Paso a Paso

### 1. Calcular objetivos por médico

- **AP:** cada médico mantiene el objetivo plano de `425h/año`
- **AC:** cada médico mantiene el objetivo plano de `1.620h/año` (135h/mes × 12)

`buildTargetHours(rotaType, pool)` asigna el mismo objetivo a todos los médicos del pool según el tipo de rota; no hay objetivos personalizados por médico.

### 2. Calcular doctors_per_day

La cobertura base de primary es **siempre 1 médico por día** para ambas rotas. La única excepción es el segundo AP en festivos. La cobertura no se incrementa automáticamente con el tamaño del pool.

Si el pool es demasiado grande para que cada médico llegue a su target con esa cobertura, el algoritmo lanza `InfeasiblePoolError` ("Pool too large for AC|AP: target Xh exceeds yearly coverage capacity Yh").

#### Cobertura variable por día

El valor `doctors_per_day` es la **base**. En tiempo de asignación, el algoritmo aplica `doctorsForDay(tipo_rota, base, día.tipo)`:

- AC: siempre devuelve la base.
- AP: en festivos devuelve `max(base, 2) = 2`. En el resto de días devuelve la base (1).

El `minPool` (tamaño mínimo del grupo) se calcula con el pico anual de `doctorsForDay`, no con la base.

#### Validación de capacidad

Tras calcular `doctors_per_day`, el algoritmo verifica que la capacidad anual de cobertura sea suficiente para cumplir los targets:

```python
total_capacity = sum(día.duración × doctorsForDay(tipo_rota, base, día.tipo) for día in año)
total_target = sum(target_por_médico for médico in grupo)
assert total_capacity >= total_target
```

Si no, lanza `InfeasiblePoolError`. Esto detecta pools AP excesivos (>= ~8 médicos con la aritmética actual) antes de iterar.

Ejemplos:
- Grupo AC de 4 → capacidad ≈ 6.627h; target = 4×1620 = 6.480h → OK, 1 médico/día.
- Grupo AC de 5 → target = 8.100h > 6.627h → **`InfeasiblePoolError`**.
- Grupo AP de 5 → capacidad ≈ 303×7 + 62×24 ≈ 3.609h; target = 5×425 = 2.125h → OK, 1 médico/día (festivos: 2).
- Grupo AP de 9 → capacidad ≈ 3.609h; target = 9×425 = 3.825h → **`InfeasiblePoolError`** (pool demasiado grande).

### 3. Construir el grupo elegible

Todos los médicos se dividen en dos grupos según las asignaciones del día anterior:

- **Descansados:** no asignados en D-1
- **Sin descanso:** asignados en D-1

Si hay suficientes médicos descansados (>= `doctors_per_day`), solo los médicos descansados son elegibles. En caso contrario, se usa el grupo completo — la regla de día de descanso se convierte en una **restricción blanda** para evitar callejones sin salida en grupos pequeños.

Además, los médicos ya asignados hoy (cuando `doctors_per_day > 1`) se excluyen de selecciones posteriores para el mismo día.

### 4. Seleccionar los médicos

Los médicos elegibles se ordenan por una clave compuesta (ascendente):

| Prioridad | Criterio | Propósito |
|-----------|---------|----------|
| 1ª | Menos turnos de este tipo de día (laborable/sábado/festivo) | Equidad de tipo de día |
| 2ª | Menos horas totales | Equilibrio de horas |
| 3ª | Posición round-robin `(índice_médico - puntero_rr) % N` | Romper bloqueo de grupo |

Un **puntero round-robin deslizante** (`puntero_rr`) avanza 1 cada día. Esto garantiza que cuando múltiples médicos están empatados en equidad y horas, diferentes subconjuntos ganan el desempate en días diferentes — evitando que siempre se asigne el mismo grupo.

Los `doctors_per_day` candidatos principales son asignados.

### 5. Actualizar seguimiento

Para cada médico asignado:
- `última_asignación[médico]` = D (usado para verificaciones de día de descanso)
- Incrementar su contador de horas por la duración del día
- Incrementar su contador de turnos por tipo de día

### 6. Validación Dura

Después de que se genera el año completo, se verifican las horas totales de cada médico:
- **AC:** cada médico debe tener >= 1.620 horas/año
- **AP:** cada médico debe tener >= 425 horas/año

Si algún médico cae por debajo, se lanza un `InfeasiblePoolError`. Esta es una **restricción dura** — la rota se rechaza, no se devuelve con advertencias.

---

## Restricciones

| ID | Regla | Aplicación |
|----|------|------------|
| RD-1 | Grupos AC/AP separados — un médico pertenece a un solo grupo | **Dura** — aplicada por el invocador (grupo separado por llamada de generación) |
| RD-2 | Día de descanso: asignado en D → no disponible en D+1 (dentro del mismo tipo de rota) | **Dura** para grupos >= 2×doctors_per_day; **blanda** para grupos más pequeños |
| RD-3 | Horas mínimas: 1.620h/año AC, 425h/año AP por médico | **Dura** — `InfeasiblePoolError` lanzado si no se cumple |
| RD-4 | Cobertura base: 1 médico/día (AC y AP); 2 médicos en festivos para AP | **Dura** — garantizado por el algoritmo |
| RD-5 | AP en festivos: 2 médicos primary con turnos de 12 h (10:00–22:00) | **Dura** — `doctorsForDay` aplica el override en cada festivo |
| RD-6 | AP en L-Sábado: 1 médico con turno de 7 h (15:00–22:00) | **Dura** — duración tomada de `apShiftDetails` |

---

## Verificación de Factibilidad (pre-generación)

Antes de que se ejecute el bucle principal, el algoritmo valida el grupo:

- **El grupo debe tener >= `doctors_per_day + doctors_per_day` médicos** (necesita suficientes para la rotación de días de descanso). Si no, se lanza `InfeasiblePoolError`.
- Verificación de seguridad: si `doctors_per_day × total_horas_anuales / tamaño_grupo < horas_min`, la configuración no es factible.

---

## Por qué importa la generación independiente por tipo

Con grupos AC y AP separados:
- **No hay acoplamiento entre tipos** — los días de descanso de AC no afectan a AP y viceversa
- Cada llamada de generación maneja un tipo con su propio grupo, su propio seguimiento de días de descanso y su propia validación
- El calendario fusiona ambos tipos en el frontend para su visualización

Esto es una simplificación significativa respecto al diseño anterior de un único paso donde las asignaciones de AC y AP estaban acopladas a través del seguimiento compartido de días de descanso.

---

## Objetivos de Optimización (orden de prioridad)

1. **Horas mínimas** — cada médico debe alcanzar el mínimo obligatorio (1.620h AC o 425h AP)
2. **Equidad de tipo de día** — cada médico obtiene aproximadamente el mismo recuento (±1) de turnos laborables, de sábado y festivos
3. **Equidad de horas** — minimizar la diferencia máximo-mínimo de horas totales entre médicos
4. **Variación de grupo** — evitar que el mismo subconjunto de médicos sea siempre asignado junto (puntero round-robin deslizante)

Los objetivos 2-4 están codificados en la clave de ordenación. El objetivo 1 se aplica como validación dura post-generación.

---

## Tipos de Día y Duraciones

La clasificación del día (festivo / sábado / laborable) es común a AC y AP. Las **duraciones de turno son distintas** entre rotas:

### AC (rota primaria)

| Condición | Tipo de Día | Duración | Turno |
|-----------|------------|---------|-------|
| Domingo, o fecha en conjunto de festivos | `festivo` | 23h | 09:00 → 08:00+1 |
| Sábado (no festivo) | `sábado` | 18h | 15:00 → 09:00+1 |
| Todos los demás días | `laborable` | 17h | 15:00 → 08:00+1 |

### AP (refuerzo del día — `apShiftDetails`)

| Tipo de Día | Médicos | Duración | Turno |
|-------------|---------|---------|-------|
| festivo | 2 | 12h | 10:00 → 22:00 |
| laborable / sábado | 1 | 7h | 15:00 → 22:00 |

**Precedencia:** Festivo > Sábado > Laborable. Un sábado que también es festivo se clasifica como `festivo`. Las duraciones AP **no coinciden** con la duración del día calendario (que es la usada por AC).

---

## Compromisos y Limitaciones

- **Codicioso, no óptimo.** El algoritmo selecciona los mejores candidatos localmente cada día. Para grupos de 4 o más médicos esto produce calendarios bien equilibrados. Para grupos muy pequeños (2-3 médicos), se necesitaría un solver de programación por restricciones (p. ej., Google OR-Tools) para garantizar la optimalidad.
- **Sin retroceso.** Una vez asignado un día, nunca se revisita. Esto mantiene el algoritmo en O(D × N × K) donde D = días del año, N = tamaño del grupo y K = doctors_per_day, pero significa que no puede recuperarse de elecciones subóptimas tempranas.
- **Suavidad del día de descanso.** Para grupos pequeños, aplicar días de descanso estrictos puede crear callejones sin salida. El algoritmo degrada graciosamente permitiendo médicos sin descanso cuando es necesario, en lugar de fallar.
- **Mínimos duros.** A diferencia del enfoque anterior de restricción blanda, el algoritmo ahora **rechaza** calendarios que no cumplen los mínimos. Esto significa que grupos muy grandes pueden ser inviables (no hay suficientes horas para distribuir).

---

## Estructuras de Datos

| Estructura | Tipo | Propósito |
|-----------|------|---------|
| `última_asignación` | `dict[str, date \| None]` | Fecha de última asignación por médico — filtrado de día de descanso |
| `puntero_rr` | `int` | Puntero round-robin deslizante — avanza 1 cada día para variación de grupo |
| `índice_médico` | `dict[str, int]` | Búsqueda de índice pre-calculada para posición round-robin en O(1) |
| `horas_totales` | `dict[str, int]` | Horas acumuladas por médico — equidad de horas + validación de mínimos |
| `{laborable,sábado,festivo}_count` | `dict[str, int]` | Recuentos de turnos por médico por tipo de día — equidad de tipo de día |

Todas las estructuras están indexadas por ID de médico e inicializadas a cero/None al inicio de la generación.
