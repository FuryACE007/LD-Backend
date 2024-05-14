import { PublicKey } from '@metaplex-foundation/umi';

export class SendTokensDto {
  tokenMint: PublicKey;
  amount: number;
  destinationWalletAddress: string;
  mnemonic: string;
}
