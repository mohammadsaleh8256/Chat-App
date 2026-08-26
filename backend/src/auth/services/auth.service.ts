import { Injectable, BadRequestException, ConflictException, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { PhoneUtil } from '../../common/utils/phone.util';
import { RegisterDto, LoginDto, RefreshDto, LogoutDto } from '../dto/auth.dto';
import { TokenService } from './token.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  private readonly logger = new Logger('AuthService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto, ip?: string) {
    const phone = PhoneUtil.normalize(dto.phoneNumber);

    // Check uniqueness
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ normalizedPhone: phone }, { phoneNumberHash: PhoneUtil.hash(phone) }],
      },
    });
    if (existing) throw new ConflictException('شماره تلفن قبلاً ثبت شده است.');

    // Determine role — Admin if matches configured initial-admin phone
    const adminSetting = await this.prisma.appSetting.findUnique({
      where: { key: 'INITIAL_ADMIN_PHONE' },
    });
    const adminPhone = adminSetting?.value;
    const isAdmin = !!adminPhone && PhoneUtil.tryNormalize(adminPhone) === phone;

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        fullName: `${dto.firstName.trim()} ${dto.lastName.trim()}`.trim(),
        phoneNumber: phone,
        normalizedPhone: phone,
        phoneNumberHash: PhoneUtil.hash(phone),
        passwordHash,
        role: isAdmin ? 'ADMIN' : 'USER',
        status: 'ACTIVE',
        lastSeen: new Date(),
      },
    });

    const access = this.tokens.generateAccessToken({ id: user.id, phoneNumber: user.phoneNumber, role: user.role });
    const refresh = await this.tokens.generateRefreshToken({ id: user.id }, access.jti, ip);

    this.logger.log(`User registered: ${user.phoneNumber} (role=${user.role})`);

    return {
      accessToken: access.token,
      refreshToken: refresh.token,
      expiresAt: access.expiresAt,
      user: this.toUserDto(user),
    };
  }

  async login(dto: LoginDto, ip?: string) {
    const phone = PhoneUtil.normalize(dto.phoneNumber);
    const user = await this.prisma.user.findUnique({ where: { normalizedPhone: phone } });
    if (!user || user.deletedAt) throw new UnauthorizedException('شماره تلفن یا رمز عبور اشتباه است.');
    if (user.status === 'DISABLED') throw new UnauthorizedException('حساب کاربری شما غیرفعال شده است. با مدیر سایت تماس بگیرید.');
    if (user.status === 'DELETED') throw new UnauthorizedException('این حساب حذف شده است.');

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('شماره تلفن یا رمز عبور اشتباه است.');

    const access = this.tokens.generateAccessToken({ id: user.id, phoneNumber: user.phoneNumber, role: user.role });
    const refresh = await this.tokens.generateRefreshToken({ id: user.id }, access.jti, ip);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastSeen: new Date(), isOnline: false },
    });

    this.logger.log(`User logged in: ${user.phoneNumber}`);

    return {
      accessToken: access.token,
      refreshToken: refresh.token,
      expiresAt: access.expiresAt,
      user: this.toUserDto(user),
    };
  }

  async refresh(dto: RefreshDto, ip?: string) {
    const result = await this.tokens.rotateTokens(dto.accessToken, dto.refreshToken, ip);
    if (!result) throw new UnauthorizedException('توکن نامعتبر است.');
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: result.expiresAt,
    };
  }

  async logout(dto: LogoutDto, ip?: string) {
    if (dto.refreshToken) {
      await this.tokens.revokeRefreshToken(dto.refreshToken, ip, 'logout');
    }
    return { success: true };
  }

  async getCurrentUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) return null;
    return this.toUserDto(user);
  }

  private toUserDto(u: any) {
    return {
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      fullName: u.fullName,
      phoneNumber: u.phoneNumber,
      avatarUrl: u.avatarUrl,
      bio: u.bio,
      role: u.role,
      status: u.status,
      isOnline: u.isOnline,
      lastSeen: u.lastSeen,
      createdAt: u.createdAt,
    };
  }
}
