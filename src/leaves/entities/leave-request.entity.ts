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
import { School } from '../../schools/entities/school.entity';

export type LeaveStatus = 'pending' | 'approved' | 'rejected';

@Entity('leave_requests')
export class LeaveRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid', nullable: true })
  schoolId: string | null;

  @ManyToOne(() => School, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'schoolId' })
  school?: School | null;

  @Column({ type: 'date' })
  startDate: string; // YYYY-MM-DD

  @Column({ type: 'date' })
  endDate: string; // YYYY-MM-DD

  @Column({ type: 'text' })
  reason: string;

  @Column({
    type: 'varchar',
    default: 'pending',
  })
  status: LeaveStatus;

  @Column({ type: 'uuid', nullable: true })
  reviewedById: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewedById' })
  reviewedBy?: User | null;

  @Column({ type: 'text', nullable: true })
  reviewNotes: string | null;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
