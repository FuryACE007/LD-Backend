import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedemptionCode } from './entities/redemption-code.entity';
import { CollectionMetadata } from './entities/collection-metadata.entity';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([RedemptionCode, CollectionMetadata]),
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
})
export class InventoryModule {}
