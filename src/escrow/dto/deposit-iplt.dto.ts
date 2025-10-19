import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class DepositIpltDto {
  @ApiProperty({ description: 'Job PDA address' })
  @IsString()
  jobPda: string;

  @ApiProperty({ description: 'IPLT mint address' })
  @IsString()
  ipltMint: string;

  @ApiProperty({ description: 'Amount of IPLT to deposit' })
  @IsString()
  amount: string;
}