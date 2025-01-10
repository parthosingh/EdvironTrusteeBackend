import { Module } from '@nestjs/common';
import { ErpService } from './erp.service';
import { ErpController } from './erp.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { TrusteeSchema } from '../schema/trustee.schema';
import { SchoolSchema } from '../schema/school.schema';
import { JwtModule } from '@nestjs/jwt';
import { SettlementSchema } from '../schema/settlement.schema';
import { BaseMdr, BaseMdrSchema } from 'src/schema/base.mdr.schema';
import { SchoolMdr, SchoolMdrSchema } from 'src/schema/school_mdr.schema';
import { Commission, CommissionSchema } from 'src/schema/commission.schema';
import { Earnings, EarningsSchema } from 'src/schema/earnings.schema';
import { CashfreeModule } from '../cashfree/cashfree.module';
import { CashfreeService } from '../cashfree/cashfree.service';
import { TrusteeService } from 'src/trustee/trustee.service';
import { TrusteeModule } from 'src/trustee/trustee.module';
import { EmailService } from 'src/email/email.service';
import { AwsS3Service } from 'src/aws.s3/aws.s3.service';
import {
  TrusteeMember,
  TrusteeMemberSchema,
} from 'src/schema/partner.member.schema';
import {
  TransactionInfo,
  TransactionInfoSchema,
} from 'src/schema/transaction.info.schema';
import { RequestMDR, RequestMDRSchema } from 'src/schema/mdr.request.schema';
import { Vendors, VendorsSchema } from 'src/schema/vendors.schema';
import { RefundRequest, RefundRequestSchema } from 'src/schema/refund.schema';
import {
  VendorsSettlement,
  VendorsSettlementSchema,
} from 'src/schema/vendor.settlements.schema';
import { Disputes, DisputesSchema } from 'src/schema/disputes.schema';
import { Capture, CaptureSchema } from 'src/schema/capture.schema';

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
      { name: Earnings.name, schema: EarningsSchema },
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
    MongooseModule.forFeature([
      { name: Capture.name, schema: CaptureSchema },
    ]),
  ],
  providers: [
    ErpService,
    CashfreeService,
    TrusteeService,
    EmailService,
    AwsS3Service,
  ],
  controllers: [ErpController],
})
export class ErpModule {}
