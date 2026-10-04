import { Injectable } from '@nestjs/common';
import { Workbook, Worksheet } from 'exceljs';

import { fromIsoDate, getIsoWeekday } from '../common/date.utils';
import { DayAssignment, DayType, RotaResponse, RotaType } from './rota.types';

const NOMBRES_DIA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

const NOMBRES_TIPO_DIA: Record<DayType, string> = {
  weekday: 'Laborable',
  saturday: 'Sábado',
  holiday: 'Festivo',
};

const NOMBRES_MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const CABECERA_CUADRANTE = [
  { header: 'Fecha', width: 12 },
  { header: 'Día', width: 11 },
  { header: 'Tipo de día', width: 13 },
  { header: 'Médico AC', width: 24 },
  { header: 'Horario AC', width: 15 },
  { header: 'Horas AC', width: 10 },
  { header: 'Refuerzo AP', width: 40 },
  { header: 'Horario AP', width: 15 },
  { header: 'Horas AP', width: 10 },
];

const CABECERA_ESTADISTICAS = [
  { header: 'Médico', width: 26 },
  { header: 'Horas totales', width: 15 },
  { header: 'Horas objetivo', width: 16 },
  { header: 'Desviación', width: 13 },
  { header: 'Laborables', width: 13 },
  { header: 'Sábados', width: 11 },
  { header: 'Festivos', width: 11 },
  ...NOMBRES_MES.map((mes) => ({ header: mes, width: 8 })),
];

@Injectable()
export class RotaExportService {
  async buildWorkbook(rotas: RotaResponse[]): Promise<Buffer> {
    const workbook = new Workbook();
    const porTipo = new Map(rotas.map((rota) => [rota.rota_type, rota]));

    this.addScheduleSheet(workbook, porTipo.get(RotaType.AC), porTipo.get(RotaType.AP));
    for (const tipo of [RotaType.AC, RotaType.AP]) {
      const rota = porTipo.get(tipo);
      if (rota) {
        this.addStatsSheet(workbook, rota);
      }
    }

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  private addScheduleSheet(workbook: Workbook, ac?: RotaResponse, ap?: RotaResponse): void {
    const sheet = this.createSheet(workbook, 'Cuadrante', CABECERA_CUADRANTE);
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.getColumn(1).numFmt = 'dd/mm/yyyy';

    const diasAc = new Map((ac?.schedule ?? []).map((day) => [day.date, day]));
    const diasAp = new Map((ap?.schedule ?? []).map((day) => [day.date, day]));
    const fechas = [...new Set([...diasAc.keys(), ...diasAp.keys()])].sort();

    for (const fecha of fechas) {
      const diaAc = diasAc.get(fecha);
      const diaAp = diasAp.get(fecha);
      const tipoDia = (diaAc ?? diaAp)!.day_type;

      sheet.addRow([
        fromIsoDate(fecha),
        NOMBRES_DIA[getIsoWeekday(fecha)],
        NOMBRES_TIPO_DIA[tipoDia],
        ...this.shiftColumns(diaAc),
        ...this.shiftColumns(diaAp),
      ]);
    }
  }

  private shiftColumns(day?: DayAssignment): Array<string | number | null> {
    if (!day) {
      return [null, null, null];
    }
    return [
      day.doctors.map((doctor) => doctor.doctor_name).join(', '),
      `${day.shift_start}–${day.shift_end}`,
      day.duration_hours,
    ];
  }

  private addStatsSheet(workbook: Workbook, rota: RotaResponse): void {
    const sheet = this.createSheet(workbook, `Estadísticas ${rota.rota_type}`, CABECERA_ESTADISTICAS);

    for (const doctor of rota.stats.doctors) {
      sheet.addRow([
        doctor.doctor_name,
        doctor.total_hours,
        doctor.target_hours,
        doctor.hours_vs_target,
        doctor.shifts_weekday,
        doctor.shifts_saturday,
        doctor.shifts_sunday_holiday,
        ...NOMBRES_MES.map((_, indice) => doctor.monthly_hours[String(indice + 1)] ?? 0),
      ]);
    }
  }

  private createSheet(
    workbook: Workbook,
    name: string,
    columns: Array<{ header: string; width: number }>,
  ): Worksheet {
    const sheet = workbook.addWorksheet(name);
    sheet.columns = columns;
    sheet.getRow(1).font = { bold: true };
    return sheet;
  }
}
