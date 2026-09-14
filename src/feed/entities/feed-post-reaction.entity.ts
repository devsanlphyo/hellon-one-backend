import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { FeedPost } from './feed-post.entity';

@Entity('feed_post_reactions')
@Unique(['postId', 'userId'])
export class FeedPostReaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  postId: string;

  @ManyToOne(() => FeedPost, (post) => post.reactions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'postId' })
  post: FeedPost;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ default: 'like' })
  type: string;

  @CreateDateColumn()
  createdAt: Date;
}
