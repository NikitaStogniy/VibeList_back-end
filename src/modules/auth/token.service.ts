import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RefreshToken } from '@database/entities/refresh-token.entity';
import { User } from '@database/entities/user.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  async generateTokens(user: User): Promise<{ accessToken: string; refreshToken: string }> {
    // Generate unique JWT IDs for both tokens
    const accessJti = uuidv4();
    const refreshJti = uuidv4();

    const payload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      isActive: user.isActive,
    };

    const accessToken = this.jwtService.sign(
      { ...payload, jti: accessJti },
      {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>('JWT_EXPIRATION', '15m'),
      }
    );

    const refreshToken = this.jwtService.sign(
      { ...payload, jti: refreshJti },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRATION', '7d'),
      }
    );

    // Store refresh token in database with jti
    await this.storeRefreshToken(user.id, refreshToken, refreshJti);

    return { accessToken, refreshToken };
  }

  async storeRefreshToken(userId: string, token: string, jti: string): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    const refreshToken = this.refreshTokenRepository.create({
      userId,
      token,
      jti,
      expiresAt,
    });

    try {
      await this.refreshTokenRepository.save(refreshToken);
    } catch (error) {
      // Handle duplicate key error gracefully (token with same jti already exists)
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        this.logger.warn(`Refresh token with jti ${jti} already exists, skipping...`);
        return;
      }
      throw error;
    }
  }

  async validateRefreshToken(token: string): Promise<RefreshToken | null> {
    // For backward compatibility: try to find by token first (old tokens without jti)
    const refreshToken = await this.refreshTokenRepository.findOne({
      where: { token, revoked: false },
    });

    if (!refreshToken) {
      return null;
    }

    // Check if expired
    if (refreshToken.expiresAt < new Date()) {
      return null;
    }

    return refreshToken;
  }

  async validateRefreshTokenByJti(jti: string): Promise<RefreshToken | null> {
    const refreshToken = await this.refreshTokenRepository.findOne({
      where: { jti, revoked: false },
    });

    if (!refreshToken) {
      return null;
    }

    // Check if expired
    if (refreshToken.expiresAt < new Date()) {
      return null;
    }

    return refreshToken;
  }

  async revokeRefreshToken(token: string): Promise<void> {
    await this.refreshTokenRepository.update({ token }, { revoked: true });
  }

  async revokeByJti(jti: string): Promise<void> {
    await this.refreshTokenRepository.update({ jti }, { revoked: true });
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.refreshTokenRepository.update({ userId }, { revoked: true });
  }
}
