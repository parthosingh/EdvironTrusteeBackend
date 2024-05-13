import {
  BadRequestException,
  ConflictException,
  Get,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Types } from 'mongoose';
import { MainBackendService } from '../main-backend/main-backend.service';
import {
  PlatformCharge,
  TrusteeSchool,
  charge_type,
  rangeCharge,
} from '../schema/school.schema';
import { Trustee } from '../schema/trustee.schema';
import { SchoolMdr } from 'src/schema/school_mdr.schema';
import { platform } from 'os';

@Injectable()
export class PlatformChargeService {
  constructor(
    @InjectModel(Trustee.name)
    private trusteeModel: mongoose.Model<Trustee>,
    @InjectModel(TrusteeSchool.name)
    private trusteeSchoolModel: mongoose.Model<TrusteeSchool>,
    private mainBackendService: MainBackendService,
    @InjectModel(SchoolMdr.name)
    private schoolMdrModel: mongoose.Model<SchoolMdr>,
  ) {}

  async AddPlatformCharge(
    trusteeSchoolId: String,
    platform_type: String,
    payment_mode: String,
    range_charge: rangeCharge[],
  ) {
    try {
      const trusteeSchool = await this.trusteeSchoolModel.findOne({
        _id: trusteeSchoolId,
      });

      if (!trusteeSchool)
        throw new NotFoundException('Trustee school not found');
      if (trusteeSchool.pgMinKYC !== 'MIN_KYC_APPROVED')
        throw new BadRequestException('KYC not approved');

      trusteeSchool.platform_charges.forEach((platformCharge) => {
        if (
          platformCharge.platform_type.toLowerCase() ===
            platform_type.toLowerCase() &&
          platformCharge.payment_mode.toLowerCase() ===
            payment_mode.toLowerCase()
        ) {
          throw new BadRequestException('MDR already present');
        }
      });

      const res = await this.trusteeSchoolModel.findOneAndUpdate(
        { _id: trusteeSchoolId },
        {
          $push: {
            platform_charges: {
              platform_type,
              payment_mode,
              range_charge,
            },
          },
        },
        { returnDocument: 'after' },
      );

      const OthersFields = [
        { platform_type: 'UPI', payment_mode: 'Others' },
        { platform_type: 'DebitCard', payment_mode: 'Others' },
        { platform_type: 'NetBanking', payment_mode: 'Others' },
        { platform_type: 'CreditCard', payment_mode: 'Others' },
        { platform_type: 'Wallet', payment_mode: 'Others' },
        { platform_type: 'PayLater', payment_mode: 'Others' },
        { platform_type: 'C ', payment_mode: 'Others' },
      ];

      let AllOtherFieldPresent = 1;

      OthersFields.forEach((OthersField) => {
        let found = 0;
        res.platform_charges.forEach((PlatformCharge) => {
          if (
            PlatformCharge.platform_type.toLowerCase() ===
              OthersField.platform_type.toLowerCase() &&
            PlatformCharge.payment_mode.toLowerCase() ===
              OthersField.payment_mode.toLowerCase()
          ) {
            found = 1;
          }
        });

        AllOtherFieldPresent = AllOtherFieldPresent & found;
      });

      if (AllOtherFieldPresent && !trusteeSchool.pg_key) {
        let pgKey = await this.mainBackendService.generateKey();
        await this.trusteeSchoolModel.findByIdAndUpdate(trusteeSchool._id, {
          $set: { pg_key: pgKey },
        });
      }

      return { platform_charges: res.platform_charges };
    } catch (err) {
      if (err.response?.statusCode === 400) {
        throw new BadRequestException(err.message);
      } else if (err.response?.statusCode === 404) {
        throw new NotFoundException(err.message);
      }
      throw new Error(err.message);
    }
  }

  async deletePlatformCharge(
    trusteeSchoolId: string,
    platform_type: String,
    payment_mode: String,
  ) {
    try {
      let school_id = new mongoose.Types.ObjectId(trusteeSchoolId);
      const trusteeSchool = await this.trusteeSchoolModel.findOne({
        school_id,
      });
      if (!trusteeSchool)
        throw new NotFoundException('Trustee school not found');

      let isFound = 0;

      const schoolMdr = await this.schoolMdrModel.findOne({ school_id });
      if (schoolMdr && !schoolMdr.mdr2)
        throw new NotFoundException('MDR not present');
      schoolMdr?.mdr2?.forEach((platformCharge) => {
        if (
          platformCharge.platform_type === platform_type &&
          platformCharge.payment_mode === payment_mode
        ) {
          isFound = 1;
        }
      });

      if (!isFound) throw new NotFoundException('MDR not present');

      const res = await this.schoolMdrModel.findOneAndUpdate(
        { school_id },
        {
          $pull: {
            mdr2: {
              platform_type: platform_type,
              payment_mode: payment_mode,
            },
          },
        },
        { returnDocument: 'after' },
      );

      return res;
    } catch (err) {
      if (err.response?.statusCode === 400) {
        throw new BadRequestException(err.message);
      } else if (err.response?.statusCode === 404) {
        throw new NotFoundException(err.message);
      }
      throw new Error(err.message);
    }
  }

  async finalAmountWithMDR(
    trusteeSchoolId: String,
    platform_type: String,
    payment_mode: String,
    amount: number,
  ) {
    try {
      if (amount < 0) throw new Error('Amount should be positive');
      const trusteeSchool = await this.trusteeSchoolModel.findOne({
        _id: trusteeSchoolId,
      });
      if (!trusteeSchool)
        throw new NotFoundException('Trustee school not found');

      let ranges = null;
      trusteeSchool.platform_charges.forEach((platformCharge) => {
        if (
          platformCharge.platform_type === platform_type &&
          platformCharge.payment_mode === payment_mode
        ) {
          ranges = platformCharge.range_charge;
        }
      });

      if (!ranges) throw new NotFoundException('MDR not found');

      let platformCharge = null;
      ranges.forEach((range: any) => {
        if (!platformCharge && (!range.upto || range.upto >= amount)) {
          platformCharge = range;
        }
      });

      let finalAmount: number = amount;

      if (platformCharge.charge_type === charge_type.FLAT) {
        finalAmount += platformCharge.charge;
      } else if ((platformCharge.charge_type = charge_type.PERCENT)) {
        finalAmount += (amount * platformCharge.charge) / 100;
      }

      return finalAmount.toFixed(2);
    } catch (err) {
      if (err.response?.statusCode === 400) {
        throw new BadRequestException(err.message);
      } else if (err.response?.statusCode === 404) {
        throw new NotFoundException(err.message);
      }
      throw new Error(err.message);
    }
  }

  async getAllTrustee() {
    try {
      const trustees = await this.trusteeModel.find({}, { _id: 1, name: 1 });
      return { trustees: trustees };
    } catch (err) {
      if (err.response?.statusCode === 400) {
        throw new BadRequestException(err.message);
      } else if (err.response?.statusCode === 404) {
        throw new NotFoundException(err.message);
      }
      throw new Error(err.message);
    }
  }

  async getAllTrusteeSchool(trusteeId: string) {
    try {
      const schools = await this.trusteeSchoolModel.find(
        { trustee_id: new Types.ObjectId(trusteeId) },
        { school_id: 1, school_name: 1, platform_charges: 1 },
      );
      return { schools: schools };
    } catch (err) {
      if (err.response?.statusCode === 400) {
        throw new BadRequestException(err.message);
      } else if (err.response?.statusCode === 404) {
        throw new NotFoundException(err.message);
      }
      throw new Error(err.message);
    }
  }

  async updatePlatformCharge(
    trusteeSchoolId: String,
    platform_type: String,
    payment_mode: String,
    range_charge: rangeCharge[],
  ) {
    try {
      const trusteeSchool = await this.trusteeSchoolModel.findOne({
        _id: trusteeSchoolId,
      });

      if (!trusteeSchool)
        throw new NotFoundException('Trustee school not found');
      if (trusteeSchool.pgMinKYC !== 'MIN_KYC_APPROVED')
        throw new BadRequestException('KYC not approved');

      let isFound = 0;
      trusteeSchool.platform_charges.forEach((platformCharge) => {
        if (
          platformCharge.platform_type === platform_type &&
          platformCharge.payment_mode === payment_mode
        ) {
          isFound = 1;
        }
      });

      if (!isFound) throw new NotFoundException('MDR not found');

      const res = await this.trusteeSchoolModel.findOneAndUpdate(
        {
          _id: trusteeSchoolId,
          platform_charges: { $elemMatch: { platform_type, payment_mode } },
        },
        {
          $set: { 'platform_charges.$.range_charge': range_charge },
        },
        { returnDocument: 'after' },
      );

      return { platform_charges: res.platform_charges };
    } catch (err) {
      if (err.response?.statusCode === 400) {
        throw new BadRequestException(err.message);
      } else if (err.response?.statusCode === 404) {
        throw new NotFoundException(err.message);
      }
      throw new Error(err.message);
    }
  }

  async addSchoolMdr(
    trusteeSchoolIds: string[],
    platform_type: String,
    payment_mode: String,
    range_charge: rangeCharge[],
  ) {
    try {
      let platform_charges = {
        platform_type: platform_type,
        payment_mode: payment_mode,
        range_charge: range_charge,
      };

      trusteeSchoolIds.map(async (schoolId) => {
        let school_id = new mongoose.Types.ObjectId(schoolId);

        const trusteeSchool = await this.trusteeSchoolModel.findOne({
          school_id,
        });

        if (!trusteeSchool)
          throw new NotFoundException('Trustee school not found');
        // if (trusteeSchool.pgMinKYC !== 'MIN_KYC_APPROVED')
        //   throw new BadRequestException('KYC not approved');

        // const schoolMdr = await this.schoolMdrModel.findOne({
        //   school_id,
        // });

        // if (schoolMdr && schoolMdr?.mdr2)
        //   schoolMdr?.mdr2?.forEach((platformCharge) => {
        //     if (
        //       platformCharge.platform_type.toLowerCase() ===
        //         platform_type.toLowerCase() &&
        //       platformCharge.payment_mode.toLowerCase() ===
        //         payment_mode.toLowerCase()
        //     ) {
        //       throw new BadRequestException('MDR already present');
        //     }
        //   });

        const res = await this.schoolMdrModel.findOneAndUpdate(
          { school_id },
          {
            $push: {
              mdr2: {
                platform_type,
                payment_mode,
                range_charge,
              },
            },
          },
          { returnDocument: 'after', upsert: true },
        );

        const OthersFields = [
          { platform_type: 'UPI', payment_mode: 'Others' },
          { platform_type: 'DebitCard', payment_mode: 'Others' },
          { platform_type: 'NetBanking', payment_mode: 'Others' },
          { platform_type: 'CreditCard', payment_mode: 'Others' },
          { platform_type: 'Wallet', payment_mode: 'Others' },
          { platform_type: 'PayLater', payment_mode: 'Others' },
          { platform_type: 'C ', payment_mode: 'Others' },
        ];

        let AllOtherFieldPresent = 1;

        OthersFields.forEach((OthersField) => {
          let found = 0;
          res.mdr2.forEach((PlatformCharge) => {
            if (
              PlatformCharge.platform_type.toLowerCase() ===
                OthersField.platform_type.toLowerCase() &&
              PlatformCharge.payment_mode.toLowerCase() ===
                OthersField.payment_mode.toLowerCase()
            ) {
              found = 1;
            }
          });

          AllOtherFieldPresent = AllOtherFieldPresent & found;
        });

        if (AllOtherFieldPresent && !trusteeSchool.pg_key) {
          let pgKey = await this.mainBackendService.generateKey();
          await this.trusteeSchoolModel.findOneAndUpdate(
            {
              school_id,
            },
            {
              $set: { pg_key: pgKey },
            },
          );
        }
      });

      return { platform_charges: platform_charges };
    } catch (err) {
      if (err.response?.statusCode === 400) {
        throw new BadRequestException(err.message);
      } else if (err.response?.statusCode === 404) {
        throw new NotFoundException(err.message);
      }
      throw new Error(err.message);
    }
  }
  //call this after request approval ,as default value is already given
  async createUpdateSchoolMdr(
    trusteeSchoolIds: string[],
    mdr2: PlatformCharge[],
    // platform_type: String,
    // payment_mode: String,
    // range_charge: rangeCharge[],
  ) {
    try {
      trusteeSchoolIds.map(async (schoolId) => {
        let school_id = new mongoose.Types.ObjectId(schoolId);
        const trusteeSchool = await this.trusteeSchoolModel.findOne({
          school_id,
        });

        if (!trusteeSchool)
          throw new NotFoundException(
            `Trustee school with schoolId: ${schoolId} not found`,
          );
        // if (trusteeSchool.pgMinKYC !== 'MIN_KYC_APPROVED')
        //   throw new BadRequestException('KYC not approved');

        const res = await this.schoolMdrModel.findOneAndUpdate(
          {
            school_id,
          },
          {
            mdr2: mdr2,
          },
          { returnDocument: 'after', upsert: true },
        );
      });
      return {
        platform_charges: mdr2,
      };
    } catch (err) {
      if (err.response?.statusCode === 400) {
        throw new BadRequestException(err.message);
      } else if (err.response?.statusCode === 404) {
        throw new NotFoundException(err.message);
      }
      throw new Error(err.message);
    }
  }

  async deleteSchoolMdr(
    trusteeSchoolId: string,
    platform_type: String,
    payment_mode: String,
  ) {
    try {
      let school_id = new mongoose.Types.ObjectId(trusteeSchoolId);

      const trusteeSchool = await this.schoolMdrModel.findOne({
        school_id,
      });
      if (!trusteeSchool)
        throw new NotFoundException('Trustee school not found');

      let isFound = 0;
      trusteeSchool.mdr2.forEach((platformCharge) => {
        if (
          platformCharge.platform_type === platform_type &&
          platformCharge.payment_mode === payment_mode
        ) {
          isFound = 1;
        }
      });

      if (!isFound) throw new NotFoundException('MDR not present');

      const res = await this.schoolMdrModel.findOneAndUpdate(
        { school_id },
        {
          $pull: {
            mdr2: {
              platform_type: platform_type,
              payment_mode: payment_mode,
            },
          },
        },
        { returnDocument: 'after' },
      );

      return res;
    } catch (err) {
      if (err.response?.statusCode === 400) {
        throw new BadRequestException(err.message);
      } else if (err.response?.statusCode === 404) {
        throw new NotFoundException(err.message);
      }
      throw new Error(err.message);
    }
  }
  async finalMdr(
    trusteeSchoolId: string,
    platform_type: String,
    payment_mode: String,
    amount: number,
  ) {
    try {
      if (amount < 0) throw new Error('Amount should be positive');
      let school_id = new mongoose.Types.ObjectId(trusteeSchoolId);

      const trusteeSchool = await this.trusteeSchoolModel.findOne({
        school_id,
      });
      if (!trusteeSchool)
        throw new NotFoundException('Trustee school not found');
      const schoolMdr = await this.schoolMdrModel.findOne({
        school_id,
      });
      let ranges = null;
      schoolMdr.mdr2.forEach((platformCharge) => {
        if (
          platformCharge.platform_type === platform_type &&
          platformCharge.payment_mode === payment_mode
        ) {
          ranges = platformCharge.range_charge;
        }
      });

      if (!ranges) throw new NotFoundException('MDR not found');

      let platformCharge = null;
      //can be changed, will work only with sorted range [ascending order,otherwise it will always pick last range.]
      //[upto null-100,upto 40-50 & amount=30]
      ranges.forEach((range: any) => {
        if (!platformCharge && (!range.upto || range.upto >= amount)) {
          platformCharge = range;
        }
      });

      let finalAmount: number = amount;

      if (platformCharge.charge_type === charge_type.FLAT) {
        finalAmount += platformCharge.charge;
      } else if ((platformCharge.charge_type = charge_type.PERCENT)) {
        finalAmount += (amount * platformCharge.charge) / 100;
      }

      return finalAmount.toFixed(2);
    } catch (err) {
      if (err.response?.statusCode === 400) {
        throw new BadRequestException(err.message);
      } else if (err.response?.statusCode === 404) {
        throw new NotFoundException(err.message);
      }
      throw new Error(err.message);
    }
  }
}
