import { Module } from '@nestjs/common';
import { MainBackendService } from './main-backend.service';
import { MainBackendController } from './main-backend.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { TrusteeSchema } from '../schema/trustee.schema';
import { SchoolSchema } from '../schema/school.schema';
import { TrusteeService } from '../trustee/trustee.service';
import { TrusteeMemberSchema } from '../schema/partner.member.schema';
import { EmailService } from '../email/email.service';
import { TransactionInfoSchema } from '../schema/transaction.info.schema';
import { RequestMDR, RequestMDRSchema } from '../schema/mdr.request.schema';
import { BaseMdr, BaseMdrSchema } from '../schema/base.mdr.schema';
import { SchoolMdr, SchoolMdrSchema } from '../schema/school_mdr.schema';
import { RefundRequest, RefundRequestSchema } from '../schema/refund.schema';
import { Invoice, InvoiceSchema } from '../schema/invoice.schema';
import { Vendors, VendorsSchema } from '../schema/vendors.schema';
import { AwsS3Service } from '../aws.s3/aws.s3.service';
import {
  SettlementReport,
  SettlementSchema,
} from '../schema/settlement.schema';
import {
  VendorsSettlement,
  VendorsSettlementSchema,
} from '../schema/vendor.settlements.schema';
import { Disputes, DisputesSchema } from '../schema/disputes.schema';
import {
  Reconciliation,
  ReconciliationSchema,
} from '../schema/Reconciliation.schema';
import { EmailGroup, EmailGroupSchema } from 'src/schema/email.schema';
import { EmailEvent, EmailEventSchema } from 'src/schema/email.events.schema';
import { BusinessAlarmService } from 'src/business-alarm/business-alarm.service';
import { ErrorLogs, ErrorLogsSchema } from 'src/schema/error.log.schema';
import { ReportsLogs, ReportsLogsSchema } from 'src/schema/reports.logs.schmea';

@Module({
  imports: [
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
      { name: RefundRequest.name, schema: RefundRequestSchema },
    ]),
    MongooseModule.forFeature([{ name: Invoice.name, schema: InvoiceSchema }]),
    MongooseModule.forFeature([{ name: Vendors.name, schema: VendorsSchema }]),
    MongooseModule.forFeature([
      { name: SettlementReport.name, schema: SettlementSchema },
    ]),
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
      { name: EmailGroup.name, schema: EmailGroupSchema },
    ]),
    MongooseModule.forFeature([
      { name: EmailEvent.name, schema: EmailEventSchema },
    ]),
    MongooseModule.forFeature([
      { name: ErrorLogs.name, schema: ErrorLogsSchema },
    ]),
    MongooseModule.forFeature([
          { name: ReportsLogs.name, schema: ReportsLogsSchema },
        ]),
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET_FOR_INTRANET,
        signOptions: { expiresIn: '1h' },
      }),
    }),
  ],
  providers: [
    MainBackendService,
    TrusteeService,
    EmailService,
    AwsS3Service,
    BusinessAlarmService,
  ],
  controllers: [MainBackendController],
})
export class MainBackendModule {}
