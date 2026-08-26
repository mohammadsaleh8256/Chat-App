import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ChatGateway } from './chat.gateway';
import { PresenceService } from './presence.service';
import { ChatEvents } from '../events/chat-events';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  providers: [ChatGateway, PresenceService, ChatEvents],
  exports: [PresenceService, JwtModule, ChatEvents],
})
export class ChatGatewayModule {}
