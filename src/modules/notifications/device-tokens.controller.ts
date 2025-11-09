import { Controller, Post, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { DeviceTokensService } from './services/device-tokens.service';
import { RegisterDeviceDto } from './dto/register-device.dto';

@ApiTags('device-tokens')
@Controller('device-tokens')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class DeviceTokensController {
  constructor(private deviceTokensService: DeviceTokensService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register device for push notifications' })
  @ApiResponse({ status: 201, description: 'Device registered successfully' })
  async register(@Request() req, @Body() registerDto: RegisterDeviceDto) {
    await this.deviceTokensService.register(
      req.user.userId,
      registerDto.token,
      registerDto.platform,
    );
    return { message: 'Device registered successfully' };
  }

  @Delete(':token')
  @ApiOperation({ summary: 'Unregister device from push notifications' })
  @ApiParam({ name: 'token', description: 'FCM device token' })
  @ApiResponse({ status: 200, description: 'Device unregistered successfully' })
  async unregister(@Request() req, @Param('token') token: string) {
    await this.deviceTokensService.unregister(req.user.userId, decodeURIComponent(token));
    return { message: 'Device unregistered successfully' };
  }
}
