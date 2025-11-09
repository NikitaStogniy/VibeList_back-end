import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import appleSignin from 'apple-signin-auth';
import { UsersService } from '../users/users.service';
import { TokenService } from './token.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { AppleAuthDto } from './dto/apple-auth.dto';

interface AppleUserInfo {
  firstName?: string;
  lastName?: string;
}

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);
  private googleClient: OAuth2Client;

  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
    private tokenService: TokenService,
  ) {
    const googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    this.googleClient = new OAuth2Client(googleClientId);
  }

  async googleAuth(googleAuthDto: GoogleAuthDto): Promise<AuthResponseDto> {
    try {
      // Verify the Google ID token
      const ticket = await this.googleClient.verifyIdToken({
        idToken: googleAuthDto.idToken,
        audience: this.configService.get<string>('GOOGLE_CLIENT_ID'),
      });

      const payload = ticket.getPayload();

      if (!payload || !payload.email) {
        throw new UnauthorizedException('Invalid Google token payload');
      }

      const { sub: googleId, email, name, picture } = payload;

      // Find or create user
      let user = await this.usersService.findByEmail(email);

      if (!user) {
        // Create new user with Google OAuth
        const username = await this.generateUniqueUsername(email);

        user = await this.usersService.createOAuthUser({
          email,
          username,
          displayName: name || username,
          avatarUrl: picture,
          provider: 'google',
          providerId: googleId,
          emailVerified: payload.email_verified || false,
        });

        this.logger.log(`New user created via Google OAuth: ${user.id}`);
      } else {
        // Update OAuth info if user exists
        await this.usersService.updateOAuthInfo(user.id, 'google', googleId);
      }

      // Generate JWT tokens
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
    } catch (error) {
      this.logger.error('Google authentication failed:', error);
      throw new UnauthorizedException('Google authentication failed');
    }
  }

  async appleAuth(appleAuthDto: AppleAuthDto): Promise<AuthResponseDto> {
    try {
      // Verify the Apple identity token
      const appleIdTokenClaims = await appleSignin.verifyIdToken(appleAuthDto.identityToken, {
        audience: this.configService.get<string>('APPLE_CLIENT_ID'),
        nonce: 'nonce', // You might want to implement nonce validation
      });

      if (!appleIdTokenClaims || !appleIdTokenClaims.email) {
        throw new UnauthorizedException('Invalid Apple token payload');
      }

      const { sub: appleId, email, email_verified } = appleIdTokenClaims;

      // Parse user info if provided (only on first sign-in)
      let userInfo: AppleUserInfo | undefined;
      if (appleAuthDto.user) {
        try {
          userInfo = JSON.parse(appleAuthDto.user);
        } catch (e) {
          this.logger.warn('Failed to parse Apple user info');
        }
      }

      // Find or create user
      let user = await this.usersService.findByEmail(email);

      if (!user) {
        // Create new user with Apple OAuth
        const username = await this.generateUniqueUsername(email);
        const displayName = userInfo
          ? `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || username
          : username;

        user = await this.usersService.createOAuthUser({
          email,
          username,
          displayName,
          provider: 'apple',
          providerId: appleId,
          emailVerified: email_verified === 'true' || email_verified === true,
        });

        this.logger.log(`New user created via Apple OAuth: ${user.id}`);
      } else {
        // Update OAuth info if user exists
        await this.usersService.updateOAuthInfo(user.id, 'apple', appleId);
      }

      // Generate JWT tokens
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
    } catch (error) {
      this.logger.error('Apple authentication failed:', error);
      throw new UnauthorizedException('Apple authentication failed');
    }
  }

  private async generateUniqueUsername(email: string): Promise<string> {
    const baseUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    let username = baseUsername;
    let counter = 1;

    while (await this.usersService.findByUsername(username)) {
      username = `${baseUsername}${counter}`;
      counter++;
    }

    return username;
  }
}
