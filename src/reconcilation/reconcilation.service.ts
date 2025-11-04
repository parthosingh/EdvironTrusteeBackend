import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { ErpService } from 'src/erp/erp.service';
import { Types } from 'mongoose'
import axios from 'axios';
import qs from 'qs';
import pLimit from 'p-limit'; 
import * as jwt from 'jsonwebtoken'
import { ReconRefundInfo, ReconTransactionInfo } from 'src/schema/Reconciliation.schema';
import { Cron } from '@nestjs/schedule';
import e from 'express';

@Injectable()
export class ReconcilationService {
    constructor(
        private databaseService: DatabaseService,
        private erpService: ErpService
    ) { }


    /*
    Easebuzz Corn -
    - It will save Settlements in Settlement DB
    - It will save Settlement Recon (Transactions, Refunds & Chargeback Under that Settlement  with utr )
    */

    /* SHIFT THIS FROM TEMP DATABASE TO PERMANENT DATABASE FOR SETTLEMENT */

    /**
     * CRON JOBS
     * Runs at 2 PM, 6 PM, and 11 PM IST
     */
    @Cron('0 14,18,23 * * *', {
        timeZone: 'Asia/Kolkata',
    })
    async easebuzzSettlements(settlementDate?: Date) {
     
        const date = new Date(settlementDate || new Date());
        date.setUTCHours(0, 0, 0, 0);
        const formattedDate = date.toLocaleDateString('en-GB').split('/').join('-'); // DD-MM-YYYY
        console.log(formattedDate,'formattedDate');
        
        console.log('Running Easebuzz settlements for:', formattedDate);

        const merchants = await this.databaseService.trusteeSchoolModel.find({
            easebuzz_non_partner: { $exists: true },
            school_id: new Types.ObjectId("67ea89a4498210d65b537832")
        });

        console.log({ merchants });

        if (!merchants.length) {
            console.log('No Easebuzz non-partner merchants found.');
            return true;
        }
        let transactions: any = []
        let formatter: any = []
        // limit concurrency to 5 requests at a time
        const limit = pLimit(5);
        let resEzb: any
        let totalAdj = 0
        const tasks = merchants.map((merchant) =>
            limit(async () => {
                try {
                    const { easebuzz_non_partner, school_name, school_id } = merchant;
                    const { easebuzz_key, easebuzz_salt } = easebuzz_non_partner;
                    console.log(easebuzz_non_partner, 'easebuzz_non_partner');
                    
                    const hashBody = `${easebuzz_key}||${formattedDate}|${easebuzz_salt}`;
                    const hash = await this.erpService.calculateSHA512Hash(hashBody);

                    const data = qs.stringify({
                        merchant_key: easebuzz_key,
                        hash,
                        payout_date: formattedDate,
                    });

                    const config = {
                        method: 'POST',
                        url: `${process.env.EASEBUZZ_ENDPOINT_PROD_DB}/payout/v1/retrieve`,
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            Accept: 'application/json',
                        },
                        data,
                    };
                    console.log(config, 'config');
                    

                    const response = await axios.request(config);
                    const payouts = response?.data?.payouts_history_data || [];
                    resEzb = response?.data
                    // console.log(payouts, 'payouts');

                    if (payouts.length === 0) {
                        console.log(`No settlements for ${school_name}`);
                        return;
                    }

                    for (const payout of payouts) {
                        let adjustment = 0
                        let total_transaction_amount = 0
                        let total_order_amount = 0
                        let reconTransactions: ReconTransactionInfo[] | [] = []
                        let reconRefunds: ReconRefundInfo[] | [] = []
                        const utr = payout.bank_transaction_id;
                        const easebuzzDate = new Date(payout.payout_actual_date);
                        transactions = payout.peb_transactions.map((item) => {
                            total_transaction_amount += item.amount
                            total_order_amount += item.peb_settlement_amount
                            return item.txnid
                        })
                        let refundIds = payout.peb_refunds.map((item: any) => {
                            adjustment = adjustment + item.refund_amount
                            totalAdj = totalAdj + item.refund_amount
                            return item.txnid
                        })

                        reconTransactions = await this.getReconInfoEzb(transactions, utr)

                        const times = reconTransactions.map(d => new Date(d.payment_time).getTime());
                        const oldest = new Date(Math.min(...times));
                        const latest = new Date(Math.max(...times));

                        reconRefunds = await this.reconRefund(refundIds, utr)
                        formatter = reconTransactions

                        const settlement = await this.databaseService.TempSettlementReportModel.findOneAndUpdate(
                            {
                                utrNumber: utr
                            },
                            {
                                settlementAmount: payout.payout_amount,
                                adjustment: '0.0',
                                netSettlementAmount: payout.payout_amount,
                                easebuzz_id: merchant.easebuzz_id,
                                fromDate: oldest,
                                tillDate: latest,
                                status: 'Settled',
                                utrNumber: utr,
                                settlementDate: easebuzzDate,
                                trustee: merchant.trustee_id,
                                schoolId: school_id,
                            },
                            {
                                upsert: true,
                                new: true
                            }
                        )

                       const recon = await this.databaseService.reconModel.findOneAndUpdate(
                            { utrNumber: utr }, // find condition
                            {
                                $set: {
                                    fromDate: oldest,
                                    tillDate: latest,
                                    settlementAmount: payout.payout_amount,
                                    totaltransactionAmount: total_transaction_amount,
                                    totalOrderAmount: total_order_amount,
                                    refundSum: adjustment,
                                    totalAdjustmentAmount: adjustment,
                                    transactions: reconTransactions,
                                    settlementDate: settlement.settlementDate,
                                    refunds: reconRefunds,
                                    school_name: merchant.school_name,
                                    schoolId: merchant.school_id,
                                    trustee: merchant.trustee_id
                                }
                            },
                            { upsert: true, new: true } // create if not found, return updated doc
                        );

                        console.log(recon, 'recon saved');
                        

                    }

                } catch (error) {
                    console.log(error, 'error');
                    
                    console.error(
                        `Error processing merchant ${merchant.school_name}:`,
                        error.message
                    );
                }
            })
        );
        await Promise.all(tasks);
        // const info = await this.getReconInfoEzb(transactions, 'utr')
        return {
            adjustment: totalAdj,
            resEzb,
            formatter
        }
        return formatter
        // return info
        return transactions

        console.log('✅ Easebuzz settlement cron completed.');
        return true;
    }

    /*
   Replicate the obove feature for 
   -Cashfree -> Webhook + CORN
   - Razorpay ->

   Use tempSettlemetModel() for now after testing we will Shift it to main
   */


    // Common for all gateway
    async getReconInfoEzb(collect_ids: string[], utr: string | null) {
        try {
            const sign = jwt.sign({ utr }, process.env.PAYMENTS_SERVICE_SECRET)

            const config = {
                url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/reconcilation/transactions-info`,
                method: 'post',
                headers: {
                    accept: 'json/application'
                },
                data: {
                    sign,
                    utr,
                    collect_ids
                }
            }

            const { data: transactions } = await axios.request(config)
            return transactions
        } catch (e) {
            console.log(e);
            
            throw new BadRequestException(e.message)
        }
    }

    // Common for all gateway
    async reconRefund(
        collect_ids: string[],
        utr: string
    ) {
        try {
            if (collect_ids.length == 0) {
                return []
            }
            let formattedResponse: any = []
            let refundTransactions: any = await this.getReconInfoEzb(collect_ids, utr)

            for (let refunds of refundTransactions) {
                const refund_data = await this.databaseService.refundModel.find({
                    order_id: new Types.ObjectId(refunds.collect_id),
                    status: "APPROVED"
                }).select('_id reason')
                refunds['event_type'] = 'REFUND'
                if (refund_data && refund_data.length > 0) {
                    refunds['refund_info'] = refund_data
                }
                formattedResponse.push(refunds)
            }
            return formattedResponse

        } catch (e) { }
    }

    async reconSettlemet(
        school_id: string,
        settlementDate: Date,
        startDate: Date,
        endDate: Date
    ) {
        try {
            const settlements = await this.databaseService.SettlementReportModel.find({
                schoolId: new Types.ObjectId(school_id), // Match the school_id
                settlementDate: {
                    $gte: startDate,
                    $lt: endDate,
                },
            });

            let totalSettlementAmount = 0;
            settlements.forEach((settlement) => {
                totalSettlementAmount += settlement.netSettlementAmount;

            });

        } catch (e) {
            throw new BadRequestException(e.message)
        }
    }

}
