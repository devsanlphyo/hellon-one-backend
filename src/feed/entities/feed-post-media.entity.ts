import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { FeedPost } from './feed-post.entity';

@Entity('feed_post_medias')
export class FeedPostMedia {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  postId: string;

  @ManyToOne(() => FeedPost, (post) => post.mediaItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'postId' })
  post: FeedPost;

  @Column()
  fileName: string;

  @Column()
  fileUrl: string;

  @Column({ type: 'bigint', nullable: true })
  fileSize: number;

  @Column({ nullable: true })
  mimeType: string;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;
}
