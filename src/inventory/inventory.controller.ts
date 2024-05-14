import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { KeypairSigner, PublicKey } from '@metaplex-foundation/umi';
import { ApiResponse, ApiTags, ApiOperation } from '@nestjs/swagger';
import { CreateWalletsDto } from './dto/create-wallets.dto';
import { LoginInventoryDto } from './dto/login-inventory.dto';
import { SendTokensDto } from './dto/send-tokens.dto';

@ApiTags('inventory')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  /*------------------ Get the wallet balance------------------------*/

  @Get('wallet-balance/:pubkey')
  @ApiOperation({ summary: 'Get wallet balance' })
  @ApiResponse({ status: 200, description: 'The wallet balance.' })
  async getWalletBalance(@Param('pubkey') pubkey: string): Promise<Number> {
    return this.inventoryService.getWalletBalance(pubkey);
  }

  /* ----------------- Get the data of tokens in the wallet --------------- */

  @Get('token-data/:walletAddress')
  @ApiOperation({ summary: 'Get token data' })
  @ApiResponse({ status: 200, description: 'The token data.' })
  async getTokenData(
    @Param('walletAddress') walletAddress: string,
  ): Promise<JSON> {
    return this.inventoryService.getTokenData(walletAddress);
  }

  /*---------- Used to create a wallet and generate a new instance of OEM with the given signer-------- */
  @ApiOperation({ summary: 'Create inventory wallet' })
  @ApiResponse({ status: 200, description: 'The created inventory wallet.' })
  @Post('create-inventory')
  @ApiOperation({ summary: 'Create inventory wallet' })
  @ApiResponse({ status: 200, description: 'The created inventory wallet.' })
  async createInventoryWallet(): Promise<JSON> {
    // returns a promise
    return this.inventoryService.createInventoryWallet(); // returns a promise containing {mnemonic, keypair}
  }

  /*------------Create and fund the consumable wallets-----------------------------------------*/

  @Post('create-consumable-wallets')
  @ApiOperation({ summary: 'Create consumable wallets' })
  @ApiResponse({ status: 200, description: 'The created consumable wallets.' })
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
  @ApiOperation({ summary: 'Login to inventory' })
  @ApiResponse({ status: 200, description: 'The login result.' })
  async loginInventory(
    @Body() loginInventoryDto: LoginInventoryDto,
  ): Promise<KeypairSigner> {
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
    status: 200,
    description: 'The operation was successful.',
    type: String, // Adjust the type according to the actual return type of your method
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request.',
  })
  async sendTokens(@Body() sendTokensDto: SendTokensDto) {
    return this.inventoryService.sendTokens(
      sendTokensDto.amount,
      sendTokensDto.tokenMint,
      sendTokensDto.destinationWalletAddress,
      sendTokensDto.mnemonic,
    );
  }
}
