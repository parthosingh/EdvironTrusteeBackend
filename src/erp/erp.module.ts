import { Module } from '@nestjs/common';
import { ErpService } from './erp.service';
import { ErpController } from './erp.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { TrusteeSchema } from '../schema/trustee.schema';
import { SchoolSchema } from '../schema/school.schema';
import { JwtModule } from '@nestjs/jwt';
import { SettlementSchema } from '../schema/settlement.schema';
import { BaseMdr, BaseMdrSchema } from '../schema/base.mdr.schema';
import { SchoolMdr, SchoolMdrSchema } from '../schema/school_mdr.schema';
import { Commission, CommissionSchema } from '../schema/commission.schema';
import { CommissionEarning, CommissionEarningSchema,
 } from '../schema/earnings.schema';
import { CashfreeModule } from '../cashfree/cashfree.module';
import { CashfreeService } from '../cashfree/cashfree.service';
import { TrusteeService } from '../trustee/trustee.service';
import { TrusteeModule } from '../trustee/trustee.module';
import { EmailService } from '../email/email.service';
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
import { Vendors, VendorsSchema } from '../schema/vendors.schema';
import { RefundRequest, RefundRequestSchema } from '../schema/refund.schema';
import {
  VendorsSettlement,
  VendorsSettlementSchema,
} from '../schema/vendor.settlements.schema';
import { Disputes, DisputesSchema } from '../schema/disputes.schema';
import { Capture, CaptureSchema } from '../schema/capture.schema';
import {
  Reconciliation,
  ReconciliationSchema,
} from '../schema/Reconciliation.schema';
import { WebhookLogs, WebhookLogsSchema } from '../schema/webhook.schema';
import { PosMachine, PosMachineSchema } from 'src/schema/pos.machine.schema';
import {
  VirtualAccount,
  VirtualAccountSchema,
} from 'src/schema/virtual.account.schema';
import { EmailGroup, EmailGroupSchema } from 'src/schema/email.schema';
import { EmailEvent, EmailEventSchema } from 'src/schema/email.events.schema';
import { BusinessAlarmService } from 'src/business-alarm/business-alarm.service';
import { ErrorLogs, ErrorLogsSchema } from 'src/schema/error.log.schema';
import { ReportsLogs, ReportsLogsSchema } from 'src/schema/reports.logs.schmea';
import { SubTrustee, SubTrusteeSchema } from 'src/schema/subTrustee.schema';
import { MerchantMember, MerchantMemberSchema } from 'src/schema/merchant.member.schema';
import { SchoolBaseMdr, SchoolBaseMdrSchema } from 'src/schema/school.base.mdr.schema';
import { DatabaseService } from 'src/database/database.service';
import { StudentDetail, StudentDetailSchema } from 'src/schema/student.schema';
import { TempSettlementReport, TempSettlementReportSchema } from 'src/schema/tempSettlements.schema';
import { GatewayRates, GatewayRatesSchema } from 'src/schema/gateways.rate.schema';
import { CommissionService } from 'src/commission/commission.service';

@Module({
  imports: [
    CashfreeModule,
    // TrusteeModule,
    MongooseModule.forFeature([{ name: 'Trustee', schema: TrusteeSchema }]),
    MongooseModule.forFeature([
      { name: 'TrusteeSchool', schema: SchoolSchema },
    ]),
    MongooseModule.forFeature([
      { name: Commission.name, schema: CommissionSchema },
    ]),
    MongooseModule.forFeature([
      { name: CommissionEarning.name, schema: CommissionEarningSchema },
    ]),
    MongooseModule.forFeature([{ name: BaseMdr.name, schema: BaseMdrSchema }]),
    MongooseModule.forFeature([
      { name: TrusteeMember.name, schema: TrusteeMemberSchema },
    ]),
    MongooseModule.forFeature([
      { name: TransactionInfo.name, schema: TransactionInfoSchema },
    ]),
    MongooseModule.forFeature([
      { name: RequestMDR.name, schema: RequestMDRSchema },
    ]),
    MongooseModule.forFeature([{ name: Vendors.name, schema: VendorsSchema }]),
    MongooseModule.forFeature([
      { name: VendorsSettlement.name, schema: VendorsSettlementSchema },
    ]),
    MongooseModule.forFeature([
      { name: Reconciliation.name, schema: ReconciliationSchema },
    ]),
    MongooseModule.forFeature([
      { name: PosMachine.name, schema: PosMachineSchema },
    ]),
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET_FOR_API_KEY,
        signOptions: { expiresIn: '2h' },
      }),
    }),
    MongooseModule.forFeature([
      { name: 'SettlementReport', schema: SettlementSchema },
    ]),
    MongooseModule.forFeature([{ name: BaseMdr.name, schema: BaseMdrSchema }]),
    MongooseModule.forFeature([
      { name: SchoolMdr.name, schema: SchoolMdrSchema },
    ]),
    MongooseModule.forFeature([
      { name: RefundRequest.name, schema: RefundRequestSchema },
    ]),
    MongooseModule.forFeature([
      { name: Disputes.name, schema: DisputesSchema },
    ]),
    MongooseModule.forFeature([{ name: Capture.name, schema: CaptureSchema }]),
    MongooseModule.forFeature([
      { name: WebhookLogs.name, schema: WebhookLogsSchema },
    ]),

    MongooseModule.forFeature([
      { name: WebhookLogs.name, schema: WebhookLogsSchema },
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
      { name: ErrorLogs.name, schema: ErrorLogsSchema },
    ]),
    MongooseModule.forFeature([
      { name: ReportsLogs.name, schema: ReportsLogsSchema },
    ]),
    MongooseModule.forFeature([
      { name: MerchantMember.name, schema: MerchantMemberSchema },
    ]),
    MongooseModule.forFeature([
      { name: SubTrustee.name, schema: SubTrusteeSchema },
    ]),
    MongooseModule.forFeature([
      { name: SchoolBaseMdr.name, schema: SchoolBaseMdrSchema },
    ]),
    MongooseModule.forFeature([
      { name: StudentDetail.name, schema: StudentDetailSchema },
    ]),
    MongooseModule.forFeature([
      { name: TempSettlementReport.name, schema: TempSettlementReportSchema },
       { name: GatewayRates.name, schema: GatewayRatesSchema },
    ]),
  ],
  providers: [
    ErpService,
    CashfreeService,
    TrusteeService,
    EmailService,
    AwsS3Service,
    BusinessAlarmService,
    DatabaseService,
    CommissionService
  ],
  controllers: [ErpController],
})
export class ErpModule { }
