import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { RedemptionCode } from '../inventory/entities/redemption-code.entity';
import { CollectionMetadata } from '../inventory/entities/collection-metadata.entity';

export const getDatabaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: configService.get('DB_HOST'),
  port: configService.get('DB_PORT'),
  username: configService.get('DB_USERNAME'),
  password: configService.get('DB_PASSWORD'),
  database: configService.get('DB_NAME'),
  entities: [RedemptionCode, CollectionMetadata],
  synchronize: true, // Always true for now, change to configService.get('NODE_ENV') !== 'production' later
  migrationsRun: true,
  logging: ['error', 'warn', 'schema'],
  autoLoadEntities: true,
  retryAttempts: 3,
  retryDelay: 3000,
  ssl:
    configService.get('NODE_ENV') === 'production'
      ? { rejectUnauthorized: false }
      : false,
});
