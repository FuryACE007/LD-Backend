import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { InventoryModule } from './inventory/inventory.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { validationSchema } from './config/validation.schema';
import { getDatabaseConfig } from './config/database.config';
import { RedemptionCode } from './inventory/entities/redemption-code.entity';
import { envConfiguration } from './config/env.config';
import { EscrowModule } from './escrow/escrow.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema,
      cache: true,
      ...envConfiguration(),
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: getDatabaseConfig,
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([RedemptionCode]),
    InventoryModule,
    EscrowModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
