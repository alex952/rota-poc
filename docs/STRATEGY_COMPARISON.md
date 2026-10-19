# Comparación de métodos de asignación: Equilibrado vs Ruedas

Informe de disparidades entre la estrategia actual (`balanced`, «Equilibrado») y la estrategia de ruedas (`wheels`, «Ruedas»), que replica el método manual del hospital: varias ruedas round-robin estrictas para laborables, sábados, domingos y festivos.

- **Datos**: `docs/strategy-comparison/results.json`
- **Reproducir**: `cd backend && npm run compare:strategies`
- **Escenarios**: 16 combinaciones (años 2026 y 2027 × AC con 3, 4, 5 y 6 médicos × AP con 5, 8, 12 y 17 médicos). AC 4 y AP 17 son los grupos semilla de `frontend/src/assets/doctors.json`; los grupos menores son los primeros N médicos del semilla y los mayores se completan con médicos sintéticos.
- **Festivos**: lista fija de festivos nacionales y de la Comunidad Valenciana (14 por año). El entorno de análisis no tenía acceso a `date.nager.at`, así que no hay festivos locales de Alicante ni traslados de festivos en domingo. Con los festivos reales las cifras cambiarán ligeramente, pero las tendencias no.

## Resumen

| Pregunta | Equilibrado | Ruedas |
|---|---|---|
| ¿Reparte las **horas** por igual? | **Sí.** Rango típico de 1 a 23 h entre médicos | Peor: rango de 21 a 104 h |
| ¿Reparte **domingos y festivos** por igual? | **No.** Hasta 6 domingos o 5 festivos de diferencia entre médicos | **Sí.** ±1 (±2 en algún caso) |
| ¿Respeta el **día de descanso**? | Sí (0 violaciones) | Sí (0 violaciones), gracias a la regla de saltos |
| ¿Cumple los **límites** 1.620 h AC / 425 h AP? | Igual en ambas: depende del tamaño del grupo, no del método | Igual |
| ¿Es **predecible** para los médicos? | No: depende del historial acumulado | Sí: cada uno sabe su posición en cada rueda |
| ¿Concentra la carga en el tiempo? | Poco | Más: el doble o más de huecos de sólo 2 días y meses más cargados |

**Conclusión:** cada método es más justo en una dimensión distinta. El Equilibrado iguala las **horas**; las Ruedas igualan el **número de guardias de cada tipo de día**. Ninguno domina al otro. La elección es una decisión de política del servicio, no técnica.

## Hallazgos

### 1. Horas totales: el Equilibrado es entre 2 y 13 veces más uniforme

En los 16 escenarios las Ruedas tienen mayor dispersión de horas. En los grupos semilla:

| Escenario | Equilibrado (rango) | Ruedas (rango) |
|---|---|---|
| AC 4 · 2026 | 18 h (1.655–1.673) | 63 h (1.633–1.696) |
| AC 4 · 2027 | 18 h | 58 h |
| AP 17 · 2026 | 7 h (167–174) | 21 h (160–181) |
| AP 17 · 2027 | 12 h | 38 h (160–198) |

El caso extremo es AC 6 · 2026: 18 h con Equilibrado frente a 104 h con Ruedas (1.048–1.152 h).

**Causa:** cada rueda reparte por igual con una tolerancia de ±1 guardia, pero las guardias valen horas distintas: en AC, 17 h un laborable, 18 h un sábado y 23 h un festivo o domingo. Un médico que cae en el «+1» de varias ruedas a la vez acumula esas horas sin que nada lo compense. El Equilibrado, en cambio, usa las horas totales como segundo criterio de desempate y corrige la desviación día a día.

### 2. Domingos y festivos: las Ruedas son claramente más justas

El Equilibrado cuenta los domingos y los festivos como una sola categoría. Por eso iguala la suma de ambos, pero no cada uno por separado:

| Escenario | Domingos por médico (Equilibrado → Ruedas) | Festivos por médico (Equilibrado → Ruedas) |
|---|---|---|
| AC 3 · 2027 | 14–20 → 17–17 | 2–7 → 4–5 |
| AC 4 · 2027 | 10–15 → 12–13 | 2–6 → 3–4 |
| AP 5 · 2026 | 8–13 → 10–11 | 1–6 → 3–4 |
| AP 12 · 2027 | 2–6 → 4–5 | 0–4 → 1–2 |

Con el Equilibrado, un médico puede acabar el año con 6 festivos y otro con 1, aunque ambos sumen las mismas horas. Socialmente, Navidad, Reyes y Semana Santa no equivalen a un domingo cualquiera. Probablemente esta sea la disparidad que más perciben los médicos, y la que el método manual evita por construcción.

En laborables y sábados ambos métodos empatan (±1).

### 3. El método manual literal choca con el día de descanso

Se simuló la «rueda pura», es decir, cuatro ruedas estrictas sin ninguna regla de saltos y todas empezando por el primer médico:

| Escenario | Violaciones de descanso | Sábado + domingo mismo médico | Viernes + sábado + domingo |
|---|---|---|---|
| AC 4 · 2026 | 58 | 38 | 1 |
| AP 17 · 2026 | 43 | 35 | 4 |
| AC 3 · 2026 | 76 | 37 | 14 |
| AP 17 · 2027 | 26 | 17 | 2 |

Las ruedas de sábados y de domingos avanzan al mismo ritmo, una posición por semana. Si ambas empiezan por el mismo médico, coinciden **todos los fines de semana** hasta que un festivo desfasa una de ellas. Probablemente la persona que hace hoy los cuadrantes corrige estos choques a mano. La estrategia `wheels` automatiza esa corrección con la regla «saltar y conservar turno». Como consecuencia, entre el 8 % y el 24 % de los días el médico asignado no es el que tocaba en orden puro.

Con la regla de saltos, las Ruedas quedan en **0 violaciones de descanso y 0 fines de semana completos** en todos los escenarios, igual que el Equilibrado.

### 4. Arrancar las ruedas escalonadas reduce casi toda la disparidad de horas

Como análisis de sensibilidad se probaron ruedas con puntero inicial escalonado: laborables desde el médico 0, sábados desde ⌊N/4⌋, domingos desde ⌊2N/4⌋ y festivos desde ⌊3N/4⌋. Se mantuvo la misma regla de saltos.

| Escenario | Equilibrado | Ruedas (todas desde el primero) | Ruedas escalonadas |
|---|---|---|---|
| AC 4 · 2026 | 18 h | 63 h | 29 h |
| AC 4 · 2027 | 18 h | 58 h | **18 h** |
| AC 6 · 2026 | 18 h | 104 h | 58 h |
| AP 12 · 2026 | 12 h | 38 h | **12 h** |
| AP 17 · 2026 | 7 h | 21 h | **7 h** |
| AP 17 · 2027 | 12 h | 38 h | 19 h |

Las ruedas escalonadas conservan el reparto ±1 por tipo de día y, en muchos escenarios, **igualan al Equilibrado en horas**. También reducen la concentración mensual. El motivo es que, si todas las ruedas empiezan por el primer médico, la cabeza de la lista recibe el «+1» de todas a la vez y el final de la lista se queda sin él.

> **Recomendación:** reconsiderar la decisión de «todas desde el primero». Los datos indican que el arranque escalonado es la mejor combinación: la equidad por tipo de día de las Ruedas con casi la equidad horaria del Equilibrado. El cambio en el código es mínimo; `assignWithWheels` ya acepta punteros iniciales.

### 5. Las Ruedas concentran más la carga en el tiempo

Al seguir un orden fijo, las Ruedas no reaccionan a la carga reciente de cada médico:

- **Huecos de sólo 2 días entre guardias**: entre el doble y 20 veces más. AP 17 · 2027 pasa de 1 a 23 y AC 5 · 2026 de 30 a 60.
- **Mes más cargado de un médico**: en AP 12 y AP 17 sube de 26–33 h a 45 h. En AC 6 · 2026, de 109 h a 132 h.
- **Hueco medio**: prácticamente igual en ambos métodos. Lo que cambia es la irregularidad.

### 6. Límites de horas: el método es indiferente

Las horas totales del año dependen sólo del calendario y del número de guardias por día, que es igual en ambos métodos. Por eso los avisos coinciden exactamente:

- **AC**: con 5 o 6 médicos todos quedan por debajo de 1.620 h. Con 3 o 4 todos lo cumplen.
- **AP**: con 5 médicos todos superan las 425 h. Con 8 o más ninguno las supera.

Cambiar de método no arregla un grupo mal dimensionado.

### 7. Limitación conocida de las Ruedas: resonancia

Si el tamaño del grupo encaja con la cadencia semanal, puede darse un choque estructural. Por ejemplo, con 5 médicos y semanas de 5 laborables, el mismo médico hace todos los viernes, nunca está descansado el sábado y su turno de sábado se aplaza semana tras semana. La regla de saltos acumula esas deudas y las salda en cuanto un festivo desfasa la rueda de laborables. Con los festivos reales, la diferencia en sábados queda en ±1 a final de año. En un año sin festivos entre semana, el desequilibrio se mantendría. Está documentado en `docs/ALGORITHM.md` y cubierto por un test.

## Decisiones pendientes para el servicio

1. **¿Qué disparidad importa más a los médicos?** ¿Las horas totales, a favor del Equilibrado, o el número de domingos y festivos, a favor de las Ruedas?
2. **Arranque de las ruedas.** Se recomienda el arranque escalonado (hallazgo 4).
3. **¿Cómo corrige hoy los choques la persona que hace los cuadrantes?** Conviene confirmar si coincide con «saltar y conservar turno», para que la herramienta replique el método real y no una aproximación.
4. **Validar con festivos reales de Alicante**, incluidos los locales, cuando haya acceso a la API.

## Limitaciones del análisis

- Festivos aproximados (ver arriba).
- Un único orden del grupo: el de `doctors.json`. Ambos métodos dependen del orden; las Ruedas mucho más.
- Las ruedas se reinician cada año. No se modela la continuidad entre años, ni las bajas, vacaciones o cambios manuales posteriores.
