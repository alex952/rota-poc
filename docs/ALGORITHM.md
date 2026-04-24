# Algoritmo de Asignación

**Fuente:** [`backend/src/scheduling/assignment.service.ts`](../backend/src/scheduling/assignment.service.ts)

El algoritmo de planificación genera un calendario de guardias completo para todo el año para un **único tipo de rota** (AC o AP). AC y AP se generan de forma independiente con grupos de médicos separados.

Para **AC**, los médicos pueden tener `hours_reduced_per_day > 0`. Esos médicos siguen participando en la rota AC principal, pero su mínimo anual obligatorio se personaliza a partir de las reducciones de días laborables mensuales, y cada día que son asignados como médico principal de AC genera una asignación de **refuerzo** vinculada en la misma fecha.

---

## Visión General

```
generar_rota(año, tipo_rota, grupo, clasificaciones_días):
  1. Calcular objetivos anuales por médico
  2. Calcular doctors_per_day a partir del tamaño del grupo y las horas mínimas
  3. Para cada día D del año:
     a. Construir el grupo elegible de médicos (filtrado por día de descanso)
     b. Seleccionar `doctors_per_day` médicos (ordenar por equidad de tipo de día → progreso hacia objetivo → posición round-robin)
     c. Actualizar seguimiento (horas, recuentos de turnos, fecha última asignación)
  4. Solo para AC, crear asignaciones de refuerzo vinculadas para médicos con horas reducidas
  5. Validar horas mínimas personalizadas (restricción DURA)
  6. Devolver calendario + estadísticas
```

---

## Paso a Paso

### 1. Calcular objetivos por médico

- **AP:** cada médico mantiene el objetivo plano de `425h/año`
- **AC:** el objetivo anual de cada médico es:

```python
sum(max(0, 135 - (hours_reduced_per_day * días_laborables_en_mes)) for mes in año)
```

Esto significa que los médicos de AC sin reducción siguen con el objetivo de `1.620h/año`, mientras que los médicos con reducción de horas se validan contra un mínimo personalizado más bajo.

### 2. Calcular doctors_per_day

El algoritmo calcula automáticamente cuántos médicos son necesarios por día para garantizar que se puedan cumplir las horas mínimas:

```python
total_horas_anuales = sum(d.duration_hours for d in clasificaciones_días)
horas_min = 1620 if tipo_rota == "AC" else 425  # AC: 135h/mes × 12
doctors_per_day = ceil(len(grupo) * horas_min / total_horas_anuales)
```

Ejemplos de cálculo (~6.635 horas totales de AC/año):
- Grupo AC de 4 → ceil(4 × 1620 / 6635) = ceil(0.98) = **1 médico/día**
- Grupo AC de 5 → ceil(5 × 1620 / 6635) = ceil(1.22) = **2 médicos/día**
- Grupo AC de 8 → ceil(8 × 1620 / 6635) = ceil(1.95) = **2 médicos/día**
- Grupo AP de 10 → ceil(10 × 425 / 6635) = ceil(0.64) = **1 médico/día**

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
| 2ª | Menor progreso hacia el objetivo personalizado | Equidad entre contratos mixtos |
| 3ª | Menos horas totales | Equilibrio de horas |
| 4ª | Posición round-robin `(índice_médico - puntero_rr) % N` | Romper bloqueo de grupo |

Un **puntero round-robin deslizante** (`puntero_rr`) avanza 1 cada día. Esto garantiza que cuando múltiples médicos están empatados en equidad y horas, diferentes subconjuntos ganan el desempate en días diferentes — evitando que siempre se asigne el mismo grupo.

Los `doctors_per_day` candidatos principales son asignados.

### 5. Actualizar seguimiento

Para cada médico asignado:
- `última_asignación[médico]` = D (usado para verificaciones de día de descanso)
- Incrementar su contador de horas por la duración del día
- Incrementar su contador de turnos por tipo de día

### 6. Refuerzos de AC vinculados

Después de que se genera el calendario principal de AC:

- Cada asignación AC principal con horas reducidas crea **un** refuerzo vinculado en la misma fecha
- Las duraciones del refuerzo son:
  - Lun-Sáb: `15:00 -> 22:00` (`7h`)
  - Domingo/festivo: `10:00 -> 22:00` (`12h`)
- Los candidatos a refuerzo provienen del grupo AC excluyendo los asignados principales del mismo día
- Cualquier asignación de AC, incluyendo refuerzo, consume la regla de descanso AC del día siguiente

### 7. Validación Dura

Después de que se genera el año completo, se verifican las horas totales de cada médico:
- **AC:** cada médico debe tener >= su objetivo anual personalizado
- **AP:** cada médico debe tener >= 425 horas/año

Si algún médico cae por debajo, se lanza un `InfeasiblePoolError`. Esta es una **restricción dura** — la rota se rechaza, no se devuelve con advertencias.

---

## Restricciones

| ID | Regla | Aplicación |
|----|------|------------|
| RD-1 | Grupos AC/AP separados — un médico pertenece a un solo grupo | **Dura** — aplicada por el invocador (grupo separado por llamada de generación) |
| RD-2 | Día de descanso: asignado en D → no disponible en D+1 (dentro del mismo tipo de rota) | **Dura** para grupos >= 2×doctors_per_day; **blanda** para grupos más pequeños |
| RD-3 | Horas mínimas: 1.620h/año AC, 425h/año AP por médico | **Dura** — `InfeasiblePoolError` lanzado si no se cumple |
| RD-4 | `doctors_per_day` calculado automáticamente | **Dura** — garantizado por el algoritmo |

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

| Condición | Tipo de Día | Duración | Turno |
|-----------|------------|---------|-------|
| Domingo, o fecha en conjunto de festivos | `festivo` | 23h | 09:00 → 08:00+1 |
| Sábado (no festivo) | `sábado` | 18h | 15:00 → 09:00+1 |
| Todos los demás días | `laborable` | 17h | 15:00 → 08:00+1 |

**Precedencia:** Festivo > Sábado > Laborable. Un sábado que también es festivo se clasifica como `festivo` (23h, no 18h).

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
