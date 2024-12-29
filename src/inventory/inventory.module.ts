import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { HttpModule } from '@nestjs/axios';
import { InventoryGateway } from './inventory.gateway';

@Module({
  imports: [HttpModule],
  controllers: [InventoryController],
  providers: [InventoryService, InventoryGateway],
})
export class InventoryModule {}
