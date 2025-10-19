import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber, IsString } from 'class-validator';

export class ConsumableBurnDto {
  @ApiProperty({ description: 'Consumable mint address' })
  @IsString()
  mint: string;

  @ApiProperty({ description: 'Amount to burn' })
  @IsString()
  amount: string;
}

export class SpendLinkedDto {
  @ApiProperty({ description: 'Job PDA address' })
  @IsString()
  jobPda: string;

  @ApiProperty({ description: 'IPLT mint address' })
  @IsString()
  ipltMint: string;

  @ApiProperty({ description: 'Amount of IPLT to spend' })
  @IsString()
  ipltAmount: string;

  @ApiProperty({ description: 'Settlement number for spend' })
  @IsNumber()
  settlementNumber: number;

  @ApiProperty({ type: [ConsumableBurnDto] })
  @IsArray()
  consumableBurns: ConsumableBurnDto[];
}
