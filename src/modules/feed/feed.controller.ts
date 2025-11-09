import { Controller, Get, Post, Query, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { FeedService } from './services/feed.service';
import { GetFeedDto } from './dto/get-feed.dto';
import { FeedResponseDto } from './dto/feed-item-response.dto';

@ApiTags('feed')
@Controller('feed')
export class FeedController {
  constructor(private feedService: FeedService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get personalized feed from followed users' })
  @ApiResponse({
    status: 200,
    description: 'Feed items from followed users',
    type: FeedResponseDto
  })
  async getFeed(@Request() req, @Query() getFeedDto: GetFeedDto) {
    return await this.feedService.getUserFeed(req.user.userId, getFeedDto);
  }

  @Post('invalidate-for-user/:userId')
  @ApiOperation({ summary: 'Invalidate feed cache for all followers of a user (internal endpoint)' })
  @ApiResponse({
    status: 200,
    description: 'Feed cache invalidated successfully'
  })
  async invalidateFeedForUser(@Param('userId') userId: string) {
    await this.feedService.invalidateFeedForNewItem(userId);
    return { message: 'Feed cache invalidated successfully' };
  }
}
