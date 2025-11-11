import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { CommissionWithoutGstDto, MdrStoreDto } from 'src/schema/commission.schema';
import { Types } from 'mongoose';
import axios from 'axios';

@Injectable()
export class CommissionService {
  constructor(private databaseService: DatabaseService) { }

  private readonly GST_RATE = 0.18;

  async updateCommission(commission_id: string, gateway: string) {
    try {
      const commission = await this.databaseService.commissionModel.findById(commission_id);
      if (!commission?.trustee_id) throw new NotFoundException('Commission not found');

      const edvCommission = await this.databaseService.gatewayRatesModel.findOne({ gateway });
      if (!edvCommission) throw new NotFoundException('EDV Commission not found');

      const status = await this.getAmount(commission.collect_id.toString())
      if (!status) {
        throw new BadRequestException('Error in getting amount')
      }

      const amount = status.amount
      const [edvironBase, trusteeBaseMDR, school, pgCommission] = await Promise.all([
        this.calculateCommissions(edvCommission.platform_charges, commission.payment_mode, commission.platform_type, amount),
        this.getTrusteeBaseMdr(commission),
        this.getTrusteeSchool(commission),
        this.getPaymentsMdr(commission.school_id.toString(), commission.payment_mode, commission.platform_type, amount),
      ]);

      // prepare MDR objects
      const mdr_amount = {
        edviron_buying_mdr_amount: edvironBase.commissionAmount,
        school_base_mdr_amount: trusteeBaseMDR.commissionAmount,
        school_final_mdr_amount: school.commissionAmount,
        pg_final_mdr_amount: pgCommission.commissionAmount,
      };

      const mdr = {
        edviron_buying_mdr: edvironBase.mdrRange,
        school_base_mdr: trusteeBaseMDR.mdrRange,
        school_final_mdr: school.mdrRange,
        pg_final_mdr: pgCommission.mdrRange,
      };

      // commission without gst
      const commission_without_gst: CommissionWithoutGstDto = {
        erp_commission_without_gst: mdr_amount.school_final_mdr_amount - mdr_amount.school_base_mdr_amount,
        edviron_earning_base_without_gst: mdr_amount.school_base_mdr_amount - mdr_amount.edviron_buying_mdr_amount,
        edviron_earning_school_without_gst: mdr_amount.school_final_mdr_amount - mdr_amount.pg_final_mdr_amount,
        edviron_earning_without_gst: 0,
        total_commission_without_gst: 0,
      };

      commission_without_gst.edviron_earning_without_gst =
        commission_without_gst.edviron_earning_base_without_gst +
        commission_without_gst.edviron_earning_school_without_gst;

      commission_without_gst.total_commission_without_gst =
        commission_without_gst.erp_commission_without_gst + commission_without_gst.edviron_earning_without_gst;

      // calculate gst + with gst
      const { commission_gst_amount, commission_with_gst } =
        this.calculateGstBreakdown(commission_without_gst, this.GST_RATE);

      return { mdr_amount, mdr, commission_without_gst, commission_gst_amount, commission_with_gst };
    } catch (e) {
      console.error('Commission Update Error:', e);
      throw new BadRequestException(e.message);
    }
  }

  private async getTrusteeBaseMdr(commission) {
    const schoolBase =
      (await this.databaseService.schoolBaseMdrModel.findOne({
        school_id: new Types.ObjectId(commission.school_id.toString()),
      })) ||
      (await this.databaseService.trusteeSchoolModel.findOne({
        trustee_id: new Types.ObjectId(commission.trustee_id.toString()),
      }));

    if (!schoolBase) throw new NotFoundException('Trustee Base MDR not found');

    return this.calculateCommissions(
      schoolBase.platform_charges,
      commission.payment_mode,
      commission.platform_type,
      commission.amount
    );
  }

  private async getTrusteeSchool(commission) {
    const school = await this.databaseService.trusteeSchoolModel.findOne({
      school_id: new Types.ObjectId(commission.school_id.toString()),
    });
    if (!school) throw new NotFoundException('School not found under trustee');

    return this.calculateCommissions(
      school.platform_charges,
      commission.payment_mode,
      commission.platform_type,
      commission.amount
    );
  }

  private calculateGstBreakdown(base: CommissionWithoutGstDto, rate: number) {
    const gst = (val: number) => val * rate;
    const add = (val: number) => val + gst(val);

    const commission_gst_amount = {
      erp_commission_gst: gst(base.erp_commission_without_gst),
      edviron_earning_base_gst: gst(base.edviron_earning_base_without_gst),
      edviron_earning_school_gst: gst(base.edviron_earning_school_without_gst),
      edviron_earning_gst: gst(base.edviron_earning_without_gst),
      total_commission_gst: gst(base.total_commission_without_gst),
    };

    const commission_with_gst = {
      erp_commission_with_gst: add(base.erp_commission_without_gst),
      edviron_earning_base_with_gst: add(base.edviron_earning_base_without_gst),
      edviron_earning_school_with_gst: add(base.edviron_earning_school_without_gst),
      edviron_earning_with_gst: add(base.edviron_earning_without_gst),
      total_commission_with_gst: add(base.total_commission_without_gst),
    };

    return { commission_gst_amount, commission_with_gst };
  }

  async calculateCommissions(commission, payment_mode, platform_type, amount) {
    let commissionEntry =
      commission.find(
        (c) =>
          c.payment_mode.toLowerCase() === payment_mode.toLowerCase() &&
          c.platform_type.toLowerCase() === platform_type.toLowerCase()
      ) ||
      commission.find(
        (c) =>
          c.payment_mode.toLowerCase() === 'others' &&
          c.platform_type.toLowerCase() === platform_type.toLowerCase()
      );

    if (!commissionEntry) {
      throw new NotFoundException(`Commission not found for ${payment_mode} - ${platform_type}`);
    }

    for (const range of commissionEntry.range_charge) {
      if (range.upto === null || amount <= range.upto) {
        const charge = range.charge_type === 'FLAT' ? range.charge : (range.charge / 100) * amount;
        return {
          commissionAmount: charge,
          mdrRange: { platform_charges: range.charge, charge_type: range.charge_type },
        };
      }
    }
    throw new BadRequestException('No valid MDR range found');
  }

  async getPaymentsMdr(school_id: string, payment_mode: string, platform_type: string, amount: number) {
    try {
      const school = await this.databaseService.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });
      if (!school) throw new NotFoundException('School not found under trustee');

      const config = {
        method: 'post',
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/reconcilation/get-school-mdr`,
        headers: { 'Content-Type': 'application/json' },
        data: { school_id: school._id, payment_mode, platform_type, amount },
      };

      const { data: res } = await axios.request(config);
      const charges = res.mdr ? res.platform_charges : school.platform_charges;

      return await this.calculateCommissions(charges, payment_mode, platform_type, amount);
    } catch (e) {
      console.error('Payments MDR Error:', e);
      throw new BadRequestException(e.message);
    }
  }

  async getAmount(collect_id: string) {
    try {
      const config = {
        method: 'get',
        url: `${process.env.URL}/check-status?transactionId=${collect_id}`,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'x-api-version': '2023-08-01',
        }
      }
      const { data: status } = await axios.request(config)
      return status
    } catch (e) {
      throw new BadRequestException(e.message)
    }
  }
}
