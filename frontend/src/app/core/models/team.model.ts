import { Doctor } from './doctor.model';

/** Equipo: un nombre, su lista de médicos y sus propios cuadrantes AC y AP por año. */
export interface Team {
  id: number;
  name: string;
  doctors: Doctor[];
}
