import { KeypairSigner } from '@metaplex-foundation/umi';

export class CreateWalletsDto {
  numberOfWallets: number;
  signer: KeypairSigner;
  tokensPerWallet: number;
}
