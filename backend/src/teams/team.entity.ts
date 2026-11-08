import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { RotaType } from '../scheduling/scheduling.types';

const isSqlJs = (process.env.DB_TYPE ?? '') === 'sqljs';

/** Médico de la lista de un equipo: el grupo (AC o AP) forma parte del médico. */
export interface TeamDoctor {
  id: string;
  name: string;
  department: string;
  rota_type: RotaType;
}

/** Equipo: un nombre, su lista de médicos y sus propios cuadrantes AC y AP por año. */
@Entity({ name: 'teams' })
@Unique('uq_teams_name', ['name'])
export class TeamEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: isSqlJs ? 'simple-json' : 'json' })
  doctors!: TeamDoctor[];

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: isSqlJs ? undefined : 3 })
  createdAt!: Date;
}
