import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ParserService } from './services/parser.service';
import { ScrapflyService } from './services/scrapfly.service';
import { OzonParser } from './services/ozon.parser';

@Module({
  imports: [ConfigModule],
  providers: [
    ParserService,
    ScrapflyService,
    OzonParser,
  ],
  exports: [ParserService],
})
export class ParserModule {}
