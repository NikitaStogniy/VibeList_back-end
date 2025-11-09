import { IsUrl, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ParseUrlDto {
  @ApiProperty({
    example: 'https://www.amazon.com/dp/B0BXFGX1K5',
    description: 'Product URL to parse'
  })
  @IsUrl()
  @IsNotEmpty()
  url: string;
}
