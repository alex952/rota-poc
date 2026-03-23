import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { DoctorInput } from '../../scheduling/scheduling.types';
import { RotaAssignmentEntity } from './rota-assignment.entity';
import { RotaDoctorEntity } from './rota-doctor.entity';

const isSqlJs = (process.env.DB_TYPE ?? '') === 'sqljs';

@Entity({ name: 'rotas' })
@Unique(['year', 'rotaType'])
export class RotaEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  year!: number;

  @Column({ name: 'rota_type', type: 'varchar', length: 2 })
  rotaType!: string;

  @Column({ type: 'varchar', length: 100 })
  city!: string;

  @Column({
    name: 'generated_at',
    type: isSqlJs ? 'datetime' : 'timestamptz',
  })
  generatedAt!: Date;

  @Column({
    type: isSqlJs ? 'simple-json' : 'jsonb',
  })
  pool!: DoctorInput[];

  @Column({ name: 'doctors_per_day', type: 'int' })
  doctorsPerDay!: number;

  @OneToMany(() => RotaDoctorEntity, (doctor) => doctor.rota)
  doctors!: RotaDoctorEntity[];

  @OneToMany(() => RotaAssignmentEntity, (assignment) => assignment.rota)
  assignments!: RotaAssignmentEntity[];
}
