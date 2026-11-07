import { Doctor, RotaType } from '../models/doctor.model';

/**
 * Lee la lista de médicos de un fichero subido por el usuario.
 *
 * - JSON: la misma forma que `assets/doctors.json` (o `{ "doctors": [...] }`), con claves
 *   en inglés o en español (`nombre`, `departamento`, `grupo`).
 * - CSV: con cabecera; separador `;`, `,` o tabulador (Excel en español exporta con `;`).
 *   Columnas `nombre` y `grupo` obligatorias; `departamento` e `id` opcionales.
 *
 * El grupo es AC o AP (sin distinguir mayúsculas). Si falta el id, se genera uno `doc-NNN`
 * que no choque con los del fichero. Lanza un `Error` con el mensaje para el usuario.
 */
export function parseDoctorFile(fileName: string, content: string): Doctor[] {
  const text = content.replace(/^﻿/, '');
  const isJson = /\.json$/i.test(fileName) || /^\s*[[{]/.test(text);
  return validate(isJson ? readJson(text) : readCsv(text));
}

/** Médico tal como viene del fichero, antes de validarlo. */
interface RawDoctor {
  /** «Línea 3» o «Médico 1», para los mensajes de error */
  label: string;
  id: string;
  name: string;
  department: string;
  group: string;
}

/** Nombres de columna o clave admitidos, ya normalizados (minúsculas y sin tildes). */
const FIELD_ALIASES: Record<keyof Omit<RawDoctor, 'label'>, string[]> = {
  id: ['id', 'identificador'],
  name: ['nombre', 'name', 'medico'],
  department: ['departamento', 'department', 'servicio', 'especialidad'],
  group: ['grupo', 'rota_type', 'tipo', 'rota'],
};

const MAX_NAME_LENGTH = 200;
const MAX_ID_LENGTH = 50;

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function fieldOf(key: string): keyof typeof FIELD_ALIASES | undefined {
  const normalized = normalizeKey(key);
  return (Object.keys(FIELD_ALIASES) as (keyof typeof FIELD_ALIASES)[]).find((field) =>
    FIELD_ALIASES[field].includes(normalized),
  );
}

function readJson(text: string): RawDoctor[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('El fichero no es un JSON válido.');
  }
  const list = Array.isArray(data) ? data : (data as { doctors?: unknown })?.doctors;
  if (!Array.isArray(list)) {
    throw new Error('El fichero JSON debe contener una lista de médicos.');
  }
  return list.map((item, index) => {
    const raw: RawDoctor = { label: `Médico ${index + 1}`, id: '', name: '', department: '', group: '' };
    if (item && typeof item === 'object') {
      for (const [key, value] of Object.entries(item)) {
        const field = fieldOf(key);
        if (field && (typeof value === 'string' || typeof value === 'number')) {
          raw[field] = String(value).trim();
        }
      }
    }
    return raw;
  });
}

function readCsv(text: string): RawDoctor[] {
  const lines = text.split(/\r?\n/);
  const header = lines[0] ?? '';
  const delimiter = [';', ',', '\t'].reduce((best, candidate) =>
    header.split(candidate).length > header.split(best).length ? candidate : best,
  );

  const columns = splitCsvLine(header, delimiter).map(fieldOf);
  if (!columns.includes('name')) {
    throw new Error('Falta la columna «nombre» en la cabecera del fichero.');
  }
  if (!columns.includes('group')) {
    throw new Error('Falta la columna «grupo» en la cabecera del fichero.');
  }

  const rows: RawDoctor[] = [];
  lines.slice(1).forEach((line, index) => {
    if (line.trim() === '') return;
    const raw: RawDoctor = { label: `Línea ${index + 2}`, id: '', name: '', department: '', group: '' };
    splitCsvLine(line, delimiter).forEach((value, column) => {
      const field = columns[column];
      if (field) raw[field] = value.trim();
    });
    rows.push(raw);
  });
  return rows;
}

/** Separa una línea CSV respetando los campos entre comillas dobles («""» es una comilla). */
function splitCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

function validate(rows: RawDoctor[]): Doctor[] {
  if (rows.length === 0) {
    throw new Error('El fichero no contiene ningún médico.');
  }

  const usedIds = new Set<string>();
  for (const row of rows) {
    if (!row.name) {
      throw new Error(`${row.label}: falta el nombre.`);
    }
    if (row.name.length > MAX_NAME_LENGTH) {
      throw new Error(`${row.label}: el nombre no puede superar los ${MAX_NAME_LENGTH} caracteres.`);
    }
    const group = row.group.toUpperCase();
    if (group !== 'AC' && group !== 'AP') {
      throw new Error(`${row.label}: el grupo debe ser AC o AP (se ha leído «${row.group}»).`);
    }
    if (row.id.length > MAX_ID_LENGTH) {
      throw new Error(`${row.label}: el identificador no puede superar los ${MAX_ID_LENGTH} caracteres.`);
    }
    if (row.id && usedIds.has(row.id)) {
      throw new Error(`${row.label}: el identificador «${row.id}» está repetido.`);
    }
    if (row.id) usedIds.add(row.id);
  }

  let next = 1;
  const generateId = () => {
    let id: string;
    do {
      id = `doc-${String(next++).padStart(3, '0')}`;
    } while (usedIds.has(id));
    usedIds.add(id);
    return id;
  };

  return rows.map((row) => ({
    id: row.id || generateId(),
    name: row.name,
    department: row.department,
    rota_type: row.group.toUpperCase() as RotaType,
  }));
}
