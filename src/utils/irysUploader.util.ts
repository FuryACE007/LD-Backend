import { Uploader } from '@irys/upload';
import { Solana } from '@irys/upload-solana';
import { Umi } from '@metaplex-foundation/umi';
import { mnemonicToWallet } from './mnemonic-to-wallet.util';

export const getIrysUploader = async (mnemonics: string, umi: Umi) => {
  const uploaderRpc = 'https://gateway.irys.xyz/';
  const privateKeyString = (
    await mnemonicToWallet(mnemonics, umi)
  ).getPrivateKeyStrings();
  const irysUploader = await Uploader(Solana)
    .withRpc(uploaderRpc)
    .withWallet(privateKeyString);
  return irysUploader;
};
