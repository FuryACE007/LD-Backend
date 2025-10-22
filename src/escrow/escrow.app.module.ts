import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EscrowModule } from './escrow.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env', '.env.local', '.env.development'],
    }),
    EscrowModule,
  ],
})
export class EscrowAppModule {}