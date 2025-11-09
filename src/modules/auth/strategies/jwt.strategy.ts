import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';

export interface JwtPayload {
  sub: string;
  email: string;
  username: string;
  isActive: boolean;
  jti?: string;
}

export interface UserFromJwt {
  userId: string;
  email: string;
  username: string;
  jti?: string;
  isActive: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<UserFromJwt> {
    // Validate required fields
    if (!payload.sub || !payload.jti) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // Check isActive flag from JWT payload first (fast check)
    if (payload.isActive === false) {
      throw new UnauthorizedException('User account is deactivated');
    }

    // Optionally verify user in database (for critical operations)
    const user = await this.usersService.findById(payload.sub);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return {
      userId: payload.sub,
      email: payload.email,
      username: payload.username,
      jti: payload.jti,
      isActive: user.isActive,
    };
  }
}
