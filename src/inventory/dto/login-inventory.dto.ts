import { ApiProperty } from '@nestjs/swagger';

export class LoginInventoryDto {
  @ApiProperty({ description: 'The mnemonic for the wallet.' })
  mnemonic: string;
}
