import { Module } from '@nestjs/common';
import { EscrowModule } from './escrow.module';

@Module({
  imports: [EscrowModule],
})
export class EscrowAppModule {}