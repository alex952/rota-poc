import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { RotaEntity } from './rota.entity';

const isSqlJs = (process.env.DB_TYPE ?? '') === 'sqljs';

@Entity({ name: 'rota_assignments' })
@Unique(['rotaId', 'date', 'doctorId', 'assignmentKind'])
@Index('ix_rota_assignments_doctor', ['rotaId', 'doctorId'])
export class RotaAssignmentEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'rota_id', type: 'int' })
  rotaId!: number;

  @Column({ type: 'date' })
  date!: string;

  @Column({ name: 'day_type', type: 'varchar', length: 20 })
  dayType!: string;

  @Column({ name: 'shift_start', type: isSqlJs ? 'varchar' : 'time', length: isSqlJs ? 10 : undefined })
  shiftStart!: string;

  @Column({ name: 'shift_end', type: isSqlJs ? 'varchar' : 'time', length: isSqlJs ? 10 : undefined })
  shiftEnd!: string;

  @Column({ name: 'duration_hours', type: 'int' })
  durationHours!: number;

  @Column({ name: 'doctor_id', type: 'varchar', length: 50 })
  doctorId!: string;

  @Column({ name: 'assignment_kind', type: 'varchar', length: 20, default: 'primary' })
  assignmentKind!: string;

  @Column({ name: 'linked_primary_doctor_id', type: 'varchar', length: 50, nullable: true })
  linkedPrimaryDoctorId!: string | null;

  @ManyToOne(() => RotaEntity, (rota) => rota.assignments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rota_id' })
  rota!: RotaEntity;
}
