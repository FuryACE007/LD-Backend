/**
 * @file This file contains the implementation of the InventoryService class.
 * @summary This code is owned and developed by Lucid Dream Software, Inc.
 * @contributor Sudhanshu Shekhar
 */

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
import {
  createTokenIfMissing,
  findAssociatedTokenPda,
  transferSol,
  transferTokens,
} from '@metaplex-foundation/mpl-toolbox';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, min } from 'rxjs';

@Injectable()
export class InventoryService {
  private readonly umi: Umi;

  constructor(private httpService: HttpService) {
    this.umi = createUmi(process.env.RPC_ENDPOINT);
    this.umi.use(mplTokenMetadata());
    this.umi.use(
      irysUploader({
        address: 'https://devnet.irys.xyz',
      }),
    );
  }

  /*--------------------- HELPER FUNCTIONS------------------------------------ */

  /**
   * Generates a Umi instance with the specified signer.
   * @param signer - The KeypairSigner to be used for signing transactions.
   * @returns The generated Umi instance.
   */
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

  /**
   * Calculates the mint price in lamports based on the given amount.
   * @param amount - The amount of tokens.
   * @returns The mint price in lamports.
   */
  calculateMintPriceInLamports(amount: number) {
    const lamports = amount * 0.0000001 * LAMPORTS_PER_SOL; // 0.0000001 SOLs per token
    return Math.ceil(lamports);
  }

  async loadWallet(mnemonic: string): Promise<KeypairSigner> {
    // Create seed phrase from mnemonic
    const seed = await mnemonicToSeed(mnemonic);
    const seed32 = new Uint8Array(seed.toJSON().data.slice(0, 32));

    //Generate Keypair from the seed
    const keypair = this.umi.eddsa.createKeypairFromSeed(seed32);
    const signer = createSignerFromKeypair(this.umi, keypair);

    return signer;
  }

  // ----------------------------------------------------------------

  /**
   * Creates an inventory wallet.
   * @returns A Promise that resolves to a JSON object representing the created wallet.
   */
  async createInventoryWallet(): Promise<JSON> {
    // Generating mnemonic for the wallet
    const mnemonic = generateMnemonic();

    // Create seed phrase from mnemonic
    const seed = await mnemonicToSeed(mnemonic);
    const seed32 = new Uint8Array(seed.toJSON().data.slice(0, 32));

    //Generate Keypair from the seed
    const keypair = this.umi.eddsa.createKeypairFromSeed(seed32);
    const signer = createSignerFromKeypair(this.umi, keypair);

    const wallet = {
      mnemonic,
      keypair: signer,
    };

    return JSON.parse(JSON.stringify(wallet));
  }

  /*-----------------------Create Consumable Wallets-----------------------------*/
  /**
   * Creates consumable wallets.
   *
   * @param numOfWallets The number of wallets to create.
   * @param signer The KeypairSigner retrieved from local storage and sent with the request.
   * @param tokensPerWallet The number of tokens per wallet.
   * @returns An array of generated wallet mnemonics.
   */
  async createConsumableWallet(
    numOfWallets: number,
    signer: KeypairSigner, // to be retrieved from the local storage and then sent with the request
    tokensPerWallet: number,
  ) {
    const newUmi = this.generateUmi(signer); // generating a new Umi instance with the OEM's signer
    const wallets = [];
    const consumableWallets = numOfWallets;
    const batchSize = 5;

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
  /**
   * Logs in to the inventory using the provided mnemonic.
   *
   * @param mnemonic - The mnemonic used to generate the seed phrase.
   * @returns A Promise that resolves to a KeypairSigner object.
   */
  async loginInventory(mnemonic: string): Promise<string> {
    // Create seed phrase from mnemonic
    const seed = await mnemonicToSeed(mnemonic);
    const seed32 = new Uint8Array(seed.toJSON().data.slice(0, 32));

    //Generate Keypair from the seed
    const keypair = this.umi.eddsa.createKeypairFromSeed(seed32);
    const signer = createSignerFromKeypair(this.umi, keypair);

    return JSON.stringify({ publicKey: signer.publicKey.toString() });
  }

  /* ================================ Get wallet balance========================================= */
  /**
   * Retrieves the wallet balance for the specified public key.
   * @param pubkey - The public key of the wallet.
   * @returns A promise that resolves to the wallet balance in SOL.
   */
  async getWalletBalance(pubkey: string): Promise<number> {
    const balance = await this.umi.rpc.getBalance(publicKey(pubkey));
    const balanceSol = Number(balance.basisPoints) / LAMPORTS_PER_SOL;

    return balanceSol;
  }
  /* ================================ Get token data========================================= */

  /**
   * Retrieves token data for a given wallet address.
   * @param walletAddress - The wallet address for which to retrieve token data.
   * @returns A Promise that resolves to a string representation of the token data.
   * @throws An error if no assets are found.
   */
  async getTokenData(walletAddress: string): Promise<string> {
    const connection = new Connection(process.env.RPC_ENDPOINT);
    const assets = await fetchAllDigitalAssetByOwner(
      this.umi,
      publicKey(walletAddress),
    );
    if (assets.length < 0) throw new Error('No assets found');

    const tokenDataPromises = assets.map(async (asset) => {
      const pub = new PublicKey(asset.publicKey);

      const tokenAccount = await getAssociatedTokenAddress(
        pub,
        new PublicKey(walletAddress), // creater is the owner of the token account
      );

      let balance = await connection.getTokenAccountBalance(tokenAccount);
      let balanceValue = 0;
      if (balance.value.uiAmount) balanceValue = balance.value.uiAmount;

      try {
        const metadataResponse = await firstValueFrom(
          this.httpService.get(asset.metadata.uri),
        );
        const metadata = metadataResponse.data;

        const result = {
          name: asset.metadata.name,
          symbol: asset.metadata.symbol,
          metadata,
          balance: balanceValue,
          mintAddress: asset.mint.publicKey,
        };

        return result;
      } catch (error) {
        throw new Error(error);
      }
    });

    const tokenData = await Promise.all(tokenDataPromises); // Wait for all promises to resolve

    return JSON.stringify(tokenData);
  }

  /**-------------------------------Send Tokens------------------------------------------- */

  /**
   * Sends tokens from one wallet to another.
   * @param amount - The amount of tokens to send.
   * @param tokenMint - The token mint address.
   * @param mnemonics - The mnemonic for the owner's wallet.
   * @param ownerWalletAddress - The address of the owner's wallet.
   * @param destinationWalletAddress - The address of the destination wallet.
   */
  async sendTokens(
    amount: number,
    tokenMint: string,
    mnemonics: string,
    ownerWalletAddress: string,
    destinationWalletAddress: string,
  ) {
    const signer = await this.loadWallet(mnemonics); // the owner's wallet signer
    const feePayer = await this.loadWallet(process.env.PAYER_MNEMONIC); // Lucid signer sponsoring the transaction fees

    const umiInstance = this.generateUmi(feePayer);

    const ownerWallet = publicKey(ownerWalletAddress);
    const destinationWallet = publicKey(destinationWalletAddress);

    const mint = publicKey(tokenMint);

    const ownerPda = findAssociatedTokenPda(umiInstance, {
      // Gets the ATA of the sender account
      mint: mint,
      owner: ownerWallet,
    });
    const destinationPda = findAssociatedTokenPda(umiInstance, {
      // Predicts the ATA of the recepient acc which doesn't exist yet
      mint: mint,
      owner: destinationWallet,
    });

    let txnBuilder = transactionBuilder();

    txnBuilder = txnBuilder.add(
      createTokenIfMissing(umiInstance, {
        // creates the recipient ATA
        mint: mint,
        owner: destinationWallet,
      }),
    );

    txnBuilder = txnBuilder.append(
      transferTokens(umiInstance, {
        source: ownerPda,
        destination: destinationPda,
        authority: signer,
        amount: amount,
      }),
    );
    txnBuilder
      .sendAndConfirm(umiInstance, { send: { skipPreflight: true } })
      .then(() => {
        console.log('Token sent');
      });
  }
}
