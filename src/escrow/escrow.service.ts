import { Injectable, Logger } from '@nestjs/common';
import { Keypair } from '@solana/web3.js';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { keypairIdentity } from '@metaplex-foundation/umi';
import {
  mplToolbox,
  findAssociatedTokenPda,
} from '@metaplex-foundation/mpl-toolbox';
import {
  address,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createTransactionMessage,
  pipe,
  appendTransactionMessageInstruction,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Address,
  type Signature,
  type TransactionSigner,
} from '@solana/kit';
import { getBase64EncodedWireTransaction } from '@solana/transactions';
// Import generated clients via tsconfig path alias for minimal coupling
import {
  getCreateJobInstruction,
  getSetMediaHashInstruction,
  getDepositIpltInstruction,
  getDepositConsumableInstruction,
  getSealJobInstruction,
  getInitJobCounterInstruction,
  getSpendLinkedInstructionAsync,
} from './generated/instructions';
import { fetchJob, fetchJobCounter } from './generated/accounts';
import { SMART_SUPPLY_ESCROW_PROGRAM_ADDRESS } from './generated/programs';
import { getAccountMetaFactory } from './generated/shared';
import type { ConsumableSpecArgs, ConsumableBurnArgs } from './generated/types';
import {
  publicKey as umiPublicKey,
  publicKeyBytes,
} from '@metaplex-foundation/umi';
import { homedir } from 'os';
import { readFileSync } from 'fs';
import { mnemonicToSeedSync } from 'bip39';

@Injectable()
export class EscrowService {
  private readonly rpc = createSolanaRpc(
    process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  );
  private umi = createUmi(
    process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  );
  private solanaKitSigner!: TransactionSigner<string>;
  private umiSigner!: ReturnType<
    typeof this.umi.eddsa.createKeypairFromSecretKey
  >;
  private readonly logger = new Logger(EscrowService.name);

  constructor() {
    this.initializeSigners();
  }

  private initializeSigners() {
    const mnemonic = process.env.PAYER_MNEMONIC;
    if (mnemonic && mnemonic.trim().length > 0) {
      const seed = mnemonicToSeedSync(mnemonic);
      const seed32 = new Uint8Array(seed).slice(0, 32);
      const keypairFromMnemonic = this.umi.eddsa.createKeypairFromSeed(seed32);

      this.umiSigner = keypairFromMnemonic;
      this.umi.use(keypairIdentity(this.umiSigner));
      this.umi.use(mplToolbox());

      createKeyPairSignerFromBytes(keypairFromMnemonic.secretKey).then(
        (signer) => {
          this.solanaKitSigner = signer;
          this.logger.log(
            `Signer initialized from PAYER_MNEMONIC owner=${this.solanaKitSigner.address}`,
          );
        },
      );
      return;
    }

    const keypairFile =
      process.env.SOLANA_KEYPAIR_PATH || homedir() + '/.config/solana/id.json';
    const keypairString = readFileSync(keypairFile, 'utf-8');
    const keypair = Keypair.fromSecretKey(
      Buffer.from(JSON.parse(keypairString)),
    );

    this.umiSigner = this.umi.eddsa.createKeypairFromSecretKey(
      keypair.secretKey,
    );
    this.umi.use(keypairIdentity(this.umiSigner));
    this.umi.use(mplToolbox());

    // Create Solana Kit TransactionSigner
    createKeyPairSignerFromBytes(keypair.secretKey).then((signer) => {
      this.solanaKitSigner = signer;
      this.logger.log(
        `Signer initialized from keypair file=${keypairFile} owner=${this.solanaKitSigner.address}`,
      );
    });
  }

  private async getFreshBlockhash() {
    const { value } = await this.rpc.getLatestBlockhash().send();
    return value;
  }

  private async awaitConfirmation(signature: Signature, timeoutMs = 20000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const { value: statuses } = await this.rpc
        .getSignatureStatuses([signature])
        .send();
      const status = statuses?.[0];
      if (status?.err)
        throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
      if (status?.confirmationStatus === 'finalized') return;
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  private async sendInstruction(ix: any) {
    const latestBlockhash = await this.getFreshBlockhash();
    const message = await pipe(
      createTransactionMessage({ version: 0 }),
      (tx) => setTransactionMessageFeePayerSigner(this.solanaKitSigner, tx),
      (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
      (tx) => appendTransactionMessageInstruction(ix, tx),
    );
    const signed = await signTransactionMessageWithSigners(message);
    const base64 = getBase64EncodedWireTransaction(signed);
    const sig = await this.rpc
      .sendTransaction(base64, { encoding: 'base64' })
      .send();
    await this.awaitConfirmation(sig);
    this.logger.log(`Transaction sent signature=${sig}`);
    return { signature: sig };
  }

  async createJob(
    ipltMint: string,
    consumables: { mint: string; maxAmount: string }[],
  ) {
    this.logger.log(
      `createJob start owner=${this.solanaKitSigner.address} ipltMint=${ipltMint} consumables=${consumables.length}`,
    );
    // derive counter PDA
    const PROGRAM_ID = SMART_SUPPLY_ESCROW_PROGRAM_ADDRESS as string;
    const [counterPda] = await this.umi.eddsa.findPda(
      umiPublicKey(PROGRAM_ID),
      [
        new TextEncoder().encode('job_counter'),
        publicKeyBytes(this.umiSigner.publicKey),
      ],
    );

    // init counter if missing
    let counterNextSeed = 0;
    try {
      const counterAcc = await fetchJobCounter(this.rpc, address(counterPda));
      counterNextSeed =
        (counterAcc as any).data?.nextSeed ?? (counterAcc as any).nextSeed ?? 0;
    } catch (_) {
      const initCounterIx = await getInitJobCounterInstruction({
        owner: this.solanaKitSigner,
        counter: address(counterPda),
        systemProgram: address('11111111111111111111111111111111'),
      });
      await this.sendInstruction(initCounterIx);
      counterNextSeed = 0;
    }

    const jobSeedLe = Buffer.alloc(4);
    jobSeedLe.writeUInt32LE(counterNextSeed);
    const [jobPda] = await this.umi.eddsa.findPda(umiPublicKey(PROGRAM_ID), [
      new TextEncoder().encode('job'),
      publicKeyBytes(this.umiSigner.publicKey),
      jobSeedLe,
    ]);

    const consumableSpecs: ConsumableSpecArgs[] = consumables.map((c) => ({
      mint: address(c.mint) as Address,
      maxAmount: BigInt(c.maxAmount),
    }));

    const createJobIx = await getCreateJobInstruction({
      owner: this.solanaKitSigner,
      counter: address(counterPda),
      job: address(jobPda),
      ipltMint: address(ipltMint),
      consumables: consumableSpecs,
      systemProgram: address('11111111111111111111111111111111'),
    });

    const res = await this.sendInstruction(createJobIx);
    this.logger.log(
      `createJob success jobPda=${address(jobPda)} counterPda=${address(counterPda)} signature=${(res as any).signature}`,
    );
    return { ...res, jobPda: address(jobPda), counterPda: address(counterPda) };
  }

  async setMediaHash(jobPdaStr: string, mediaHash: string) {
    this.logger.log(
      `setMediaHash start jobPda=${jobPdaStr} mediaHashLen=${mediaHash?.length}`,
    );
    const setMediaHashIx = await getSetMediaHashInstruction({
      owner: this.solanaKitSigner,
      job: address(jobPdaStr),
      mediaHash,
    });
    const res = await this.sendInstruction(setMediaHashIx);
    this.logger.log(
      `setMediaHash success jobPda=${jobPdaStr} signature=${(res as any).signature}`,
    );
    return res;
  }

  async depositIplt(jobPdaStr: string, ipltMintStr: string, amountStr: string) {
    this.logger.log(
      `depositIplt start jobPda=${jobPdaStr} ipltMint=${ipltMintStr} amount=${amountStr}`,
    );
    const jobPda = umiPublicKey(jobPdaStr);
    const ipltMint = umiPublicKey(ipltMintStr);

    const userIpltAccount = findAssociatedTokenPda(this.umi, {
      mint: ipltMint,
      owner: this.umiSigner.publicKey,
    })[0];

    const escrowIpltAccount = findAssociatedTokenPda(this.umi, {
      mint: ipltMint,
      owner: jobPda,
    })[0];

    const depositIpltIx = await getDepositIpltInstruction({
      owner: this.solanaKitSigner,
      job: address(jobPdaStr),
      userIpltAccount: address(userIpltAccount),
      escrowIpltAccount: address(escrowIpltAccount),
      ipltMint: address(ipltMintStr),
      amount: BigInt(amountStr),
      tokenProgram: address('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
      associatedTokenProgram: address(
        'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
      ),
      systemProgram: address('11111111111111111111111111111111'),
    });

    const res = await this.sendInstruction(depositIpltIx);
    this.logger.log(
      `depositIplt success jobPda=${jobPdaStr} signature=${(res as any).signature}`,
    );
    return res;
  }

  async depositConsumable(
    jobPdaStr: string,
    consumableMintStr: string,
    amountStr: string,
  ) {
    this.logger.log(
      `depositConsumable start jobPda=${jobPdaStr} mint=${consumableMintStr} amount=${amountStr}`,
    );
    const jobPda = umiPublicKey(jobPdaStr);
    const consumableMint = umiPublicKey(consumableMintStr);

    const userConsumableAccount = findAssociatedTokenPda(this.umi, {
      mint: consumableMint,
      owner: this.umiSigner.publicKey,
    })[0];

    const escrowConsumableAccount = findAssociatedTokenPda(this.umi, {
      mint: consumableMint,
      owner: jobPda,
    })[0];

    const depositConsumableIx = await getDepositConsumableInstruction({
      owner: this.solanaKitSigner,
      job: address(jobPdaStr),
      consumableMint: address(consumableMintStr),
      userConsumableAccount: address(userConsumableAccount),
      escrowConsumableAccount: address(escrowConsumableAccount),
      amount: BigInt(amountStr),
      tokenProgram: address('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
      associatedTokenProgram: address(
        'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
      ),
      systemProgram: address('11111111111111111111111111111111'),
    });

    const res = await this.sendInstruction(depositConsumableIx);
    this.logger.log(
      `depositConsumable success jobPda=${jobPdaStr} signature=${(res as any).signature}`,
    );
    return res;
  }

  async sealJob(jobPdaStr: string) {
    this.logger.log(`sealJob start jobPda=${jobPdaStr}`);
    const sealIx = await getSealJobInstruction({
      owner: this.solanaKitSigner,
      job: address(jobPdaStr),
    });
    const res = await this.sendInstruction(sealIx);
    this.logger.log(
      `sealJob success jobPda=${jobPdaStr} signature=${(res as any).signature}`,
    );
    return res;
  }

  async spendLinked(
    jobPdaStr: string,
    ipltMintStr: string,
    ipltAmountStr: string,
    settlementNumber: number,
    consumableBurns: { mint: string; amount: string }[],
  ) {
    this.logger.log(
      `spendLinked start jobPda=${jobPdaStr} ipltMint=${ipltMintStr} ipltAmount=${ipltAmountStr} settlementNumber=${settlementNumber} burns=${consumableBurns?.length}`,
    );
    const jobPda = umiPublicKey(jobPdaStr);
    const ipltMint = umiPublicKey(ipltMintStr);

    const escrowIpltAccount = findAssociatedTokenPda(this.umi, {
      mint: ipltMint,
      owner: jobPda,
    })[0];

    const spendIx = await getSpendLinkedInstructionAsync({
      jobOwner: this.solanaKitSigner,
      job: address(jobPdaStr),
      ipltMint: address(ipltMintStr),
      escrowIpltAccount: address(escrowIpltAccount),
      settlementNumber,
      ipltAmount: BigInt(ipltAmountStr),
      consumableBurns: consumableBurns.map((b) => ({
        mint: address(b.mint),
        amount: BigInt(b.amount),
      })) as ConsumableBurnArgs[],
    });

    const getAccountMeta = getAccountMetaFactory(
      SMART_SUPPLY_ESCROW_PROGRAM_ADDRESS,
      'programId',
    );

    const extraAccounts = [] as any[];
    for (const burn of consumableBurns) {
      const mintPk = umiPublicKey(burn.mint);
      const escrowConsumable = findAssociatedTokenPda(this.umi, {
        mint: mintPk,
        owner: jobPda,
      })[0];
      extraAccounts.push(
        getAccountMeta({ value: address(burn.mint), isWritable: true })!,
      );
      extraAccounts.push(
        getAccountMeta({ value: address(escrowConsumable), isWritable: true })!,
      );
    }

    const originalAccounts = ((spendIx as any).accounts ?? []) as any[];
    const augmentedSpendIx = {
      ...(spendIx as any),
      accounts: [...originalAccounts, ...extraAccounts],
    };

    const res = await this.sendInstruction(augmentedSpendIx);
    this.logger.log(
      `spendLinked success jobPda=${jobPdaStr} signature=${(res as any).signature}`,
    );
    return res;
  }

  async fetchJob(jobPdaStr: string) {
    this.logger.log(`fetchJob start jobPda=${jobPdaStr}`);
    const jobAcc = await fetchJob(this.rpc, address(jobPdaStr), {
      commitment: 'confirmed' as any,
    });
    this.logger.log(`fetchJob success jobPda=${jobPdaStr}`);
    return this.serializeForJson(jobAcc as any);
  }

  async fetchCounter(ownerStr: string) {
    this.logger.log(`fetchCounter start owner=${ownerStr}`);
    const PROGRAM_ID = SMART_SUPPLY_ESCROW_PROGRAM_ADDRESS as string;
    const [counterPda] = await this.umi.eddsa.findPda(
      umiPublicKey(PROGRAM_ID),
      [
        new TextEncoder().encode('job_counter'),
        publicKeyBytes(umiPublicKey(ownerStr)),
      ],
    );
    const counterAcc = await fetchJobCounter(this.rpc, address(counterPda), {
      commitment: 'confirmed' as any,
    });
    this.logger.log(`fetchCounter success owner=${ownerStr}`);
    return this.serializeForJson({
      pda: address(counterPda),
      ...counterAcc,
    } as any);
  }

  async fetchSettlement(jobPdaStr: string, settlementNumber: number) {
    this.logger.log(
      `fetchSettlement start jobPda=${jobPdaStr} settlementNumber=${settlementNumber}`,
    );
    const { fetchSettlement } = await import('./generated/accounts/settlement');
    const PROGRAM_ID = SMART_SUPPLY_ESCROW_PROGRAM_ADDRESS as string;
    const jobPda = umiPublicKey(jobPdaStr);
    const numLe = Buffer.alloc(4);
    numLe.writeUInt32LE(settlementNumber);
    const [settlementPda] = await this.umi.eddsa.findPda(
      umiPublicKey(PROGRAM_ID),
      [new TextEncoder().encode('settlement'), publicKeyBytes(jobPda), numLe],
    );
    const settlementAcc = await fetchSettlement(
      this.rpc,
      address(settlementPda),
      { commitment: 'confirmed' as any },
    );
    this.logger.log(
      `fetchSettlement success jobPda=${jobPdaStr} settlementNumber=${settlementNumber}`,
    );
    return this.serializeForJson({
      pda: address(settlementPda),
      ...settlementAcc,
    } as any);
  }

  // Recursively serialize BigInt values to strings for JSON responses
  private serializeForJson(value: any): any {
    if (typeof value === 'bigint') return value.toString();
    if (Array.isArray(value)) return value.map((v) => this.serializeForJson(v));
    if (value && typeof value === 'object') {
      const out: any = {};
      for (const [k, v] of Object.entries(value)) {
        out[k] = this.serializeForJson(v);
      }
      return out;
    }
    return value;
  }
}
