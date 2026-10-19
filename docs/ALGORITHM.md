# Algoritmo de Asignación

**Fuente:** [`backend/src/scheduling/assignment.service.ts`](../backend/src/scheduling/assignment.service.ts)

El algoritmo de planificación genera un calendario de guardias completo para todo el año para un **único tipo de rota** (AC o AP). AC y AP se generan de forma independiente con grupos de médicos separados.

Para **AC**, cada médico tiene el mismo objetivo anual fijo de `1.620h/año` (135h/mes × 12). Cada día se asigna exactamente **1 médico AC**.

Para **AP**, el modelo refleja que los profesionales de AP son **refuerzos diarios de la guardia AC**. La rota se genera por separado, pero las duraciones de turno son distintas de las de AC y el segundo de dos festivos consecutivos requiere cobertura doble:
- L-Sábado: 1 médico AP con turno de 7 h (15:00–22:00).
- Festivos: 1 médico AP con turno de 12 h (10:00–22:00).
- Festivo precedido de otro festivo: 2 médicos AP primary, cada uno con turno de 12 h.

---

## Visión General

```
generar_rota(año, tipo_rota, grupo, clasificaciones_días):
  1. Calcular días "efectivos" — duración real del turno por rota (AC usa la duración del día calendario; AP usa apShiftDetails)
  2. Calcular objetivos anuales por médico (1.620h mínimo AC / 425h máximo AP para todos)
  3. Fijar `doctors_per_day` base en 1
  4. Para cada día D del año:
     a. Determinar `required = doctorsForDay(tipo_rota, base, día, día_anterior)` — AP dobla en el segundo festivo consecutivo
     b. Construir el grupo elegible de médicos (filtrado por día de descanso)
     c. Seleccionar `required` médicos (ordenar por equidad de tipo de día → horas totales → posición round-robin)
     d. Actualizar seguimiento (horas, recuentos de turnos, fecha última asignación)
  5. Comprobar límites de horas (mínimo AC, máximo AP; si no se cumplen, aviso en `warnings`; no bloquea)
  6. Devolver calendario + estadísticas
```

---

## Paso a Paso

### 1. Calcular objetivos por médico

- **AP:** cada médico mantiene el tope plano de `425h/año` (**máximo**)
- **AC:** cada médico mantiene el objetivo plano de `1.620h/año` (135h/mes × 12)

`buildTargetHours(rotaType, pool)` asigna el mismo objetivo a todos los médicos del pool según el tipo de rota; no hay objetivos personalizados por médico.

### 2. Calcular doctors_per_day

La cobertura base de primary es **siempre 1 médico por día** para ambas rotas. La única excepción es el segundo AP en un festivo precedido de otro festivo. La cobertura no se incrementa automáticamente con el tamaño del pool.

Si el pool AC es demasiado grande para que cada médico llegue a su mínimo con esa cobertura, el algoritmo **no falla**: genera el cuadrante y añade a `warnings` un aviso ("El grupo de N médicos es demasiado grande para AC: el objetivo de Xh supera la capacidad anual de cobertura de Yh. K médicos quedan por debajo del mínimo de Mh; faltan Zh en total."). En AP ocurre al revés: si el pool es demasiado pequeño y la cobertura anual superaría el máximo de 425h por médico, también genera con aviso ("El grupo de N médicos es demasiado pequeño para AP: la cobertura anual de Yh supera el máximo de 425h por médico (se necesitan al menos M médicos). K médicos quedan por encima del máximo de 425h; sobran Zh en total."). Un pool AP grande es válido: cada médico simplemente hace menos horas.

#### Cobertura variable por día

El valor `doctors_per_day` es la **base**. En tiempo de asignación, el algoritmo aplica `doctorsForDay(tipo_rota, base, día, día_anterior)`:

- AC: siempre devuelve la base.
- AP: en un festivo cuyo día anterior también es festivo devuelve `max(base, 2) = 2`. En el resto de días —incluidos los festivos aislados y el primero de una serie— devuelve la base (1).

Los domingos cuentan como festivo: un lunes festivo lleva 2 AP, y también un domingo tras un sábado festivo. En una serie de tres o más festivos, todos menos el primero llevan 2. El 1 de enero no tiene día anterior en el año clasificado: `RotaService.generate` clasifica el 31 de diciembre anterior con los festivos de ese año (API y manuales) y lo pasa a `generateRota` como `dayBeforeYear`, de modo que el 1 de enero lleva 2 AP si ese 31 de diciembre es domingo o está marcado como festivo.

El `minPool` (tamaño mínimo del grupo) se calcula con el pico anual de `doctorsForDay`, no con la base.

#### Validación de capacidad

Tras calcular `doctors_per_day`, el algoritmo compara la capacidad anual de cobertura con el total de targets (AC: capacidad >= mínimos; AP: capacidad <= máximos):

```python
total_capacity = sum(día.duración × doctorsForDay(tipo_rota, base, día, día_anterior) for día in año)
total_target = sum(target_por_médico for médico in grupo)
pool_AC_demasiado_grande = total_capacity < total_target
pool_AP_demasiado_pequeño = total_capacity > total_target
```

Si no se cumple (en AP, pools de < 7 médicos con la aritmética actual), la generación continúa y el aviso final indica que el grupo es demasiado grande (AC) o demasiado pequeño (AP).

Ejemplos:
- Grupo AC de 4 → capacidad ≈ 6.627h; target = 4×1620 = 6.480h → OK, 1 médico/día.
- Grupo AC de 5 → target = 8.100h > 6.627h → se genera **con aviso** (faltan horas).
- Grupo AP de 5 → capacidad ≈ 302×7 + 63×12 + 6×12 ≈ 2.942h; tope = 5×425 = 2.125h < 2.942h → se genera **con aviso** (pool demasiado pequeño).
- Grupo AP de 7 → capacidad ≈ 2.942h; tope = 7×425 = 2.975h → OK (≈ 420h por médico, 1 médico/día; segundo festivo consecutivo: 2).

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

### 6. Validación de límites de horas (aviso)

Después de que se genera el año completo, se verifican las horas totales de cada médico:
- **AC:** cada médico debe tener >= 1.620 horas/año
- **AP:** cada médico debe tener <= 425 horas/año (máximo)

Si algún médico incumple su límite (por debajo en AC, por encima en AP), la rota **se devuelve igualmente** con un único aviso agregado en `warnings` (cuántos médicos incumplen y cuántas horas faltan o sobran en total; si además la capacidad anual no encaja con el objetivo, el aviso empieza indicando que el grupo es demasiado grande o demasiado pequeño). La desviación de cada médico es su `hours_vs_target` (negativo = faltan horas; en AP, positivo = sobran horas). El aviso sólo se devuelve al generar; no se persiste.

---

## Restricciones

| ID | Regla | Aplicación |
|----|------|------------|
| RD-1 | Grupos AC/AP separados — un médico pertenece a un solo grupo | **Dura** — aplicada por el invocador (grupo separado por llamada de generación) |
| RD-2 | Día de descanso: asignado en D → no disponible en D+1 (dentro del mismo tipo de rota) | **Dura** para grupos >= 2×doctors_per_day; **blanda** para grupos más pequeños |
| RD-3 | Horas: mínimo 1.620h/año AC, máximo 425h/año AP por médico | **Blanda** — si no se cumple, la rota se genera con un aviso y la desviación en las estadísticas |
| RD-4 | Cobertura base: 1 médico/día (AC y AP); 2 médicos AP en un festivo precedido de otro festivo | **Dura** — garantizado por el algoritmo |
| RD-5 | AP en festivos: turnos de 12 h (10:00–22:00); 2 médicos primary sólo en el segundo festivo consecutivo | **Dura** — `doctorsForDay` aplica el override en cada festivo precedido de otro festivo |
| RD-6 | AP en L-Sábado: 1 médico con turno de 7 h (15:00–22:00) | **Dura** — duración tomada de `apShiftDetails` |

---

## Verificación de Factibilidad (pre-generación)

Antes de que se ejecute el bucle principal, el algoritmo valida el grupo:

- **El grupo debe tener >= `doctors_per_day + doctors_per_day` médicos** (necesita suficientes para la rotación de días de descanso). Si no, se lanza `InfeasiblePoolError`.
- Si la capacidad anual no encaja con el objetivo del grupo (AC demasiado grande, AP demasiado pequeño), la generación **no** se bloquea: se emite un aviso (ver paso 6).

---

## Por qué importa la generación independiente por tipo

Con grupos AC y AP separados:
- **No hay acoplamiento entre tipos** — los días de descanso de AC no afectan a AP y viceversa
- Cada llamada de generación maneja un tipo con su propio grupo, su propio seguimiento de días de descanso y su propia validación
- El calendario fusiona ambos tipos en el frontend para su visualización

Esto es una simplificación significativa respecto al diseño anterior de un único paso donde las asignaciones de AC y AP estaban acopladas a través del seguimiento compartido de días de descanso.

---

## Objetivos de Optimización (orden de prioridad)

1. **Límites de horas** — cada médico de AC debe alcanzar 1.620h y ningún médico de AP debe superar 425h
2. **Equidad de tipo de día** — cada médico obtiene aproximadamente el mismo recuento (±1) de turnos laborables, de sábado y festivos
3. **Equidad de horas** — minimizar la diferencia máximo-mínimo de horas totales entre médicos
4. **Variación de grupo** — evitar que el mismo subconjunto de médicos sea siempre asignado junto (puntero round-robin deslizante)

Los objetivos 2-4 están codificados en la clave de ordenación. El objetivo 1 se comprueba tras la generación y, si no se cumple, produce un aviso en lugar de un error.

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
| festivo precedido de otro festivo | 2 | 12h | 10:00 → 22:00 |
| festivo aislado o primero de una serie | 1 | 12h | 10:00 → 22:00 |
| laborable / sábado | 1 | 7h | 15:00 → 22:00 |

**Precedencia:** Festivo > Sábado > Laborable. Un sábado que también es festivo se clasifica como `festivo`. Las duraciones AP **no coinciden** con la duración del día calendario (que es la usada por AC).

---

## Estrategia de ruedas (wheels)

Alternativa a la selección equilibrada, elegida con `strategy: "wheels"` en `POST /rota/generate`. Replica cómo se hacen hoy los cuadrantes a mano. Duraciones, `doctors_per_day`, verificación de factibilidad, estadísticas y avisos son los mismos; sólo cambia quién hace cada día. La estrategia `balanced` descrita arriba sigue siendo la predeterminada y no cambia.

**Ruedas.** Hay cuatro ruedas independientes: laborables, sábados, domingos y festivos. Un día va a la rueda de festivos si su fecha es un festivo oficial (`publicHoliday`), aunque caiga en sábado o domingo; si no, a la de domingos si es domingo, a la de sábados si es sábado y a la de laborables en otro caso.

**Orden.** Cada rueda recorre el grupo en el orden de la lista recibida con su propio puntero. Los punteros arrancan **escalonados** cada año (sin estado entre años): laborables en el índice 0, sábados en ⌊N/4⌋, domingos en ⌊2N/4⌋ y festivos en ⌊3N/4⌋, con N el tamaño del grupo (`staggeredInitialPointers`). Si todas las ruedas arrancaran desde el primer médico, la cabeza de la lista recibiría a la vez el primer turno de todas las ruedas y el +1 de cada una coincidiría sobre los mismos médicos; escalonar los orígenes reparte esa carga (ver `docs/STRATEGY_COMPARISON.md`). Cada asignación avanza el puntero de su rueda. Si un día requiere 2 (segundo refuerzo AP en festivo consecutivo) se toman los 2 siguientes de la rueda de festivos.

**Día de descanso: saltar y conservar turno.** Un médico no está descansado si hizo guardia el día anterior (en cualquier rueda del mismo tipo de rota) o ya ha sido elegido ese mismo día. Al llenar un día se consideran primero, en orden FIFO, los médicos pendientes de esa rueda y después la rueda desde su puntero. Al médico de la rueda que no está descansado se le salta, el puntero avanza y se anota una deuda en la cola de pendientes de esa rueda. Cada salto genera una deuda, aunque el médico ya tuviera otras: la cola admite al mismo médico varias veces (FIFO de turnos debidos). Elegir a un médico desde la cola consume UNA deuda, y un médico nunca sale dos veces el mismo día aunque acumule varias.

**Descanso blando.** Si en todo el grupo no hay suficientes descansados para cubrir el día, se completa con no descansados en el orden de la rueda (pendientes primero). Esos huecos no generan deuda nueva. Esta rama es inalcanzable desde `generateRota`: el tamaño mínimo del grupo (2 × pico de cobertura) garantiza siempre suficientes descansados, y sólo existe por robustez ante llamadas directas a la estrategia. Si aun así no hay suficientes médicos distintos se lanza `InfeasiblePoolError` con el mismo mensaje que `balanced`.

**Compromisos.** El reparto por rueda es exacto (±1) mientras no haya choques; los choques se compensan con la cola de pendientes, pero no se optimiza el equilibrio global de horas, por lo que los avisos de horas pueden aparecer con más frecuencia que con `balanced`.

### Limitación conocida: resonancia

Si la cadencia semanal coincide con el tamaño del grupo, la rueda de laborables da un número exacto de vueltas por semana y el mismo médico cae siempre en el mismo día de la semana. Caso típico: un grupo de 5 (o un múltiplo de 5 con 5 laborables por semana y sin festivos entre semana) hace que la rueda de laborables dé una vuelta exacta cada semana, de modo que el viernes lo hace siempre el mismo médico. Ese médico no está descansado el sábado, así que la rueda de sábados lo salta cada vez que le toca y sólo acumula deuda: no puede recuperarla mientras dure la resonancia, y sus sábados quedan en cero (con AC de 5 médicos y 2026 sin festivos, el que hace todos los viernes no hace ningún sábado). La resonancia se rompe cuando un festivo entre semana o un cambio de tamaño de grupo desplaza la fase; entonces el médico deudor encadena los turnos debidos en los sábados siguientes. Es una limitación conocida del método de ruedas, documentada por una prueba; `balanced` no la sufre porque elige por recuento.

---

## Compromisos y Limitaciones

- **Codicioso, no óptimo.** El algoritmo selecciona los mejores candidatos localmente cada día. Para grupos de 4 o más médicos esto produce calendarios bien equilibrados. Para grupos muy pequeños (2-3 médicos), se necesitaría un solver de programación por restricciones (p. ej., Google OR-Tools) para garantizar la optimalidad.
- **Sin retroceso.** Una vez asignado un día, nunca se revisita. Esto mantiene el algoritmo en O(D × N × K) donde D = días del año, N = tamaño del grupo y K = doctors_per_day, pero significa que no puede recuperarse de elecciones subóptimas tempranas.
- **Suavidad del día de descanso.** Para grupos pequeños, aplicar días de descanso estrictos puede crear callejones sin salida. El algoritmo degrada graciosamente permitiendo médicos sin descanso cuando es necesario, en lugar de fallar.
- **Límites blandos.** El algoritmo no rechaza calendarios que no cumplen los límites: con grupos AC muy grandes no hay suficientes horas para distribuir, y con grupos AP muy pequeños las horas exceden el máximo por médico; en ambos casos el cuadrante se entrega con un aviso y la desviación por médico.

---

## Estructuras de Datos

| Estructura | Tipo | Propósito |
|-----------|------|---------|
| `última_asignación` | `dict[str, date \| None]` | Fecha de última asignación por médico — filtrado de día de descanso |
| `puntero_rr` | `int` | Puntero round-robin deslizante — avanza 1 cada día para variación de grupo |
| `índice_médico` | `dict[str, int]` | Búsqueda de índice pre-calculada para posición round-robin en O(1) |
| `horas_totales` | `dict[str, int]` | Horas acumuladas por médico — equidad de horas + validación de límites |
| `{laborable,sábado,festivo}_count` | `dict[str, int]` | Recuentos de turnos por médico por tipo de día — equidad de tipo de día |

Todas las estructuras están indexadas por ID de médico e inicializadas a cero/None al inicio de la generación.
