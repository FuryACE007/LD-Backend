import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { EscrowAppModule } from './escrow.app.module';
import { LoggingInterceptor } from '../common/interceptors/logging.interceptor';
import { EscrowService } from './escrow.service';

async function bootstrap() {
  const app = await NestFactory.create(EscrowAppModule);
  app.enableCors();
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useLogger(['log', 'error', 'warn']);

  const config = new DocumentBuilder()
    .setTitle('Escrow API')
    .setDescription('Escrow microservice API')
    .setVersion('1.0')
    .addTag('escrow')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // Log owner address as soon as service is initialized
  const escrowSvc = app.get(EscrowService);
  const owner = escrowSvc.getOwnerAddress();
  const source = escrowSvc.getSignerSource();
  if (owner) {
    // eslint-disable-next-line no-console
    console.log(`Escrow signer initialized owner=${owner} source=${source}`);
  }

  const port = process.env.ESCROW_PORT ? Number(process.env.ESCROW_PORT) : 3002;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Escrow microservice listening on port ${port}`);
}

bootstrap();
