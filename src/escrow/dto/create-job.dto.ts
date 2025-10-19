import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class ConsumableSpecDto {
  @ApiProperty({ description: 'Consumable mint address' })
  @IsString()
  mint: string;

  @ApiProperty({ description: 'Max amount allowed for this consumable' })
  @IsString()
  maxAmount: string;
}

export class CreateJobDto {
  @ApiProperty({ description: 'IPLT mint address' })
  @IsString()
  ipltMint: string;

  @ApiProperty({ type: [ConsumableSpecDto] })
  @IsArray()
  consumables: ConsumableSpecDto[];
}
