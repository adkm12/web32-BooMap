import { RedisService } from '@liaoliaots/nestjs-redis';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@app/entity';
import Redis from 'ioredis';
import { authException } from '../../exceptions';
import { JwtPayload, RefreshTokenPayload } from '@app/jwt';

@Injectable()
export class AuthService {
  private GeneralRedis: Redis | null;
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {
    this.GeneralRedis = this.redisService.getOrThrow('general');
  }

  generateAccessToken(user: User) {
    const payload: JwtPayload = { email: user.email, id: user.id };
    const accessToken = this.jwtService.sign(payload, { expiresIn: 60 * 30 });
    return accessToken;
  }

  generateRefreshToken(user: User) {
    const payload: RefreshTokenPayload = { id: user.id, email: user.email };
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '14d' });
    return refreshToken;
  }

  async verifiedRefreshToken(refreshToken: string) {
    try {
      await this.checkBlackList(refreshToken);
      const refreshPayload: RefreshTokenPayload = this.jwtService.verify<RefreshTokenPayload>(refreshToken);
      const accessPayload: JwtPayload = { email: refreshPayload.email, id: refreshPayload.id };
      return this.jwtService.sign(accessPayload, { expiresIn: 60 * 30 });
    } catch (error) {
      this.logger.error(error);
      throw new authException('다시 로그인해주세요.');
    }
  }

  async logout(refreshToken: string) {
    try {
      await this.GeneralRedis.set(refreshToken, 'true', 'EX', 60 * 60 * 24 * 3);
    } catch (error) {
      this.logger.error(error);
      throw new authException('로그아웃에 실패했습니다.');
    }
  }

  private async checkBlackList(refreshToken: string) {
    const isBlacklisted = await this.GeneralRedis.get(refreshToken);
    if (isBlacklisted === 'true') {
      throw new UnauthorizedException('다시 로그인해주세요.');
    }
  }
}
