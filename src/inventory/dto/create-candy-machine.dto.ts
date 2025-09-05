import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsNotEmpty,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateCandyMachineDto {
  @ApiProperty({
    description: 'Collection name',
    example: 'SCOTCH 70',
    maxLength: 32,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  collectionName: string;

  @ApiProperty({
    description: 'Collection symbol',
    example: 'SCOTCH70',
    maxLength: 10,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  collectionSymbol: string;

  @ApiProperty({
    description: 'Collection description',
    example: 'Scotch Collection 1970',
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  collectionDescription: string;

  @ApiProperty({
    description: 'Maximum supply of tokens that can be minted',
    example: 1000,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  @IsNotEmpty()
  maxSupply: number;

  @ApiProperty({
    description: 'Name prefix for NFTs',
    example: 'SPIRIT70',
    maxLength: 16,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  namePrefix: string;

  // TODO: Remove these POC fields when implementing unique metadata
  @ApiProperty({
    description: 'Base NFT name for POC (all NFTs will use this)',
    example: 'Spirit NFT',
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  baseNftName: string;

  @ApiProperty({
    description: 'Base NFT description for POC (all NFTs will use this)',
    example: 'A unique spirit from the 1970 collection',
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  baseNftDescription: string;

  @ApiProperty({
    description: 'Base NFT image URL for POC (all NFTs will use this)',
    example: 'https://arweave.net/your-image-hash',
  })
  @IsString()
  @IsNotEmpty()
  baseImageUrl: string;
}

export class CreateCandyMachineResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Candy machine created successfully' })
  message: string;

  @ApiProperty({ example: 'xyz...abc' })
  candyMachineAddress?: string;

  @ApiProperty({ example: 'abc...xyz' })
  collectionMintAddress?: string;

  @ApiProperty({ example: 'xyz...abc' })
  collectionUpdateAuthority?: string;

  @ApiProperty({ example: 1000 })
  totalRedemptionCodes?: number;

  @ApiProperty({ required: false })
  error?: string;
}
