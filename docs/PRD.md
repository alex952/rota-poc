# Documento de Requisitos de Producto: Aplicación de Asignación de Guardias Médicas

**Versión:** 1.0
**Fecha:** 2026-03-12
**Estado:** Borrador - Alcance PoC
**Fuente:** REQUIREMENTS.md

---

## 1. Descripción del Producto

La aplicación de asignación de guardias médicas automatiza la planificación de servicios de guardia para médicos. El sistema calcula las asignaciones anuales de guardia garantizando equidad y cumplimiento de los requisitos mínimos de horas, y proporciona una interfaz visual para visualizar y gestionar el calendario.

Se trata de una **Prueba de Concepto (PoC)** — la autenticación, autorización y los aspectos de seguridad en producción quedan explícitamente fuera del alcance.

---

## 2. Glosario

| Término | Definición |
|---------|-----------|
| **Atención Continuada (AC)** | Guardia principal del día. Grupo de médicos separado. Mínimo 1.620 horas/año (135h/mes de media) por médico. |
| **Atención Primaria (AP)** | Refuerzo diario de la guardia AC. Grupo de médicos separado. Mínimo 425 horas/año por médico. |
| **Rota** | El calendario de guardias del año, generado de forma independiente por tipo de servicio. |
| **Pool** | El conjunto de médicos disponibles para la asignación de guardias en un año determinado. AC y AP tienen grupos **separados** — un médico pertenece a un solo grupo. |
| **Festivo** | Un día festivo público (nacional, autonómico o local) para la ciudad del hospital en España. |
| **doctors_per_day** | Cobertura base: **1 médico/día** para AC y AP. En festivos, AP se dobla a 2 médicos. No se calcula automáticamente. |

---

## 3. Funcionalidades

### 3.1 — Generación de Rota

**Descripción:** Dado un grupo de médicos y un año objetivo, el sistema calcula un calendario de guardias completo para todo el año que satisface todas las restricciones.

#### Reglas de Negocio

- RN-1: Cada médico de AC debe tener asignadas **al menos 1.620 horas/año** (135h/mes de media durante 12 meses) de Atención Continuada. Es una **restricción dura** — el algoritmo genera un error si no se cumple.
- RN-2: Cada médico de AP debe tener asignadas **al menos 425 horas/año** de Atención Primaria. Es una **restricción dura** — el algoritmo genera un error si no se cumple.
- RN-3: La duración de los turnos depende de la rota y del tipo de día:
  | Rota / rol | Lunes–Viernes | Sábado | Domingo / Festivo |
  |------------|---------------|--------|--------------------|
  | AC (primary) | 17 h (15:00 → 08:00+1) | 18 h (15:00 → 09:00+1) | 23 h (09:00 → 08:00+1) |
  | AP (refuerzo del día) | 7 h (15:00 → 22:00) | 7 h (15:00 → 22:00) | 12 h × 2 médicos (10:00 → 22:00) |
- RN-4: El calendario debe ser **equitativo** — los médicos deben tener el mismo número (o lo más cercano posible) de cada tipo de día asignado y el total de horas.
- RN-5: AC y AP tienen **grupos de médicos separados**. Un médico pertenece a un solo grupo. Las rotas se generan de forma independiente por tipo.
- RN-6: Los domingos que también son festivos cuentan como un único turno Domingo/Festivo (sin doble conteo).
- RN-7: La cobertura primary base es **siempre 1 médico por día**, tanto para AC como para AP. La única cobertura adicional es el segundo AP en festivos. Si el pool es demasiado grande para que todos los médicos alcancen su target con esa cobertura, el algoritmo rechaza la generación con `InfeasiblePoolError` ("El grupo … es demasiado grande …").
- RN-8: **Día de descanso post-guardia** — un médico que está de guardia el día D **no está disponible** para asignación el día D+1. Los días de descanso aplican **por tipo de rota únicamente** (los descansos de AC no afectan a AP y viceversa, ya que los grupos son separados). Restricción blanda para grupos con menos de 4 médicos.
- RN-9: Las asignaciones de guardia deben tener **máxima variación de grupo** — el algoritmo usa un puntero round-robin deslizante para evitar que el mismo subconjunto de médicos sea asignado siempre junto.
- RN-10: Si un festivo cae en sábado, se clasifica como **festivo** (turno de 23h para AC, 12h para AP), no como sábado. La clasificación de festivo siempre tiene prioridad.
- RN-11: **AP en festivos**: el algoritmo asigna **2 médicos AP primary** en cada festivo, cada uno con turno de 12 h (10:00 → 22:00). Ambos cuentan como asignación primaria a efectos de equidad y horas mínimas. **En el resto de días, AP asigna exactamente 1 médico** con turno de 7 h, independientemente del tamaño del pool. Si el pool es demasiado grande para que todos los médicos cumplan 425 h con esa cobertura, el algoritmo rechaza la generación con `InfeasiblePoolError`.
#### Criterios de Aceptación

| ID | Criterio |
|----|---------|
| CA-3.1.1 | **Dado** un grupo válido de médicos, un tipo de rota (AC o AP) y un año objetivo, **cuando** se llama al endpoint de generación de rota, **entonces** se devuelve un calendario completo de 365/366 días con `doctors_per_day` médicos asignados por día. |
| CA-3.1.2 | **Dada** una rota AC generada, **cuando** se suman las horas individuales de cada médico, **entonces** todos los médicos tienen >= 1.620 horas/año (restricción dura — error si no se cumple). |
| CA-3.1.3 | **Dada** una rota AP generada, **cuando** se suman las horas individuales de cada médico, **entonces** todos los médicos tienen >= 425 horas/año (restricción dura — error si no se cumple). |
| CA-3.1.4 | **Dada** una rota generada, **cuando** se comparan las horas totales entre médicos, **entonces** la diferencia entre el médico con más horas y el médico con menos horas se minimiza (objetivo: <= 1 turno de diferencia por tipo de día). |
| CA-3.1.5 | **Dada** una rota generada, **cuando** se inspeccionan festivos y domingos, **entonces** usan la duración de turno de 23 horas (09:00→08:00+1). |
| CA-3.1.6 | **Dada** una rota generada, **cuando** se inspeccionan los sábados, **entonces** usan la duración de turno de 18 horas (15:00→09:00+1). |
| CA-3.1.7 | **Dada** una rota generada, **cuando** se inspeccionan los días laborables (Lun-Vie, no festivos), **entonces** usan la duración de turno de 17 horas (15:00→08:00+1). |
| CA-3.1.8 | **Dado** un año, **cuando** se genera la rota, **entonces** el sistema obtiene y clasifica correctamente los festivos públicos para la ciudad configurada. |
| CA-3.1.9 | **Dados** grupos separados de AC y AP, **entonces** los médicos pertenecen a un solo grupo y las rotas se generan de forma independiente por tipo. |
| CA-3.1.10 | **Dado** que un médico está de guardia el día D, **entonces** ese médico no tiene asignación el día D+1 dentro del mismo tipo de rota (día de descanso solo por tipo). |
| CA-3.1.11 | **Dada** una rota generada, **cuando** se examinan qué médicos son asignados juntos en diferentes días, **entonces** el algoritmo varía las agrupaciones (ningún grupo fijo de médicos es siempre asignado junto). |
| CA-3.1.12 | **Dado** un festivo que cae en sábado, **entonces** ese día se clasifica como festivo (turno de 23h), no como sábado (18h). |
| CA-3.1.13 | **Dado** un grupo de médicos, **cuando** el algoritmo se ejecuta, **entonces** la cobertura primary base es exactamente 1 médico/día. Si el pool excede la capacidad anual de cobertura, se lanza `InfeasiblePoolError`. |
| CA-3.1.14 | **Dada** una rota AP generada, **cuando** se inspeccionan los festivos, **entonces** cada festivo tiene **2 médicos AP primary asignados** con turnos de 12 h (10:00→22:00). |
| CA-3.1.15 | **Dada** una rota AP generada, **cuando** se inspeccionan los laborables y sábados, **entonces** cada día tiene 1 médico AP asignado con turno de 7 h (15:00→22:00). |

---

### 3.2 — Persistencia y Consulta de Rota

**Descripción:** Las rotas generadas se almacenan y pueden consultarse para un año determinado.

#### Criterios de Aceptación

| ID | Criterio |
|----|---------|
| CA-3.2.1 | **Dada** una rota generada para el año Y y tipo T, **cuando** se llama al endpoint de consulta con año Y y tipo T, **entonces** se devuelve la rota almacenada. |
| CA-3.2.2 | **Dada** la ausencia de rota para el año Y y tipo T, **cuando** se llama al endpoint de consulta, **entonces** se devuelve una respuesta 404 o vacía indicando que no existe rota. |
| CA-3.2.3 | **Dada** una rota almacenada, **cuando** se consulta con un filtro de médico, **entonces** solo se devuelven las asignaciones de ese médico. |
| CA-3.2.4 | **Dada** una rota re-generada para un año/tipo que ya tiene una, **entonces** la rota anterior para ese tipo se reemplaza completamente. |

---

### 3.3 — Sustitución de Médico

**Descripción:** Un médico específico en una rota existente puede ser reemplazado por otro médico para una asignación concreta.

#### Criterios de Aceptación

| ID | Criterio |
|----|---------|
| CA-3.3.1 | **Dada** una rota almacenada y una solicitud de sustitución válida (fecha, médico antiguo, médico nuevo), **cuando** se realiza la sustitución, **entonces** la asignación para esa fecha refleja el nuevo médico. |
| CA-3.3.2 | **Dada** una sustitución, **cuando** se recalculan las estadísticas de la rota, **entonces** los totales de horas reflejan el cambio. |
| CA-3.3.3 | **Dada** una rota AP con festivo y 2 médicos AP, **cuando** se reemplaza uno de los dos, **entonces** el otro permanece y el nuevo aparece en el día. |

---

### 3.4 — Resolución de Festivos

**Descripción:** El sistema obtiene los festivos públicos para la ciudad configurada del hospital en España para clasificar correctamente los tipos de día. La ciudad es una **configuración a nivel de aplicación** establecida antes de ejecutar la aplicación, compartida por el backend y el frontend.

#### Criterios de Aceptación

| ID | Criterio |
|----|---------|
| CA-3.4.1 | **Dada** la ciudad configurada y un año objetivo, **cuando** se obtienen los festivos, **entonces** se incluyen los festivos nacionales, autonómicos y locales. |
| CA-3.4.2 | **Dados** los festivos obtenidos, **cuando** se genera la rota, **entonces** las fechas festivas se clasifican como tipo de día Domingo/Festivo (turnos de 23 horas). |
| CA-3.4.3 | **Dado** que la fuente externa de festivos no está disponible, **cuando** se genera la rota, **entonces** el sistema devuelve un error apropiado en lugar de generar un calendario incorrecto. |
| CA-3.4.4 | **Dado** un sábado que también es festivo, **entonces** se clasifica como festivo (23h), no como sábado (18h). |

---

### 3.5 — Estadísticas de Rota

**Descripción:** El sistema devuelve estadísticas por médico junto con la rota.

#### Criterios de Aceptación

| ID | Criterio |
|----|---------|
| CA-3.5.1 | **Dada** una rota generada o almacenada, **cuando** se solicitan estadísticas, **entonces** la respuesta incluye por médico: horas totales, desglose mensual de horas, recuento de turnos por tipo de día (laborable/sábado/domingo-festivo). |
| CA-3.5.2 | **Dadas** las estadísticas, **cuando** se revisa la equidad, **entonces** las estadísticas muestran claramente cualquier desequilibrio entre médicos. |

---

### 3.6 — Interfaz de Usuario: Vista de Calendario

**Descripción:** Una interfaz web muestra la rota en un diseño de dos columnas con vista de calendario.

#### Criterios de Aceptación

| ID | Criterio |
|----|---------|
| CA-3.6.1 | **Dada** la carga de la interfaz, **cuando** existe una rota para el año seleccionado, **entonces** el calendario muestra todas las asignaciones para cada día de cada mes. |
| CA-3.6.2 | **Dada** la carga de la interfaz, **cuando** no existe rota para el año seleccionado, **entonces** el calendario está vacío y el botón de generar muestra "Generar cuadrante {AC|AP}" (según la pestaña activa). |
| CA-3.6.3 | **Dada** una rota existente, **entonces** el botón de generar muestra "Regenerar cuadrante {AC|AP}" (según la pestaña activa). |
| CA-3.6.4 | **Dado** que el usuario hace clic en "Regenerar cuadrante {AC|AP}", **entonces** aparece un diálogo de confirmación advirtiendo que la rota actual será reemplazada antes de continuar. |
| CA-3.6.5 | **Dada** la interfaz, **entonces** hay un selector de año visible que por defecto muestra el año actual. |
| CA-3.6.6 | **Dado** que el usuario cambia el año, **entonces** el calendario recarga los datos del año seleccionado. |
| CA-3.6.7 | **Dada** la carga de la interfaz, **entonces** el nombre de la ciudad configurada se muestra en la interfaz. |
| CA-3.6.9 | **Dada** una celda de calendario con AP asignados, **entonces** cada médico AP se muestra con el prefijo `R:` para indicar su rol de refuerzo del día. |
| CA-3.6.10 | **Dado** un festivo con 2 médicos AP asignados, **entonces** la celda del calendario muestra ambos médicos AP, cada uno con prefijo `R:`. |

---

### 3.7 — Interfaz de Usuario: Panel de Grupo de Médicos

**Descripción:** El panel izquierdo muestra el grupo de médicos disponibles para asignación.

#### Criterios de Aceptación

| ID | Criterio |
|----|---------|
| CA-3.7.1 | **Dada** la carga de la interfaz, **entonces** el panel izquierdo muestra tarjetas de médicos pre-cargadas desde un archivo de configuración estático. |
| CA-3.7.2 | **Dada** una tarjeta de médico, **entonces** muestra el nombre y el departamento del médico. |
| CA-3.7.3 | **Dado** que el usuario hace clic en "Añadir médico", **entonces** puede añadir un nuevo médico al grupo (nombre, departamento). |
| CA-3.7.4 | **Dadas** las tarjetas de médico, **entonces** se pueden arrastrar y soltar en las celdas del calendario con guardia; al soltar se abre un diálogo para **añadir** el médico a la guardia del día o **sustituir** a uno de los ya asignados. Si el médico ya está asignado ese día se muestra un aviso y no se abre el diálogo. |
| CA-3.7.5 | **Dado** el fondo del panel izquierdo, **entonces** los botones de "Añadir médico" y "Generar cuadrante {AC|AP}" / "Regenerar cuadrante {AC|AP}" son visibles. |

---

### 3.8 — Interfaz de Usuario: Panel de Estadísticas

**Descripción:** Un panel lateral oculto muestra las estadísticas de rota por médico.

#### Criterios de Aceptación

| ID | Criterio |
|----|---------|
| CA-3.8.1 | **Dada** una rota cargada, **cuando** el usuario abre el panel de estadísticas, **entonces** se muestran los desgloses de horas por médico. |
| CA-3.8.2 | **Dado** el panel de estadísticas, **entonces** muestra las horas totales, el desglose mensual de horas y los recuentos de turnos por tipo de día para cada médico. El panel de estadísticas tiene un selector AC/AP para mostrar las estadísticas del tipo activo. |
| CA-3.8.3 | **Dado** que el panel de estadísticas está cerrado por defecto, **entonces** se puede alternar entre abierto y cerrado. |

---

## 4. Fuera de Alcance (PoC)

Lo siguiente queda explícitamente **fuera del alcance** de esta PoC:

- Autenticación y autorización de usuarios
- Control de acceso basado en roles
- Registro de auditoría
- Soporte multi-hospital / multi-ubicación
- Preferencias o restricciones de disponibilidad del médico (p. ej., vacaciones, conflictos)
- Deshacer/rehacer cambios de rota
- Sistema de notificaciones (email/SMS)
- Diseño adaptable para móviles (solo escritorio es aceptable)
- Despliegue en producción (solo entornos locales y basados en Docker)

---

## 5. Supuestos

1. Los médicos pertenecen al grupo AC o al grupo AP, no a ambos. Los grupos se gestionan por separado.
2. La cobertura base es **1 médico/día** para ambos tipos de rota. En festivos, AP se dobla a 2 médicos. Esta cobertura es fija, no se calcula automáticamente.
3. La ciudad del hospital para la resolución de festivos es **configurable a nivel de aplicación** (configuración estática establecida antes de ejecutar la aplicación), compartida por el backend y el frontend.
4. El archivo de configuración estático de médicos es un archivo JSON simple incluido con el frontend, donde cada médico especifica su `rota_type` (AC o AP).
5. "Equitativo" significa minimizar la diferencia máxima en horas totales y en recuento por tipo de día entre todos los médicos dentro de un tipo de rota.
6. Un médico de guardia el día D tiene un día de descanso obligatorio en D+1 dentro del mismo tipo de rota. Los descansos de AC no afectan a AP y viceversa.
7. Las horas mínimas son **restricciones duras**: los médicos de AC deben alcanzar 1.620h/año (135h/mes × 12), los médicos de AP deben alcanzar 425h/año.

---

## 6. Decisiones Resueltas

Estas eran inicialmente preguntas abiertas, ahora resueltas con aportaciones de las partes interesadas:

| # | Pregunta | Resolución |
|---|---------|------------|
| DR-1 | ¿Deben AC y AP compartir un único grupo de médicos? | **No.** AC y AP tienen grupos separados. Un médico pertenece a un solo grupo. Las rotas se generan de forma independiente por tipo. |
| DR-2 | ¿Para qué ciudad española específica se deben resolver los festivos? ¿Debe ser configurable? | **Configurable a nivel de aplicación.** La ciudad es una configuración estática a nivel de aplicación establecida antes de ejecutar la aplicación. Se aplica tanto al backend (resolución de festivos) como al frontend (mostrado en la interfaz). |
| DR-3 | ¿Hay un número máximo de días de guardia consecutivos para un médico? | **Implícito mediante la regla de día de descanso.** Un médico de guardia el día D descansa el D+1, por lo que las guardias consecutivas son imposibles. Además, las asignaciones deben ser lo más dispersas posible. |
| DR-4 | ¿Los festivos que caen en sábado deben usar horas de sábado o de festivo? | **El festivo tiene prioridad.** Un sábado que es festivo público usa el turno de festivo de 23 horas, no el turno de sábado de 18 horas. |
| DR-5 | ¿AngularJS (1.x, EOL) vs Angular (v19+)? | **Angular v19+.** Se usará el framework moderno y mantenido activamente. |
| DR-6 | ¿Cuántos médicos por día por tipo de rota? | **Cobertura base fija: 1 médico/día** para AC y AP. En festivos, AP se dobla a 2 médicos. No es un parámetro de usuario. |
| DR-7 | ¿Las horas mínimas son restricciones blandas o duras? | **Restricciones duras.** El algoritmo lanza un `InfeasiblePoolError` si algún médico no alcanza el mínimo. |
| DR-8 | ¿Las horas mínimas de AC son anuales o mensuales? | **Promedio mensual.** Los médicos de AC necesitan 135h/mes × 12 = 1.620h/año. El algoritmo valida el total anual. |
