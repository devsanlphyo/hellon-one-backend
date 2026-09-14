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
import { FeedPostMedia } from './feed-post-media.entity';
import { FeedPostReaction } from './feed-post-reaction.entity';
import { FeedPostComment } from './feed-post-comment.entity';

export type PostVisibility = 'public' | 'campus' | 'private';

@Entity('feed_posts')
export class FeedPost {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  authorId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'authorId' })
  author: User;

  @Column({ type: 'uuid', nullable: true })
  schoolId: string | null;

  @ManyToOne(() => School, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'schoolId' })
  school?: School | null;

  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'varchar',
    default: 'campus',
  })
  visibility: PostVisibility;

  @Column({ type: 'boolean', default: false })
  isAnnouncement: boolean;

  @Column({ type: 'boolean', default: false })
  isPinned: boolean;

  @Column({ type: 'boolean', default: false })
  isDeleted: boolean;

  @Column({ type: 'uuid', nullable: true })
  deletedById: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'deletedById' })
  deletedBy?: User | null;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt: Date | null;

  @OneToMany(() => FeedPostMedia, (media) => media.post, { cascade: true })
  mediaItems: FeedPostMedia[];

  @OneToMany(() => FeedPostReaction, (reaction) => reaction.post, { cascade: true })
  reactions: FeedPostReaction[];

  @OneToMany(() => FeedPostComment, (comment) => comment.post, { cascade: true })
  comments: FeedPostComment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
