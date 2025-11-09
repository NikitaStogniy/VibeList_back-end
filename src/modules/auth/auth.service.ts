import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { TokenService } from './token.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';

interface RefreshTokenPayload {
  sub: string;
  email: string;
  username: string;
  isActive: boolean;
  jti?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private tokenService: TokenService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const user = await this.usersService.create({
      email: registerDto.email,
      username: registerDto.username,
      password: registerDto.password,
      displayName: registerDto.displayName,
    });

    const { accessToken, refreshToken } = await this.tokenService.generateTokens(user);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
      },
      token: accessToken,
      refreshToken,
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.usersService.findByEmail(loginDto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await this.usersService.validatePassword(user, loginDto.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const { accessToken, refreshToken } = await this.tokenService.generateTokens(user);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
      },
      token: accessToken,
      refreshToken,
    };
  }

  async refreshTokens(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    // Verify token signature and decode payload
    let decoded: RefreshTokenPayload;
    try {
      decoded = this.jwtService.verify<RefreshTokenPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Validate required fields
    if (!decoded.sub || !decoded.jti) {
      throw new UnauthorizedException('Invalid refresh token payload');
    }

    // Validate token in database (ensures it hasn't been revoked)
    const storedToken = await this.tokenService.validateRefreshTokenByJti(decoded.jti);

    if (!storedToken) {
      throw new UnauthorizedException('Invalid or revoked refresh token');
    }

    // Verify user still exists and is active
    const user = await this.usersService.findById(decoded.sub);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is deactivated');
    }

    // Token rotation: revoke old token by jti
    await this.tokenService.revokeByJti(decoded.jti);

    // Generate new tokens with new jti
    return await this.tokenService.generateTokens(user);
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    await this.tokenService.revokeRefreshToken(refreshToken);
  }

  async logoutAll(userId: string): Promise<void> {
    await this.tokenService.revokeAllUserTokens(userId);
  }
}
