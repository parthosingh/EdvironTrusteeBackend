import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WebhookLogs, WebhookLogsSchema } from 'src/schema/webhook.schema';
import { WebhooksController } from './webhooks.controller';
import { RefundRequest, RefundRequestSchema } from 'src/schema/refund.schema';
import {
  VendorsSettlement,
  VendorsSettlementSchema,
} from 'src/schema/vendor.settlements.schema';
import { Vendors, VendorsSchema } from 'src/schema/vendors.schema';
import { SchoolSchema, TrusteeSchool } from 'src/schema/school.schema';
import { Trustee, TrusteeSchema } from 'src/schema/trustee.schema';
import { Disputes, DisputesSchema } from 'src/schema/disputes.schema';
import {
  TempSettlementReport,
  TempSettlementReportSchema,
} from 'src/schema/tempSettlements.schema';
import {
  SettlementReport,
  SettlementSchema,
} from 'src/schema/settlement.schema';
import { EmailService } from 'src/email/email.service';
import { TrusteeService } from 'src/trustee/trustee.service';
import { JwtService } from '@nestjs/jwt';
import { AwsS3Service } from 'src/aws.s3/aws.s3.service';
import { TrusteeMember, TrusteeMemberSchema } from 'src/schema/partner.member.schema';
import { TransactionInfo, TransactionInfoSchema } from 'src/schema/transaction.info.schema';
import { RequestMDR, RequestMDRSchema } from 'src/schema/mdr.request.schema';
import { BaseMdr, BaseMdrSchema } from 'src/schema/base.mdr.schema';
import { SchoolMdr } from 'src/schema/school_mdr.schema';
import { TrusteeModule } from 'src/trustee/trustee.module';
import { Reconciliation, ReconciliationSchema } from 'src/schema/Reconciliation.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WebhookLogs.name, schema: WebhookLogsSchema },
    ]),
    MongooseModule.forFeature([
      { name: RefundRequest.name, schema: RefundRequestSchema },
    ]),
    MongooseModule.forFeature([{ name: Vendors.name, schema: VendorsSchema }]),
    MongooseModule.forFeature([
      { name: TrusteeSchool.name, schema: SchoolSchema },
    ]),

    MongooseModule.forFeature([
      { name: VendorsSettlement.name, schema: VendorsSettlementSchema },
    ]),

    MongooseModule.forFeature([{ name: Trustee.name, schema: TrusteeSchema }]),
    MongooseModule.forFeature([
      { name: Disputes.name, schema: DisputesSchema },
    ]),

    MongooseModule.forFeature([
      { name: TempSettlementReport.name, schema: TempSettlementReportSchema },
    ]),
    MongooseModule.forFeature([
      { name: SettlementReport.name, schema: SettlementSchema },
    ]),
    MongooseModule.forFeature([
      { name: TrusteeMember.name, schema: TrusteeMemberSchema },
    ]),
     MongooseModule.forFeature([
      { name: TransactionInfo.name, schema: TransactionInfoSchema },
    ]),
    MongooseModule.forFeature([
      { name: RequestMDR.name, schema: RequestMDRSchema },
    ]),
    MongooseModule.forFeature([
      { name: BaseMdr.name, schema: BaseMdrSchema },
    ]),
    MongooseModule.forFeature([
      { name: SchoolMdr.name, schema: SchoolSchema },
    ]),
    MongooseModule.forFeature([
      { name: Reconciliation.name, schema: ReconciliationSchema },
    ])
  ],
  controllers: [WebhooksController],
  providers: [EmailService,TrusteeService,JwtService,AwsS3Service,],
})
export class WebhooksModule {}
