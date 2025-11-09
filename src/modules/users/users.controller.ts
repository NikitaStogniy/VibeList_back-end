import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  ClassSerializerInterceptor,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from './users.service';
import { FollowService } from './follow.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SearchUsersDto } from './dto/search-users.dto';
import { UserResponseDto } from './dto/user-response.dto';

@ApiTags('users')
@Controller('users')
@UseInterceptors(ClassSerializerInterceptor)
export class UsersController {
  constructor(
    private usersService: UsersService,
    private followService: FollowService,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Current user profile', type: UserResponseDto })
  async getCurrentUser(@Request() req) {
    return await this.usersService.findById(req.user.userId);
  }

  @Put('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated', type: UserResponseDto })
  async updateProfile(@Request() req, @Body() updateDto: UpdateProfileDto) {
    return await this.usersService.updateProfile(req.user.userId, updateDto);
  }

  @Get('search')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Search users' })
  @ApiResponse({ status: 200, description: 'Search results' })
  async searchUsers(@Query() searchDto: SearchUsersDto) {
    return await this.usersService.searchUsers(searchDto);
  }

  @Get(':userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'User profile', type: UserResponseDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUser(@Param('userId') userId: string) {
    return await this.usersService.findById(userId);
  }

  @Get('username/:username')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get user by username' })
  @ApiResponse({ status: 200, description: 'User profile', type: UserResponseDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserByUsername(@Param('username') username: string) {
    return await this.usersService.findByUsername(username);
  }

  @Post(':userId/follow')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Follow a user' })
  @ApiResponse({ status: 200, description: 'Successfully followed user' })
  @ApiResponse({ status: 400, description: 'Bad request (already following or self-follow)' })
  async followUser(@Request() req, @Param('userId') userId: string) {
    await this.followService.followUser(req.user.userId, userId);
    return { message: 'Successfully followed user' };
  }

  @Delete(':userId/follow')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Unfollow a user' })
  @ApiResponse({ status: 200, description: 'Successfully unfollowed user' })
  @ApiResponse({ status: 400, description: 'Not following this user' })
  async unfollowUser(@Request() req, @Param('userId') userId: string) {
    await this.followService.unfollowUser(req.user.userId, userId);
    return { message: 'Successfully unfollowed user' };
  }

  @Get(':userId/following')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Check if following a user' })
  @ApiResponse({ status: 200, description: 'Following status' })
  async isFollowing(@Request() req, @Param('userId') userId: string) {
    const isFollowing = await this.followService.isFollowing(req.user.userId, userId);
    return { isFollowing };
  }

  @Get(':userId/followers')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get user followers' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of followers' })
  async getFollowers(
    @Param('userId') userId: string,
    @Query('limit') limit: number = 20,
    @Query('offset') offset: number = 0,
  ) {
    return await this.usersService.getFollowers(userId, limit, offset);
  }

  @Get(':userId/following-list')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get users that this user is following' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of following' })
  async getFollowing(
    @Param('userId') userId: string,
    @Query('limit') limit: number = 20,
    @Query('offset') offset: number = 0,
  ) {
    return await this.usersService.getFollowing(userId, limit, offset);
  }
}
