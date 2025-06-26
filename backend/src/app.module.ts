import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from './config/env.validation';
import { GraphQLModule } from '@nestjs/graphql';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { ProjectModule } from './project/project.module';
import { TokenModule } from './token/token.module';
import { UserModule } from './user/user.module';
import { InitModule } from './init/init.module';
import { User } from './user/user.model';
import { AppResolver } from './app.resolver';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LoggingInterceptor } from 'src/interceptor/LoggingInterceptor';
import { PromptToolModule } from './prompt-tool/prompt-tool.module';
import { MailModule } from './mail/mail.module';
import { GitHubModule } from './github/github.module';
import { AppConfigService } from './config/config.service';
import { getDatabaseConfig } from './database.config';
import { DashboardModule } from './dashboard/dashboard.module';
import { InterceptorModule } from './interceptor/interceptor.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config: Record<string, unknown>) => {
        return Object.assign(new EnvironmentVariables(), config);
      },
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), '../frontend/src/graphql/schema.gql'),
      sortSchema: true,
      playground: true,
      subscriptions: {
        'graphql-ws': true,
        'subscriptions-transport-ws': true,
      },
      context: ({ req, res }) => ({ req, res }),
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService<EnvironmentVariables>) =>
        getDatabaseConfig(new AppConfigService(config)),
      inject: [ConfigService],
    }),
    InitModule,
    UserModule,
    AuthModule,
    ProjectModule,
    TokenModule,
    ChatModule,
    PromptToolModule,
    MailModule,
    TypeOrmModule.forFeature([User]),
    GitHubModule,
    DashboardModule,
    InterceptorModule,
  ],
  providers: [
    AppResolver,
    AppConfigService,
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
  exports: [AppConfigService],
})
export class AppModule {}
