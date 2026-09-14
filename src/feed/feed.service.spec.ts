jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => {},
}));

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { FeedService } from './feed.service';
import { User } from '../auth/entities/user.entity';
import { FeedPost } from './entities/feed-post.entity';

describe('FeedService Flow Tests', () => {
  let service: FeedService;
  let postRepo: any;
  let mediaRepo: any;
  let reactionRepo: any;
  let commentRepo: any;
  let userRepo: any;
  let schoolRepo: any;

  beforeEach(() => {
    postRepo = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((dto) => ({ id: 'post-123', ...dto })),
      save: jest.fn((entity) => Promise.resolve({ id: 'post-123', ...entity })),
    };
    mediaRepo = {
      create: jest.fn((m) => m),
      save: jest.fn((m) => Promise.resolve(m)),
    };
    reactionRepo = {
      findOne: jest.fn(),
      create: jest.fn((r) => r),
      save: jest.fn((r) => Promise.resolve(r)),
      delete: jest.fn(),
    };
    commentRepo = {
      create: jest.fn((c) => c),
      save: jest.fn((c) => Promise.resolve(c)),
      findOne: jest.fn(),
    };
    userRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
    };
    schoolRepo = {
      find: jest.fn(),
    };

    service = new FeedService(
      postRepo,
      mediaRepo,
      reactionRepo,
      commentRepo,
      userRepo,
      schoolRepo,
    );
  });

  const campusTeacher: User = {
    id: 'teacher-uuid-1',
    email: 'teacher@school.edu',
    fullName: 'Teacher Jane',
    role: 'teacher',
    schoolId: 'campus-alpha-uuid',
  } as User;

  const campusOfficer: User = {
    id: 'officer-uuid-2',
    email: 'officer@school.edu',
    fullName: 'Officer Bob',
    role: 'officer',
    schoolId: 'campus-alpha-uuid',
  } as User;

  const systemAdmin: User = {
    id: 'admin-uuid-99',
    email: 'admin@system.edu',
    fullName: 'System Admin',
    role: 'admin',
    schoolId: null,
  } as unknown as User;

  describe('Flow 5 & Flow 6: Post Deletion & Authority', () => {
    it('Flow 5: Campus staff can delete their own post', async () => {
      const ownPost: Partial<FeedPost> = {
        id: 'post-1',
        authorId: campusTeacher.id,
        isDeleted: false,
      };
      postRepo.findOne.mockResolvedValue(ownPost);

      const result = await service.deletePost(campusTeacher, 'post-1');
      expect(result.success).toBe(true);
      expect(ownPost.isDeleted).toBe(true);
      expect(ownPost.deletedById).toBe(campusTeacher.id);
    });

    it('Flow 5: Campus staff cannot delete another user post (Throws ForbiddenException)', async () => {
      const otherPost: Partial<FeedPost> = {
        id: 'post-2',
        authorId: campusOfficer.id,
        isDeleted: false,
      };
      postRepo.findOne.mockResolvedValue(otherPost);

      await expect(service.deletePost(campusTeacher, 'post-2')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('Flow 6: Admin/Director can delete any post (System-wide moderation authority)', async () => {
      const teacherPost: Partial<FeedPost> = {
        id: 'post-3',
        authorId: campusTeacher.id,
        isDeleted: false,
      };
      postRepo.findOne.mockResolvedValue(teacherPost);

      const result = await service.deletePost(systemAdmin, 'post-3');
      expect(result.success).toBe(true);
      expect(teacherPost.isDeleted).toBe(true);
      expect(teacherPost.deletedById).toBe(systemAdmin.id);
    });
  });

  describe('Flow 7 & Flow 8: Post Editing (Own Post? Check)', () => {
    it('Flow 7: Campus staff can edit their own post', async () => {
      const ownPost: Partial<FeedPost> = {
        id: 'post-4',
        authorId: campusTeacher.id,
        content: 'Original Content',
        isDeleted: false,
      };
      postRepo.findOne.mockResolvedValue(ownPost);
      jest.spyOn(service, 'getPostById').mockResolvedValue({ id: 'post-4', content: 'Updated' } as any);

      const updated = await service.updatePost(campusTeacher, 'post-4', { content: 'Updated' });
      expect(updated).toBeDefined();
      expect(ownPost.content).toBe('Updated');
    });

    it('Flow 7 & 8: User cannot edit someone elses post', async () => {
      const otherPost: Partial<FeedPost> = {
        id: 'post-5',
        authorId: campusTeacher.id,
        content: 'Teacher Post',
        isDeleted: false,
      };
      postRepo.findOne.mockResolvedValue(otherPost);

      // Even an admin cannot edit another person's post per Flow 8 "Own Post?" diamond
      await expect(service.updatePost(systemAdmin, 'post-5', { content: 'Admin Edit' })).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('Flow 3 & Flow 4: Post Creation Scoping', () => {
    it('Flow 3: Campus staff post is bound to their campus schoolId', async () => {
      jest.spyOn(service, 'getPostById').mockImplementation((id: string) => Promise.resolve({ id } as any));

      await service.createPost(campusTeacher, {
        content: 'Hello Campus',
        visibility: 'campus',
      });

      expect(postRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          authorId: campusTeacher.id,
          schoolId: campusTeacher.schoolId,
          content: 'Hello Campus',
          visibility: 'campus',
        }),
      );
    });

    it('Flow 4: Director/Admin can create broadcast announcements targeting any school', async () => {
      jest.spyOn(service, 'getPostById').mockImplementation((id: string) => Promise.resolve({ id } as any));

      await service.createPost(systemAdmin, {
        content: 'System-wide maintenance tonight',
        visibility: 'public',
        isAnnouncement: true,
        schoolId: 'campus-beta-uuid',
      });

      expect(postRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          authorId: systemAdmin.id,
          schoolId: 'campus-beta-uuid',
          content: 'System-wide maintenance tonight',
          visibility: 'public',
          isAnnouncement: true,
        }),
      );
    });
  });

  describe('Flow 1 & Flow 2: Feed Query Scoping', () => {
    it('Flow 1: Campus staff query is scoped to user schoolId and public posts', async () => {
      const qbMock: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      postRepo.createQueryBuilder.mockReturnValue(qbMock);

      await service.getFeed(campusTeacher, {});

      // Verify that campus scoping filter was applied with user.schoolId
      expect(qbMock.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('post.schoolId = :userSchool'),
        expect.objectContaining({ userSchool: campusTeacher.schoolId }),
      );
    });

    it('Flow 2: Director/Admin can view all posts without schoolId restriction by default', async () => {
      const qbMock: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      postRepo.createQueryBuilder.mockReturnValue(qbMock);

      await service.getFeed(systemAdmin, {});

      // Should not restrict by userSchool
      expect(qbMock.andWhere).not.toHaveBeenCalledWith(
        expect.stringContaining('post.schoolId = :userSchool'),
        expect.anything(),
      );
    });

    it('Flow 2: Director/Admin can filter feed by target campus schoolId', async () => {
      const qbMock: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      postRepo.createQueryBuilder.mockReturnValue(qbMock);

      await service.getFeed(systemAdmin, { schoolId: 'campus-target-123' });

      expect(qbMock.andWhere).toHaveBeenCalledWith(
        'post.schoolId = :filterSchool',
        { filterSchool: 'campus-target-123' },
      );
    });
  });
});
