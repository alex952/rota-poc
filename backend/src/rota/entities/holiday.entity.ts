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
}
