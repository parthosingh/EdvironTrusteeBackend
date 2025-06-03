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
import { TransactionInfoSchema } from '../schema/transaction.info.schema';
import { RequestMDR, RequestMDRSchema } from '../schema/mdr.request.schema';
import { BaseMdr, BaseMdrSchema } from '../schema/base.mdr.schema';
import { SchoolMdr, SchoolMdrSchema } from '../schema/school_mdr.schema';
import { Commission, CommissionSchema } from '../schema/commission.schema';
import {
  MerchantMember,
  MerchantMemberSchema,
} from '../schema/merchant.member.schema';
import { CashfreeService } from '../cashfree/cashfree.service';
import { CashfreeModule } from '../cashfree/cashfree.module';
import { Invoice, InvoiceSchema } from '../schema/invoice.schema';
import { MerchantService } from '../merchant/merchant.service';
import { MerchantModule } from '../merchant/merchant.module';

import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AwsS3Service } from '../aws.s3/aws.s3.service';
import { RefundRequest, RefundRequestSchema } from '../schema/refund.schema';
import { Vendors, VendorsSchema } from '../schema/vendors.schema';
import {
  VendorsSettlement,
  VendorsSettlementSchema,
} from '../schema/vendor.settlements.schema';
import { Disputes, DisputesSchema } from '../schema/disputes.schema';
import {
  Reconciliation,
  ReconciliationSchema,
} from '../schema/Reconciliation.schema';
import {
  TempSettlementReport,
  TempSettlementReportSchema,
} from '../schema/tempSettlements.schema';
import { PdfService } from '../pdf-service/pdf-service.service';
import { VirtualAccount, VirtualAccountSchema } from 'src/schema/virtual.account.schema';
import { EmailGroup, EmailGroupSchema } from 'src/schema/email.schema';
import { EmailEvent, EmailEventSchema } from 'src/schema/email.events.schema';
import { PosMachine, PosMachineSchema } from 'src/schema/pos.machine.schema';
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
    MongooseModule.forFeature([
      { name: TempSettlementReport.name, schema: TempSettlementReportSchema },
    ]),

    MongooseModule.forFeature([
      { name: VirtualAccount.name, schema: VirtualAccountSchema },
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
    MongooseModule.forFeature([
      { name: VirtualAccount.name, schema: VirtualAccountSchema },
    ]),
    MongooseModule.forFeature([
      { name: EmailGroup.name, schema: EmailGroupSchema },
    ]),
    MongooseModule.forFeature([
      { name: EmailEvent.name, schema: EmailEventSchema },
    ]),
    MongooseModule.forFeature([
      { name: PosMachine.name, schema: PosMachineSchema },
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
    PdfService,
  ],
})
export class TrusteeModule { }
