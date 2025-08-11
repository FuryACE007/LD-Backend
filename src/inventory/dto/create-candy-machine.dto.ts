import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsNotEmpty,
  Min,
  MaxLength,
  IsUrl,
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
    description: 'Base URI for the metadata (Arweave/IPFS)',
    example: 'https://gateway.irys.xyz/',
    pattern: '^https?://',
  })
  @IsString()
  @IsNotEmpty()
  @IsUrl()
  baseUri: string;

  @ApiProperty({
    description: 'Name prefix for NFTs. Use $ID+1$ for sequential numbering',
    example: 'SPIRIT70 #$ID+1$',
    maxLength: 16,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  namePrefix: string;
}

export class CreateCandyMachineResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Candy machine created successfully' })
  message: string;

  @ApiProperty({ example: 'xyz...abc' })
  candyMachineAddress?: string;

  @ApiProperty({ example: 'abc...xyz' })
  candyGuardAddress?: string;

  @ApiProperty({ example: 'def...ghi' })
  collectionMintAddress?: string;

  @ApiProperty({ example: 'xyz...abc' })
  collectionUpdateAuthority?: string;

  @ApiProperty({ required: false })
  error?: string;
}
