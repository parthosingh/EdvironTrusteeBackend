import { Module } from '@nestjs/common';
import { BusinessAlarmResolver } from './business-alarm.resolver';
import { BusinessAlarmService } from './business-alarm.service';
import { MongooseModule } from '@nestjs/mongoose';
import { TrusteeSchool } from '../schema/school.schema';
import { EmailService } from '../email/email.service';
import { RefundRequest } from '../schema/refund.schema';
import { SettlementReport } from '../schema/settlement.schema';
import { BusinessAlarmController } from './business-alarm.controller';
import {
  VendorsSettlement,
  VendorsSettlementSchema,
} from '../schema/vendor.settlements.schema';
import { Vendors, VendorsSchema } from '../schema/vendors.schema';
import { EmailGroup, EmailGroupSchema } from 'src/schema/email.schema';
import { EmailEvent, EmailEventSchema } from 'src/schema/email.events.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TrusteeSchool.name, schema: TrusteeSchool },
      { name: RefundRequest.name, schema: RefundRequest },
      { name: SettlementReport.name, schema: SettlementReport },
      { name: VendorsSettlement.name, schema: VendorsSettlementSchema },
      { name: Vendors.name, schema: VendorsSchema },
    ]),
     MongooseModule.forFeature([{ name: EmailGroup.name, schema: EmailGroupSchema }]),
        MongooseModule.forFeature([{ name: EmailEvent.name, schema: EmailEventSchema }]),
  ],
  providers: [BusinessAlarmResolver, BusinessAlarmService, EmailService],
  controllers: [BusinessAlarmController],
})
export class BusinessAlarmModule {}
