import { Module } from '@nestjs/common';
import { BusinessAlarmResolver } from './business-alarm.resolver';
import { BusinessAlarmService } from './business-alarm.service';
import { MongooseModule } from '@nestjs/mongoose';
import { TrusteeSchool } from 'src/schema/school.schema';
import { EmailService } from 'src/email/email.service';
import { RefundRequest } from 'src/schema/refund.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TrusteeSchool.name, schema: TrusteeSchool },
      { name: RefundRequest.name, schema: RefundRequest },
    ]),
  ],
  providers: [BusinessAlarmResolver, BusinessAlarmService, EmailService],
})
export class BusinessAlarmModule {}
