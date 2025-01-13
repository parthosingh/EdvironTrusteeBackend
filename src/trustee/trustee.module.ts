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
import { TransactionInfoSchema } from 'src/schema/transaction.info.schema';
import { RequestMDR, RequestMDRSchema } from 'src/schema/mdr.request.schema';
import { BaseMdr, BaseMdrSchema } from 'src/schema/base.mdr.schema';
import { SchoolMdr, SchoolMdrSchema } from 'src/schema/school_mdr.schema';
import { Commission, CommissionSchema } from 'src/schema/commission.schema';
import {
  MerchantMember,
  MerchantMemberSchema,
} from 'src/schema/merchant.member.schema';
import { CashfreeService } from '../cashfree/cashfree.service';
import { CashfreeModule } from '../cashfree/cashfree.module';
import { Invoice, InvoiceSchema } from 'src/schema/invoice.schema';
import { MerchantService } from 'src/merchant/merchant.service';
import { MerchantModule } from 'src/merchant/merchant.module';

import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AwsS3Service } from 'src/aws.s3/aws.s3.service';
import { RefundRequest, RefundRequestSchema } from 'src/schema/refund.schema';
import { Vendors, VendorsSchema } from 'src/schema/vendors.schema';
import {
  VendorsSettlement,
  VendorsSettlementSchema,
} from 'src/schema/vendor.settlements.schema';
import { Disputes, DisputesSchema } from 'src/schema/disputes.schema';
import { Reconciliation, ReconciliationSchema } from 'src/schema/Reconciliation.schema';
config();

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'src/views'), // Adjust the path to your views directory
      exclude: ['/api*'], // Exclude API routes if necessary
    }),
    CashfreeModule,
    MerchantModule,
    MongooseModule.forFeature([
      { name: MerchantMember.name, schema: MerchantMemberSchema },
    ]),
    MongooseModule.forFeature([{ name: 'Trustee', schema: TrusteeSchema }]),
    MongooseModule.forFeature([
      { name: 'TrusteeMember', schema: TrusteeMemberSchema },
    ]),
    MongooseModule.forFeature([
      { name: 'TrusteeSchool', schema: SchoolSchema },
    ]),
    MongooseModule.forFeature([
      { name: 'TransactionInfo', schema: TransactionInfoSchema },
      { name: RequestMDR.name, schema: RequestMDRSchema },
    ]),
    MongooseModule.forFeature([{ name: BaseMdr.name, schema: BaseMdrSchema }]),
    MongooseModule.forFeature([
      { name: SchoolMdr.name, schema: SchoolMdrSchema },
    ]),
    MongooseModule.forFeature([
      { name: Commission.name, schema: CommissionSchema },
    ]),
    MongooseModule.forFeature([{ name: Invoice.name, schema: InvoiceSchema }]),
    MongooseModule.forFeature([
      { name: RefundRequest.name, schema: RefundRequestSchema },
    ]),
    MongooseModule.forFeature([
      { name: VendorsSettlement.name, schema: VendorsSettlementSchema },
    ]),
    MongooseModule.forFeature([{ name: Vendors.name, schema: VendorsSchema }]),
    MongooseModule.forFeature([
      { name: VendorsSettlement.name, schema: VendorsSettlementSchema },
    ]),
    MongooseModule.forFeature([
      { name: Disputes.name, schema: DisputesSchema },
    ]),
    MongooseModule.forFeature([
      { name: Reconciliation.name, schema: ReconciliationSchema },
    ]),
    JwtModule.registerAsync({
      useFactory: () => ({
        signOptions: { expiresIn: '30d' },
      }),
    }),
    // GraphQLModule.forRoot({
    //   driver: ApolloDriver,
    //   autoSchemaFile: true, // Generates schema.gql file
    //   // playground: true, // Enable GraphQL playground in development
    //   installSubscriptionHandlers: true, // Enable subscriptions if needed
    //   resolvers: [TrusteeResolver], // Your resolvers here
    //   playground: process.env.NODE_ENV === 'dev',
    // }),
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
    AwsS3Service,
  ],
})
export class TrusteeModule {}
