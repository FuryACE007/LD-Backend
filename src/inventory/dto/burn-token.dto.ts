import { ApiProperty } from '@nestjs/swagger';

export class BurnTokensDto {
  @ApiProperty({ description: 'The mint address of the token.' })
  tokenMint: string;

  @ApiProperty({ description: 'The mnemonics for the owner wallet.' })
  mnemonics: string;

  @ApiProperty({ description: 'The wallet address of the token owner.' })
  ownerWalletAddress: string;
}
