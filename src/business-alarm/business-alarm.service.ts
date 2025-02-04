import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RefundRequest } from 'src/schema/refund.schema';
import { TrusteeSchool } from 'src/schema/school.schema';

@Injectable()
export class BusinessAlarmService {
  constructor(
    @InjectModel(TrusteeSchool.name)
    private readonly trusteeSchoolModel: Model<TrusteeSchool>,
    @InjectModel(RefundRequest.name)
    private readonly refundRequestSchema: Model<RefundRequest>,
  ) {}

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
         school:{$push:"$$ROOT"}
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
}
