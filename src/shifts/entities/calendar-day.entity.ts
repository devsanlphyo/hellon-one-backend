import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('calendar_days')
export class CalendarDay {
  @PrimaryColumn({ type: 'varchar', length: 10 })
  date: string; // "YYYY-MM-DD"

  @Column({ type: 'boolean', default: true })
  isSchoolDay: boolean;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
