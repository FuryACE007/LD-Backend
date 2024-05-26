import { ApiProperty } from '@nestjs/swagger';

export class SendTokensDto {
  @ApiProperty({ description: 'The mint address of the token.' })
  tokenMint: string;

  @ApiProperty({ description: 'The amount of tokens to send.' })
  amount: number;

  @ApiProperty({ description: 'The wallet address of the owner.' })
  ownerWalletAddress: string;

  @ApiProperty({ description: 'The destination wallet address.' })
  destinationWalletAddress: string;

  @ApiProperty({ description: 'The mnemonics for the owner wallet.' })
  mnemonics: string;
}
