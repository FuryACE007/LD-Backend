import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { KeypairSigner, PublicKey } from '@metaplex-foundation/umi';
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

@ApiTags('inventory')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  /*------------------ Get the wallet balance------------------------*/

  @Get('wallet-balance/:pubkey')
  @ApiOperation({ summary: 'Retrieve the balance of a wallet' })
  @ApiResponse({
    status: 200,
    description: 'The balance of the wallet in SOL.',
  })
  async getWalletBalance(@Param('pubkey') pubkey: string): Promise<number> {
    return this.inventoryService.getWalletBalance(pubkey);
  }

  /* ----------------- Get the data of tokens in the wallet --------------- */

  @Get('token-data/:walletAddress')
  @ApiOperation({ summary: 'Retrieve token data for a wallet' })
  @ApiParam({
    name: 'walletAddress',
    description: 'The wallet address to retrieve token data for.',
  })
  @ApiResponse({ status: 200, description: 'The token data for the wallet.' })
  async getTokenData(
    @Param('walletAddress') walletAddress: string,
  ): Promise<any> {
    return this.inventoryService.getTokenData(walletAddress);
  }

  /*---------- Used to create a wallet and generate a new instance of OEM with the given signer-------- */
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
  @ApiOperation({ summary: 'Login to inventory' })
  @ApiResponse({ status: 200, description: 'The login result.' })
  @ApiBody({
    description: 'Data required to login to inventory.',
    type: LoginInventoryDto,
  })
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
    status: 201,
    description: 'The operation was successful.',
    type: String, // Adjust the type according to the actual return type of your method
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
      sendTokensDto.ownerWalletAddress,
      sendTokensDto.destinationWalletAddress,
    );
  }
}
