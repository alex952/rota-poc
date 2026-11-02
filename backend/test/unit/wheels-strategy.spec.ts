import { AC_POOL_4, AP_POOL_12, HOLIDAYS_2026, YEAR_2026, toHolidaySet } from '../helpers/fixtures';

import { InfeasiblePoolError, generateRota } from '../../src/scheduling/assignment.service';
import { classifyYear } from '../../src/holidays/holidays.service';
import { DayInfo, DoctorInput } from '../../src/scheduling/scheduling.types';
import { toIsoDate } from '../../src/common/date.utils';
import {
  assignWithWheels,
  staggeredInitialPointers,
  wheelsStrategy,
} from '../../src/scheduling/strategies/wheels.strategy';
import { balancedStrategy } from '../../src/scheduling/strategies/balanced.strategy';
import {
  ASSIGNMENT_STRATEGIES,
  getAssignmentStrategy,
} from '../../src/scheduling/strategies';

function addDaysUtc(isoDate: string, days: number): Date {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

const pool: DoctorInput[] = ['A', 'B', 'C', 'D'].map((id) => ({
  id,
  name: `Dr. ${id}`,
  department: 'Medicina General',
}));

// Construye un día con el tipo derivado de la fecha; `publicHoliday` fuerza un festivo oficial.
function day(isoDate: string, publicHoliday = false): DayInfo {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  const weekday = date.getUTCDay();
  const dayType = publicHoliday || weekday === 0 ? 'holiday' : weekday === 6 ? 'saturday' : 'weekday';
  return {
    date,
    dayType,
    publicHoliday,
    durationHours: 10,
    shiftStart: '15:00',
    shiftEnd: '08:00+1',
  };
}

function run(days: DayInfo[], required: number[] = days.map(() => 1), doctors = pool): string[][] {
  return wheelsStrategy
    .assign({ pool: doctors, days, requiredByDay: required })
    .map((chosen) => chosen.map((doctor) => doctor.id));
}

// Mecánica pura de las ruedas: punteros explícitos a 0 (no el arranque escalonado del producto).
function runFromZero(days: DayInfo[], required: number[] = days.map(() => 1), doctors = pool): string[][] {
  return assignWithWheels(
    { pool: doctors, days, requiredByDay: required },
    { weekday: 0, saturday: 0, sunday: 0, holiday: 0 },
  ).map((chosen) => chosen.map((doctor) => doctor.id));
}

function poolOf(size: number): DoctorInput[] {
  return Array.from({ length: size }, (_, i) => ({
    id: `M${i}`,
    name: `Dr. M${i}`,
    department: 'Medicina General',
  }));
}

describe('Estrategia de ruedas (wheels)', () => {
  describe('arranque escalonado', () => {
    it('staggeredInitialPointers reparte los punteros: 0, ⌊N/4⌋, ⌊2N/4⌋, ⌊3N/4⌋', () => {
      expect(staggeredInitialPointers(4)).toEqual({ weekday: 0, saturday: 1, sunday: 2, holiday: 3 });
      expect(staggeredInitialPointers(17)).toEqual({ weekday: 0, saturday: 4, sunday: 8, holiday: 12 });
    });

    it.each([4, 17])('con N=%i cada rueda hace su primer turno en su índice inicial', (n) => {
      const doctors = poolOf(n);
      const pointers = staggeredInitialPointers(n);
      // Lunes laborable, sábado, domingo no festivo y festivo entre semana, sin días consecutivos.
      const days = [day('2026-01-12'), day('2026-01-17'), day('2026-01-25'), day('2026-02-04', true)];
      const result = run(days, undefined, doctors);
      expect(result).toEqual([
        [`M${pointers.weekday}`],
        [`M${pointers.saturday}`],
        [`M${pointers.sunday}`],
        [`M${pointers.holiday}`],
      ]);
      expect(result[1]).toEqual([`M${Math.floor(n / 4)}`]);
      expect(result[2]).toEqual([`M${Math.floor((2 * n) / 4)}`]);
      expect(result[3]).toEqual([`M${Math.floor((3 * n) / 4)}`]);
    });
  });

  it('un identificador desconocido lanza un error en español', () => {
    expect(() => getAssignmentStrategy('aleatoria' as never)).toThrow(
      'Método de asignación desconocido: aleatoria',
    );
  });

  it('se registra con su identificador', () => {
    expect(wheelsStrategy.id).toBe('wheels');
    expect(balancedStrategy.id).toBe('balanced');
    expect(getAssignmentStrategy('wheels')).toBe(wheelsStrategy);
    expect(Object.keys(ASSIGNMENT_STRATEGIES).sort()).toEqual(['balanced', 'wheels']);
  });

  it('recorre la rueda de laborables en el orden estricto de la lista', () => {
    const days = ['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09'].map((d) =>
      day(d),
    );
    expect(runFromZero(days)).toEqual([['A'], ['B'], ['C'], ['D'], ['A']]);
  });

  it('las ruedas son independientes (punteros a 0): el primer sábado lo hace el índice 0', () => {
    const days = ['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-10'].map((d) => day(d));
    expect(runFromZero(days)).toEqual([['A'], ['B'], ['C'], ['A']]);
  });

  it('un festivo en sábado o domingo va a la rueda de festivos; un domingo normal, a la de domingos', () => {
    const days = [
      day('2026-01-01', true), // jueves festivo -> rueda festivos (A)
      day('2026-01-04'), // domingo -> rueda domingos (A)
      day('2026-01-06', true), // martes festivo -> rueda festivos (B)
      day('2026-01-10', true), // sábado festivo -> rueda festivos (C), no la de sábados
      day('2026-01-11'), // domingo -> rueda domingos (B)
      day('2026-01-17'), // sábado normal -> rueda de sábados (A)
    ];
    expect(runFromZero(days)).toEqual([['A'], ['A'], ['B'], ['C'], ['B'], ['A']]);
  });

  it('salta y conserva el turno: el saltado es el primero en el siguiente turno de su rueda', () => {
    // A hace el viernes, así que el sábado se salta y se conserva su turno.
    const days = [
      '2026-01-02',
      '2026-01-03',
      '2026-01-04',
      '2026-01-05',
      '2026-01-06',
      '2026-01-07',
      '2026-01-08',
      '2026-01-09',
      '2026-01-10',
    ].map((d) => day(d));
    expect(runFromZero(days)).toEqual([
      ['A'],
      ['B'], // sábado: A (le tocaba) hizo el viernes, se salta
      ['A'], // domingo: índice 0 de la rueda de domingos
      ['B'],
      ['C'],
      ['D'],
      ['A'],
      ['B'],
      ['A'], // sábado siguiente: A recupera su turno
    ]);
  });

  describe('deuda contada', () => {
    const five: DoctorInput[] = ['A', 'B', 'C', 'D', 'E'].map((id) => ({
      id,
      name: `Dr. ${id}`,
      department: 'Medicina General',
    }));

    // Semanas completas (lunes a sábado) desde el lunes 2026-01-05; la semana
    // `weekWithHoliday` tiene el miércoles festivo (va a la rueda de festivos).
    function weeks(count: number, weekWithHoliday: number): DayInfo[] {
      const result: DayInfo[] = [];
      for (let week = 0; week < count; week += 1) {
        for (let offset = 0; offset < 6; offset += 1) {
          const date = toIsoDate(addDaysUtc('2026-01-05', week * 7 + offset));
          result.push(day(date, week === weekWithHoliday && offset === 2));
        }
      }
      return result;
    }

    it('cada salto suma una deuda aunque el médico ya fuera deudor, y se recuperan todas', () => {
      // Con 5 médicos la rueda de laborables da una vuelta exacta por semana: E hace
      // siempre el viernes y no puede hacer el sábado. Se salta a E dos veces (semanas 5 y
      // 9), acumulando dos deudas. En la semana 10 un festivo desplaza la fase y E queda
      // libre: debe recuperar sus dos turnos seguidos (semanas 10 y 11), no sólo uno.
      const days = weeks(12, 9);
      const assigned = runFromZero(days, days.map(() => 1), five);
      const saturdayDoctors = days
        .map((d, index) => (d.date.getUTCDay() === 6 ? assigned[index][0] : null))
        .filter((id) => id !== null);

      expect(saturdayDoctors.slice(0, 9)).toEqual(['A', 'B', 'C', 'D', 'A', 'B', 'C', 'D', 'A']);
      expect(saturdayDoctors.slice(9)).toEqual(['E', 'E', 'B']);
    });

    it('un médico con varias deudas no sale dos veces el mismo día', () => {
      const days = weeks(12, 9);
      // El sábado de la semana 10 (E con dos deudas) requiere 2 médicos.
      const required = days.map((d, index) => (index === 9 * 6 + 5 ? 2 : 1));
      const assigned = runFromZero(days, required, five);
      const chosen = assigned[9 * 6 + 5];
      expect(chosen).toHaveLength(2);
      expect(new Set(chosen).size).toBe(2);
      expect(chosen).toContain('E');
    });

    it('limitación conocida (resonancia): AC de 5 médicos sin festivos, el de los viernes no hace sábados', () => {
      // Los festivos especiales de sanidad (1 y 6 ene, 24, 25 y 31 dic) son siempre festivo:
      // se mira el tramo del 7 de enero al 23 de diciembre, sin ningún festivo.
      // Con 5 laborables por semana y 5 médicos la rueda de laborables da una vuelta
      // exacta cada semana, así que el viernes lo hace siempre el mismo médico. Como
      // el descanso le impide hacer el sábado, la rueda de sábados lo salta una y otra
      // vez y sólo acumula deuda: nunca llega a recuperarla mientras dure la resonancia.
      // Se documenta como limitación conocida del método (ver docs/ALGORITHM.md). El arranque
      // escalonado de producción sólo desplaza la fase de la rueda de sábados: el viernes sigue
      // siendo siempre el mismo médico y el descanso le sigue impidiendo el sábado, así que la
      // limitación se mantiene.
      const rota = generateRota(
        YEAR_2026,
        'AC',
        five,
        classifyYear(YEAR_2026, new Set()),
        undefined,
        'wheels',
      );
      const fridays = new Map<string, number>();
      const saturdays = new Map<string, number>();
      const window = rota.schedule.filter((entry) => {
        const iso = toIsoDate(entry.date);
        return iso >= '2026-01-07' && iso <= '2026-12-23';
      });
      for (const entry of window) {
        const weekday = entry.date.getUTCDay();
        const target = weekday === 5 ? fridays : weekday === 6 ? saturdays : null;
        for (const doctor of entry.doctors) {
          target?.set(doctor.doctorId, (target.get(doctor.doctorId) ?? 0) + 1);
        }
      }
      expect(fridays.size).toBe(1);
      const [fridayDoctor] = [...fridays.keys()];
      expect(saturdays.get(fridayDoctor) ?? 0).toBe(0);
    });
  });

  it('el segundo refuerzo AP toma los dos siguientes de la rueda de festivos', () => {
    const days = [day('2026-01-06', true), day('2026-01-07', true)];
    const fivePool = [...pool, { id: 'E', name: 'Dr. E', department: 'Medicina General' }];
    expect(runFromZero(days, [1, 2], fivePool)).toEqual([['A'], ['B', 'C']]);
  });

  it('guardia y refuerzo usan ruedas distintas; la de refuerzo arranca desplazada ⌊N/2⌋', () => {
    const days = [day('2026-01-05'), day('2026-01-06'), day('2026-01-07')];
    const assigned = assignWithWheels(
      { pool, days, requiredByDay: [2, 2, 2], refuerzosByDay: [1, 1, 1] },
      { weekday: 0, saturday: 0, sunday: 0, holiday: 0 },
    ).map((chosen) => chosen.map((doctor) => doctor.id));
    // Guardia: A, B, C. Refuerzo desde C (0 + 2): C, D y, al dar la vuelta, A.
    expect(assigned).toEqual([
      ['A', 'C'],
      ['B', 'D'],
      ['C', 'A'],
    ]);
  });

  it('descanso blando: completa con no descansados en orden de rueda y sin generar deudas', () => {
    const three = pool.slice(0, 3);
    const days = [day('2026-01-05'), day('2026-01-06'), day('2026-01-07')];
    // Día 2: sólo C descansado; se completa con A (siguiente de la rueda).
    // Día 3: sin deudas pendientes, la rueda continúa tras el último tomado.
    const result = runFromZero(days, [2, 2, 1], three);
    expect(result[0]).toEqual(['A', 'B']);
    expect(result[1]).toEqual(['C', 'A']);
    expect(result[2]).toHaveLength(1);
    expect(result[2]).not.toContain('C');
    expect(result[2]).not.toContain('A');
  });

  it('lanza InfeasiblePoolError con el mensaje de siempre si no hay médicos distintos suficientes', () => {
    expect(() => run([day('2026-01-05')], [4], pool.slice(0, 3))).toThrow(InfeasiblePoolError);
    expect(() => run([day('2026-01-05')], [4], pool.slice(0, 3))).toThrow(
      'No hay suficientes médicos elegibles el 2026-01-05. El grupo es demasiado pequeño.',
    );
  });

  it('reparte cada rueda con diferencia máxima de 1 cuando no hay choques', () => {
    const dates = [
      '2026-01-05',
      '2026-01-06',
      '2026-01-07',
      '2026-01-08',
      '2026-01-09',
      '2026-01-12',
      '2026-01-13',
      '2026-01-14',
      '2026-01-15',
      '2026-01-16',
    ];
    const counts = new Map<string, number>();
    for (const [id] of runFromZero(dates.map((d) => day(d))).map((chosen) => chosen)) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    const values = [...counts.values()];
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
  });

  describe('integrado en generateRota', () => {
    const classifications = classifyYear(YEAR_2026, toHolidaySet(HOLIDAYS_2026));

    it('devuelve strategy wheels y mantiene estadísticas, avisos y descanso', () => {
      const rota = generateRota(YEAR_2026, 'AP', AP_POOL_12, classifications, undefined, 'wheels');

      expect(rota.strategy).toBe('wheels');
      expect(rota.schedule).toHaveLength(365);
      expect(rota.stats.doctors).toHaveLength(AP_POOL_12.length);
      expect(Array.isArray(rota.warnings)).toBe(true);

      for (let i = 1; i < rota.schedule.length; i += 1) {
        const previous = new Set(rota.schedule[i - 1].doctors.map((d) => d.doctorId));
        for (const doctor of rota.schedule[i].doctors) {
          expect(previous.has(doctor.doctorId)).toBe(false);
        }
      }
    });

    it('funciona con el grupo AC mínimo', () => {
      const rota = generateRota(YEAR_2026, 'AC', AC_POOL_4, classifications, undefined, 'wheels');
      expect(rota.strategy).toBe('wheels');
      expect(rota.schedule.every((d) => d.doctors.length === 1)).toBe(true);
    });

    it('sin estrategia equivale a balanced', () => {
      const implicit = generateRota(YEAR_2026, 'AC', AC_POOL_4, classifications);
      const explicit = generateRota(YEAR_2026, 'AC', AC_POOL_4, classifications, undefined, 'balanced');
      expect(implicit.strategy).toBe('balanced');
      expect(implicit).toEqual(explicit);
    });
  });
});
