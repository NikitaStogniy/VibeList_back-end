import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';

export interface RefreshTokenPayload {
  sub: string;
  email: string;
  username: string;
  isActive: boolean;
  jti?: string;
}

interface RefreshTokenValidationResult {
  userId: string;
  email: string;
  refreshToken: string;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: RefreshTokenPayload): Promise<RefreshTokenValidationResult> {
    const refreshToken = req.body?.refreshToken;

    if (!refreshToken || typeof refreshToken !== 'string') {
      throw new UnauthorizedException('Missing refresh token');
    }

    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    return {
      userId: payload.sub,
      email: '',  // Not included in refresh token payload for security
      refreshToken,
    };
  }
}
