import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EscrowService } from './escrow.service';
import { CreateJobDto } from './dto/create-job.dto';
import { SetMediaHashDto } from './dto/set-media-hash.dto';
import { DepositIpltDto } from './dto/deposit-iplt.dto';
import { DepositConsumableDto } from './dto/deposit-consumable.dto';
import { SealJobDto } from './dto/seal-job.dto';
import { SpendLinkedDto } from './dto/spend-linked.dto';

@ApiTags('escrow')
@Controller('escrow')
export class EscrowController {
  constructor(private readonly escrowService: EscrowService) {}

  @Post('create-job')
  createJob(@Body() body: CreateJobDto) {
    return this.escrowService.createJob(body.ipltMint, body.consumables);
  }

  @Post('set-media-hash')
  setMediaHash(@Body() body: SetMediaHashDto) {
    return this.escrowService.setMediaHash(body.jobPda, body.mediaHash);
  }

  @Post('deposit-iplt')
  depositIplt(@Body() body: DepositIpltDto) {
    return this.escrowService.depositIplt(body.jobPda, body.amount);
  }

  @Post('deposit-consumable')
  depositConsumable(@Body() body: DepositConsumableDto) {
    return this.escrowService.depositConsumable(
      body.jobPda,
      body.consumableIndex,
      body.amount,
    );
  }

  @Post('seal-job')
  sealJob(@Body() body: SealJobDto) {
    return this.escrowService.sealJob(body.jobPda);
  }

  @Post('spend-linked')
  spendLinked(@Body() body: SpendLinkedDto) {
    return this.escrowService.spendLinked(
      body.jobPda,
      body.ipltAmount,
      body.consumableBurnsByIndex,
    );
  }

  @Get('job/:jobPda')
  fetchJob(@Param('jobPda') jobPda: string) {
    return this.escrowService.fetchJob(jobPda);
  }

  @Get('counter/:owner')
  fetchCounter(@Param('owner') owner: string) {
    return this.escrowService.fetchCounter(owner);
  }

  @Get('settlement/:jobPda/:settlementNumber')
  fetchSettlement(
    @Param('jobPda') jobPda: string,
    @Param('settlementNumber') settlementNumber: string,
  ) {
    return this.escrowService.fetchSettlement(jobPda, Number(settlementNumber));
  }
}
