import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { EscrowAppModule } from './escrow.app.module';

async function bootstrap() {
  const app = await NestFactory.create(EscrowAppModule);
  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle('Escrow API')
    .setDescription('Escrow microservice API')
    .setVersion('1.0')
    .addTag('escrow')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.ESCROW_PORT ? Number(process.env.ESCROW_PORT) : 3002;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Escrow microservice listening on port ${port}`);
}

bootstrap();
