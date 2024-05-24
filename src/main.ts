import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
 const app = await NestFactory.create(AppModule);
 app.enableCors(); // This enables CORS for all origins

 const config = new DocumentBuilder()
    .setTitle('Lucid Backend API')
    .setDescription('The Lucid Backend API description')
    .setVersion('1.0')
    .addTag('lucid')
    .build();
 const document = SwaggerModule.createDocument(app, config);
 SwaggerModule.setup('api', app, document);

 await app.listen(3000);
}
bootstrap();
