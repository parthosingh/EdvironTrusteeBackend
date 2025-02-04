import { Query, Resolver } from '@nestjs/graphql';
import { BusinessAlarmService } from './business-alarm.service';
import { TrusteeSchool } from 'src/schema/school.schema';
import { Cron } from '@nestjs/schedule';
import { EmailService } from 'src/email/email.service';
import {
  htmlToSend,
  Pg_keyMismatchTemplate,
  refundAmountAndTransactionAmountMismatchTemplate,
} from './templates/htmlToSend.format';

@Resolver()
export class BusinessAlarmResolver {
  constructor(
    private readonly businessServices: BusinessAlarmService,
    private readonly emailService: EmailService,
  ) {}

  @Query(() => [TrusteeSchool])
  async findAllTrusteeDetail(): Promise<TrusteeSchool[]> {
    return await this.businessServices.findAll();
  }

  @Cron('0 0 2 * * *')
  @Query(() => Boolean)
  async findDuplicateTrusteeSchoolDetails() {
    console.log(`Running Duplicate Trustee Details CROn`);
    try {
      const data = await this.businessServices.findDuplicateTrustees();
      if (data.length === 0) {
        console.log(`No Duplicate Trustee`);
      }

      if (data.length > 0) {
        const formatEmail = htmlToSend(data, 'Email Address');
        this.emailService.sendAlert(
          formatEmail,
          'Duplicate Trustee Schools With Same Email',
        );
        return true;
      } else {
        console.log('No duplicate trustees found.');
        return false;
      }
    } catch (e) {
      console.log(e);
      return false;
    }
  }
  @Cron('0 0 2 * * *')
  @Query(() => Boolean)
  async findDuplicateTrusteeSchoolDetailsByClientId() {
    const data = await this.businessServices.findDuplicateTrusteesByCientId();
    if (data.length > 0) {
      const formatEmail = htmlToSend(data, 'Client Ids');
      this.emailService.sendAlert(
        formatEmail,
        'Duplicate Trustee Schools With Same Client Id',
      );
      return true;
    } else {
      console.log('No duplicate trustees found.');
      return false;
    }
  }

  @Cron('0 0 2 * * *')
  @Query(() => Boolean)
  async refundAmountandOrderAmountMismatch() {
    const data =
      await this.businessServices.refundAmountandOrderAmountMismatch();
    if (data.length > 0) {
      const formatEmail =
        refundAmountAndTransactionAmountMismatchTemplate(data);

      this.emailService.sendAlert(
        formatEmail,
        'Alert: Mismatch Found Between Refund and Order Amounts',
      );
      return true;
    } else {
      console.log('No Mismatch Found Between Refund and Order Amounts.');
      return false;
    }
  }

  @Cron('0 0 2 * * *')
  @Query(() => Boolean)
  async findDuplicateTrusteesPGKey() {
    console.log(`Checking Duplicate pg keys`);
    const data = await this.businessServices.findDuplicateTrusteesPgKey()
    
    if (data.length > 0) {
      console.log(`duplicate pg key found`);
      
      const formatEmail = Pg_keyMismatchTemplate(data);

      this.emailService.sendAlert(
        formatEmail,
        'Alert: Mismatch Found PG_KEY',
      );
      return true;
    } else {
      console.log('No Mismatch Found PG_KEY.');
      return false;
    }


  }
}
