import { PublicKey } from '@metaplex-foundation/umi';

export class SendTokensDto {
  tokenMint: string;
  amount: number;
  destinationWalletAddress: string;
  mnemonic: string;
}
