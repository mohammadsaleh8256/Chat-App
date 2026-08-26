import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ListUsersQueryDto, UpdateProfileDto } from '../dto/user.dto';
import { PhoneUtil } from '../../common/utils/phone.util';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(currentUserId: string, query: ListUsersQueryDto) {
    const where: any = {
      id: { not: currentUserId },
      deletedAt: null,
    };
    if (query.search) {
      const s = query.search.trim();
      const normalized = PhoneUtil.tryNormalize(s);
      if (normalized) {
        where.OR = [{ normalizedPhone: normalized }];
      } else {
        where.OR = [
          { firstName: { contains: s } },
          { lastName: { contains: s } },
          { fullName: { contains: s } },
          { phoneNumber: { contains: s } },
        ];
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: this.selectSummary(),
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async getUser(id: string) {
    const u = await this.prisma.user.findUnique({
      where: { id },
      select: this.selectDetail(),
    });
    if (!u) throw new NotFoundException('کاربر یافت نشد.');
    return u;
  }

  async getProfile(userId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: this.selectDetail(),
    });
    if (!u) throw new NotFoundException('کاربر یافت نشد.');
    return u;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const data: any = { updatedAt: new Date() };
    if (dto.firstName !== undefined) data.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) data.lastName = dto.lastName.trim();
    if (dto.firstName !== undefined || dto.lastName !== undefined) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      const fn = dto.firstName ?? user!.firstName;
      const ln = dto.lastName ?? user!.lastName;
      data.fullName = `${fn} ${ln}`.trim();
    }
    if (dto.avatarUrl !== undefined) data.avatarUrl = dto.avatarUrl;
    if (dto.bio !== undefined) data.bio = dto.bio;

    const updated = await this.prisma.user.update({ where: { id: userId }, data, select: this.selectDetail() });
    return updated;
  }

  async updatePresence(userId: string, isOnline: boolean) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isOnline, lastSeen: new Date() },
    });
  }

  async getOnlineUserIds(): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: { isOnline: true, deletedAt: null },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  private selectSummary() {
    return {
      id: true,
      fullName: true,
      phoneNumber: true,
      avatarUrl: true,
      isOnline: true,
      lastSeen: true,
    };
  }

  private selectDetail() {
    return {
      id: true,
      firstName: true,
      lastName: true,
      fullName: true,
      phoneNumber: true,
      avatarUrl: true,
      bio: true,
      role: true,
      status: true,
      isOnline: true,
      lastSeen: true,
      createdAt: true,
      deletedAt: true,
    };
  }
}
