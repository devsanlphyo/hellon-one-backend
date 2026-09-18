import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { School } from '../schools/entities/school.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { QueryFeedDto } from './dto/query-feed.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import { FeedPost } from './entities/feed-post.entity';
import { FeedPostComment } from './entities/feed-post-comment.entity';
import { FeedPostMedia } from './entities/feed-post-media.entity';
import { FeedPostReaction } from './entities/feed-post-reaction.entity';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(FeedService.name);

  constructor(
    @InjectRepository(FeedPost)
    private readonly postRepository: Repository<FeedPost>,
    @InjectRepository(FeedPostMedia)
    private readonly mediaRepository: Repository<FeedPostMedia>,
    @InjectRepository(FeedPostReaction)
    private readonly reactionRepository: Repository<FeedPostReaction>,
    @InjectRepository(FeedPostComment)
    private readonly commentRepository: Repository<FeedPostComment>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(School)
    private readonly schoolRepository: Repository<School>,
  ) {}

  async onApplicationBootstrap() {
    // Auto-seeding disabled to keep database clean
  }

  /**
   * Flow 1 & Flow 2: Get Feed
   * - Flow 1 (Campus Level: Headmaster, Officer, Teacher, Assistant):
   *   Only sees own campus posts (schoolId == user.schoolId), public posts, and author's own private posts.
   * - Flow 2 (Multi-Campus: Director, Admin):
   *   Sees all posts across all schools and public announcements.
   */
  async getFeed(user: User, query: QueryFeedDto) {
    const isMultiCampus = user.role === 'admin' || user.role === 'director';
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const qb = this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .leftJoinAndSelect('post.school', 'school')
      .leftJoinAndSelect('post.mediaItems', 'mediaItems')
      .leftJoinAndSelect('post.reactions', 'reactions')
      .leftJoinAndSelect('reactions.user', 'reactionUser')
      .leftJoinAndSelect('post.comments', 'comments')
      .leftJoinAndSelect('comments.author', 'commentAuthor')
      .leftJoinAndSelect('comments.replies', 'replies')
      .leftJoinAndSelect('replies.author', 'replyAuthor')
      .where('post.isDeleted = :isDeleted', { isDeleted: false });

    // Flow 1 vs Flow 2 Scoping
    if (!isMultiCampus) {
      // Campus-level staff: only own school, public, or own private posts
      if (user.schoolId) {
        qb.andWhere(
          '(post.visibility = :pubVis OR (post.visibility = :campVis AND post.schoolId = :userSchool) OR (post.visibility = :privVis AND post.authorId = :userId))',
          {
            pubVis: 'public',
            campVis: 'campus',
            userSchool: user.schoolId,
            privVis: 'private',
            userId: user.id,
          },
        );
      } else {
        qb.andWhere('(post.visibility = :pubVis OR post.authorId = :userId)', {
          pubVis: 'public',
          userId: user.id,
        });
      }
    } else {
      // Director / Admin can view all, but if they explicitly filter by schoolId:
      if (query.schoolId) {
        qb.andWhere('post.schoolId = :filterSchool', { filterSchool: query.schoolId });
      }
    }

    // Additional filter tabs
    if (query.filter === 'announcements') {
      qb.andWhere('post.isAnnouncement = true');
    } else if (query.filter === 'my') {
      qb.andWhere('post.authorId = :userId', { userId: user.id });
    } else if (query.filter === 'public') {
      qb.andWhere('post.visibility = :pubVis', { pubVis: 'public' });
    } else if (query.filter === 'campus') {
      qb.andWhere('post.visibility = :campVis', { campVis: 'campus' });
      if (user.schoolId && !isMultiCampus) {
        qb.andWhere('post.schoolId = :userSchool', { userSchool: user.schoolId });
      }
    }

    // Text search
    if (query.search && query.search.trim()) {
      const term = `%${query.search.trim()}%`;
      qb.andWhere(
        '(post.content ILIKE :term OR author.fullName ILIKE :term)',
        { term },
      );
    }

    qb.orderBy('post.isPinned', 'DESC')
      .addOrderBy('post.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [posts, total] = await qb.getManyAndCount();

    // Map and annotate with user-specific flags (e.g. hasLiked, permissions)
    const formatted = posts.map((p) => {
      const hasLiked = p.reactions?.some((r) => r.userId === user.id) || false;
      const canEdit = p.authorId === user.id;
      const canDelete = isMultiCampus || p.authorId === user.id;

      // Filter top-level comments only (replies are nested)
      const topLevelComments = (p.comments || [])
        .filter((c) => !c.parentId)
        .map((c) => ({
          id: c.id,
          content: c.content,
          createdAt: c.createdAt,
          author: {
            id: c.author?.id,
            fullName: c.author?.fullName,
            email: c.author?.email,
            role: c.author?.role,
            avatarUrl: c.author?.avatarUrl,
          },
          canDelete: isMultiCampus || c.authorId === user.id,
          replies: (c.replies || []).map((r) => ({
            id: r.id,
            content: r.content,
            createdAt: r.createdAt,
            author: {
              id: r.author?.id,
              fullName: r.author?.fullName,
              email: r.author?.email,
              role: r.author?.role,
              avatarUrl: r.author?.avatarUrl,
            },
            canDelete: isMultiCampus || r.authorId === user.id,
          })),
        }));

      return {
        id: p.id,
        content: p.content,
        visibility: p.visibility,
        isAnnouncement: p.isAnnouncement,
        isPinned: p.isPinned,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        author: {
          id: p.author?.id,
          fullName: p.author?.fullName,
          email: p.author?.email,
          role: p.author?.role,
          avatarUrl: p.author?.avatarUrl,
        },
        school: p.school
          ? {
              id: p.school.id,
              name: p.school.name,
              code: p.school.code,
            }
          : null,
        mediaItems: (p.mediaItems || []).sort((a, b) => a.sortOrder - b.sortOrder),
        reactionCount: p.reactions?.length || 0,
        hasLiked,
        commentsCount: (p.comments?.length || 0),
        comments: topLevelComments,
        canEdit,
        canDelete,
      };
    });

    return {
      posts: formatted,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Flow 3 & Flow 4: Create Post
   * - Flow 3 (Campus Level): Created for own school/campus
   * - Flow 4 (Director/Admin): Can create system-wide public announcement or target any campus
   */
  async createPost(user: User, dto: CreatePostDto, files?: Express.Multer.File[]) {
    const isMultiCampus = user.role === 'admin' || user.role === 'director';

    let targetSchoolId: string | null = null;
    let visibility = dto.visibility || 'campus';

    if (isMultiCampus) {
      targetSchoolId = dto.schoolId || user.schoolId || null;
      if (dto.visibility) {
        visibility = dto.visibility;
      }
    } else {
      // Campus staff is strictly bound to their school
      targetSchoolId = user.schoolId || null;
      if (visibility === 'public' && user.role !== 'headmaster') {
        // Teachers / assistants default to campus visibility
        visibility = 'campus';
      }
    }

    const post = this.postRepository.create({
      authorId: user.id,
      schoolId: targetSchoolId,
      content: dto.content,
      visibility,
      isAnnouncement: isMultiCampus ? !!dto.isAnnouncement : false,
      isPinned: isMultiCampus ? !!dto.isPinned : false,
    });

    const savedPost = await this.postRepository.save(post);

    // Save media items
    if (files && files.length > 0) {
      const mediaList: FeedPostMedia[] = files.map((f, idx) =>
        this.mediaRepository.create({
          postId: savedPost.id,
          fileName: f.originalname,
          fileUrl: `/uploads/feed/${f.filename}`,
          fileSize: f.size,
          mimeType: f.mimetype,
          sortOrder: idx,
        }),
      );
      await this.mediaRepository.save(mediaList);
    }

    return this.getPostById(savedPost.id, user);
  }

  /**
   * Get single post by ID
   */
  async getPostById(id: string, user: User) {
    const post = await this.postRepository.findOne({
      where: { id, isDeleted: false },
      relations: {
        author: true,
        school: true,
        mediaItems: true,
        reactions: { user: true },
        comments: {
          author: true,
          replies: { author: true },
        },
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const isMultiCampus = user.role === 'admin' || user.role === 'director';
    const hasLiked = post.reactions?.some((r) => r.userId === user.id) || false;
    const canEdit = post.authorId === user.id;
    const canDelete = isMultiCampus || post.authorId === user.id;

    const topLevelComments = (post.comments || [])
      .filter((c) => !c.parentId)
      .map((c) => ({
        id: c.id,
        content: c.content,
        createdAt: c.createdAt,
        author: {
          id: c.author?.id,
          fullName: c.author?.fullName,
          email: c.author?.email,
          role: c.author?.role,
          avatarUrl: c.author?.avatarUrl,
        },
        canDelete: isMultiCampus || c.authorId === user.id,
        replies: (c.replies || []).map((r) => ({
          id: r.id,
          content: r.content,
          createdAt: r.createdAt,
          author: {
            id: r.author?.id,
            fullName: r.author?.fullName,
            email: r.author?.email,
            role: r.author?.role,
            avatarUrl: r.author?.avatarUrl,
          },
          canDelete: isMultiCampus || r.authorId === user.id,
        })),
      }));

    return {
      id: post.id,
      content: post.content,
      visibility: post.visibility,
      isAnnouncement: post.isAnnouncement,
      isPinned: post.isPinned,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      author: {
        id: post.author?.id,
        fullName: post.author?.fullName,
        email: post.author?.email,
        role: post.author?.role,
        avatarUrl: post.author?.avatarUrl,
      },
      school: post.school
        ? {
            id: post.school.id,
            name: post.school.name,
            code: post.school.code,
          }
        : null,
      mediaItems: (post.mediaItems || []).sort((a, b) => a.sortOrder - b.sortOrder),
      reactionCount: post.reactions?.length || 0,
      hasLiked,
      commentsCount: post.comments?.length || 0,
      comments: topLevelComments,
      canEdit,
      canDelete,
    };
  }

  /**
   * Flow 7 & Flow 8: Edit Post
   * Decision diamond: Own Post?
   * - If not author -> throws ForbiddenException ("You can only edit your own posts")
   */
  async updatePost(user: User, postId: string, dto: UpdatePostDto) {
    const post = await this.postRepository.findOne({
      where: { id: postId, isDeleted: false },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Flow 7 & Flow 8 Decision Gate: Own Post?
    if (post.authorId !== user.id) {
      throw new ForbiddenException('You can only edit your own posts');
    }

    if (dto.content !== undefined) {
      post.content = dto.content;
    }
    if (dto.visibility !== undefined) {
      post.visibility = dto.visibility;
    }

    await this.postRepository.save(post);
    return this.getPostById(postId, user);
  }

  /**
   * Flow 5 & Flow 6: Delete Post
   * - Flow 5 (Campus Staff): Decision diamond "Own Post?" -> If not author, ForbiddenException
   * - Flow 6 (Director / Admin): Moderation authority! Can delete any post without restriction.
   */
  async deletePost(user: User, postId: string) {
    const post = await this.postRepository.findOne({
      where: { id: postId, isDeleted: false },
      relations: { mediaItems: true },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const isMultiCampus = user.role === 'admin' || user.role === 'director';

    // Flow 5 vs Flow 6 Decision Gate
    if (!isMultiCampus && post.authorId !== user.id) {
      throw new ForbiddenException('You can only delete your own posts');
    }

    // Soft delete
    post.isDeleted = true;
    post.deletedById = user.id;
    post.deletedAt = new Date();
    await this.postRepository.save(post);

    return { success: true, message: 'Post deleted successfully' };
  }

  /**
   * Toggle Reaction (Like / Heart)
   */
  async toggleReaction(user: User, postId: string) {
    const post = await this.postRepository.findOne({
      where: { id: postId, isDeleted: false },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const existing = await this.reactionRepository.findOne({
      where: { postId, userId: user.id },
    });

    if (existing) {
      await this.reactionRepository.remove(existing);
      const count = await this.reactionRepository.count({ where: { postId } });
      return { liked: false, reactionCount: count };
    } else {
      const reaction = this.reactionRepository.create({
        postId,
        userId: user.id,
        type: 'like',
      });
      await this.reactionRepository.save(reaction);
      const count = await this.reactionRepository.count({ where: { postId } });
      return { liked: true, reactionCount: count };
    }
  }

  /**
   * Add Comment
   */
  async addComment(user: User, postId: string, dto: AddCommentDto) {
    const post = await this.postRepository.findOne({
      where: { id: postId, isDeleted: false },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const comment = this.commentRepository.create({
      postId,
      authorId: user.id,
      content: dto.content,
      parentId: dto.parentId || null,
    });

    const saved = await this.commentRepository.save(comment);

    return {
      id: saved.id,
      content: saved.content,
      createdAt: saved.createdAt,
      author: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
      canDelete: true,
      replies: [],
    };
  }

  /**
   * Delete Comment (Author or Admin/Director)
   */
  async deleteComment(user: User, commentId: string) {
    const comment = await this.commentRepository.findOne({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    const isMultiCampus = user.role === 'admin' || user.role === 'director';
    if (!isMultiCampus && comment.authorId !== user.id) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    await this.commentRepository.remove(comment);
    return { success: true, message: 'Comment deleted successfully' };
  }

  /**
   * Seed initial realistic posts if database is empty
   */
  private async seedInitialPosts() {
    try {
      const count = await this.postRepository.count();
      if (count > 0) return;

      this.logger.log('Seeding initial Feed posts for realistic demonstration...');

      // Find sample users across roles
      const director = await this.userRepository.findOne({ where: { role: 'director' } });
      const headmaster = await this.userRepository.findOne({ where: { role: 'headmaster' } });
      const teacher = await this.userRepository.findOne({ where: { role: 'teacher' } });
      const officer = await this.userRepository.findOne({ where: { role: 'officer' } });
      const school = await this.schoolRepository.findOne({ where: {} });

      const postsToSeed: FeedPost[] = [];

      if (director) {
        postsToSeed.push(
          this.postRepository.create({
            authorId: director.id,
            schoolId: null,
            content: `📢 Welcome to the Academic Term 2026-2027!\n\nWe are thrilled to welcome all faculty, administrative officers, and students back to our multi-campus community. Please ensure your semester syllabi and daily lesson plans are synchronized through the new academic portals.\n\nLet's make this year our most successful yet!`,
            visibility: 'public',
            isAnnouncement: true,
            isPinned: true,
            createdAt: new Date(Date.now() - 3600 * 1000 * 48),
          }),
        );
      }

      if (headmaster && school) {
        postsToSeed.push(
          this.postRepository.create({
            authorId: headmaster.id,
            schoolId: school.id,
            content: `🏫 Campus Update — ${school.name}\n\nFaculty and staff are reminded that our weekly curriculum coordination meeting will take place this Thursday at 3:00 PM in the Faculty Conference Hall. Please have your class registers and lesson milestones ready for review.`,
            visibility: 'campus',
            isAnnouncement: true,
            isPinned: false,
            createdAt: new Date(Date.now() - 3600 * 1000 * 24),
          }),
        );
      }

      if (teacher && school) {
        postsToSeed.push(
          this.postRepository.create({
            authorId: teacher.id,
            schoolId: school.id,
            content: `🔬 Science Laboratory Exhibition Success!\n\nOur Grade 10 students completed their kinetic energy and optics lab demonstrations today. Fantastic creativity and teamwork shown across all student groups!`,
            visibility: 'campus',
            isAnnouncement: false,
            isPinned: false,
            createdAt: new Date(Date.now() - 3600 * 1000 * 6),
          }),
        );
      }

      if (officer && school) {
        postsToSeed.push(
          this.postRepository.create({
            authorId: officer.id,
            schoolId: school.id,
            content: `📋 Attendance & Leave Request Processing Reminder\n\nPlease submit any scheduled leave requests at least 48 hours in advance so duty rosters and shift coverage can be updated seamlessly. Thank you!`,
            visibility: 'campus',
            isAnnouncement: false,
            isPinned: false,
            createdAt: new Date(Date.now() - 3600 * 1000 * 2),
          }),
        );
      }

      if (postsToSeed.length > 0) {
        const savedPosts = await this.postRepository.save(postsToSeed);

        // Seed some reactions and comments
        if (savedPosts[0] && teacher) {
          await this.reactionRepository.save(
            this.reactionRepository.create({
              postId: savedPosts[0].id,
              userId: teacher.id,
              type: 'like',
            }),
          );
          if (headmaster) {
            await this.reactionRepository.save(
              this.reactionRepository.create({
                postId: savedPosts[0].id,
                userId: headmaster.id,
                type: 'like',
              }),
            );
          }
          await this.commentRepository.save(
            this.commentRepository.create({
              postId: savedPosts[0].id,
              authorId: teacher.id,
              content: 'Excited for the upcoming academic year!',
            }),
          );
        }

        this.logger.log(`Successfully seeded ${savedPosts.length} initial feed posts.`);
      }
    } catch (err) {
      this.logger.warn(`Failed to seed feed posts: ${err.message}`);
    }
  }
}
