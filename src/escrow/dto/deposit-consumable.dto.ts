import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString } from 'class-validator';

export class DepositConsumableDto {
  @ApiProperty({ description: 'Job PDA address' })
  @IsString()
  jobPda: string;

  @ApiProperty({ description: 'Index of consumable in job.consumables' })
  @IsInt()
  consumableIndex: number;

  @ApiProperty({ description: 'Amount of consumable to deposit' })
  @IsString()
  amount: string;
}
