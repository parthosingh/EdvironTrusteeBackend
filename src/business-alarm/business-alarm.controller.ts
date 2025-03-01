import { Controller, Post } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import axios from 'axios';
import { BusinessAlarmService } from './business-alarm.service';
import { EmailService } from 'src/email/email.service';
import { TrusteeSchool } from 'src/schema/school.schema';
import mongoose from 'mongoose';
import { checkMerchantSettlementnot } from './templates/htmlToSend.format';

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
        let allSchoolaftercontext : any[] = [];

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
}
