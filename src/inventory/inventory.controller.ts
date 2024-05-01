import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { KeypairSigner, PublicKey } from '@metaplex-foundation/umi';
import { CreateWalletsDto } from './dto/create-wallets.dto';
import { LoginInventoryDto } from './dto/login-inventory.dto';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  /*------------------ Get the wallet balance------------------------*/

  @Get('wallet-balance/:pubkey')
  async getWalletBalance(@Param('pubkey') pubkey: string): Promise<Number> {
    return this.inventoryService.getWalletBalance(pubkey);
  }

  /* ----------------- Get the data of tokens in the wallet --------------- */

  @Get('token-data/:walletAddress')
  async getTokenData(
    @Param('walletAddress') walletAddress: string,
  ): Promise<JSON> {
    return this.inventoryService.getTokenData(walletAddress);
  }

  /*---------- Used to create a wallet and generate a new instance of OEM with the given signer-------- */
  @Post('create-inventory')
  async createInventoryWallet(): Promise<JSON> {
    // returns a promise
    return this.inventoryService.createInventoryWallet(); // returns a promise containing {mnemonic, keypair}
  }

  /*------------Create and fund the consumable wallets-----------------------------------------*/

  @Post('create-consumable-wallets')
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
  async loginInventory(
    @Body() loginInventoryDto: LoginInventoryDto,
  ): Promise<KeypairSigner> {
    return this.inventoryService.loginInventory(loginInventoryDto.mnemonic);
  }
}
