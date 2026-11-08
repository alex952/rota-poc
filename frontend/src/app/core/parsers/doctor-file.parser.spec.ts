import { parseDoctorFile } from './doctor-file.parser';

describe('parseDoctorFile', () => {
  describe('JSON', () => {
    it('lee la misma forma que assets/doctors.json', () => {
      const content = JSON.stringify([
        { id: 'doc-001', name: 'Dr. García', department: 'Pediatría', rota_type: 'AC' },
        { id: 'doc-002', name: 'Dra. Muñoz', department: 'Urgencias', rota_type: 'AP' },
      ]);
      expect(parseDoctorFile('medicos.json', content)).toEqual([
        { id: 'doc-001', name: 'Dr. García', department: 'Pediatría', rota_type: 'AC' },
        { id: 'doc-002', name: 'Dra. Muñoz', department: 'Urgencias', rota_type: 'AP' },
      ]);
    });

    it('acepta { doctors: [...] }, claves en español, grupo en minúsculas e id ausente', () => {
      const content = JSON.stringify({
        doctors: [{ nombre: '  Dr. Gil ', departamento: 'Neurología', grupo: 'ap' }],
      });
      expect(parseDoctorFile('equipo.json', content)).toEqual([
        { id: 'doc-001', name: 'Dr. Gil', department: 'Neurología', rota_type: 'AP' },
      ]);
    });

    it('rechaza un JSON mal formado o que no es una lista', () => {
      expect(() => parseDoctorFile('medicos.json', '[{')).toThrow('El fichero no es un JSON válido.');
      expect(() => parseDoctorFile('medicos.json', '{"a":1}')).toThrow(
        'El fichero JSON debe contener una lista de médicos.',
      );
    });
  });

  describe('CSV', () => {
    it('lee un CSV con punto y coma, cabecera en español con tildes y BOM', () => {
      const content =
        '﻿Nombre;Departamento;Grupo\r\nDr. García;Pediatría;AC\r\n\r\n"Dra. Muñoz; jefa";Urgencias;ap\r\n';
      expect(parseDoctorFile('medicos.csv', content)).toEqual([
        { id: 'doc-001', name: 'Dr. García', department: 'Pediatría', rota_type: 'AC' },
        { id: 'doc-002', name: 'Dra. Muñoz; jefa', department: 'Urgencias', rota_type: 'AP' },
      ]);
    });

    it('lee un CSV con comas y columnas en inglés, conservando los ids y sin repetirlos al generarlos', () => {
      const content = 'id,name,department,rota_type\ndoc-002,Dr. A,Cardiología,AC\n,Dr. B,,AP\n';
      expect(parseDoctorFile('doctors.csv', content)).toEqual([
        { id: 'doc-002', name: 'Dr. A', department: 'Cardiología', rota_type: 'AC' },
        { id: 'doc-001', name: 'Dr. B', department: '', rota_type: 'AP' },
      ]);
    });

    it('exige las columnas de nombre y grupo', () => {
      expect(() => parseDoctorFile('m.csv', 'Departamento;Grupo\nPediatría;AC')).toThrow(
        'Falta la columna «nombre» en la cabecera del fichero.',
      );
      expect(() => parseDoctorFile('m.csv', 'Nombre;Departamento\nDr. A;Pediatría')).toThrow(
        'Falta la columna «grupo» en la cabecera del fichero.',
      );
    });
  });

  describe('validación', () => {
    it('indica la línea del médico con el grupo incorrecto', () => {
      expect(() => parseDoctorFile('m.csv', 'Nombre;Grupo\nDr. A;AC\nDr. B;XX')).toThrow(
        'Línea 3: el grupo debe ser AC o AP (se ha leído «XX»).',
      );
    });

    it('indica el médico sin nombre o con un identificador repetido', () => {
      expect(() => parseDoctorFile('m.json', JSON.stringify([{ rota_type: 'AC' }]))).toThrow(
        'Médico 1: falta el nombre.',
      );
      expect(() =>
        parseDoctorFile('m.csv', 'id;nombre;grupo\ndoc-1;Dr. A;AC\ndoc-1;Dr. B;AP'),
      ).toThrow('Línea 3: el identificador «doc-1» está repetido.');
    });

    it('rechaza un fichero sin médicos', () => {
      expect(() => parseDoctorFile('m.csv', 'Nombre;Grupo\n\n')).toThrow('El fichero no contiene ningún médico.');
      expect(() => parseDoctorFile('m.json', '[]')).toThrow('El fichero no contiene ningún médico.');
    });
  });
});
