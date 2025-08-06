import { ApiProperty } from '@nestjs/swagger';

export class CreateIPLTTokenDto {
  @ApiProperty({
    description: 'Token metadata and configuration',
    example: {
      'Max Supply': { value: 1000000 },
      name: 'Test Token',
      symbol: 'TEST',
      description: 'Test token description',
    },
  })
  tokenData: string;

  @ApiProperty({
    description: 'OEM wallet mnemonic',
    example: { mnemonics: 'your mnemonic phrase here' },
  })
  oemMnemonic: string;
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
