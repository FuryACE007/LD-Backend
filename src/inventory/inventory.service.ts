/**
 * @file This file contains the implementation of the InventoryService class.
 * @summary This code is owned and developed by Lucid Dream Software, Inc.
 * @contributor Sudhanshu Shekhar
 */

import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  TokenStandard,
  fetchAllDigitalAssetByOwner,
  mintV1,
  mplTokenMetadata,
  createNft,
} from '@metaplex-foundation/mpl-token-metadata';
import {
  create,
  mplCandyMachine,
  addConfigLines,
} from '@metaplex-foundation/mpl-candy-machine';
import {
  KeypairSigner,
  SolAmount,
  Umi,
  createSignerFromKeypair,
  publicKey,
  signerIdentity,
  transactionBuilder,
  generateSigner,
  percentAmount,
  some,
} from '@metaplex-foundation/umi';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
// import { irysUploader } from '@metaplex-foundation/umi-uploader-irys';
import { generateMnemonic, mnemonicToSeed } from 'bip39';
import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  Keypair,
} from '@solana/web3.js';

import {
  createTokenIfMissing,
  findAssociatedTokenPda,
  transferSol,
  transferTokens,
  closeToken,
} from '@metaplex-foundation/mpl-toolbox';
import {
  getAssociatedTokenAddress,
  setAuthority,
  AuthorityType,
} from '@solana/spl-token';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { getIrysUploader } from 'src/utils/irysUploader.util';
import { mnemonicToWallet } from 'src/utils/mnemonic-to-wallet.util';
import { HttpException, HttpStatus } from '@nestjs/common';

import { BatchResponse } from './dto/batch-response.dto';
import { CreateIPLTTokenResponseDto } from './dto/create-iplt-token.dto';
import {
  CreateCandyMachineResponseDto,
  CreateCandyMachineDto,
} from './dto/create-candy-machine.dto';
import { createFungibleAsset } from '@metaplex-foundation/mpl-token-metadata';
import {
  LogicalTokenMetadata,
  OnChainTokenMetadata,
} from './types/token-metadata';
import {
  RedemptionCode,
  RedemptionStatus,
} from './entities/redemption-code.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class InventoryService {
  private readonly umi: Umi;

  private readonly logger = new Logger(InventoryService.name);

  private readonly IRYS_BASE_URI = 'https://gateway.irys.xyz/';

  constructor(
    private httpService: HttpService,
    @InjectRepository(RedemptionCode)
    private redemptionCodeRepository: Repository<RedemptionCode>,
  ) {
    this.umi = createUmi(process.env.RPC_ENDPOINT);
    this.umi.use(mplTokenMetadata());
  }

  /*--------------------- HELPER FUNCTIONS------------------------------------ */

  /**
   * Generates a Umi instance with the specified signer.
   * @param signer - The KeypairSigner to be used for signing transactions.
   * @returns The generated Umi instance.
   */
  private generateUmi(signer: KeypairSigner): Umi {
    const umi = createUmi(process.env.RPC_ENDPOINT);
    umi.use(mplTokenMetadata());
    umi.use(signerIdentity(signer));
    return umi;
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

  /**
   * Loads a wallet from a mnemonic phrase.
   * @param mnemonic - The mnemonic phrase.
   * @returns The loaded KeypairSigner.
   */
  async loadWallet(mnemonic: string): Promise<KeypairSigner> {
    // Create seed phrase from mnemonic
    const seed = await mnemonicToSeed(mnemonic);
    const seed32 = new Uint8Array(seed.toJSON().data.slice(0, 32));

    //Generate Keypair from the seed
    const keypair = this.umi.eddsa.createKeypairFromSeed(seed32);
    const signer = createSignerFromKeypair(this.umi, keypair);

    return signer;
  }

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

  /**
   * Creates consumable wallets.
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
            'Hhx2w5Wjpe85nsAMExvqwCfQh68VjAe7ZJE6qMDW8zDR', // LUCID Wallet Address
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
          basisPoints: BigInt(Math.floor(0.001 * LAMPORTS_PER_SOL)), // Convert 0.001 SOL to lamports first
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

    return JSON.stringify({ publicKey: publicKey(signer.publicKey), mnemonic });
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

      const balance = await connection.getTokenAccountBalance(tokenAccount);
      let balanceValue = 0;
      if (balance.value.uiAmount) balanceValue = balance.value.uiAmount;

      let metadata = null;
      try {
        const metadataResponse = await firstValueFrom(
          this.httpService.get(asset.metadata.uri),
        );
        metadata = metadataResponse.data;
      } catch (error) {
        console.error(
          `Failed to fetch metadata for URI ${asset.metadata.uri}: ${error}`,
        );
      }

      const result = {
        name: asset.metadata.name,
        symbol: asset.metadata.symbol,
        metadata, // This will be null if the fetch fails
        balance: balanceValue,
        mintAddress: asset.mint.publicKey,
      };

      return result;
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
   * @param destinationWalletAddress - The address of the destination wallet.
   */
  async sendTokens(
    amount: number,
    tokenMint: string,
    mnemonics: string,
    destinationWalletAddress: string,
  ) {
    const signer = await this.loadWallet(mnemonics); // the owner's wallet signer
    const feePayer = await this.loadWallet(process.env.PAYER_MNEMONIC); // Lucid signer sponsoring the transaction fees

    const umiInstance = this.generateUmi(feePayer);

    const ownerWallet = publicKey(signer.publicKey);
    const destinationWallet = publicKey(destinationWalletAddress);

    const mint = publicKey(tokenMint);
    const rawAmount = Math.round(amount * Math.pow(10, 3));

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
        amount: BigInt(rawAmount),
      }),
    );

    try {
      await txnBuilder.sendAndConfirm(umiInstance, {
        send: { skipPreflight: true },
      });
      console.log('Token sent');
    } catch (error) {
      this.logger.error('Failed to send tokens:', error);
      throw new HttpException(
        {
          success: false,
          message: error.message || 'Failed to send tokens',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Calls the print function to mint tokens.
   * @param amount - The amount of tokens to mint.
   * @param tokenMint - The token mint address.
   * @param mnemonics - The mnemonic for the consumable wallet.
   */
  async callPrint(
    printRequests: {
      tokenMint: string;
      amount: number;
      mnemonics: string;
    }[],
  ): Promise<{
    success: boolean;
    batchResponses: BatchResponse[];
    summary: string;
  }> {
    try {
      this.logger.log(
        `Starting print request processing for ${printRequests.length} requests`,
      );
      const feePayer = await this.loadWallet(process.env.PAYER_MNEMONIC);
      const lucidWalletAddress = publicKey(feePayer.publicKey);
      this.logger.debug(`Using fee payer wallet: ${lucidWalletAddress}`);

      const umiInstance = this.generateUmi(feePayer);
      const batchSize = 4; // Reduced batch size to stay within transaction limits
      const batches = [];
      let hasFailedBatches = false;

      // Split requests into smaller batches
      for (let i = 0; i < printRequests.length; i += batchSize) {
        batches.push(printRequests.slice(i, i + batchSize));
      }

      const batchResponses: BatchResponse[] = [];

      // Process each batch
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const currentBatch = batches[batchIndex];
        let txBuilder = transactionBuilder();

        const batchResponse: BatchResponse = {
          batchIndex,
          success: false,
          message: '',
          processedRequests: 0,
          totalRequests: currentBatch.length,
          requests: currentBatch,
        };

        try {
          // Pre-load all signers for current batch
          const sourceSigners = await Promise.all(
            currentBatch.map((request) => this.loadWallet(request.mnemonics)),
          );

          // Process current batch
          for (let i = 0; i < currentBatch.length; i++) {
            const request = currentBatch[i];
            const sourceSigner = sourceSigners[i];
            const sourceWallet = publicKey(sourceSigner.publicKey);
            const destinationWallet = publicKey(lucidWalletAddress);
            const mint = publicKey(request.tokenMint);

            const rawAmount = Math.round(request.amount * Math.pow(10, 3));

            if (isNaN(rawAmount) || rawAmount <= 0) {
              throw new Error(
                `Invalid amount for token ${request.tokenMint}: ${request.amount}`,
              );
            }

            const sourcePda = findAssociatedTokenPda(umiInstance, {
              mint: mint,
              owner: sourceWallet,
            });
            const destinationPda = findAssociatedTokenPda(umiInstance, {
              mint: mint,
              owner: destinationWallet,
            });

            // Add token account creation instruction only if needed
            txBuilder = txBuilder.add(
              createTokenIfMissing(umiInstance, {
                mint: mint,
                owner: destinationWallet,
              }),
            );

            // Add token transfer instruction
            txBuilder = txBuilder.add(
              transferTokens(umiInstance, {
                source: sourcePda,
                destination: destinationPda,
                authority: sourceSigner,
                amount: BigInt(rawAmount),
              }),
            );
          }

          // Send and confirm the batch transaction
          const latestBlockhash = await umiInstance.rpc.getLatestBlockhash();
          const result = await txBuilder.sendAndConfirm(umiInstance, {
            send: {
              // skipPreflight: true,
              maxRetries: 3,
            },
            confirm: {
              commitment: 'confirmed',
              strategy: {
                type: 'blockhash',
                blockhash: latestBlockhash.blockhash,
                lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
              },
            },
          });

          this.logger.log(
            `Batch ${batchIndex + 1}/${
              batches.length
            } confirmed with signature: ${result.signature}`,
          );

          batchResponse.success = true;
          batchResponse.message = 'Batch processed successfully';
          batchResponse.transactionHash = result.signature.toString();
          batchResponse.processedRequests = currentBatch.length;
        } catch (batchError) {
          hasFailedBatches = true;
          batchResponse.success = false;
          batchResponse.message =
            batchError.message || 'Batch processing failed';
          batchResponse.processedRequests = 0;
          this.logger.error(`Batch ${batchIndex + 1} failed:`, batchError);
        }

        batchResponses.push(batchResponse);
      }

      const successfulBatches = batchResponses.filter(
        (batch) => batch.success,
      ).length;
      const failedBatches = batchResponses.filter(
        (batch) => !batch.success,
      ).length;

      return {
        success: !hasFailedBatches,
        batchResponses,
        summary: `Processed ${printRequests.length} requests in ${batches.length} batches. ${successfulBatches} succeeded, ${failedBatches} failed.`,
      };
    } catch (error) {
      this.logger.error('Print request processing failed:', error.stack);

      throw new HttpException(
        {
          success: false,
          error: error.message || 'Failed to process print requests',
          batchResponses: [],
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Closes a token account with 0 token balance.
   * @param walletAddress - The wallet address.
   * @param tokenMint - The token mint address.
   * @param mnemonics - The mnemonic for the wallet.
   * @returns Success or error message.
   */
  async closeTokenAccount(
    walletAddress: string,
    tokenMint: string,
    mnemonics: string,
  ) {
    try {
      console.log(
        `Initiating token account closure for wallet: ${walletAddress}, token: ${tokenMint}`,
      );

      // Load wallets
      const signer = await this.loadWallet(mnemonics); // the owner's wallet signer
      if (!signer) {
        throw new Error('Failed to load owner wallet signer');
      }

      const feePayer = await this.loadWallet(process.env.PAYER_MNEMONIC); // Lucid signer sponsoring the transaction fees
      if (!feePayer) {
        throw new Error('Failed to load fee payer wallet');
      }

      const umiInstance = this.generateUmi(feePayer);
      console.log('UMI instance generated successfully');

      const ownerWallet = publicKey(walletAddress);
      const mint = publicKey(tokenMint);

      // Get token Account
      const tokenAccount = await getAssociatedTokenAddress(
        new PublicKey(mint),
        new PublicKey(ownerWallet),
      );

      const connection = new Connection(process.env.RPC_ENDPOINT);
      const balance = await connection.getTokenAccountBalance(tokenAccount);
      console.log(
        `Token account balance before closure: ${balance.value.uiAmount}`,
      );

      const ownerPda = await findAssociatedTokenPda(umiInstance, {
        mint: mint,
        owner: ownerWallet,
      });

      const destinationPda = await findAssociatedTokenPda(umiInstance, {
        mint: mint,
        owner: publicKey(feePayer.publicKey),
      });

      // Transfer remaining tokens if balance is not zero
      if (balance.value.uiAmount !== 0) {
        console.log(
          `Transferring remaining balance of ${balance.value.uiAmount} tokens`,
        );
        let txnBuilder = transactionBuilder();

        txnBuilder = txnBuilder.add(
          createTokenIfMissing(umiInstance, {
            mint: mint,
            owner: publicKey(feePayer.publicKey),
          }),
        );

        txnBuilder = txnBuilder.add(
          transferTokens(umiInstance, {
            source: ownerPda,
            destination: destinationPda,
            authority: signer,
            amount: BigInt(Math.round(balance.value.uiAmount * 1000)),
          }),
        );

        await txnBuilder
          .sendAndConfirm(umiInstance, { send: { skipPreflight: false } })
          .then(() => {
            console.log('Token transfer completed successfully');
          })
          .catch((error) => {
            throw new Error(`Token transfer failed: ${error.message}`);
          });
      }

      // Wait for transactions to reflect
      console.log('Waiting for transaction confirmation...');
      await new Promise((resolve) => setTimeout(resolve, 10000));

      // Close Token Account with retry mechanism
      console.log('Initiating token account closure...');
      const maxRetries = 3;
      const baseDelay = 2000; // 2 seconds base delay

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          await closeToken(umiInstance, {
            account: ownerPda,
            destination: umiInstance.payer.publicKey,
            owner: signer,
          })
            .sendAndConfirm(umiInstance)
            .then(() => {
              console.log('Token account closed successfully');
            });
          break; // Success, exit the retry loop
        } catch (error) {
          console.log(`Attempt ${attempt} failed: ${error.message}`);

          if (attempt === maxRetries) {
            throw new Error(
              `Token account closure failed after ${maxRetries} attempts: ${error.message}`,
            );
          }

          // Calculate delay with exponential backoff
          const delay = baseDelay * Math.pow(2, attempt - 1);
          console.log(`Retrying in ${delay / 1000} seconds...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      return { success: true, message: 'Token account closed successfully' };
    } catch (error) {
      console.error('Error in closeTokenAccount:', error);
      return {
        success: false,
        message: error.message || 'Failed to close token account',
        error: error,
      };
    }
  }

  /**
   * Uploads metadata to Arweave/Irys.
   * @param mnemonic - The mnemonic for the wallet.
   * @param metadata - The metadata JSON object.
   * @returns The URI of the uploaded metadata.
   */
  async uploadMetadata(mnemonic: string, metadata: JSON) {
    const signer = await (
      await mnemonicToWallet(mnemonic, this.umi)
    ).getSigner();
    const umiInstance = this.generateUmi(signer);
    const uploader = await getIrysUploader(mnemonic, umiInstance);

    try {
      // Add content type tags to specify JSON format
      const tags = [
        { name: 'Content-Type', value: 'application/json' },
        { name: 'App-Name', value: 'Lucid-Supply-System' },
      ];

      const uploadReceipt = await uploader.upload(JSON.stringify(metadata), {
        tags,
      });
      const uri = 'https://gateway.irys.xyz/' + uploadReceipt.id;
      return uri;
    } catch (error) {
      console.error('Failed to upload metadata to Arweave:', error);
      throw new Error('Failed to upload metadata to Arweave');
    }
  }

  /**
   * Revokes mint and freeze authorities for a token mint.
   * @param connection - Solana connection.
   * @param wallet - Keypair of the authority.
   * @param mintPublicKey - Public key of the mint.
   */
  private async revokeTokenAuthorities(
    connection: Connection,
    wallet: Keypair,
    mintPublicKey: PublicKey,
  ) {
    try {
      // Revoke Mint Authority
      await setAuthority(
        connection,
        wallet, // payer
        mintPublicKey, // mint address
        wallet.publicKey, // current authority
        AuthorityType.MintTokens,
        null, // new authority (null to revoke)
        [wallet], // signers
      );
      this.logger.log('Mint authority revoked.');

      // Revoke Freeze Authority
      await setAuthority(
        connection,
        wallet,
        mintPublicKey,
        wallet.publicKey,
        AuthorityType.FreezeAccount,
        null,
        [wallet],
      );
      this.logger.log('Freeze authority revoked.');
    } catch (error) {
      this.logger.error('Error revoking authorities:', error);
      throw error;
    }
  }

  /**
   * Creates a fungible token and uploads metadata.
   * @param umi - Umi instance.
   * @param metadata - LogicalTokenMetadata object.
   * @returns The mint signer.
   */
  private async createTokenHandler(umi: Umi, metadata: LogicalTokenMetadata) {
    const mint = generateSigner(umi);

    try {
      // Create metadata as JSON
      const uploadableMetadata: JSON = JSON.parse(
        JSON.stringify({
          name: metadata.tokenName,
          symbol: metadata.tokenSymbol,
          description: metadata.tokenDescription,
          properties: {
            uom: metadata.uom,
            maxSupply: metadata.maxSupply,
          },
        }),
      );

      this.logger.log(
        `Creating fungible asset with metadata: ${JSON.stringify(
          uploadableMetadata,
        )}`,
      );

      // Upload metadata to Irys
      const uri = await this.uploadMetadata(
        process.env.PAYER_MNEMONIC,
        uploadableMetadata,
      );

      this.logger.log(`Metadata uploaded to URI: ${uri}`);

      // Create on-chain metadata for the token
      const onChainMetadata: OnChainTokenMetadata = {
        name: metadata.tokenName,
        symbol: metadata.tokenSymbol,
        uri,
      };

      this.logger.log(
        `Creating fungible asset with on-chain metadata: ${JSON.stringify(
          onChainMetadata,
        )}`,
      );

      // Get a fresh blockhash right before the transaction
      const latestBlockhash = await umi.rpc.getLatestBlockhash();

      // Create the fungible token with on-chain metadata
      await createFungibleAsset(umi, {
        mint,
        ...onChainMetadata,
        sellerFeeBasisPoints: percentAmount(0),
        isMutable: true,
        isCollection: false,
        authority: umi.identity,
        decimals: 3,
      }).sendAndConfirm(umi, {
        send: {
          skipPreflight: false,
          maxRetries: 3,
        },
        confirm: {
          commitment: 'finalized',
          strategy: {
            type: 'blockhash',
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
          },
        },
      });

      this.logger.log(
        `${metadata.tokenName} created successfully: ${mint.publicKey}`,
      );
      this.logger.log(`Creator: ${umi.identity.publicKey.toString()}`);
      this.logger.log(`Metadata URI: ${uri}`);

      return mint;
    } catch (error) {
      this.logger.error('Error creating fungible asset:', error);
      throw error;
    }
  }

  /**
   * Mints tokens and transfers them to the OEM.
   * @param umi - Umi instance.
   * @param mint - Mint signer.
   * @param amount - Amount to mint.
   * @param oemWalletAddress - OEM wallet address to receive tokens.
   * @returns The result of the mint transaction.
   */
  private async mintHandler(
    umi: Umi,
    mint: any,
    amount: number,
    oemWalletAddress: string,
  ) {
    try {
      this.logger.log('Minting IPLT tokens...');
      this.logger.log(`Mint address: ${mint.publicKey.toString()}`);
      this.logger.log(`Amount: ${amount}`);
      this.logger.log(
        `Lucid Wallet Addr: ${umi.identity.publicKey.toString()}`,
      );

      const result = await mintV1(umi, {
        mint: mint.publicKey,
        authority: umi.identity,
        amount: amount * 1000,
        tokenOwner: umi.identity.publicKey,
        tokenStandard: TokenStandard.Fungible,
      }).sendAndConfirm(umi, { send: { skipPreflight: true } });

      // Transfer minted tokens to OEM
      await this.sendTokens(
        amount,
        mint.publicKey.toString(),
        process.env.PAYER_MNEMONIC,
        oemWalletAddress,
      );

      this.logger.log(`IPLT Tokens sent to OEM: ${oemWalletAddress}`);
      return result;
    } catch (error) {
      this.logger.error('Error minting:', error);
      throw error;
    }
  }

  /**
   * Creates an IPLT token, mints supply, and transfers to OEM.
   * @param tokenData - LogicalTokenMetadata as JSON string.
   * @param oemWalletAddress - OEM wallet public key address.
   * @returns Result of the token creation process.
   */
  async createIPLTToken(
    tokenData: string,
    oemWalletAddress: string,
  ): Promise<CreateIPLTTokenResponseDto> {
    try {
      // Parse the token data string into TokenMetadata object
      let parsedTokenData: LogicalTokenMetadata;
      try {
        parsedTokenData = JSON.parse(tokenData);
      } catch (error) {
        throw new Error(
          'Invalid token data format. Must be a valid JSON string',
        );
      }

      // Validate required fields directly from the parsed data
      if (
        !parsedTokenData.maxSupply ||
        !parsedTokenData.tokenName ||
        !parsedTokenData.tokenSymbol ||
        !parsedTokenData.tokenDescription ||
        !parsedTokenData.uom
      ) {
        throw new Error('Missing required token metadata fields');
      }

      const lucidSigner = await this.loadWallet(process.env.PAYER_MNEMONIC);
      const umi = this.generateUmi(lucidSigner);

      // Create the token
      const mint = await this.createTokenHandler(umi, parsedTokenData);

      // Mint the tokens and transfer to OEM
      await this.mintHandler(
        umi,
        mint,
        parsedTokenData.maxSupply,
        oemWalletAddress,
      );

      // Convert UMI wallet to Solana wallet for SPL token operations
      const connection = new Connection(process.env.RPC_ENDPOINT);
      const walletKeyPair = Keypair.fromSecretKey(lucidSigner.secretKey);
      const mintPublicKey = new PublicKey(mint.publicKey);

      // Revoke authorities
      await this.revokeTokenAuthorities(
        connection,
        walletKeyPair,
        mintPublicKey,
      );

      return {
        success: true,
        message: 'Token created successfully',
        mintAddress: mint.publicKey.toString(),
      };
    } catch (error) {
      this.logger.error('Error creating IPLT token:', error);
      return {
        success: false,
        message: 'Failed to create token',
        error: error.message,
      };
    }
  }

  async createCandyMachine(
    dto: CreateCandyMachineDto,
  ): Promise<CreateCandyMachineResponseDto> {
    try {
      this.logger.log('Starting candy machine creation process...');

      if (dto.namePrefix.length > 32) {
        throw new Error('Name prefix exceeds maximum length of 32 characters');
      }

      if (dto.collectionName.length > 32) {
        throw new Error(
          'Collection name exceeds maximum length of 32 characters',
        );
      }

      if (dto.collectionSymbol.length > 10) {
        throw new Error(
          'Collection symbol exceeds maximum length of 10 characters',
        );
      }

      if (dto.collectionDescription.length > 200) {
        throw new Error(
          'Collection description exceeds maximum length of 200 characters',
        );
      }

      if (dto.maxSupply <= 0 || dto.maxSupply > 10000) {
        throw new Error('Max supply must be between 1 and 10,000');
      }

      this.logger.log('Validations passed. Proceeding with creation...');

      // Load the admin wallet that will pay for and manage the candy machine
      const adminSigner = await this.loadWallet(process.env.PAYER_MNEMONIC);
      const umi = this.generateUmi(adminSigner);
      umi.use(mplCandyMachine());

      this.logger.log('Creating collection NFT...');

      // Create the Collection NFT
      const collectionMint = generateSigner(umi);
      const authority = umi.identity;

      // Create collection metadata
      const collectionMetadata = {
        name: dto.collectionName,
        symbol: dto.collectionSymbol,
        description: dto.collectionDescription,
        seller_fee_basis_points: 0,
        image: dto.baseImageUrl, // Using base image for collection
        properties: {
          files: [],
          category: 'image',
          creators: [
            {
              address: authority.publicKey.toString(),
              share: 100,
            },
          ],
        },
      };

      // Upload collection metadata
      const collectionUri = await this.uploadMetadata(
        process.env.PAYER_MNEMONIC,
        JSON.parse(JSON.stringify(collectionMetadata)),
      );
      this.logger.log(`Collection metadata uploaded to: ${collectionUri}`);

      // Create the collection NFT
      await createNft(umi, {
        mint: collectionMint,
        authority: authority,
        name: dto.collectionName,
        symbol: dto.collectionSymbol,
        uri: collectionUri,
        sellerFeeBasisPoints: percentAmount(0),
        isCollection: true,
        collectionDetails: {
          __kind: 'V1',
          size: dto.maxSupply,
        },
      }).sendAndConfirm(umi);

      this.logger.log(
        `Collection NFT created with mint: ${collectionMint.publicKey}`,
      );
      await new Promise((resolve) => setTimeout(resolve, 10000));

      // TODO: For unique metadata, create individual metadata files here
      // Upload base NFT metadata for POC (same for all NFTs)
      this.logger.log('Uploading base NFT metadata for POC...');
      const baseNftMetadata = {
        name: dto.baseNftName,
        description: dto.baseNftDescription,
        image: dto.baseImageUrl,
        seller_fee_basis_points: 0,
        properties: {
          files: [
            {
              uri: dto.baseImageUrl,
              type: 'image/png', // Adjust based on your image type
            },
          ],
          category: 'image',
          creators: [
            {
              address: authority.publicKey.toString(),
              verified: true,
              share: 100,
            },
          ],
        },
        attributes: [
          // TODO: For unique metadata, generate different attributes per NFT
          {
            trait_type: 'Collection',
            value: dto.collectionName,
          },
          {
            trait_type: 'Series',
            value: 'POC Series',
          },
          // TODO: Add rarity, background, style, etc. for unique NFTs
        ],
      };

      const baseNftUri = await this.uploadMetadata(
        process.env.PAYER_MNEMONIC,
        JSON.parse(JSON.stringify(baseNftMetadata)),
      );
      this.logger.log(`Base NFT metadata uploaded to: ${baseNftUri}`);

      // Create the Candy Machine
      this.logger.log('Creating candy machine...');
      const candyMachine = generateSigner(umi);

      this.logger.log(`Candy Machine Config: 
      Max Supply: ${dto.maxSupply},
      Name Prefix: ${dto.namePrefix},
      Base URI: ${this.IRYS_BASE_URI},
      Collection Name: ${dto.collectionName},
      Collection Symbol: ${dto.collectionSymbol},
      Collection URI: ${collectionUri},
      Collection Description: ${dto.collectionDescription}`);

      // Create the candy machine with default configurations
      const builder = await create(umi, {
        candyMachine,
        collectionMint: collectionMint.publicKey,
        collectionUpdateAuthority: authority,
        tokenStandard: TokenStandard.NonFungible,
        sellerFeeBasisPoints: percentAmount(0),
        itemsAvailable: dto.maxSupply,
        creators: [
          {
            address: umi.identity.publicKey,
            verified: true,
            percentageShare: 100,
          },
        ],
        configLineSettings: some({
          prefixName: `${dto.namePrefix} #$ID+1$`,
          nameLength: 0,
          prefixUri: '', // Empty because we're using full URIs for POC
          uriLength: 0, // 0 because we're using full URIs
          isSequential: true,
        }),
      });
      await builder.sendAndConfirm(umi);

      this.logger.log(`Candy machine created: ${candyMachine.publicKey}`);
      await new Promise((resolve) => setTimeout(resolve, 15000));

      // Insert config lines with same metadata for all (POC)
      await this.insertCandyMachineConfigLines(
        umi,
        candyMachine.publicKey.toString(),
        dto.maxSupply,
        baseNftUri, // Pass the same URI for all NFTs
      );

      // Generate redemption codes after successful candy machine creation
      this.logger.log('Generating redemption codes...');
      const redemptionCodes = await this.generateCodesForCandyMachine(
        candyMachine.publicKey.toString(),
        collectionMint.publicKey.toString(),
        dto.maxSupply,
      );

      this.logger.log(
        `Generated ${redemptionCodes.length} redemption codes successfully!`,
      );

      return {
        success: true,
        message:
          'Candy machine created, config lines inserted, and redemption codes generated successfully',
        candyMachineAddress: candyMachine.publicKey.toString(),
        collectionMintAddress: collectionMint.publicKey.toString(),
        collectionUpdateAuthority: authority.publicKey.toString(),
        totalRedemptionCodes: redemptionCodes.length,
      };
    } catch (error) {
      this.logger.error('Failed to create candy machine:', error);
      return {
        success: false,
        message: 'Failed to create candy machine',
        error: error.message,
      };
    }
  }

  /**
   * Inserts config lines into the candy machine in batches.
   * For POC: Uses same metadata URI for all NFTs
   * TODO: For unique metadata, pass different URIs per NFT
   */
  private async insertCandyMachineConfigLines(
    umi: Umi,
    candyMachineAddress: string,
    maxSupply: number,
    baseNftUri: string, // Same URI for all NFTs in POC
  ) {
    try {
      this.logger.log('Starting to insert config lines...');
      const batchSize = 10;
      let itemsLoaded = 0;

      while (itemsLoaded < maxSupply) {
        const remainingItems = maxSupply - itemsLoaded;
        const currentBatchSize = Math.min(batchSize, remainingItems);

        const configLines = Array.from({ length: currentBatchSize }, () => ({
          name: '',
          uri: baseNftUri, // TODO: For unique metadata, use `${(itemsLoaded + i + 1)}.json`
        }));

        // TODO: For unique metadata, replace above with:
        // const configLines = Array.from(
        //   { length: currentBatchSize },
        //   (_, i) => ({
        //     name: (itemsLoaded + i + 1).toString().padStart(4, '0'),
        //     uri: `${this.IRYS_BASE_URI}${(itemsLoaded + i + 1)}.json`, // Each NFT gets unique metadata
        //   }),
        // );

        await addConfigLines(umi, {
          candyMachine: publicKey(candyMachineAddress),
          index: itemsLoaded,
          configLines,
        }).sendAndConfirm(umi, {
          confirm: { commitment: 'finalized' },
        });

        itemsLoaded += currentBatchSize;
        this.logger.log(`Inserted ${itemsLoaded}/${maxSupply} config lines`);
      }

      this.logger.log('All config lines inserted successfully!');
    } catch (error) {
      this.logger.error('Failed to insert config lines:', error);
      throw error;
    }
  }

  /**
   * Generate a secure, QR-friendly redemption code
   * Uses: Numbers + Uppercase letters (excluding confusing characters)
   */
  private generateSecureCode(): string {
    // Character set: Numbers + uppercase letters (excluding 0, O, 1, I, L for clarity)
    const charset = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
    const codeLength = 12; // QR-friendly length

    let code = '';
    const randomBytes = crypto.randomBytes(codeLength);

    for (let i = 0; i < codeLength; i++) {
      code += charset[randomBytes[i] % charset.length];
    }

    // Add hyphens for readability: XXXX-XXXX-XXXX
    return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`;
  }

  /**
   * Generate redemption codes for a candy machine
   */
  private async generateCodesForCandyMachine(
    candyMachineAddress: string,
    collectionMintAddress: string,
    maxSupply: number,
  ): Promise<RedemptionCode[]> {
    this.logger.log(
      `Generating ${maxSupply} redemption codes for candy machine: ${candyMachineAddress}`,
    );

    const codes: RedemptionCode[] = [];
    const generatedCodes = new Set<string>();

    // Generate unique codes
    while (codes.length < maxSupply) {
      const code = this.generateSecureCode();

      // Check if code already exists (very unlikely but safety first)
      if (!generatedCodes.has(code)) {
        const existingCode = await this.redemptionCodeRepository.findOne({
          where: { code },
        });

        if (!existingCode) {
          generatedCodes.add(code);
          codes.push(
            this.redemptionCodeRepository.create({
              code,
              candyMachineAddress,
              collectionMintAddress,
              status: RedemptionStatus.UNUSED,
            }),
          );
        }
      }
    }

    // Batch insert for performance
    const batchSize = 100;
    const savedCodes: RedemptionCode[] = [];

    for (let i = 0; i < codes.length; i += batchSize) {
      const batch = codes.slice(i, i + batchSize);
      const saved = await this.redemptionCodeRepository.save(batch);
      savedCodes.push(...saved);

      this.logger.log(
        `Saved ${Math.min(i + batchSize, codes.length)}/${
          codes.length
        } redemption codes`,
      );
    }

    this.logger.log(
      `Successfully generated ${savedCodes.length} redemption codes`,
    );
    return savedCodes;
  }

  /**
   * Get unused codes for a candy machine
   */
  async getUnusedCodes(candyMachineAddress: string): Promise<RedemptionCode[]> {
    return this.redemptionCodeRepository.find({
      where: {
        candyMachineAddress,
        status: RedemptionStatus.UNUSED,
      },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Mark a code as used
   */
  async markCodeAsUsed(
    code: string,
    userWalletAddress: string,
    mintedNftAddress: string,
    transactionSignature: string,
  ): Promise<RedemptionCode> {
    const redemptionCode = await this.redemptionCodeRepository.findOne({
      where: { code, status: RedemptionStatus.UNUSED },
    });

    if (!redemptionCode) {
      throw new Error('Invalid or already used redemption code');
    }

    redemptionCode.status = RedemptionStatus.USED;
    redemptionCode.userWalletAddress = userWalletAddress;
    redemptionCode.mintedNftAddress = mintedNftAddress;
    redemptionCode.transactionSignature = transactionSignature;
    redemptionCode.redeemedAt = new Date();

    return this.redemptionCodeRepository.save(redemptionCode);
  }

  /**
   * Validate a redemption code
   */
  async validateCode(code: string): Promise<RedemptionCode | null> {
    return this.redemptionCodeRepository.findOne({
      where: { code, status: RedemptionStatus.UNUSED },
    });
  }

  // TODO: Create mint function to mint from candy machine - QR handled on frontend
  // TODO: Analytics function to get minting status, remaining supply, etc.
  // TODO: Create Function to delete the candy machine
}
