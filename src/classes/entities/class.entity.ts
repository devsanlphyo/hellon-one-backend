import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { School } from '../../schools/entities/school.entity';
import { ClassSubject } from './class-subject.entity';

export type ClassStatus = 'active' | 'archived';

@Entity('classes')
export class Class {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  gradeLevel: string;

  @Column({ default: '2026-2027' })
  academicYear: string;

  @Column({ type: 'varchar', default: 'active' })
  status: ClassStatus;

  @Column({ type: 'uuid', nullable: true })
  schoolId: string | null;

  @ManyToOne(() => School, (school) => school.classes, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'schoolId' })
  school?: School | null;

  @Column({ type: 'uuid', nullable: true })
  teacherId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'teacherId' })
  teacher?: User | null;

  @OneToMany(() => ClassSubject, (cs) => cs.class)
  classSubjects: ClassSubject[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
