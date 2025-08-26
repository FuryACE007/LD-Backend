import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import {
  ApiResponse,
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { CreateWalletsDto } from './dto/create-wallets.dto';
import { LoginInventoryDto } from './dto/login-inventory.dto';
import { SendTokensDto } from './dto/send-tokens.dto';
import { CloseTokenAccountDto } from './entities/close-token-account.dto';
import { CallPrintDto } from './dto/call-print.dto';
import { UploadMetadataDto } from './dto/upload-token-metadata.dto';
import { Logger } from '@nestjs/common';
import { BatchResponse } from './dto/batch-response.dto';
import {
  CreateIPLTTokenDto,
  CreateIPLTTokenResponseDto,
} from './dto/create-iplt-token.dto';
import { LogicalTokenMetadata } from './types/token-metadata';
// import { string } from '@metaplex-foundation/umi/serializers';
import { CreateCandyMachineDto } from './dto/create-candy-machine.dto';
import { CreateCandyMachineResponseDto } from './dto/create-candy-machine.dto';

@ApiTags('inventory')
@Controller('inventory')
export class InventoryController {
  private readonly logger = new Logger(InventoryController.name);

  constructor(private readonly inventoryService: InventoryService) {}

  /*------------------ Get the wallet balance------------------------*/

  @Get('wallet-balance/:pubkey')
  @ApiOperation({
    summary: 'Retrieve the balance of a wallet',
    description: 'Returns the SOL balance for the given wallet public key.',
  })
  @ApiResponse({
    status: 200,
    description: 'The balance of the wallet in SOL.',
    schema: { type: 'number', example: 1.234 },
  })
  async getWalletBalance(@Param('pubkey') pubkey: string): Promise<number> {
    return this.inventoryService.getWalletBalance(pubkey);
  }

  /* ----------------- Get the data of tokens in the wallet --------------- */

  @Get('token-data/:walletAddress')
  @ApiOperation({
    summary: 'Retrieve token data for a wallet',
    description: 'Returns all token data for the specified wallet address.',
  })
  @ApiParam({
    name: 'walletAddress',
    description: 'The wallet address to retrieve token data for.',
  })
  @ApiResponse({
    status: 200,
    description: 'The token data for the wallet.',
    schema: { type: 'object' },
  })
  async getTokenData(
    @Param('walletAddress') walletAddress: string,
  ): Promise<any> {
    return this.inventoryService.getTokenData(walletAddress);
  }

  /*---------- Used to create a wallet and generate a new instance of OEM with the given signer-------- */
  @Post('create-inventory')
  @ApiOperation({
    summary: 'Create inventory wallet',
    description:
      'Creates a new inventory wallet and returns its mnemonic and keypair.',
  })
  @ApiResponse({
    status: 200,
    description: 'The created inventory wallet.',
    schema: { type: 'object' },
  })
  async createInventoryWallet(): Promise<JSON> {
    // returns a promise
    return this.inventoryService.createInventoryWallet(); // returns a promise containing {mnemonic, keypair}
  }

  /*------------Create and fund the consumable wallets-----------------------------------------*/

  @Post('create-consumable-wallets')
  @ApiOperation({
    summary: 'Create consumable wallets',
    description: 'Creates multiple consumable wallets and funds them.',
  })
  @ApiResponse({
    status: 200,
    description: 'The created consumable wallets.',
    schema: { type: 'array', items: { type: 'string' } },
  })
  @ApiBody({
    description: 'Data required to create consumable wallets.',
    type: CreateWalletsDto,
  })
  createConsumableWallet(@Body() createWalletsDto: CreateWalletsDto) {
    return this.inventoryService.createConsumableWallet(
      createWalletsDto.numberOfWallets,
      createWalletsDto.signer,
      createWalletsDto.tokensPerWallet,
    );
  }

  /**--------------------------------------------------------------------------------------------- */

  /* ============================Login using mnemoics and store signer on the local storage=============================== */

  @Post('login-inventory')
  @ApiOperation({
    summary: 'Login to inventory',
    description:
      'Logs in to the inventory using a mnemonic and returns the public key.',
  })
  @ApiResponse({
    status: 200,
    description: 'The publickey of the wallet.',
    schema: { type: 'string' },
  })
  @ApiBody({
    description: 'Data required to login to inventory.',
    type: LoginInventoryDto,
  })
  async loginInventory(
    @Body() loginInventoryDto: LoginInventoryDto,
  ): Promise<string> {
    return this.inventoryService.loginInventory(loginInventoryDto.mnemonic);
  }

  //------------------------------Send Tokens----------------------------------------
  @Post('send-tokens')
  @ApiOperation({
    summary: 'Send tokens to a specified destination',
    description:
      'Sends a specified amount of tokens to a destination wallet address.',
  })
  @ApiResponse({
    status: 201,
    description: 'The operation was successful.',
    schema: { type: 'string' },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request.',
  })
  @ApiBody({
    description: 'The data required to send tokens.',
    type: SendTokensDto,
  })
  async sendTokens(@Body() sendTokensDto: SendTokensDto) {
    return this.inventoryService.sendTokens(
      sendTokensDto.amount,
      sendTokensDto.tokenMint,
      sendTokensDto.mnemonics,
      sendTokensDto.destinationWalletAddress,
    );
  }

  /*-----------------Call Print---------------------------------*/
  @Post('call-print')
  @ApiOperation({
    summary: 'Process multiple token print requests in batch',
    description:
      'Processes multiple token print requests in a single transaction.',
  })
  @ApiResponse({
    status: 201,
    description:
      'The print requests were processed successfully. Returns the transaction signature.',
    schema: {
      properties: {
        success: { type: 'boolean' },
        batchResponses: {
          type: 'array',
          items: { $ref: '#/components/schemas/BatchResponse' },
        },
        summary: { type: 'string' },
      },
    },
  })
  async callPrint(@Body() callPrintDto: CallPrintDto): Promise<{
    success: boolean;
    batchResponses: BatchResponse[];
    summary: string;
  }> {
    return this.inventoryService.callPrint(callPrintDto.printRequests);
  }

  /*-----------------Close Token Account---------------------------------*/
  @Post('close-token')
  @ApiOperation({
    summary: 'Close token account',
    description: 'Close a token account with 0 token balance.',
  })
  @ApiResponse({
    status: 201,
    description: 'The operation was successful.',
    schema: { type: 'string' },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request.',
  })
  @ApiBody({
    description: 'The data required to close a token account.',
    type: CloseTokenAccountDto,
  })
  async closeTokenAccount(@Body() closeTokenAccountDto: CloseTokenAccountDto) {
    return this.inventoryService.closeTokenAccount(
      closeTokenAccountDto.walletAddress,
      closeTokenAccountDto.tokenMint,
      closeTokenAccountDto.mnemonic,
    );
  }

  @Post('upload-metadata')
  @ApiOperation({
    summary: 'Upload metadata to Arweave',
    description: 'Uploads metadata to Arweave/Irys and returns the URI.',
  })
  @ApiResponse({
    status: 200,
    description: 'Metadata uploaded successfully.',
    schema: { type: 'string' },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request.',
  })
  @ApiBody({ type: UploadMetadataDto })
  async uploadMetadata(@Body() uploadMetadataDto: UploadMetadataDto) {
    return this.inventoryService.uploadMetadata(
      uploadMetadataDto.mnemonic,
      uploadMetadataDto.metadata,
    );
  }

  @Post('create-iplt-token')
  @ApiOperation({
    summary: 'Create a new IPLT token',
    description:
      'Creates a new token with the specified metadata and configuration, mints supply, and transfers to OEM wallet.',
  })
  @ApiResponse({
    status: 201,
    description: 'Token created successfully.',
    type: CreateIPLTTokenResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request or token creation failed.',
  })
  @ApiBody({ type: CreateIPLTTokenDto })
  async createIPLTToken(
    @Body() createTokenDto: CreateIPLTTokenDto,
  ): Promise<CreateIPLTTokenResponseDto> {
    const tokenMetadata: LogicalTokenMetadata = {
      tokenName: createTokenDto.tokenName,
      tokenSymbol: createTokenDto.tokenSymbol,
      uom: createTokenDto.uom,
      maxSupply: createTokenDto.maxSupply,
      tokenDescription: createTokenDto.tokenDescription,
    };
    return this.inventoryService.createIPLTToken(
      JSON.stringify(tokenMetadata),
      createTokenDto.oemWalletAddress,
    );
  }

  // @Get('token-metadata/:mintAddress')
  // @ApiOperation({
  //   summary: 'Get token metadata',
  //   description: 'Retrieves the on-chain metadata for a specific token.',
  // })
  // @ApiResponse({
  //   status: 200,
  //   description: 'Token metadata retrieved successfully.',
  //   type: string,
  // })
  // @ApiParam({
  //   name: 'mintAddress',
  //   description: 'The mint address of the token',
  // })
  // async getTokenMetadata(
  //   @Param('mintAddress') mintAddress: string,
  // ): Promise<string> {
  //   return this.inventoryService.getTokenData(mintAddress);
  // }

  @Post('create-candy-machine')
  @ApiOperation({
    summary: 'Create a new candy machine with candy guard',
    description:
      'Creates a candy machine with allowlist guard and collection NFT',
  })
  @ApiResponse({
    status: 201,
    description: 'Candy machine created successfully',
    type: CreateCandyMachineResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request or candy machine creation failed',
  })
  @ApiBody({ type: CreateCandyMachineDto })
  async createCandyMachine(
    @Body() createCandyMachineDto: CreateCandyMachineDto,
  ): Promise<CreateCandyMachineResponseDto> {
    return this.inventoryService.createCandyMachine(createCandyMachineDto);
  }
}
