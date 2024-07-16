import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { config } from 'dotenv';
import { TrusteeModule } from './trustee/trustee.module';
import { ErpModule } from './erp/erp.module';
import { MainBackendModule } from './main-backend/main-backend.module';
import { PlatformChargesModule } from './platform-charges/platform-charges.module';
import { ScheduleModule } from '@nestjs/schedule';
import { MerchantModule } from './merchant/merchant.module';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver } from '@nestjs/apollo';
import { TrusteeResolver } from './trustee/trustee.resolver';
import { MerchantResolver } from './merchant/merchant.resolver';
import { CashfreeService } from './cashfree/cashfree.service';
import { CashfreeModule } from './cashfree/cashfree.module';
config();

@Module({
  imports: [
    MongooseModule.forRoot(process.env.DB),
    TrusteeModule,
    ErpModule,
    MainBackendModule,
    PlatformChargesModule,
    MerchantModule,
    ScheduleModule.forRoot(),
    GraphQLModule.forRoot({
      driver: ApolloDriver,
      autoSchemaFile: true, // Generates schema.gql file
      // playground: true, // Enable GraphQL playground in development
      installSubscriptionHandlers: true, // Enable subscriptions if needed
      resolvers: [TrusteeResolver, MerchantResolver], // Your resolvers here
      playground: process.env.NODE_ENV === 'dev',
    }),
    CashfreeModule,
  ],

  controllers: [AppController],
  providers: [AppService, CashfreeService],
})
export class AppModule {}
