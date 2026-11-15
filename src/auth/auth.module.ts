import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthAdapter } from './adapters/outbound/jwt/jwt-auth.adapter';
import { ResolveViewerGuard } from './adapters/inbound/http/resolve-viewer.guard';
import { AUTH_PORT } from './domain/auth.port';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: Number(config.getOrThrow<string>('JWT_EXPIRES_IN_SECONDS')),
        },
      }),
    }),
  ],
  providers: [
    { provide: AUTH_PORT, useClass: JwtAuthAdapter },
    // Resolves the viewer on every request; routes decide what a viewer may do.
    { provide: APP_GUARD, useClass: ResolveViewerGuard },
  ],
  exports: [AUTH_PORT],
})
export class AuthModule {}
