import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Post,
  Res,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import axios from 'axios';
import { BusinessAlarmService } from './business-alarm.service';
import { EmailService } from '../email/email.service';
import { TrusteeSchool } from '../schema/school.schema';
import mongoose, { Types } from 'mongoose';
import {
  checkMerchantSettlementnot,
  generateTransactionMailReciept,
} from './templates/htmlToSend.format';
import { EmailEvent } from 'src/schema/email.events.schema';
import { Events } from 'aws-sdk/clients/cognitosync';

@Controller('business-alarm')
export class BusinessAlarmController {
  constructor(
    private readonly businessServices: BusinessAlarmService,
    private readonly emailService: EmailService,
    @InjectModel(TrusteeSchool.name)
    private readonly trusteeSchool: mongoose.Model<TrusteeSchool>,
    @InjectModel(EmailEvent.name)
    private EmailEventModel: mongoose.Model<EmailEvent>,
  ) {}

  @Post('fivepm')
  async checkMerchantSettlement() {
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
    console.time('check time before');
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

    console.timeEnd('check time before');

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

  @Post('send-mail-after-transaction')
  async sendMailAfterTransaction(@Body() body: any, @Res() res: any) {
    const {
      amount,
      gateway,
      additional_data,
      school_id,
      trustee_id,
      custom_order_id,
      vendors_info,
      isQRPayment,
      createdAt,
      updatedAt,
      collect_id,
      status,
      bank_reference,
      details,
      transactionAmount,
      transactionStatus,
      transactionTime,
      payment_method,
      payment_time,
      transaction_amount,
      order_amount,
      isAutoRefund,
      reason,
      error_details,
    } = body;

    try {
      const school = await this.trusteeSchool.findOne({
        school_id: new Types.ObjectId(school_id),
      });
      if (!school) {
        throw new BadRequestException('School not found');
      }
      if (
        school.isNotificationOn &&
        school.isNotificationOn.for_transaction === true &&
        status.toUpperCase() === 'SUCCESS'
      ) {
        const htmlContent = await generateTransactionMailReciept(
          amount,
          gateway,
          additional_data,
          school_id,
          trustee_id,
          custom_order_id,
          vendors_info,
          isQRPayment,
          createdAt,
          updatedAt,
          collect_id,
          status,
          bank_reference,
          details,
          transactionAmount,
          transactionStatus,
          transactionTime,
          payment_method,
          payment_time,
          transaction_amount,
          order_amount,
          isAutoRefund,
          reason,
          error_details,
        );
        let emailRecipient = school.email;
        const eventName = 'TRANSACTION_ALERT';
        const emails = await this.businessServices.getMails(
          eventName,
          school_id,
        );
        const ccMails = await this.businessServices.getMailsCC(
          eventName,
          school_id,
        );
        try {
          this.emailService.sendTransactionAlert(
            htmlContent,
            `TRANSACTION SUCCESSFUL (${school.school_name})`,
            emails,
            ccMails,
          );
        } catch (e) {
          console.log(e);
        }
      }
      return res.status(200).send('ok');
    } catch (error) {
      console.log(error);

      throw new BadRequestException(error.message);
    }
  }

  @Post('create-mail-groups')
  async createMailgroup(
    @Body()
    body: {
      event_name: string;
      group_name: string;
      school_id: string;
      emails: string[];
      cc: string[];
      isNotification: boolean;
    },
  ) {
    const { event_name, group_name, school_id, emails, cc } = body;
    try {
      const school = await this.trusteeSchool.findOne({
        school_id: new Types.ObjectId(school_id),
      });
      if (!school) {
        throw new BadRequestException('School not found for ' + school_id);
      }
      const event = await this.EmailEventModel.findOne({ event_name });
      if (!event) {
        throw new BadRequestException('Event Not found ' + event_name);
      }
      if(!school.isNotificationOn){
        school.isNotificationOn={
          for_refund:false,
          for_settlement:false,
          for_transaction:false
        }
      }
      switch (event_name) {
        case 'SETTLEMENT_ALERT':
          school.isNotificationOn.for_settlement = true;
          await school.save();
          break;
        case 'TRANSACTION_ALERT':
          school.isNotificationOn.for_transaction = true;
          await school.save();
          break;
        case 'REFUND_ALERT':
          school.isNotificationOn.for_refund = true;
          break;
        default:
          throw new BadRequestException('INVALID EVENT NAME');
      }

      return await this.businessServices.createEmailGroup(
        event_name,
        group_name,
        school_id,
        school.trustee_id.toString(),
        emails,
        cc,
      );
    } catch (e) {
      throw new BadRequestException(e.message);
    }
  }

  @Post('create-event')
    async createEvent(@Body() body: { name: string }) {
      try {
        const event = await this.EmailEventModel.findOne({
          event_name: body.name,
        });
        
        if (event) {
          throw new ConflictException('Event Already present ' + body.name);
        }
        const newEvent = await this.EmailEventModel.create({
          event_name: body.name,
        });
  
        return newEvent;
      } catch (e) {
        throw new BadRequestException(e.message);
      }
    }
}
