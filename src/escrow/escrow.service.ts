import { Injectable, Logger, BadRequestException } from '@nestjs/common';
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
import { fetchJob, fetchJobCounter, getJobDecoder } from './generated/accounts';
import { SMART_SUPPLY_ESCROW_PROGRAM_ADDRESS } from './generated/programs';
import { getAccountMetaFactory } from './generated/shared';
import type { ConsumableSpecArgs, ConsumableBurnArgs } from './generated/types';
import {
  publicKey as umiPublicKey,
  publicKeyBytes,
} from '@metaplex-foundation/umi';
import { mnemonicToSeedSync, validateMnemonic } from 'bip39';

@Injectable()
export class EscrowService {
  private readonly rpc = createSolanaRpc(
    process.env.RPC_ENDPOINT || 'https://api.devnet.solana.com',
  );
  private umi = createUmi(
    process.env.RPC_ENDPOINT || 'https://api.devnet.solana.com',
  );
  private solanaKitSigner!: TransactionSigner<string>;
  private umiSigner!: ReturnType<
    typeof this.umi.eddsa.createKeypairFromSecretKey
  >;
  private readonly logger = new Logger(EscrowService.name);
  private signerSource: 'mnemonic' | 'file' = 'file';

  constructor() {
    // Ensure signer is initialized synchronously where possible
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.initializeSigners();
  }

  private async initializeSigners() {
    const mnemonic = process.env.PAYER_MNEMONIC?.trim();
    if (mnemonic && validateMnemonic(mnemonic)) {
      const seed = mnemonicToSeedSync(mnemonic);
      const seed32 = new Uint8Array(seed).slice(0, 32);
      const keypairFromMnemonic = this.umi.eddsa.createKeypairFromSeed(seed32);

      this.umiSigner = keypairFromMnemonic;
      this.umi.use(keypairIdentity(this.umiSigner));
      this.umi.use(mplToolbox());

      const signer = await createKeyPairSignerFromBytes(
        keypairFromMnemonic.secretKey,
      );
      this.solanaKitSigner = signer;
      this.signerSource = 'mnemonic';
      this.logger.log(
        `Signer initialized [mnemonic] owner=${this.solanaKitSigner.address}`,
      );
      return;
    } else if (mnemonic) {
      throw new Error(
        'PAYER_MNEMONIC is invalid. Provide a valid BIP-39 phrase.',
      );
    }

    // Strict mode: require mnemonic, no file fallback
    if (!mnemonic) {
      throw new Error('PAYER_MNEMONIC is required but not set.');
    }
  }

  private async getFreshBlockhash() {
    const { value } = await this.rpc.getLatestBlockhash().send();
    return value;
  }

  private async awaitConfirmation(signature: Signature, timeoutMs = 20000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const { value } = await this.rpc.getSignatureStatuses([signature]).send();
      const status = value?.[0];
      if (status?.confirmationStatus === 'finalized') {
        if (status?.err) {
          await this.fetchAndLogTransactionLogs(signature);
          const errJson = this.serializeForJson(status.err);
          throw new BadRequestException(
            `Transaction failed: ${JSON.stringify(errJson)}`,
          );
        }
        return;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new BadRequestException('Transaction confirmation timeout');
  }

  private async fetchAndLogTransactionLogs(signature: Signature) {
    try {
      const tx = await this.rpc
        .getTransaction(signature, {
          encoding: 'jsonParsed',
          maxSupportedTransactionVersion: 0,
        })
        .send();
      const logs: string[] | undefined = (tx as any)?.meta?.logMessages;
      if (logs && logs.length) {
        this.logger.error(
          `On-chain logs for ${signature}:\n${logs.join('\n')}`,
        );
      } else {
        this.logger.warn(`No on-chain logs available for ${signature}`);
      }
    } catch (e: any) {
      this.logger.warn(
        `Failed to fetch transaction logs for ${signature}: ${e?.message ?? e}`,
      );
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

    // Preflight: simulate to capture logs for easier debugging
    try {
      const sim = await this.rpc
        .simulateTransaction(base64, { encoding: 'base64' })
        .send();
      const simErr = (sim as any)?.value?.err;
      const simLogs = (sim as any)?.value?.logs;
      if (simErr) {
        const simErrJson = this.serializeForJson(simErr);
        this.logger.error(
          `Preflight simulation failed: ${JSON.stringify(simErrJson)}\nLogs:\n${(simLogs || []).join('\n')}`,
        );
        throw new BadRequestException(
          `Transaction simulation failed: ${JSON.stringify(simErrJson)}`,
        );
      }
    } catch (e) {
      const msg = (e as any)?.message ?? '';
      // If client-side serialization blocks simulate, warn and proceed to send
      if (msg.includes('serialize a BigInt')) {
        this.logger.warn(
          `simulateTransaction unavailable or failed softly: ${msg}`,
        );
      } else {
        // Treat transformer-thrown simulation errors as preflight failures
        this.logger.error(`simulateTransaction threw: ${msg}`);
        throw new BadRequestException(`Transaction simulation failed: ${msg}`);
      }
    }

    const sig = await this.rpc
      .sendTransaction(base64, { encoding: 'base64', skipPreflight: true })
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
    } catch {
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

  async depositIplt(jobPdaStr: string, amountStr: string) {
    this.logger.log(
      `depositIplt start jobPda=${jobPdaStr} amount=${amountStr}`,
    );
    const jobPda = umiPublicKey(jobPdaStr);

    // Fetch job to derive IP-LT mint from on-chain state
    const jobAcc = await fetchJob(this.rpc, address(jobPdaStr), {
      commitment: 'confirmed' as any,
    });
    const ipltMintResolved =
      (jobAcc as any).data?.ipltMint ?? (jobAcc as any).ipltMint;
    if (!ipltMintResolved) {
      throw new BadRequestException('Job account missing ipltMint');
    }
    const ipltMint = umiPublicKey(ipltMintResolved as string);

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
      ipltMint: address(ipltMintResolved as string),
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
    consumableIndex: number,
    amountStr: string,
  ) {
    this.logger.log(
      `depositConsumable start jobPda=${jobPdaStr} index=${consumableIndex} amount=${amountStr}`,
    );
    const jobPda = umiPublicKey(jobPdaStr);

    // Fetch job to derive consumable mint by index
    const jobAcc = await fetchJob(this.rpc, address(jobPdaStr), {
      commitment: 'confirmed' as any,
    });
    const consumables =
      (jobAcc as any).data?.consumables ?? (jobAcc as any).consumables;
    if (!Array.isArray(consumables)) {
      throw new BadRequestException('Job account missing consumables');
    }
    if (consumableIndex < 0 || consumableIndex >= consumables.length) {
      throw new BadRequestException(
        `Invalid consumableIndex ${consumableIndex}, available range 0..${consumables.length - 1}`,
      );
    }
    const consumableMintResolved = consumables[consumableIndex].mint as string;
    const consumableMint = umiPublicKey(consumableMintResolved);

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
      consumableMint: address(consumableMintResolved),
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
      `depositConsumable success jobPda=${jobPdaStr} mint=${consumableMintResolved} signature=${(res as any).signature}`,
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
    ipltAmountStr: string,
    consumableBurnsByIndex: { index: number; amount: string }[],
  ) {
    this.logger.log(
      `spendLinked start jobPda=${jobPdaStr} ipltAmount=${ipltAmountStr} burns=${consumableBurnsByIndex?.length}`,
    );
    const jobPda = umiPublicKey(jobPdaStr);

    // Fetch job to derive IP-LT mint and settlement number from the job and accept index-based consumable burns.
    const accResp = await this.rpc
      .getAccountInfo(address(jobPdaStr), {
        encoding: 'base64',
        commitment: 'confirmed' as any,
      })
      .send();
    const jobAccInfo = (accResp as any)?.value;
    const jobDataBase64 = jobAccInfo?.data?.[0];
    if (!jobDataBase64) {
      throw new BadRequestException('Job account not found or empty');
    }
    const jobDecoded = getJobDecoder().decode(
      new Uint8Array(Buffer.from(jobDataBase64, 'base64')),
    );
    const ipltMintResolved = jobDecoded.ipltMint as string;
    if (!ipltMintResolved) {
      throw new BadRequestException('Job account missing ipltMint');
    }
    const settlementNumberResolved = jobDecoded.settlementCount as number;
    if (typeof settlementNumberResolved === 'undefined') {
      throw new BadRequestException('Job account missing settlementCount');
    }

    // Guard: IPLT amount must not exceed deposited IPLT
    const ipltDepositedRaw = jobDecoded.ipltAmount as bigint;
    const ipltDeposited =
      typeof ipltDepositedRaw === 'bigint'
        ? ipltDepositedRaw
        : BigInt(ipltDepositedRaw ?? 0);
    const ipltAmountBig = BigInt(ipltAmountStr);
    if (ipltAmountBig > ipltDeposited) {
      throw new BadRequestException(
        `IPLT spend amount ${ipltAmountStr} exceeds deposited ${ipltDeposited.toString()}`,
      );
    }

    const ipltMint = umiPublicKey(ipltMintResolved as string);

    const escrowIpltAccount = findAssociatedTokenPda(this.umi, {
      mint: ipltMint,
      owner: jobPda,
    })[0];

    // Resolve consumable mints by index from job.consumables
    const consumables = jobDecoded.consumables as any[];
    if (!Array.isArray(consumables)) {
      throw new BadRequestException('Job account missing consumables');
    }

    // Build deposited map by mint for guard checks
    const depositedList = jobDecoded.depositedConsumables as any[];
    const depositedByMint = new Map<string, bigint>();
    for (const d of depositedList ?? []) {
      const mintStr = (d?.mint as string) ?? '';
      let amt: bigint;
      if (typeof d?.amount === 'bigint') {
        amt = d.amount as bigint;
      } else {
        amt = BigInt(d?.amount ?? 0);
      }
      if (mintStr) depositedByMint.set(mintStr, amt);
    }

    const consumableBurns = consumableBurnsByIndex.map((b) => {
      const spec = consumables[b.index];
      if (!spec) {
        throw new BadRequestException(`Invalid consumableIndex ${b.index}`);
      }
      const mintStr = spec.mint as string;
      const burnAmt = BigInt(b.amount);
      let maxAmt: bigint;
      if (typeof spec.maxAmount === 'bigint') {
        maxAmt = spec.maxAmount as bigint;
      } else {
        maxAmt = BigInt(spec.maxAmount ?? 0);
      }
      if (burnAmt > maxAmt) {
        throw new BadRequestException(
          `Burn amount ${b.amount} exceeds maxAmount ${maxAmt.toString()} for index ${b.index}`,
        );
      }
      const depositedAmt = depositedByMint.get(mintStr) ?? 0n;
      if (burnAmt > depositedAmt) {
        throw new BadRequestException(
          `Burn amount ${b.amount} exceeds deposited ${depositedAmt.toString()} for consumable ${mintStr}`,
        );
      }
      return {
        mint: address(mintStr),
        amount: burnAmt,
      };
    }) as ConsumableBurnArgs[];

    const spendIx = await getSpendLinkedInstructionAsync({
      jobOwner: this.solanaKitSigner,
      job: address(jobPdaStr),
      ipltMint: address(ipltMintResolved as string),
      escrowIpltAccount: address(escrowIpltAccount),
      settlementNumber: settlementNumberResolved,
      ipltAmount: BigInt(ipltAmountStr),
      consumableBurns,
    });

    const getAccountMeta = getAccountMetaFactory(
      SMART_SUPPLY_ESCROW_PROGRAM_ADDRESS,
      'programId',
    );

    const extraAccounts = [] as any[];
    for (const burn of consumableBurns) {
      const mintPk = umiPublicKey(burn.mint as string);
      const escrowConsumable = findAssociatedTokenPda(this.umi, {
        mint: mintPk,
        owner: jobPda,
      })[0];

      // Ensure escrow consumable ATA exists before sending
      const escrowConsumableAddr = address(escrowConsumable);
      const { value: escrowAccInfo } = await this.rpc
        .getAccountInfo(escrowConsumableAddr, { encoding: 'base64' })
        .send();
      if (!escrowAccInfo) {
        throw new BadRequestException(
          `Escrow consumable account not found for mint ${burn.mint}. Deposit the consumable first to create its ATA.`,
        );
      }

      extraAccounts.push(
        getAccountMeta({ value: address(burn.mint), isWritable: true })!,
      );
      extraAccounts.push(
        getAccountMeta({ value: escrowConsumableAddr, isWritable: true })!,
      );
    }

    const originalAccounts = ((spendIx as any).accounts ?? []) as any[];
    // Ensure IPLT mint is writable for SPL burn semantics
    const writableIpltMintMeta = getAccountMeta({
      value: address(ipltMintResolved as string),
      isWritable: true,
    })!;
    const updatedOriginalAccounts = originalAccounts.map((m, i) =>
      i === 2 ? writableIpltMintMeta : m,
    );
    const augmentedSpendIx = {
      ...(spendIx as any),
      accounts: [...updatedOriginalAccounts, ...extraAccounts],
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

  // Expose owner info for early logging
  getOwnerAddress(): string | undefined {
    return this.solanaKitSigner?.address;
  }

  getSignerSource(): 'mnemonic' | 'file' {
    return this.signerSource;
  }
}
