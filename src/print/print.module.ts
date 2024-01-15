import { Module } from '@nestjs/common';
import { PrintService } from './print.service';
import { PrintController } from './print.controller';

@Module({
  controllers: [PrintController],
  providers: [PrintService],
})
export class PrintModule {}
