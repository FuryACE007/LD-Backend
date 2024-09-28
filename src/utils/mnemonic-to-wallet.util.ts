import {
  createSignerFromKeypair,
  KeypairSigner,
  Umi,
} from '@metaplex-foundation/umi';
import { mnemonicToSeed } from 'bip39';
import bs58 from 'bs58';

export const mnemonicToWallet = async (mnemonic: string, umi: Umi) => {
  const seed = await mnemonicToSeed(mnemonic);
  const seed32 = new Uint8Array(seed.toJSON().data.slice(0, 32));

  // Generate Keypair from the seed
  const keypair = umi?.eddsa.createKeypairFromSeed(seed32);
  const signer = createSignerFromKeypair(umi, keypair);
  const secretKeyString = bs58.encode(keypair.secretKey);

  const getPrivateKeyStrings = (): string => {
    return secretKeyString;
  };

  const getSigner = (): KeypairSigner => {
    return signer;
  };

  const getKeypair = () => {
    return keypair;
  };

  return {
    getPrivateKeyStrings,
    getSigner,
    getKeypair,
  };
};
