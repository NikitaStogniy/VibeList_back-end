import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WishlistService } from './services/wishlist.service';
import { ReservationService } from './services/reservation.service';
import { ParserGatewayService } from './services/parser-gateway.service';
import { CreateItemDto } from './dto/create-item.dto';
import { CreateItemFromUrlDto } from './dto/create-item-from-url.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { FilterItemsDto } from './dto/filter-items.dto';
import { ParseUrlDto } from './dto/parse-url.dto';
import { ItemResponseDto } from './dto/item-response.dto';

@ApiTags('wishlist')
@Controller('wishlist')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class WishlistController {
  constructor(
    private wishlistService: WishlistService,
    private reservationService: ReservationService,
    private parserGatewayService: ParserGatewayService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new wishlist item (manual or from URL)' })
  @ApiResponse({
    status: 201,
    description: 'Item created successfully',
    schema: {
      type: 'object',
      properties: {
        item: { type: 'object' },
        warnings: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid data or parsing failed' })
  async createItem(@Request() req, @Body() createDto: CreateItemDto) {
    // If productUrl is provided, create from URL
    if (createDto.productUrl) {
      const urlDto: CreateItemFromUrlDto = {
        url: createDto.productUrl,
        priority: createDto.priority,
        isPublic: createDto.isPublic,
      };
      return await this.wishlistService.createItemFromUrl(req.user.userId, urlDto);
    }

    // Otherwise create manually
    if (!createDto.name) {
      throw new BadRequestException('Either name or productUrl must be provided');
    }
    const item = await this.wishlistService.createItem(req.user.userId, createDto);
    return { item };
  }

  @Get('my-items')
  @ApiOperation({ summary: 'Get current user wishlist items' })
  @ApiResponse({ status: 200, description: 'User wishlist items' })
  async getMyItems(@Request() req, @Query() filterDto: FilterItemsDto) {
    return await this.wishlistService.findUserItems(req.user.userId, filterDto);
  }

  @Get('my-stats')
  @ApiOperation({ summary: 'Get wishlist statistics for current user' })
  @ApiResponse({ status: 200, description: 'Wishlist statistics' })
  async getMyStats(@Request() req) {
    return await this.wishlistService.getItemStats(req.user.userId);
  }

  @Get('reserved-by-me')
  @ApiOperation({ summary: 'Get items reserved by current user' })
  @ApiResponse({ status: 200, description: 'Reserved items' })
  async getReservedByMe(@Request() req) {
    return await this.reservationService.getReservedItems(req.user.userId);
  }

  @Get('reserved-by-others')
  @ApiOperation({ summary: 'Get current user items reserved by others' })
  @ApiResponse({ status: 200, description: 'Items reserved by others' })
  async getReservedByOthers(@Request() req) {
    return await this.reservationService.getItemsReservedByOthers(req.user.userId);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get public wishlist items for a specific user' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User public wishlist items' })
  async getUserItems(@Param('userId') userId: string, @Query() filterDto: FilterItemsDto) {
    return await this.wishlistService.findPublicUserItems(userId, filterDto);
  }

  @Get(':itemId')
  @ApiOperation({ summary: 'Get a specific wishlist item by ID' })
  @ApiParam({ name: 'itemId', description: 'Item ID' })
  @ApiResponse({ status: 200, description: 'Wishlist item', type: ItemResponseDto })
  @ApiResponse({ status: 404, description: 'Item not found' })
  async getItem(@Param('itemId') itemId: string) {
    return await this.wishlistService.findItemById(itemId);
  }

  @Put(':itemId')
  @ApiOperation({ summary: 'Update a wishlist item' })
  @ApiParam({ name: 'itemId', description: 'Item ID' })
  @ApiResponse({ status: 200, description: 'Item updated successfully', type: ItemResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  async updateItem(
    @Param('itemId') itemId: string,
    @Request() req,
    @Body() updateDto: UpdateItemDto,
  ) {
    return await this.wishlistService.updateItem(itemId, req.user.userId, updateDto);
  }

  @Delete(':itemId')
  @ApiOperation({ summary: 'Delete a wishlist item' })
  @ApiParam({ name: 'itemId', description: 'Item ID' })
  @ApiResponse({ status: 200, description: 'Item deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  async deleteItem(@Param('itemId') itemId: string, @Request() req) {
    await this.wishlistService.deleteItem(itemId, req.user.userId);
    return { message: 'Item deleted successfully' };
  }

  @Post(':itemId/reserve')
  @ApiOperation({ summary: 'Reserve a wishlist item' })
  @ApiParam({ name: 'itemId', description: 'Item ID' })
  @ApiResponse({ status: 200, description: 'Item reserved successfully' })
  @ApiResponse({ status: 400, description: 'Bad request (already reserved or own item)' })
  async reserveItem(@Param('itemId') itemId: string, @Request() req) {
    return await this.reservationService.reserveItem(itemId, req.user.userId);
  }

  @Delete(':itemId/reserve')
  @ApiOperation({ summary: 'Unreserve a wishlist item' })
  @ApiParam({ name: 'itemId', description: 'Item ID' })
  @ApiResponse({ status: 200, description: 'Item unreserved successfully' })
  @ApiResponse({ status: 400, description: 'Bad request (not reserved)' })
  async unreserveItem(@Param('itemId') itemId: string, @Request() req) {
    return await this.reservationService.unreserveItem(itemId, req.user.userId);
  }

  @Post('parse-url')
  @ApiOperation({ summary: 'Start async parsing of product URL' })
  @ApiResponse({
    status: 202,
    description: 'Parsing job created successfully',
    schema: {
      type: 'object',
      properties: {
        jobId: { type: 'string' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid URL' })
  async parseUrl(@Request() req, @Body() parseDto: ParseUrlDto) {
    const jobId = await this.parserGatewayService.parseUrl(parseDto.url, req.user.userId);
    return {
      jobId,
      message: 'Parsing started. Use the jobId to check status.',
    };
  }

  @Get('parse-status/:jobId')
  @ApiOperation({ summary: 'Get parsing job status' })
  @ApiParam({ name: 'jobId', description: 'Job ID from parse-url endpoint' })
  @ApiResponse({ status: 200, description: 'Job status retrieved' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async getParseStatus(@Param('jobId') jobId: string) {
    return await this.parserGatewayService.getParseStatus(jobId);
  }
}
