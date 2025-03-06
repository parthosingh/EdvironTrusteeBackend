import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WebhookLogs, WebhookLogsSchema } from '../schema/webhook.schema';
import { WebhooksController } from './webhooks.controller';
import { RefundRequest, RefundRequestSchema } from '../schema/refund.schema';
import {
  VendorsSettlement,
  VendorsSettlementSchema,
} from '../schema/vendor.settlements.schema';
import { Vendors, VendorsSchema } from '../schema/vendors.schema';
import { SchoolSchema, TrusteeSchool } from '../schema/school.schema';
import { Trustee, TrusteeSchema } from '../schema/trustee.schema';
import { Disputes, DisputesSchema } from '../schema/disputes.schema';
import {
  TempSettlementReport,
  TempSettlementReportSchema,
} from '../schema/tempSettlements.schema';
import {
  SettlementReport,
  SettlementSchema,
} from '../schema/settlement.schema';
import { EmailService } from '../email/email.service';
import { TrusteeService } from '../trustee/trustee.service';
import { JwtService } from '@nestjs/jwt';
import { AwsS3Service } from '../aws.s3/aws.s3.service';
import {
  TrusteeMember,
  TrusteeMemberSchema,
} from '../schema/partner.member.schema';
import {
  TransactionInfo,
  TransactionInfoSchema,
} from '../schema/transaction.info.schema';
import { RequestMDR, RequestMDRSchema } from '../schema/mdr.request.schema';
import { BaseMdr, BaseMdrSchema } from '../schema/base.mdr.schema';
import { SchoolMdr } from '../schema/school_mdr.schema';
import { TrusteeModule } from '../trustee/trustee.module';
import {
  Reconciliation,
  ReconciliationSchema,
} from '../schema/Reconciliation.schema';
import { PdfService } from '../pdf-service/pdf-service.service';

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
    MongooseModule.forFeature([{ name: BaseMdr.name, schema: BaseMdrSchema }]),
    MongooseModule.forFeature([{ name: SchoolMdr.name, schema: SchoolSchema }]),
    MongooseModule.forFeature([
      { name: Reconciliation.name, schema: ReconciliationSchema },
    ]),
  ],
  controllers: [WebhooksController],
  providers: [
    EmailService,
    TrusteeService,
    JwtService,
    AwsS3Service,
    PdfService,
  ],
})
export class WebhooksModule {}
