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
import { Class } from '../../classes/entities/class.entity';
import { Subject } from '../../subjects/entities/subject.entity';

export type LessonPlanStatus = 'pending' | 'reviewed' | 'needs_revision';

@Entity('lesson_plans')
export class LessonPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  teacherId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacherId' })
  teacher?: User;

  @Column({ type: 'uuid', nullable: true })
  schoolId: string | null;

  @ManyToOne(() => School, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'schoolId' })
  school?: School | null;

  @Column({ type: 'uuid', nullable: true })
  classId: string | null;

  @ManyToOne(() => Class, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'classId' })
  class?: Class | null;

  @Column({ type: 'uuid', nullable: true })
  subjectId: string | null;

  @ManyToOne(() => Subject, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'subjectId' })
  subject?: Subject | null;

  @Column({ type: 'date' })
  date: string; // YYYY-MM-DD

  @Column()
  title: string;

  @Column({ type: 'varchar', nullable: true })
  topic: string | null;

  @Column({ type: 'text', nullable: true })
  objectives: string | null;

  @Column({ type: 'varchar', nullable: true })
  fileUrl: string | null;

  @Column({ type: 'varchar', nullable: true })
  fileName: string | null;

  @Column({ type: 'int', nullable: true })
  fileSize: number | null;

  @Column({ type: 'varchar', nullable: true })
  mimeType: string | null;

  @Column({ type: 'boolean', default: false })
  isLate: boolean;

  @Column({ type: 'text', nullable: true })
  justification: string | null;

  @Column({
    type: 'varchar',
    default: 'pending',
  })
  status: LessonPlanStatus;

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
