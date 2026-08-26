import { Injectable, Logger, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { PhoneUtil } from '../../common/utils/phone.util';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

export interface JwtPayload {
  sub: string;
  phone: string;
  role: 'USER' | 'ADMIN';
  jti: string;
}

@Injectable()
export class TokenService {
  private readonly logger = new Logger('TokenService');

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  generateAccessToken(user: { id: string; phoneNumber: string; role: string }): { token: string; jti: string; expiresAt: Date } {
    const jti = crypto.randomUUID();
    const expiresIn = this.config.get<string>('JWT_ACCESS_EXPIRES', '15m');
    const expiresAt = this.parseExpiry(expiresIn);
    const token = this.jwt.sign(
      { sub: user.id, phone: user.phoneNumber, role: user.role, jti },
      { secret: this.config.get<string>('JWT_ACCESS_SECRET'), expiresIn },
    );
    return { token, jti, expiresAt };
  }

  async generateRefreshToken(user: { id: string }, jwtId: string, ip?: string): Promise<{ token: string; expiresAt: Date }> {
    const raw = crypto.randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + this.parseExpiryMs(this.config.get<string>('JWT_REFRESH_EXPIRES', '30d')));
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(raw),
        jwtId,
        expiresAt,
        createdByIp: ip,
      },
    });
    return { token: raw, expiresAt };
  }

  async rotateTokens(expiredAccessToken: string, refreshToken: string, ip?: string): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date } | null> {
    const oldHash = this.hashToken(refreshToken);
    const old = await this.prisma.refreshToken.findUnique({ where: { tokenHash: oldHash } });
    if (!old || old.revokedAt || old.expiresAt < new Date()) return null;

    // Verify the access token's signature (ignore expiry) to extract user info
    let payload: JwtPayload | null = null;
    try {
      payload = this.jwt.verify<JwtPayload>(expiredAccessToken, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        ignoreExpiration: true,
      });
    } catch {
      return null;
    }
    if (!payload || payload.sub !== old.userId || payload.jti !== old.jwtId) return null;

    // Load user
    const user = await this.prisma.user.findUnique({ where: { id: old.userId } });
    if (!user || user.status !== 'ACTIVE' || user.deletedAt) return null;

    // Generate new tokens
    const access = this.generateAccessToken({ id: user.id, phoneNumber: user.phoneNumber, role: user.role as 'USER' | 'ADMIN' });
    const refresh = await this.generateRefreshToken({ id: user.id }, access.jti, ip);

    // Revoke old refresh token, replaced by new one
    await this.prisma.refreshToken.update({
      where: { id: old.id },
      data: {
        revokedAt: new Date(),
        revokeByIp: ip,
        reasonRevoked: 'rotated',
        replacedByToken: refresh.token,
      },
    });

    return { accessToken: access.token, refreshToken: refresh.token, expiresAt: access.expiresAt };
  }

  async revokeRefreshToken(refreshToken: string, ip?: string, reason = 'logout'): Promise<void> {
    const hash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hash, revokedAt: null },
      data: { revokedAt: new Date(), revokeByIp: ip, reasonRevoked: reason },
    });
  }

  async revokeAllUserTokens(userId: string, reason = 'logout-all'): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), reasonRevoked: reason },
    });
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private parseExpiry(expiresIn: string): Date {
    return new Date(Date.now() + this.parseExpiryMs(expiresIn));
  }

  private parseExpiryMs(expiresIn: string): number {
    const m = expiresIn.match(/^(\d+)([smhd])$/);
    if (!m) return 15 * 60 * 1000;
    const num = parseInt(m[1], 10);
    const unit = m[2];
    const mult = unit === 's' ? 1000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;
    return num * mult;
  }
}
