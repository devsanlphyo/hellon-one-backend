import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('shifts')
export class Shift {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ unique: true })
  code: string;

  @Column()
  startTime: string; // e.g. "09:00"

  @Column()
  endTime: string; // e.g. "12:00"

  @Column({ nullable: true })
  description: string;

  @Column({ default: 'blue' })
  color: string;

  @Column({ type: 'integer', default: 15 })
  graceMinutes: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
