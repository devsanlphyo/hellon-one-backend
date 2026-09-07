import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { Class } from '../../classes/entities/class.entity';
import { Subject } from '../../subjects/entities/subject.entity';

export type SchoolStatus = 'active' | 'suspend';

@Entity('schools')
export class School {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ unique: true })
  code: string;

  @Column({ nullable: true })
  principalName: string;

  @Column({ type: 'uuid', nullable: true })
  headmasterId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'headmasterId' })
  headmaster?: User | null;

  @Column({ type: 'varchar', default: 'active' })
  status: SchoolStatus;

  @OneToMany(() => Class, (cls) => cls.school)
  classes: Class[];

  @OneToMany(() => User, (user) => user.school)
  staff: User[];

  @ManyToMany(() => Subject, (subject) => subject.schools)
  @JoinTable({
    name: 'school_subjects',
    joinColumn: { name: 'schoolId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'subjectId', referencedColumnName: 'id' },
  })
  subjects: Subject[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
