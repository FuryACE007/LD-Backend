import { Injectable } from '@nestjs/common';
import {
  TokenStandard,
  fetchAllDigitalAssetByOwner,
  mintV1,
  mplTokenMetadata,
} from '@metaplex-foundation/mpl-token-metadata';
import {
  KeypairSigner,
  SolAmount,
  Umi,
  createSignerFromKeypair,
  publicKey,
  signerIdentity,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { irysUploader } from '@metaplex-foundation/umi-uploader-irys';
import { generateMnemonic, mnemonicToSeed } from 'bip39';
import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { transferSol } from '@metaplex-foundation/mpl-toolbox';
import { getAssociatedTokenAddress } from '@solana/spl-token';

@Injectable()
export class OemService {
  private readonly umi: Umi;

  constructor() {
    this.umi = createUmi(process.env.RPC_ENDPOINT);
    this.umi.use(mplTokenMetadata());
    this.umi.use(
      irysUploader({
        address: 'https://devnet.irys.xyz',
      }),
    );
  }
  /*--------------------- HELPER FUNCTIONS------------------------------------ */
  generateUmi(signer: KeypairSigner): Umi {
    return createUmi(process.env.RPC_ENDPOINT)
      .use(mplTokenMetadata())
      .use(
        irysUploader({
          address: 'https://devnet.irys.xyz',
        }),
      )
      .use(signerIdentity(signer));
  }

  // price calculation function
  calculateMintPriceInLamports(amount: number) {
    const lamports = amount * 0.0000001 * LAMPORTS_PER_SOL; // 0.0000001 SOLs per token
    return Math.ceil(lamports);
  }

  // ----------------------------------------------------------------

  async createOemWallet(): Promise<JSON> {
    // Generating mnemonic for the wallet
    const mnemonic = generateMnemonic();

    // Create seed phrase from mnemonic
    const seed = await mnemonicToSeed(mnemonic);
    const seed32 = new Uint8Array(seed.toJSON().data.slice(0, 32));

    //Generate Keypair from the seed
    const keypair = this.umi.eddsa.createKeypairFromSeed(seed32);
    const signer = createSignerFromKeypair(this.umi, keypair);
    // const newUmi = this.generateUmi(signer);

    // let balance = await newUmi.rpc.getBalance(newUmi.identity.publicKey);
    // let balanceSol = Number(balance.basisPoints) / LAMPORTS_PER_SOL;

    const wallet = {
      mnemonic,
      keypair: signer,
      // balance: balanceSol,
    };

    return JSON.parse(JSON.stringify(wallet));
  }
  // Would UMI's state be persisted anywhere ? -- Nope, create a new instance everytime.
  // So once a user has generated their OEM wallet¸ their wallet object would be persisted on browser cache/local storage
  // If the user has a wallet, but it's not stored on local storage, then he can enter the mnemonics to login.

  /*-----------------------Create Consumable Wallets-----------------------------*/
  async createConsumableWallet(
    numOfWallets: number,
    signer: KeypairSigner, // to be retrieved from the local storage and then sent with the request
    tokensPerWallet: number,
  ) {
    const newUmi = this.generateUmi(signer); // generating a new Umi instance with the OEM's signer
    const wallets = [];
    const consumableWallets = numOfWallets;
    const batchSize = 7;

    for (
      let batchIndex = 0;
      batchIndex < Math.ceil(+consumableWallets / batchSize);
      batchIndex++
    ) {
      let txBuilder = transactionBuilder();

      const price = this.calculateMintPriceInLamports(
        +consumableWallets * tokensPerWallet,
      );

      const solPrice: SolAmount = {
        identifier: 'SOL',
        decimals: 9,
        basisPoints: BigInt(price),
      };
      // Accepting fee for the tokens
      txBuilder = txBuilder.add(
        transferSol(newUmi, {
          source: newUmi.payer,
          destination: publicKey(
            '3moPQrUksj91Pu1LWCAWH8FzQEEQocwBbMCmC1Rc1EaM', // LUCID Wallet Address
          ),
          amount: solPrice,
        }),
      );

      const start = batchIndex * batchSize;
      const end = Math.min((batchIndex + 1) * batchSize, +consumableWallets);

      for (let i = start; i < end; i++) {
        // generate wallet
        // Generating mnemonic for the wallet
        const mnemonic = generateMnemonic();

        // Create seed phrase from mnemonic
        const seed = await mnemonicToSeed(mnemonic);
        const seed32 = new Uint8Array(seed.toJSON().data.slice(0, 32));

        //Generate Keypair from the seed
        const keypair = newUmi.eddsa.createKeypairFromSeed(seed32);

        wallets.push(mnemonic);

        txBuilder = txBuilder.add(
          /** !!ONE BIG PROBLEM: How to add this wallet as the mint authirity when lucid creates a token ?
           * Possible Solution: LUCID creates an OEM wallet, funds it and then
           * **/
          mintV1(newUmi, {
            // Need to make the min pubkey address taken from the user input -- PENDING
            mint: publicKey('2uT3YF6v5178p5mkx62ak11HHmVoxgbzrG9÷dfhtF879e'), // Minting only the White Toner Cartridge Token
            authority: newUmi.identity, // The OEM would mint the tokens on behalf of the consumable wallets
            amount: tokensPerWallet * 1000, // decimal value of token: 1000
            tokenOwner: publicKey(keypair.publicKey),
            tokenStandard: TokenStandard.Fungible,
          }),
        );
        /* Funding the wallets with some SOLs to be able to pay their fees */
        const txPrice: SolAmount = {
          identifier: 'SOL',
          decimals: 9,
          basisPoints: BigInt(1000000), // 1000000000 = 1 SOL, 0.001 SOL
        };

        txBuilder = txBuilder.add(
          transferSol(newUmi, {
            source: newUmi.payer,
            destination: publicKey(keypair.publicKey),
            amount: txPrice,
          }),
        );
      }
      // Signing the transaction
      const confirmResult = await txBuilder.sendAndConfirm(newUmi); // Builds the txns, sends it and confirms the transaction

      confirmResult && console.log('Txn signature: ' + confirmResult);

      return wallets;
    }
  }
  /*------------------------------------------------------------------------------------------------------*/

  /* ============================Login using mnemoics and store signer on the local storage=============================== */
  async loginOem(mnemonic: string): Promise<KeypairSigner> {
    // Create seed phrase from mnemonic
    const seed = await mnemonicToSeed(mnemonic);
    const seed32 = new Uint8Array(seed.toJSON().data.slice(0, 32));

    //Generate Keypair from the seed
    const keypair = this.umi.eddsa.createKeypairFromSeed(seed32);
    const signer = createSignerFromKeypair(this.umi, keypair);

    return signer; // This signer can then be stored on local storage and then sent along with every request
  }

  /* ================================ Get wallet balance========================================= */
  async getWalletBalance(pubkey: string): Promise<Number> {
    const balance = await this.umi.rpc.getBalance(publicKey(pubkey));
    const balanceSol = Number(balance.basisPoints) / LAMPORTS_PER_SOL;

    return balanceSol;
  }
  /* ================================ Get token data========================================= */

  async getTokenData(walletAddress: string): Promise<JSON> {
    const connection = new Connection(process.env.RPC_ENDPOINT);
    const assets = await fetchAllDigitalAssetByOwner(
      this.umi,
      publicKey(walletAddress),
    );
    if (assets.length < 0) throw new Error('No assets found');
    const asset = assets.at(0);
    const pub = new PublicKey(asset.publicKey);

    const tokenAccount = await getAssociatedTokenAddress(
      pub,
      new PublicKey('6Vt52q418Q63KD1Uk1bgRjwdaoJMUsRLNqpMiYu4N1s9'), // creater is the owner of the token account
    );

    let balance = await connection.getTokenAccountBalance(tokenAccount);
    let balanceValue = 0;
    // if (!balance.value.uiAmount) balanceValue = 0;
    // else balanceValue = balance.value.uiAmount;

    if (balance.value.uiAmount) balanceValue = balance.value.uiAmount;

    const result = {
      name: asset.metadata.name,
      symbol: asset.metadata.symbol,
      metadataUri: asset.metadata.uri,
      balance: balanceValue,
    };

    return JSON.parse(JSON.stringify(result));
  }
}
