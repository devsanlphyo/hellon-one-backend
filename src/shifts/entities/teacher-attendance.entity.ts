import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

@Entity('teacher_attendance')
export class TeacherAttendance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  staffId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'staffId' })
  staff: User;

  @Column({ type: 'date' })
  date: string; // YYYY-MM-DD

  @Column({ type: 'varchar', nullable: true })
  checkInTime: string | null; // e.g. "08:52 AM"

  @Column({ type: 'varchar', nullable: true })
  checkOutTime: string | null; // e.g. "12:05 PM"

  @Column({ type: 'varchar', nullable: true })
  duration: string | null; // e.g. "3h 13m"

  @Column({
    type: 'varchar',
    default: 'on_time',
  })
  status: 'on_time' | 'late' | 'in_progress' | 'completed' | 'absent';

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
