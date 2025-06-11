import { BadRequestException, Body, Controller, Post, Res } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import axios from 'axios';
import { BusinessAlarmService } from './business-alarm.service';
import { EmailService } from '../email/email.service';
import { TrusteeSchool } from '../schema/school.schema';
import mongoose, { Types } from 'mongoose';
import { checkMerchantSettlementnot, generateTransactionMailReciept } from './templates/htmlToSend.format';

@Controller('business-alarm')
export class BusinessAlarmController {
    constructor(
        private readonly businessServices: BusinessAlarmService,
        private readonly emailService: EmailService,
        @InjectModel(TrusteeSchool.name)
        private readonly trusteeSchool: mongoose.Model<TrusteeSchool>,
    ) { }


    @Post('fivepm')
    async checkMerchantSettlement() {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        // console.log(today)
        const at5pm = new Date()
        at5pm.setUTCHours(17, 59, 59, 999);
        // console.log(at5pm)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const formattedDate = yesterday.toISOString().split('T')[0];

        const schools = await this.trusteeSchool.aggregate([
            {
                $match: {
                    pg_key: { $ne: null }
                }
            }
        ])
        console.time("check time before");
        let allSchoolaftercontext: any[] = [];

        const requests = schools.map(async (school) => {
            const config = {
                method: "post",
                maxBodyLength: Infinity,
                url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/get-transaction-report-batched`,
                headers: {
                    accept: "application/json",
                    "content-type": "application/json",
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
                console.error(`Error fetching data for school ${school.school_name}:`, error.message);
            }
        });

        await Promise.all(requests);

        console.timeEnd("check time before");

        const missMatched = await this.businessServices.checkMerchantSettlement(today, at5pm, allSchoolaftercontext);
        const formatEmail = checkMerchantSettlementnot(missMatched);

        this.emailService.sendAlert(formatEmail, "Today These School Not Setteled Any Amount Yet")

        return missMatched;
    }

    @Post('send-mail-after-transaction')
    async sendMailAfterTransaction(
        @Body() body: any,
        @Res() res: any
    ) {
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
            error_details
        } = body;

        try {
            const school = await this.trusteeSchool.findOne({
                school_id: new Types.ObjectId(school_id),
            });
            if (!school) {
                throw new BadRequestException("School not found");
            }
            console.log(school.isNotificationOn,'debug1',status);
            
            if (school.isNotificationOn && school.isNotificationOn.for_transaction === true && status.toUpperCase()=== 'SUCCESS') {
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
                    error_details
                )
                let emailRecipient = school.email
                const eventName='TRANSACTION_ALERT'
                const emails=await this.businessServices.getMails(eventName,school_id)
                console.log({emails});     
                try{
                    this.emailService.sendTransactionAlert(htmlContent, `TRANSACTION SUCCESSFUL (${school.school_name})`, emails)
                }   catch(e){
                    console.log(e);
                    
                }    
            }
            return res.status(200).send("ok")
        } catch (error) {
            console.log(error);
            
            throw new BadRequestException(error.message);
        }
    }
}
