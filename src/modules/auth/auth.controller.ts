import { Controller, Post, Body, UseGuards, Get, Request, Param, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { OAuthService } from './oauth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { AppleAuthDto } from './dto/apple-auth.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UsersService } from '../users/users.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private oauthService: OAuthService,
    private usersService: UsersService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully', type: AuthResponseDto })
  @ApiResponse({ status: 409, description: 'Email or username already exists' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponseDto> {
    return await this.authService.register(registerDto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({ status: 200, description: 'Login successful', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    return await this.authService.login(loginDto);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return await this.authService.refreshTokens(refreshTokenDto.refreshToken);
  }

  @Post('google')
  @ApiOperation({ summary: 'Authenticate with Google (mobile)' })
  @ApiResponse({ status: 200, description: 'Google authentication successful', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid Google token' })
  async googleAuth(@Body() googleAuthDto: GoogleAuthDto): Promise<AuthResponseDto> {
    return await this.oauthService.googleAuth(googleAuthDto);
  }

  @Post('apple')
  @ApiOperation({ summary: 'Authenticate with Apple (mobile)' })
  @ApiResponse({ status: 200, description: 'Apple authentication successful', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid Apple token' })
  async appleAuth(@Body() appleAuthDto: AppleAuthDto): Promise<AuthResponseDto> {
    return await this.oauthService.appleAuth(appleAuthDto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async logout(@Request() req, @Body() refreshTokenDto: RefreshTokenDto) {
    await this.authService.logout(req.user.userId, refreshTokenDto.refreshToken);
    return { message: 'Logout successful' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current user' })
  @ApiResponse({ status: 200, description: 'Current user info' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getProfile(@Request() req) {
    return req.user;
  }

  @Get('verify/:userId')
  @ApiOperation({ summary: 'Verify user exists and is active' })
  @ApiResponse({ status: 200, description: 'User verification info' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async verifyUser(@Param('userId') userId: string) {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      isActive: user.isActive,
      email: user.email,
      username: user.username,
    };
  }
}
