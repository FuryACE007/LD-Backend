import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class RedeemMintRequestDto {
  @ApiProperty({
    description: 'The redemption code to use (format: XXXX-XXXX-XXXX)',
    example: 'ABCD-EFGH-IJKL',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/, {
    message:
      'Invalid redemption code format. Must be in format: XXXX-XXXX-XXXX',
  })
  code: string;

  @ApiProperty({
    description: 'The wallet address that will receive the NFT',
    example: 'HhKJ2...xyz',
  })
  @IsString()
  @IsNotEmpty()
  recipientWallet: string;
}

export class RedeemMintResponseDto {
  @ApiProperty({
    description: 'The address of the minted NFT',
  })
  nftAddress: string;

  @ApiProperty({
    description: 'The transaction signature',
  })
  txSignature: string;

  @ApiProperty({
    description: 'The name of the collection the NFT belongs to',
  })
  collectionName: string;
}
