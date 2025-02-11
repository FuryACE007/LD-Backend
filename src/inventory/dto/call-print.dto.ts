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

  @ApiProperty({
    description:
      'The mnemonic phrase for the wallet that will be used to sign this specific transfer.',
    example: 'wallet specific mnemonic phrase here',
  })
  mnemonics: string;
}

export class CallPrintDto {
  @ApiProperty({
    description:
      'Array of print requests to process in batch. Each request specifies a token mint, amount, and wallet mnemonics.',
    type: [PrintRequestDto],
    example: [
      {
        tokenMint: '2uT3YF6v5178p5mkx62ak11HHmVoxgbzrG9dfhtF879e',
        amount: 100,
        mnemonics: 'wallet 1 mnemonic phrase here',
      },
      {
        tokenMint: '3fT4YF8v6189p6nly73ak22IImWpygbzrH0eghtG980f',
        amount: 50,
        mnemonics: 'wallet 2 mnemonic phrase here',
      },
    ],
  })
  printRequests: PrintRequestDto[];
}
