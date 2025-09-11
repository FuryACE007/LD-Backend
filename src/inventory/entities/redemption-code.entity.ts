import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CollectionMetadata } from './collection-metadata.entity';

export enum RedemptionStatus {
  UNUSED = 'unused',
  USED = 'used',
  EXPIRED = 'expired',
}

@Entity('redemption_codes')
@Index(['candyMachineAddress']) // For faster queries by candy machine
@Index(['code'], { unique: true }) // Ensure unique codes
export class RedemptionCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 16, unique: true })
  code: string; // Short, secure, QR-friendly code

  @Column({ type: 'varchar', length: 64 })
  candyMachineAddress: string;

  @Column({ type: 'varchar', length: 64 })
  collectionMintAddress: string;

  @Column({
    type: 'enum',
    enum: RedemptionStatus,
    default: RedemptionStatus.UNUSED,
  })
  status: RedemptionStatus;

  @Column({ type: 'varchar', length: 64, nullable: true })
  userWalletAddress?: string; // Set when redeemed

  @Column({ type: 'varchar', length: 64, nullable: true })
  mintedNftAddress?: string; // Set when NFT is minted

  @Column({ type: 'timestamp', nullable: true })
  redeemedAt?: Date; // When the code was used

  @Column({ type: 'varchar', length: 128, nullable: true })
  transactionSignature?: string; // Mint transaction signature

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(
    () => CollectionMetadata,
    (collection) => collection.redemptionCodes,
    {
      nullable: false, // Change to false since we want this to be required
      onDelete: 'CASCADE', // If collection is deleted, delete associated codes
    },
  )
  @JoinColumn({ name: 'collection_id' })
  collection: CollectionMetadata;

  @Column({ name: 'collection_id' })
  collectionId: string;
}
