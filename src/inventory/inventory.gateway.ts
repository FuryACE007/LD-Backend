import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  pingInterval: 10000,
  pingTimeout: 5000,
  transports: ['websocket'],
  allowUpgrades: true,
  path: '/socket.io/',
  connectTimeout: 45000,
  maxHttpBufferSize: 1e8,
  allowEIO3: true,
  cleanupEmptyChildNamespaces: true,
})
export class InventoryGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(InventoryGateway.name);

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    client.conn.on('heartbeat', () => {
      this.logger.debug(`Heartbeat from client: ${client.id}`);
    });

    client.on('error', (error) => {
      this.logger.error(`Socket error for client ${client.id}:`, error);
    });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    client.conn.on('upgrade', () => {
      this.logger.log(`Client ${client.id} attempting to upgrade connection`);
    });
  }

  broadcastWebhookEvent(data: any) {
    try {
      this.logger.log('Broadcasting webhook event to clients...');
      this.logger.log(`Connected clients: ${this.server.engine.clientsCount}`);
      this.logger.log('Webhook data:', JSON.stringify(data, null, 2));
      this.server.emit('webhook-event', data);
      this.logger.log('Broadcast complete');
    } catch (error) {
      this.logger.error('Error broadcasting webhook event:', error);
    }
  }
}
