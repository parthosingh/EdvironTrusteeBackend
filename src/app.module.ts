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
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AwsS3Service } from './aws.s3/aws.s3.service';
import { WebhooksController } from './webhooks/webhooks.controller';
import { WebhooksModule } from './webhooks/webhooks.module';
// import { OnboardingService } from './onboarding/onboarding.service';
// import { OnboardingController } from './onboarding/onboarding.controller';
import { OnboardingResolver } from './onboarding/onboarding.resolver';
import { OnboardingModule } from './onboarding/onboarding.module';
import { BusinessAlarmModule } from './business-alarm/business-alarm.module';
import { PdfServiceModule } from './pdf-service/pdf-service.module';
import { SubTrusteeModule } from './sub-trustee/sub-trustee.module';
config();

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'src/views'), // Adjust the path to your views directory
      exclude: ['/api*'], // Exclude API routes if necessary
    }),
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
    WebhooksModule,
    OnboardingModule,
    BusinessAlarmModule,
    PdfServiceModule,
    SubTrusteeModule,
  ],

  controllers: [AppController],
  providers: [AppService, CashfreeService, AwsS3Service],
})
export class AppModule {}
