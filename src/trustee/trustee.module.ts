import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TrusteeService } from './trustee.service';
import { TrusteeSchema } from '../schema/trustee.schema';
import { JwtModule } from '@nestjs/jwt';
import { TrusteeResolver } from './trustee.resolver';
import { GraphQLModule } from '@nestjs/graphql';
import { SchoolSchema } from '../schema/school.schema';
import { ApolloDriver } from '@nestjs/apollo';
import { TrusteeGuard } from './trustee.guard';
import { config } from 'dotenv';
import { ErpService } from '../erp/erp.service';
import { MainBackendService } from '../main-backend/main-backend.service';
import { SettlementSchema } from '../schema/settlement.schema';
import { TrusteeMemberSchema } from '../schema/partner.member.schema';
import { EmailService } from '../email/email.service';
import { RequestMDR,RequestMDRSchema } from 'src/schema/mdr.request.schema';
import { BaseMdr,BaseMdrSchema } from 'src/schema/base.mdr.schema';
import { SchoolMdr, SchoolMdrSchema } from 'src/schema/school_mdr.schema';
config();

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Trustee', schema: TrusteeSchema }]),
    MongooseModule.forFeature([
      { name: 'TrusteeMember', schema: TrusteeMemberSchema },
    ]),
    MongooseModule.forFeature([
      { name: 'TrusteeSchool', schema: SchoolSchema },
    ]),
    MongooseModule.forFeature([{ name:  RequestMDR.name, schema: RequestMDRSchema }]),
    MongooseModule.forFeature([{ name:  BaseMdr.name, schema: BaseMdrSchema }]),
    MongooseModule.forFeature([
      { name: SchoolMdr.name, schema: SchoolMdrSchema },
    ]),
    JwtModule.registerAsync({
      useFactory: () => ({
        signOptions: { expiresIn: '30d' },
      }),
    }),
    GraphQLModule.forRoot({
      driver: ApolloDriver,
      autoSchemaFile: true, // Generates schema.gql file
      // playground: true, // Enable GraphQL playground in development
      installSubscriptionHandlers: true, // Enable subscriptions if needed
      resolvers: [TrusteeResolver], // Your resolvers here
      playground: process.env.NODE_ENV === 'dev',
    }),
    MongooseModule.forFeature([
      { name: 'SettlementReport', schema: SettlementSchema },
    ]),
  ],
  controllers: [],
  providers: [
    ErpService,
    TrusteeService,
    TrusteeResolver,
    TrusteeGuard,
    MainBackendService,
    EmailService,
  ],
})
export class TrusteeModule {}
