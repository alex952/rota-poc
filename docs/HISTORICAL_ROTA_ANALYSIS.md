# Análisis de Rotas Históricas

**Fuentes:**
- **PAS Aaiún** — Documentos de rota mensual programados manualmente (Ene 2026 – Ene 2027), hospital de despliegue militar
- **PAS Alicante Sur** — Documentos de rota mensual programados manualmente (Ene 2026 – Ene 2027), hospital doméstico

Ambos cubren asignaciones de AC (Atención Continuada / PAS). Este documento captura patrones y lecciones de rotas programadas por humanos reales para guiar la alineación futura del algoritmo.

---

## Composición del Grupo

### Aaiún

| Rol | Cantidad | Detalles |
|-----|---------|---------|
| Médicos principales (AC/PAS) | 4 | Isabel, Marina, Cynthia, Cesar |
| Referencias de refuerzo AP | 21 | Numerados `R:1` a `R:21`; se refieren a personal de refuerzo de Atención Primaria, no residentes, y no forman parte de la rotación principal de AC/PAS |
| Sustitutos de vacaciones | ~25 entradas | Etiquetados `VAC/N`, cubren durante las ausencias de los médicos principales |
| Sustitutos junior | ~12 entradas | Etiquetados `J/N`, aparecen Oct–Dic (posiblemente reemplazando a Isabel) |

**Notable:** Isabel desaparece de los totales de horas mensuales a partir de octubre y está ausente del resumen anual. Parece haber sido parcial o totalmente reemplazada por sustitutos J/ y VAC/ — lo que sugiere una salida a mediados de año o una baja prolongada.

### Alicante Sur

| Rol | Cantidad | Detalles |
|-----|---------|---------|
| Médicos principales (AC/PAS) | 5 (4 puestos efectivos) | Miguel A, Paula, Fabiola, Ruth, Jessica |
| Referencias de refuerzo AP | 17 | Numerados `R:1` a `R:17`; se refieren a personal de refuerzo de Atención Primaria, no residentes, y no forman parte de la rotación principal de AC/PAS |
| Sustitutos de vacaciones | Presentes | Etiquetados `VAC N`, usados durante los meses de verano y otoño |

**Notable:** Ruth y Jessica son **siempre asignadas juntas** el mismo día — cada celda lee "Ruth | Jessica" o "Jessica | Ruth". Comparten un único puesto de rotación (trabajo compartido / media jornada), haciendo que el grupo efectivo sea de **4 puestos de rotación** a pesar de tener 5 médicos nombrados. Sus horas mensuales son casi idénticas (diferencia de 0-2h en solo 3 de los 12 meses). Los documentos incluyen anotaciones `Horas Ruth:N` y `Horas Paula:N` para rastrear ajustes de horas parciales para el puesto compartido.

**Miguel A sistemáticamente con menos horas:** Miguel promedia 141h/mes frente a ~147h de los demás, con 4 meses por debajo de 135h (Feb: 126h, Abr: 133h, Jul: 126h, Oct: 127h). Este patrón de exactamente 126h (= ~7 turnos de día laborable × 17h + 1 fin de semana) sugiere que sistemáticamente recibe menos turnos de fin de semana/festivo — una debilidad conocida de las rotaciones rígidas sin equilibrio de tipo de día.

---

## Patrón de Rotación

Ambos centros usan una **rotación estricta de 4 puestos** sin ninguna desviación (verificado en todos los meses):

### Aaiún

```
Día 1: Isabel    Día 5: Isabel    Día 9: Isabel   ...
Día 2: Marina    Día 6: Marina    Día 10: Marina  ...
Día 3: Cynthia   Día 7: Cynthia   Día 11: Cynthia ...
Día 4: Cesar     Día 8: Cesar     Día 12: Cesar   ...
```

### Alicante Sur

```
Día 1: Miguel A       Día 5: Miguel A       ...
Día 2: Paula          Día 6: Paula          ...
Día 3: Ruth/Jessica   Día 7: Ruth/Jessica   ...
Día 4: Fabiola        Día 8: Fabiola        ...
```

Ambos dan a cada puesto:
- **1 turno cada 4 días** (3 días completos de descanso entre turnos)
- **~7-8 turnos/mes**
- **~91 turnos/año**

La rotación es completamente determinista — sin lógica de optimización, sin equilibrio por tipo de día. El tipo de día (laborable/sábado/festivo) que cae en tu puesto de rotación es el que te corresponde.

---

## Horas Mensuales

### Aaiún — Totales Mensuales por Médico (2026)

| Mes | Cynthia | Cesar | Marina | Promedio | Diferencia |
|-----|---------|-------|--------|---------|-----------|
| Ene | 144 | 138 | 149 | 143.7 | 11h |
| Feb | 147 | 145 | 145 | 145.7 | 2h |
| Mar | 138 | 149 | 149 | 145.3 | 11h |
| Abr | 144 | 156 | 150 | 150.0 | 12h |
| May | 149 | 145 | 144 | 146.0 | 5h |
| Jun | 153 | 150 | 154 | 152.3 | 4h |
| Jul | 150 | 143 | 150 | 147.7 | 7h |
| Ago | 149 | 138 | 150 | 145.7 | 12h |
| Sep | 140 | 143 | 140 | 141.0 | 3h |
| Oct | 150 | 151 | 156 | 152.3 | 6h |
| Nov | 152 | 145 | 150 | 149.0 | 7h |
| Dic | 149 | 144 | 151 | 148.0 | 7h |

**Diferencia mensual:** 2h–12h (media 6.8h). Isabel excluida — no completó el año completo.

### Alicante Sur — Totales Mensuales por Médico (2026)

| Mes | Ruth | Jessica | Fabiola | Paula | Miguel A | Promedio | Diferencia |
|-----|------|---------|---------|-------|----------|---------|-----------|
| Ene | 144 | 144 | 138 | 149 | 150 | 145.0 | 12h |
| Feb | 140 | 140 | 145 | 145 | 126 | 139.2 | 19h |
| Mar | 138 | 140 | 149 | 149 | 144 | 144.0 | 11h |
| Abr | 144 | 144 | 156 | 150 | 133 | 145.4 | 23h |
| May | 149 | 149 | 145 | 144 | 149 | 147.2 | 5h |
| Jun | 146 | 147 | 150 | 147 | 144 | 146.8 | 6h |
| Jul | 150 | 150 | 143 | 150 | 126 | 143.8 | 24h |
| Ago | 149 | 149 | 138 | 150 | 144 | 146.0 | 12h |
| Sep | 140 | 140 | 143 | 140 | 143 | 141.2 | 3h |
| Oct | 150 | 150 | 151 | 156 | 127 | 146.8 | 29h |
| Nov | 152 | 152 | 149 | 150 | 149 | 150.4 | 3h |
| Dic | 150 | 150 | 144 | 151 | 152 | 149.4 | 8h |

**Diferencia mensual:** 3h–29h (media 12.9h). Significativamente más amplia que Aaiún, impulsada principalmente por la infraasignación de Miguel A en fines de semana.

### Patrones de Horas

Las horas base a menudo caen en **126h** (≈ 7 turnos de día laborable × 17h + 1 parcial) o **143-149h**, con ajustes manuales de **+7h, +12h, +21h** añadidos para alcanzar el objetivo. Estos ajustes probablemente provienen de cubrir turnos extra, sustituciones de vacaciones o horas de compensación. Este patrón es consistente en ambos centros.

### Totales Anuales

**Aaiún** (del documento de diciembre):

| Médico | Horas Brutas | Tras Deducción de Vacaciones |
|--------|-------------|----------------------------|
| Cynthia | 1.765h | 1.567h |
| Cesar | 1.747h | 1.622h |
| Marina | 1.788h | 1.643h |
| **Diferencia** | **41h** | **76h** |

**Alicante Sur** (calculado a partir de totales mensuales):

| Médico | Horas 2026 |
|--------|-----------|
| Ruth | 1.752h |
| Jessica | 1.755h |
| Fabiola | 1.751h |
| Paula | 1.781h |
| Miguel A | 1.687h |
| **Diferencia** | **94h** |

La expectativa teórica para una rotación estricta de 4 puestos durante 365 días es ~1.644h/año (~137h/mes). Ambos centros superan esto — el excedente proviene de cubrir los turnos de médicos ausentes y trabajo de sustitución. La diferencia más amplia de Alicante Sur (94h frente a 41h) se debe casi en su totalidad a que Miguel A es sistemáticamente infraasignado en fines de semana.

---

## Estructura de Turnos

Para la propia rota AC/PAS, ambos centros usan la misma estructura de turno diario básica:

1. **Un médico AC/PAS principal** (o una pareja de trabajo compartido) del grupo
2. **Horarios y duraciones de turno** que coinciden con la clasificación de tipo de día de nuestro algoritmo:
   - Día laborable: 17h (15:00-08:00+1)
   - Sábado: 18h (15:00-09:00+1)
   - Festivo/Domingo: 23h (09:00-08:00+1)

Aclaración importante sobre la notación y el alcance:
- `R:N` **no** significa residente; significa **refuerzo** y se refiere a cobertura de **Atención Primaria (AP)**
- Por tanto, esas entradas `R:` no deben tratarse como parte del modelo de dotación AC/PAS analizado aquí
- El personal de Atención Continuada con contrato especial es una **plantilla exclusiva de guardia**, no un grupo de programación recurrente normal comparable a la rotación de médicos principales AC/PAS

Notaciones especiales encontradas en los documentos:
- `X/N` — aparece ~una vez por médico por mes; probablemente un día de compensación o servicio especial
- `VAC/N` o `VAC N` — médico sustituto de vacaciones que cubre un turno numerado
- `J/N` — médico junior o de reemplazo (solo Aaiún, concentrado en Oct-Dic)
- `Permiso` — día de permiso/baja
- `Horas Nombre:N` — anotaciones de seguimiento de horas parciales (Alicante Sur, para la división del trabajo compartido)

---

## Conclusiones Clave para la Alineación del Algoritmo

### 1. Los grupos reales son pequeños (4 puestos efectivos)

Ambos centros operan con **4 puestos de rotación efectivos** — Aaiún tiene 4 médicos, Alicante Sur tiene 5 médicos pero 2 (Ruth/Jessica) comparten un puesto. Esto es mucho más pequeño que nuestros datos de prueba (20 por grupo). El algoritmo debe funcionar bien con grupos de 4-5 médicos, que es el escenario operativo realista.

### 2. La rotación estricta es la línea de base humana

Ambos centros usan una rotación secuencial simple sin optimización. Aaiún logra una equidad mensual razonable (~7h de diferencia) porque la rotación fija es intrínsecamente justa con el tiempo. Sin embargo, Alicante Sur muestra la debilidad: sin equilibrio de tipo de día, los médicos individuales pueden ser sistemáticamente infraasignados o sobreasignados en fines de semana (diferencia anual de 94h de Miguel A). Nuestro algoritmo debe igualar la equidad de Aaiún como mínimo y mejorar sobre la de Alicante Sur.

### 3. El trabajo compartido es real

Alicante Sur demuestra que dos médicos pueden compartir un único puesto de rotación. Ruth y Jessica aparecen siempre juntas, con horas casi idénticas (diferencia de 0-2h). Esto no está modelado actualmente en nuestro sistema. **Una futura funcionalidad podría permitir definir un "puesto compartido" donde dos médicos dividan una posición de rotación.**

### 4. La notación de refuerzo AP no debe modelarse como dotación secundaria de AC

La notación `R:N` en las rotas de origen se refiere a **refuerzo AP**, no a residentes. Esto significa que este análisis **no** debe inferir un segundo nivel de dotación AC a partir de esas entradas. Esto se alinea con la implementación actual: el generador ya acepta un `rota_type` y produce **rotas AC y AP separadas con grupos separados**, en lugar de tratar el refuerzo AP como una segunda capa dentro de la rota AC.

### 5. Los ajustes manuales son la norma

Las adiciones de `+7h`, `+12h`, `+21h` en los totales mensuales muestran que los calendarios reales requieren ajustes post-generación. Nuestra función de sustitución mediante arrastrar y soltar responde directamente a esta necesidad. El algoritmo produce una línea de base; los humanos siempre ajustarán.

### 6. La gestión de vacaciones es ad hoc

La cobertura de vacaciones se gestiona mediante médicos sustitutos (VAC/, J/) en lugar de redistribuir entre el grupo restante. Esto sugiere una futura funcionalidad: generación con conciencia de vacaciones que excluya médicos para rangos de fechas o inserte sustitutos nombrados.

### 7. Los cambios de grupo ocurren a mitad del año

La salida de Isabel muestra que los cambios de composición del grupo durante el año son reales. El sistema debería admitir la regeneración de una rota cuando los médicos se unen o se marchan, preservando las asignaciones ya realizadas donde sea posible.

### 8. El mínimo de 135h/mes de AC coincide con la realidad

Ambos centros muestran horas mensuales reales agrupadas en torno a 126-156h, con el objetivo claramente en el rango de 135-150h. Nuestra restricción dura de 1.620h/año (135h/mes x 12) está bien calibrada con las expectativas del mundo real.

### 9. La equidad de tipo de día es una mejora clara respecto al método manual

La rotación humana rígida significa que la distribución de sábados/festivos es aleatoria. Los datos de Alicante Sur demuestran que esto causa una inequidad real — Miguel A sistemáticamente obtiene menos fines de semana, terminando 94h por debajo del médico con más horas anuales. Nuestro algoritmo equilibra activamente la distribución de tipos de día (recuentos laborable/sábado/festivo dentro de ±1), lo que aborda directamente esta debilidad observada.

### 10. AC y AP se tratan correctamente como dominios de planificación separados en el sistema actual

La notación clarificada hace la separación más limpia: las entradas `R:` pertenecen al **refuerzo AP**, mientras que la rota principal analizada aquí es la rotación de médicos **AC/PAS**. Además, algunos médicos de Atención Continuada tienen un **contrato especial exclusivo de guardia**, por lo que no deben tratarse como parte de un grupo de programación mensual normal. Esto valida el diseño actual del sistema, donde el flujo de generación de rota ya maneja AC y AP de forma independiente por tipo de rota, con grupos separados y pasadas de generación separadas.

---

## Comparación entre Centros

| Métrica | Aaiún | Alicante Sur |
|---------|-------|--------------|
| Puestos de médicos principales | 4 | 4 (5 médicos, 1 trabajo compartido) |
| Médicos por día | 1 | 1 (o 2 compartidos) |
| Tipo de rotación | Estricta 4 días | Estricta 4 días |
| Referencias de refuerzo AP en documentos fuente | `R:1`-`R:21` | `R:1`-`R:17` |
| Rango de horas mensuales | 138-156h | 126-156h |
| Diferencia mensual (promedio) | 6.8h | 12.9h |
| Diferencia anual | 41h | 94h |
| Sustitutos de vacaciones | VAC/, J/ | VAC |
| Trabajo compartido | No | Sí (Ruth/Jessica) |
| Cambio de grupo a mitad de año | Sí (Isabel) | No |

Los patrones son llamativamente consistentes en ambos centros a pesar de las diferentes ubicaciones, personal y contextos operativos. La rotación estricta de 4 días de AC/PAS, los ajustes manuales de horas y la gestión ad hoc de vacaciones parecen ser práctica estándar en el sistema de hospitales militares españoles. El aparente patrón anterior de "dos niveles" debe entenderse en cambio como notación de refuerzo AP separada junto a la rota AC, más personal AC con contrato exclusivo de guardia fuera del grupo de programación normal.

---

## Consideraciones Futuras

Basándose en este análisis, posibles mejoras futuras a explorar:

- **Modelado de AC en guardia con contrato especial** — si se necesita en el futuro, modelar el contrato exclusivo de guardia de Atención Continuada explícitamente como su propio modo de planificación, en lugar de integrarlo en la rota AC estándar
- **Generación con conciencia de vacaciones** — aceptar rangos de fechas donde los médicos no están disponibles, insertar automáticamente sustitutos
- **Regeneración a mitad de año** — gestionar cambios de grupo (incorporaciones/salidas) sin reconstruir todo el año
- **Seguimiento de ajustes manuales** — registrar y mostrar los ajustes de horas post-generación (el patrón +7h, +12h)
- **Optimización para grupos pequeños** — garantizar que el algoritmo degrada graciosamente a una rotación simple para grupos de 3-4, ya que eso coincide con la línea de base del mundo real
- **Soporte de trabajo compartido** — permitir que dos médicos compartan un único puesto de rotación, dividiendo las horas y haciendo seguimiento individualmente
