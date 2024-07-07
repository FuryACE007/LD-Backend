import { ApiProperty } from '@nestjs/swagger';

export class CloseTokenAccountDto {
  @ApiProperty({ description: 'The token account address to close.' })
  walletAddress: string;

  @ApiProperty({ description: 'The token mint address.' })
  tokenMint: string;
}
