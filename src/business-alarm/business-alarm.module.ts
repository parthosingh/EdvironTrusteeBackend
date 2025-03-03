import { Module } from '@nestjs/common';
import { BusinessAlarmResolver } from './business-alarm.resolver';
import { BusinessAlarmService } from './business-alarm.service';
import { MongooseModule } from '@nestjs/mongoose';
import { TrusteeSchool } from '../schema/school.schema';
import { EmailService } from '../email/email.service';
import { RefundRequest } from '../schema/refund.schema';
import { SettlementReport } from '../schema/settlement.schema';
import { BusinessAlarmController } from './business-alarm.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TrusteeSchool.name, schema: TrusteeSchool },
      { name: RefundRequest.name, schema: RefundRequest },
      { name: SettlementReport.name, schema: SettlementReport },
    ]),
  ],
  providers: [BusinessAlarmResolver, BusinessAlarmService, EmailService],
  controllers: [BusinessAlarmController],
})
export class BusinessAlarmModule {}
