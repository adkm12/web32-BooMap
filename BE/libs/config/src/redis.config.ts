import { RedisModuleOptions } from '@liaoliaots/nestjs-redis';
import { ConfigService } from '@nestjs/config';

export const getRedisConfig = (...args: unknown[]): RedisModuleOptions => {
  const configService = args[0] as ConfigService;
  return {
    config: [
      {
        namespace: 'subscriber',
        host: configService.get<string>('REDIS_HOST'),
        port: configService.get<number>('REDIS_PORT'),
      },
      {
        namespace: 'publisher',
        host: configService.get<string>('REDIS_HOST'),
        port: configService.get<number>('REDIS_PORT'),
      },
      {
        namespace: 'general',
        host: configService.get<string>('REDIS_HOST'),
        port: configService.get<number>('REDIS_PORT'),
      },
    ],
  };
};
