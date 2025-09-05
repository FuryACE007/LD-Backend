import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedemptionCode } from './entities/redemption-code.entity';

@Module({
  imports: [HttpModule, TypeOrmModule.forFeature([RedemptionCode])],
  controllers: [InventoryController],
  providers: [InventoryService],
})
export class InventoryModule {}
