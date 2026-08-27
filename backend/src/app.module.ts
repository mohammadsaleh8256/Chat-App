import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as path from 'path';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ConversationsModule } from './conversations/conversations.module';
import { MessagesModule } from './messages/messages.module';
import { FilesModule } from './files/files.module';
import { AdminModule } from './admin/admin.module';
import { ChatGatewayModule } from './common/gateway/chat-gateway.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [path.join(__dirname, '..', '.env'), '.env'],
    }),
    ThrottlerModule.forRoot([
      // 1000 req per 10s per IP — high enough for chat polling + socket reconnects,
      // but still blocks brute-force / abuse. Tune via env if needed.
      { ttl: 10_000, limit: 1000 },
    ]),
    PrismaModule,
    AuthModule,
    UsersModule,
    ConversationsModule,
    MessagesModule,
    FilesModule,
    AdminModule,
    ChatGatewayModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
