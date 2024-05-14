import { KeypairSigner } from '@metaplex-foundation/umi';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWalletsDto {
  @ApiProperty({ description: 'The number of wallets to create.' })
  numberOfWallets: number;

  @ApiProperty({ description: 'The signer for the wallets.' })
  signer: KeypairSigner;

  @ApiProperty({ description: 'The number of tokens per wallet.' })
  tokensPerWallet: number;
}
