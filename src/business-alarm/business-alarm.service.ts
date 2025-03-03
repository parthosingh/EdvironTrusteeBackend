import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RefundRequest } from '../schema/refund.schema';
import { TrusteeSchool } from '../schema/school.schema';
import * as jwt from 'jsonwebtoken';
import axios, { AxiosError } from 'axios';
import { SettlementReport } from '../schema/settlement.schema';
@Injectable()
export class BusinessAlarmService {
  constructor(
    @InjectModel(TrusteeSchool.name)
    private readonly trusteeSchoolModel: Model<TrusteeSchool>,
    @InjectModel(RefundRequest.name)
    private readonly refundRequestSchema: Model<RefundRequest>,
    @InjectModel(SettlementReport.name)
    private readonly settelmentReports: Model<SettlementReport>
  ) { }

  async findAll() {
    const data = await this.trusteeSchoolModel.find();
    return data;
  }

  async findDuplicateTrustees() {
    // make sure multiple ignored ids should be separated by comma(',') in env
    let ignoredIds = [];
    if (process.env.EDVIRON_TRUSTEE_IDS) {
      ignoredIds = process.env.EDVIRON_TRUSTEE_IDS.split(',').map(
        (id) => new Types.ObjectId(id),
      );
    }

    const data = await this.trusteeSchoolModel.aggregate([
      {
        $match: {
          email: { $ne: null },
          // trustee_id: { $nin: ignoredIds },
        },
      },
      {
        $group: {
          _id: '$email',
          count: { $sum: 1 },
          school: { $push: '$$ROOT' },
        },
      },
      {
        $match: {
          count: { $gt: 1 },
        },
      },
      // {
      //   $project: {
      //     email: '$_id',
      //     count: 1,
      //     _id: 1,
      //     school_name: 1,
      //   },
      // },
    ]);

    return data;
  }

  async findDuplicateTrusteesByCientId() {
    // make sure multiple ignored ids should be separated by comma(',') in env
    const ignoredIds = process.env.EDVIRON_TRUSTEE_IDS.split(',').map(
      (id) => new Types.ObjectId(id),
    );

    const data = await this.trusteeSchoolModel.aggregate([
      {
        $match: {
          client_id: { $ne: null },
          trustee_id: { $nin: ignoredIds },
        },
      },
      {
        $group: {
          _id: '$client_id',
          count: { $sum: 1 },
          school: { $push: '$$ROOT' },
        },
      },
      {
        $match: {
          count: { $gt: 1 },
        },
      },
      // {
      //   $project: {
      //     client_id: '$_id',
      //     count: 1,
      //     _id: 1,
      //     school_name: 1,
      //   },
      // },
    ]);

    return data;
  }

  async refundAmountandOrderAmountMismatch() {
    const data = await this.refundRequestSchema.aggregate([
      {
        $match: {
          refund_amount: { $ne: null },
          order_amount: { $ne: null },
          $expr: { $lt: ['$order_amount', '$refund_amount'] },
        },
      },
      {
        $project: {
          _id: 1,
          order_id: 1,
          transaction_amount: 1,
          refund_amount: 1,
          order_amount: 1,
          trustee_id: 1,
          school_id: 1,
          status: 1,
        },
      },
    ]);

    return data;
  }

  async findDuplicateTrusteesPgKey() {
    const data = this.trusteeSchoolModel.aggregate([
      {
        $match: {
          pg_key: { $ne: null },
        },
      },
      {
        $group: {
          _id: '$pg_key',
          count: { $sum: 1 },
          docs: { $push: '$$ROOT' },
        },
      },
      {
        $match: {
          count: { $gt: 1 },
        },
      },
      {
        $unwind: {
          path: '$docs',
        },
      },
      {
        $replaceRoot: {
          newRoot: '$docs',
        },
      },
      {
        $project: {
          _id: 0,
          school_id: 1,
          school_name: 1,
          pg_key: 1,
          trustee_id: 1,
        },
      },
    ]);

    return data;
  }

  async reconOrderAmount() {
    const dateString = new Date().toISOString().split('T')[0];
    const schools = await this.trusteeSchoolModel.find({
      pg_key: { $exists: true, $ne: null },
    });

    const missmatchedSchools = (
      await Promise.all(
        schools.map(async (data) => {
          const missMatched = await this.checkTransactionDataAlram(
            dateString,
            dateString,
            data.school_id.toString(),
            data.trustee_id.toString(),
          );

          if (missMatched?.missmatched) {
            return missMatched;
          }
          return null; // Ensure null is returned instead of undefined
        })
      )
    ).filter(Boolean); // Remove null/undefined entries

    return missmatchedSchools;
  }


  async checkTransactionDataAlram(
    startDate: string,
    endDate: string,
    school_id: string,
    trustee_id: string,
  ) {
    console.log('checking for transaction' + school_id);

    let token = jwt.sign(
      { trustee_id: trustee_id },
      process.env.PAYMENTS_SERVICE_SECRET,
    );
    try {
      let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/bulk-transactions-report?startDate=${startDate}&endDate=${endDate}&status=SUCCESS&school_id=${school_id}&limit=500000`,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        data: {
          trustee_id: trustee_id,
          token,
        },
      };

      const amountConfig = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/get-transaction-report-batched`,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        data: {
          end_date: endDate,
          start_date: startDate,
          school_id: school_id,
          trustee_id: trustee_id,
          status: 'SUCCESS',
        },
      };

      const { data: response } = await axios.request(config);
      const { data: amountResponse } = await axios.request(amountConfig);
      console.log(amountResponse, 'amountResponse');
      const totalorderAmount = response.transactions.reduce(
        (sum, transaction) => sum + (transaction.order_amount || 0),
        0,
      );
      // return amountResponse
      if (
        amountResponse.length > 0 &&
        amountResponse.transactions[0].totalOrderAmount
      ) {
        if (
          totalorderAmount === amountResponse.transactions[0].totalOrderAmount
        ) {
          return {
            missmatched: false,
            order_amount: totalorderAmount,
            received_order_amount:
              amountResponse.transactions[0].totalOrderAmount,
            transaction_id: amountResponse.transactions[0].transaction_id,
            diff:
              totalorderAmount -
              amountResponse.transactions[0].totalOrderAmount,
            school_id: school_id,
            trustee_id: trustee_id,
            startDate: startDate,
            endDate: endDate,
          };
        }
        return {
          missmatched: true,
          order_amount: totalorderAmount,
          received_order_amount:
            amountResponse.transactions[0].totalOrderAmount,
          transaction_id: amountResponse.transactions[0].transaction_id,
          diff:
            totalorderAmount - amountResponse.transactions[0].totalOrderAmount,
          school_id: school_id,
          trustee_id: trustee_id,
          startDate: startDate,
          endDate: endDate,
        };
      }
      return {
        missmatched: false,
      };
      // add mailer here
    } catch (e) {
      console.log(e, 'error');
      throw new Error(e.message);
    }
  }


  async checkMerchantSettlement(today: Date, endtime: Date, remainingSchools: Array<any>) {

    const dataConvert = new Date(today)
    const at5pmconvert = new Date(endtime)
    at5pmconvert.setUTCHours(17, 59, 59, 999);

    const yesterdaySchoolIdsSet = new Set(remainingSchools.map(school => school.school_id));


    // console.log(yesterdaySchoolIdsSet, "yesterdaySchoolIdsSet")

    //this will return school  not collect request previous day
    // const removePreviousCollectSchools = allSchools.filter(
    //   school => !yesterdaySchoolIdsSet.has(school.school_id)
    // );

    // console.log(removePreviousCollectSchools, "removePreviousCollectSchools")

    const checkschoolsinschool = await this.settelmentReports.aggregate([
      {
        $match: {
          settlementDate: { $gte: dataConvert, $lte: at5pmconvert },
          // status: { $nin: ["SUCCESS"] }
          schoolId : {$nin : [yesterdaySchoolIdsSet]}
        },
      },
      {
        $group: {
          _id: "$schoolId",
          count: { $sum: 1 },
          settlements: { $push: "$$ROOT" }
        }
      },
      {
        $lookup: {
          from: "trusteeschools",
          localField: "_id",
          foreignField: "school_id",
          as: "school"
        }
      },
      {
        $unwind: {
          path: "$school"
        }
      },
      {
        $project: {
          _id: 0,
          school_id: '$_id',
          count: 1,
          school_name: '$school.school_name',
          school_email: '$school.email',
          school_phone_number: '$school.phone_number',
          client_id: '$school.client_id',
          // settlements: {
          //   $map: {
          //     input: '$settlements',
          //     as: 'settlement',
          //     in: {
          //       settlement_id: '$$settlement._id',
          //       settled_on: '$$settlement.settlementDate',
          //       utr: '$$settlement.utrNumber',
          //       adjustment: '$$settlement.adjustment',
          //       settelement_transaction_amount:
          //         '$$settlement.settlementAmount',
          //       net_settlement_amount: '$$settlement.netSettlementAmount',
          //       status: '$$settlement.status',
          //       payment_from: '$$settlement.fromDate',
          //       payment_till: '$$settlement.tillDate',
          //     },
          //   },
          // },
        }
      }
    ])

    // console.log(checkschoolsinschool, "checkschoolsinschool", checkschoolsinschool.length )

    // remove all today settelment report from all schools
    const filteredSchools = remainingSchools.filter(
      school => !checkschoolsinschool.some(s => s.school_id.toString() === school.school_id.toString())
    );

 
    // console.log(newSet, "newSet");

    const result = filteredSchools
      .map(school => ({
      school_name: school.school_name,
      school_id: school.school_id,
      email: school.email,
      phone_number: school.phone_number,
      trustee_id: school.trustee_id,
      }));

      // console.log(result, "result")

    // const filteredSchools = allSchools.filter(
    //   school => !yesterdaySchoolIdsSet.has(school.school_id) && !checkschoolsinschool.some(s => s.school_id === school.school_id)
    // );
    
    // const result = removePreviousCollectSchools.map(school => ({
    //   school_name: school.school_name,
    //   school_id: school.school_id,
    //   email: school.email,
    //   phone_number: school.phone_number,
    //   trustee_id: school.trustee_id,
    // }));

    return result;


  }





  async checkErrorMerchantSettlement(today, endtime) {

    const checkaggregation = await this.settelmentReports.aggregate([
      {
        $match: {
          settlementDate: { $gte: today, $lte: endtime },
          status: { $nin: ["SUCCESS", "Settled"] }
        },
      },
      {
        $group: {
          _id: "$schoolId",
          count: { $sum: 1 },
          settlements: { $push: "$$ROOT" }
        }
      },
      {
        $lookup: {
          from: "trusteeschools",
          localField: "_id",
          foreignField: "school_id",
          as: "school"
        }
      },
      {
        $unwind: {
          path: "$school"
        }
      },
      {
        $project: {
          _id: 0,
          school_id: '$_id',
          count: 1,
          school_name: '$school.school_name',
          school_email: '$school.email',
          school_phone_number: '$school.phone_number',
          client_id: '$school.client_id',
          settlements: {
            $map: {
              input: '$settlements',
              as: 'settlement',
              in: {
                settlement_id: '$$settlement._id',
                settled_on: '$$settlement.settlementDate',
                utr: '$$settlement.utrNumber',
                adjustment: '$$settlement.adjustment',
                settelement_transaction_amount:
                  '$$settlement.settlementAmount',
                net_settlement_amount: '$$settlement.netSettlementAmount',
                status: '$$settlement.status',
                payment_from: '$$settlement.fromDate',
                payment_till: '$$settlement.tillDate',
              },
            },
          },
        }
      }
    ])



    // console.log(checkaggregation);

    return checkaggregation;
  }

}

