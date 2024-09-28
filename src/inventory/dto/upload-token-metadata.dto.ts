import { ApiProperty } from '@nestjs/swagger';

export class UploadMetadataDto {
  @ApiProperty({ description: 'The mnemonic for the wallet.' })
  mnemonic: string;

  @ApiProperty({ description: 'The metadata to upload.', type: Object })
  metadata: JSON;
}
