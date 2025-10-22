import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber, IsString } from 'class-validator';

export class ConsumableBurnByIndexDto {
  @ApiProperty({ description: 'Index of consumable in job.consumables' })
  @IsNumber()
  index: number;

  @ApiProperty({ description: 'Amount to burn' })
  @IsString()
  amount: string;
}

export class SpendLinkedDto {
  @ApiProperty({ description: 'Job PDA address' })
  @IsString()
  jobPda: string;

  @ApiProperty({ description: 'Amount of IPLT to spend' })
  @IsString()
  ipltAmount: string;

  @ApiProperty({ type: [ConsumableBurnByIndexDto] })
  @IsArray()
  consumableBurnsByIndex: ConsumableBurnByIndexDto[];
}
