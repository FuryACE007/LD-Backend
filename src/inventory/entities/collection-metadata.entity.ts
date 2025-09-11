import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { RedemptionCode } from './redemption-code.entity';

@Entity('collection_metadata')
export class CollectionMetadata {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 32, unique: true })
  name: string;

  @Column({ type: 'varchar', length: 64 })
  candyMachineAddress: string;

  @Column({ type: 'varchar', length: 64 })
  collectionMintAddress: string;

  @Column({ type: 'varchar', length: 64 })
  collectionUpdateAuthority: string;

  @Column({ type: 'int' })
  maxSupply: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => RedemptionCode, (code) => code.collection)
  redemptionCodes: RedemptionCode[];
}
