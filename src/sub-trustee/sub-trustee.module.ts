import { Module } from '@nestjs/common';
import { SubTrusteeResolver } from './sub-trustee.resolver';
import { SubTrusteeService } from './sub-trustee.service';
import { SubTrusteeGuard } from './sub-trustee.guard';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { SubTrustee, SubTrusteeSchema } from 'src/schema/subTrustee.schema';
import { Trustee, TrusteeSchema } from 'src/schema/trustee.schema';
import { SettlementReport } from 'src/schema/settlement.schema';
import { TrusteeSchool } from 'src/schema/school.schema';
import { RefundRequest, RefundRequestSchema } from 'src/schema/refund.schema';
import { Disputes, DisputesSchema } from 'src/schema/disputes.schema';
import { Vendors, VendorsSchema } from 'src/schema/vendors.schema';
import { TrusteeService } from 'src/trustee/trustee.service';
import { EmailService } from 'src/email/email.service';
import { AwsS3Service } from 'src/aws.s3/aws.s3.service';
import { TrusteeMemberSchema } from 'src/schema/partner.member.schema';
import { TransactionInfo, TransactionInfoSchema } from 'src/schema/transaction.info.schema';
import { RequestMDR, RequestMDRSchema } from 'src/schema/mdr.request.schema';
import { BaseMdr, BaseMdrSchema } from 'src/schema/base.mdr.schema';
import { SchoolMdr, SchoolMdrSchema } from 'src/schema/school_mdr.schema';
import { VendorsSettlement, VendorsSettlementSchema } from 'src/schema/vendor.settlements.schema';
import { Reconciliation, ReconciliationSchema } from 'src/schema/Reconciliation.schema';
import { EmailGroup, EmailGroupSchema } from 'src/schema/email.schema';
import { EmailEvent, EmailEventSchema } from 'src/schema/email.events.schema';
import { BusinessAlarmService } from 'src/business-alarm/business-alarm.service';
import { ErrorLogs, ErrorLogsSchema } from 'src/schema/error.log.schema';
import { ReportsLogs, ReportsLogsSchema } from 'src/schema/reports.logs.schmea';
import { MerchantMember, MerchantMemberSchema } from 'src/schema/merchant.member.schema';
import { VirtualAccount, VirtualAccountSchema } from 'src/schema/virtual.account.schema';


@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SubTrustee.name, schema: SubTrusteeSchema },
    ]),
    MongooseModule.forFeature([
      { name: Trustee.name, schema: TrusteeSchema },
    ]),
    MongooseModule.forFeature([
      { name: SettlementReport.name, schema: SettlementReport },
    ]),
    MongooseModule.forFeature([
      { name: TrusteeSchool.name, schema: TrusteeSchool },
    ]),
    MongooseModule.forFeature([
      { name: SubTrustee.name, schema: SubTrusteeSchema },
    ]),
    MongooseModule.forFeature([
      { name: RefundRequest.name, schema: RefundRequestSchema },
    ]),
    MongooseModule.forFeature([
      { name: Disputes.name, schema: DisputesSchema },
    ]),
     MongooseModule.forFeature([
      { name: Vendors.name, schema: VendorsSchema },
    ]),
    MongooseModule.forFeature([
      { name: 'TrusteeMember', schema: TrusteeMemberSchema },
    ]),
    MongooseModule.forFeature([
      { name: TransactionInfo.name, schema: TransactionInfoSchema },
    ]),
    MongooseModule.forFeature([
      { name: RequestMDR.name, schema: RequestMDRSchema },
    ]),
    MongooseModule.forFeature([{ name: BaseMdr.name, schema: BaseMdrSchema }]),
    MongooseModule.forFeature([
      { name: SchoolMdr.name, schema: SchoolMdrSchema },
    ]),
    MongooseModule.forFeature([
      { name: VendorsSettlement.name, schema: VendorsSettlementSchema },
    ]),
    MongooseModule.forFeature([
      { name: Vendors.name, schema: VendorsSchema },
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
      MongooseModule.forFeature([
      { name: MerchantMember.name, schema: MerchantMemberSchema },
    ]),
      MongooseModule.forFeature([
      { name: VirtualAccount.name, schema: VirtualAccountSchema },
    ]),
    MongooseModule.forFeature([
      { name: VendorsSettlement.name, schema: VendorsSettlementSchema },
    ]),
    JwtModule.registerAsync({
      useFactory: () => ({
        signOptions: { expiresIn: '30d' },
      }),
    }),
  ],
  providers: [
    SubTrusteeService,
    SubTrusteeResolver,
    SubTrusteeGuard,
    TrusteeService,
    EmailService,
    AwsS3Service,
    BusinessAlarmService

  ],
  controllers: [],
})
export class SubTrusteeModule { }