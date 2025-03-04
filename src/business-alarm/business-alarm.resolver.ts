import { Field, ObjectType, Query, Resolver } from '@nestjs/graphql';
import { BusinessAlarmService } from './business-alarm.service';
import { TrusteeSchool } from '../schema/school.schema';
import { Cron } from '@nestjs/schedule';
import { EmailService } from '../email/email.service';
import {
  checkMerchantSettlementnot,
  generateSettlementEmail,
  generateSettlementFaildEmail,
  generateZeroSettlementEmail,
  htmlToSend,
  Pg_keyMismatchTemplate,
  refundAmountAndTransactionAmountMismatchTemplate,
} from './templates/htmlToSend.format';
import mongoose from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import axios from 'axios';

@Resolver()
export class BusinessAlarmResolver {
  constructor(
    private readonly businessServices: BusinessAlarmService,
    private readonly emailService: EmailService,
    @InjectModel(TrusteeSchool.name)
    private readonly trusteeSchool: mongoose.Model<TrusteeSchool>,
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
    const data = await this.businessServices.findDuplicateTrusteesPgKey();

    if (data.length > 0) {
      console.log(`duplicate pg key found`);

      const formatEmail = Pg_keyMismatchTemplate(data);

      this.emailService.sendAlert(formatEmail, 'Alert: Mismatch Found PG_KEY');
      return true;
    } else {
      console.log('No Mismatch Found PG_KEY.');
      return false;
    }
  }

  @Cron('0 0 2 * * *')
  @Query(() => Boolean)
  async checkOrderAmount() {
    const missMatched = await this.businessServices.reconOrderAmount();
    console.log(missMatched, 'missmatched');

    return true;
  }


  @Cron('0 11 * * *', { timeZone: 'UTC' })
  @Query(() => [MerchantSettlement])
  async checkMerchantSettlement(): Promise<MerchantSettlement[]> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    // console.log(today)
    const at5pm = new Date();
    at5pm.setUTCHours(17, 59, 59, 999);
    // console.log(at5pm)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const formattedDate = yesterday.toISOString().split('T')[0];

    const schools = await this.trusteeSchool.aggregate([
      {
        $match: {
          pg_key: { $ne: null },
        },
      },
    ]);

    let allSchoolaftercontext: any[] = [];

    const requests = schools.map(async (school) => {
      const config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/get-transaction-report-batched`,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        data: {
          trustee_id: school.trustee_id.toString(),
          school_id: school.school_id.toString(),
          start_date: formattedDate,
          end_date: formattedDate,
        },
      };

      try {
        const response = await axios.request(config);

        if (response.data && response.data.length > 0) {
          allSchoolaftercontext.push(school);
        }
      } catch (error) {
        console.error(
          `Error fetching data for school ${school.school_name}:`,
          error.message,
        );
      }
    });

    await Promise.all(requests);

    console.time('check time after');
    const missMatched = await this.businessServices.checkMerchantSettlement(
      today,
      at5pm,
      allSchoolaftercontext,
    );

    const formatEmail = checkMerchantSettlementnot(missMatched);

    this.emailService.sendAlert(
      formatEmail,
      'Today These School Not Setteled Any Amount Yet',
    );

    return missMatched;
  }

  @Cron('0 13,17 * * *', { timeZone: 'UTC' })
  @Query(() => Boolean)
  async checkFailedMerchantSettlement() {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    console.log(today);
    const atTime = new Date();
    console.log(atTime);
    const todaySettlement =
      await this.businessServices.checkErrorMerchantSettlement(today, atTime);
    if (todaySettlement && todaySettlement.length > 0) {
      const subject = 'Daily Merchant Settlement Not Succeeded List';
      const template = generateSettlementFaildEmail(
        todaySettlement,
        "Merchant's Settlement Not Succeeded",
        'This report provides an overview of the vendors settlements not processed today.',
        'error',
      );
      this.emailService.sendErrorMail(subject, template);
      return true;
    }
    console.log('No settlements failed over the day upto 5pm');
    return false;
  }

  // Runs at 5 PM IST (which is 11:30 AM UTC, rounded down to 11 AM UTC)
  @Cron('0 11 * * *', { timeZone: 'UTC' })
  @Query(() => Boolean)
  async checkSavedVendorSettlement() {
    const todaySettlement =
      await this.businessServices.checkSchoolsHaveNoSettlementToday();
    if (todaySettlement && todaySettlement.length > 0) {
      const subject = 'List of Vendors with No Settlements Processed Today';
      const template = generateZeroSettlementEmail(
        todaySettlement,
        'List of Vendors with No Settlements Processed Today',
        'This report provides an overview of the vendors settlements not processed today.',
        'error',
      );
      this.emailService.sendErrorMail(subject, template);
      return true;
    }
    console.log('No vendors found with no settlements over the day upto 5pm');
    return false;
  }

  @Cron('0 13,17 * * *', { timeZone: 'UTC' })
  @Query(() => Boolean)
  async checkFailedVendorSettlement() {
    const todaySettlement =
      await this.businessServices.checkTodayVendorSettlement([
        'SUCCESS',
        'Settled',
      ]);
    if (todaySettlement && todaySettlement.length > 0) {
      const subject = 'Daily Vendor Settlement Not Succeeded List';
      const template = generateSettlementEmail(
        todaySettlement,
        "Vendor's Settlement Not Succeeded",
        'This report provides an overview of the vendors settlements not processed today.',
        'error',
      );
      this.emailService.sendErrorMail(subject, template);
      return true;
    }
    console.log('No settlements failed over the day upto 5pm');
    return false;
  }
}

@ObjectType()
class MerchantSettlement {
  @Field()
  school_name: string;

  @Field()
  school_id: string;

  @Field({ nullable: true })
  email: string;

  @Field({ nullable: true })
  phone_number: string;
}
