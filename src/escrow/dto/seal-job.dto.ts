import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class SealJobDto {
  @ApiProperty({ description: 'Job PDA address' })
  @IsString()
  jobPda: string;
}