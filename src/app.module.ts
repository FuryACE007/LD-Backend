import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { InventoryModule } from './inventory/inventory.module';
import { ConfigModule } from '@nestjs/config';

ConfigModule.forRoot();

@Module({
  imports: [InventoryModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
