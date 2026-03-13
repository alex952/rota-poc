export type RotaType = 'AC' | 'AP';

export interface Doctor {
  id: string;
  name: string;
  department: string;
  rota_type: RotaType;
}
