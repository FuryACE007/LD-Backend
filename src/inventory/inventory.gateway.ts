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
  pingInterval: 25000,
  pingTimeout: 10000,
  transports: ['websocket'],
  allowUpgrades: true,
  path: '/socket.io/',
  connectTimeout: 45000,
  maxHttpBufferSize: 1e8,
  allowEIO3: true,
  cleanupEmptyChildNamespaces: true,
  perMessageDeflate: false,
  handlePreflightRequest: (req, res) => {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST',
      'Access-Control-Allow-Headers': 'my-custom-header',
      'Access-Control-Allow-Credentials': true,
    });
    res.end();
  },
})
export class InventoryGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(InventoryGateway.name);
  private connectedClients = new Set<string>();

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    this.connectedClients.add(client.id);
    this.logger.log(`Client connected: ${client.id}`);
    this.logger.log(`Total connected clients: ${this.connectedClients.size}`);
  }

  handleDisconnect(client: Socket) {
    this.connectedClients.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);
    this.logger.log(`Total connected clients: ${this.connectedClients.size}`);
  }

  broadcastWebhookEvent(data: any) {
    try {
      this.logger.log('Broadcasting webhook event to clients...');
      this.logger.log(
        `Active connected clients: ${this.connectedClients.size}`,
      );
      this.server.emit('webhook-event', data);
      this.logger.log('Broadcast complete');
    } catch (error) {
      this.logger.error('Error broadcasting webhook event:', error);
    }
  }
}
