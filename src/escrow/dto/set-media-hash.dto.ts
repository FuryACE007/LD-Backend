import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class SetMediaHashDto {
  @ApiProperty({ description: 'Job PDA address' })
  @IsString()
  jobPda: string;

  @ApiProperty({ description: 'Media hash to set' })
  @IsString()
  mediaHash: string;
}
