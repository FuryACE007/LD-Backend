import { ApiProperty } from '@nestjs/swagger';

class PrintRequestDto {
  @ApiProperty({
    description: 'The token mint address to process.',
    example: '2uT3YF6v5178p5mkx62ak11HHmVoxgbzrG9dfhtF879e',
  })
  tokenMint: string;

  @ApiProperty({
    description: 'The amount of tokens to process.',
    example: 100,
    minimum: 1,
  })
  amount: number;
}

export class CallPrintDto {
  @ApiProperty({
    description:
      'Array of print requests to process in batch. Each request specifies a token mint and amount.',
    type: [PrintRequestDto],
    example: [
      {
        tokenMint: '2uT3YF6v5178p5mkx62ak11HHmVoxgbzrG9dfhtF879e',
        amount: 100,
      },
      { tokenMint: '3fT4YF8v6189p6nly73ak22IImWpygbzrH0eghtG980f', amount: 50 },
    ],
  })
  printRequests: PrintRequestDto[];

  @ApiProperty({
    description:
      'The mnemonic phrase for the wallet that will be used to sign the transaction.',
    example: 'your wallet mnemonic phrase here',
  })
  mnemonics: string;
}
