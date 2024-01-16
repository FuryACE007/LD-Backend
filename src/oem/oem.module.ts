import { Module } from '@nestjs/common';
import { OemService } from './oem.service';
import { OemController } from './oem.controller';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  controllers: [OemController],
  providers: [OemService],
})
export class OemModule {}
