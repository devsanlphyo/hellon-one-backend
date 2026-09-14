import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { School } from '../schools/entities/school.entity';
import { User } from '../auth/entities/user.entity';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';
import { FeedPost } from './entities/feed-post.entity';
import { FeedPostComment } from './entities/feed-post-comment.entity';
import { FeedPostMedia } from './entities/feed-post-media.entity';
import { FeedPostReaction } from './entities/feed-post-reaction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FeedPost,
      FeedPostMedia,
      FeedPostReaction,
      FeedPostComment,
      User,
      School,
    ]),
  ],
  controllers: [FeedController],
  providers: [FeedService],
  exports: [FeedService],
})
export class FeedModule {}
