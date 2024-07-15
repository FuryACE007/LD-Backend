import { ApiProperty } from '@nestjs/swagger';

export class CallPrintDto {
  @ApiProperty({ description: 'The amount of tokens to send.' })
  amount: number;
  @ApiProperty({ description: 'The token mint address.' })
  tokenMint: string;
  @ApiProperty({ description: 'Mnemonics of the consumable wallet' })
  mnemonics: string;
  // @ApiProperty({ description: 'The owner wallet address' })
  // ownerWalletAddress: string;
}
