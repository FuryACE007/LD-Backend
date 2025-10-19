import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class DepositConsumableDto {
  @ApiProperty({ description: 'Job PDA address' })
  @IsString()
  jobPda: string;

  @ApiProperty({ description: 'Consumable mint address' })
  @IsString()
  consumableMint: string;

  @ApiProperty({ description: 'Amount of consumable to deposit' })
  @IsString()
  amount: string;
}