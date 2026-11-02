import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity({ name: 'holidays' })
@Unique(['year', 'city', 'date'])
@Index('ix_holidays_year_city', ['year', 'city'])
export class HolidayEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  year!: number;

  @Column({ type: 'varchar', length: 100 })
  city!: string;

  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'varchar', length: 10, default: 'api' })
  source!: 'api' | 'manual';

  // Festivo especial de sanidad (24, 25 y 31 dic, 1 y 6 ene): no se puede eliminar.
  @Column({ name: 'is_special', type: 'boolean', default: false })
  special!: boolean;
}
