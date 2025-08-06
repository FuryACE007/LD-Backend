import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsNotEmpty } from 'class-validator';

export class CreateIPLTTokenDto {
  @ApiProperty({
    description: 'Token name',
    example: 'Test Token',
  })
  @IsString()
  @IsNotEmpty()
  tokenName: string;

  @ApiProperty({
    description: 'Token symbol',
    example: 'TEST',
  })
  @IsString()
  @IsNotEmpty()
  tokenSymbol: string;

  @ApiProperty({
    description: 'Unit of measurement',
    example: 'units',
  })
  @IsString()
  @IsNotEmpty()
  uom: string;

  @ApiProperty({
    description: 'Maximum token supply',
    example: 1000000,
  })
  @IsNumber()
  @IsNotEmpty()
  maxSupply: number;

  @ApiProperty({
    description: 'Token description',
    example: 'Test token description',
  })
  @IsString()
  @IsNotEmpty()
  tokenDescription: string;

  @ApiProperty({
    description: 'OEM wallet public key address',
    example: 'EmLhXf5u1JBGwpbHAQZhBnYmgmLax4WBxPBxvVomDSF1',
  })
  @IsString()
  @IsNotEmpty()
  oemWalletAddress: string;
}

export class CreateIPLTTokenResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Token created successfully' })
  message: string;

  @ApiProperty({ example: '7G7k9z...yourPublicKeyHere' })
  mintAddress?: string;

  @ApiProperty({ required: false })
  error?: string;
}
