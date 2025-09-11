import { Logger } from '@nestjs/common';

export class InventoryGateway {
  private readonly logger = new Logger(InventoryGateway.name);
  private connectedClients = new Set<string>();
}
