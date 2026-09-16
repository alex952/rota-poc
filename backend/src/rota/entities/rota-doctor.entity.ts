import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { RotaEntity } from './rota.entity';

@Entity({ name: 'rota_doctors' })
@Unique(['rotaId', 'doctorId'])
export class RotaDoctorEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'rota_id', type: 'int' })
  rotaId!: number;

  @Column({ name: 'doctor_id', type: 'varchar', length: 50 })
  doctorId!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'varchar', length: 200 })
  department!: string;

  @ManyToOne(() => RotaEntity, (rota) => rota.doctors, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rota_id' })
  rota!: RotaEntity;
}
