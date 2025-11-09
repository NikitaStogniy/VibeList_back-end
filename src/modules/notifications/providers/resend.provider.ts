import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export const RESEND_CLIENT = 'RESEND_CLIENT';

export const ResendProvider: Provider = {
  provide: RESEND_CLIENT,
  useFactory: (configService: ConfigService) => {
    const apiKey = configService.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is not configured');
    }
    return new Resend(apiKey);
  },
  inject: [ConfigService],
};
