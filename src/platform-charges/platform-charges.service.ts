import { ConflictException, Get, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Types } from 'mongoose';
import { MainBackendService } from 'src/main-backend/main-backend.service';
import {
    PlatformCharge,
    TrusteeSchool,
    charge_type,
    rangeCharge,
} from 'src/schema/school.schema';
import { Trustee } from 'src/schema/trustee.schema';

@Injectable()
export class PlatformChargeService {
    constructor(
        @InjectModel(Trustee.name)
        private trusteeModel: mongoose.Model<Trustee>,
        @InjectModel(TrusteeSchool.name)
        private trusteeSchoolModel: mongoose.Model<TrusteeSchool>,
        private mainBackendService: MainBackendService,
    ) { }

    async AddPlatformCharge(
        trusteeSchoolId: String,
        platform_type: String,
        payment_mode: String,
        range_charge: rangeCharge,
    ) {
        try {
            const trusteeSchool = await this.trusteeSchoolModel.findOne({
                _id: trusteeSchoolId,
            });
            if (!trusteeSchool) throw new Error('Trustee school not found');
            if (trusteeSchool.pgMinKYC === 'MIN_KYC_APPROVED')
                throw new Error('KYC not approved');

            trusteeSchool.platform_charges.forEach((platformCharge) => {
                if (
                    platformCharge.platform_type === platform_type &&
                    platformCharge.payment_mode === payment_mode
                ) {
                    throw new ConflictException('MDR already present');
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
                { platform_type: 'CardLess EMI', payment_mode: 'Others' },
            ];

            let AllOtherFieldPresent = 1;

            OthersFields.forEach((OthersField) => {
                let found = 0;
                res.platform_charges.forEach((PlatformCharge) => {
                    if (
                        PlatformCharge.platform_type === OthersField.platform_type &&
                        PlatformCharge.payment_mode === OthersField.payment_mode
                    ) {
                        found = 1;
                    }
                });

                AllOtherFieldPresent = AllOtherFieldPresent & found;
            });

            if (AllOtherFieldPresent && !trusteeSchool.pg_key) {
                let pgKey = this.mainBackendService.generateKey;
                await this.trusteeSchoolModel.findByIdAndUpdate(trusteeSchool._id, {
                    $set: { pg_key: pgKey },
                });
            }

            return { platform_charges: res.platform_charges };
        } catch (err) {
            throw new Error(err);
        }
    }

    async deletePlatformCharge(
        trusteeSchoolId: String,
        platform_type: String,
        payment_mode: String,
    ) {
        try {
            const trusteeSchool = await this.trusteeSchoolModel.findOne({
                _id: trusteeSchoolId,
            });
            if (!trusteeSchool) throw new Error('Trustee school not found');

            let isFound = 0;
            trusteeSchool.platform_charges.forEach((platformCharge) => {
                if (
                    platformCharge.platform_type === platform_type &&
                    platformCharge.payment_mode === payment_mode
                ) {
                    isFound = 1;
                }
            });

            if (!isFound) throw new Error('MDR not present');

            const res = await this.trusteeSchoolModel.findOneAndUpdate(
                { _id: trusteeSchoolId },
                {
                    $pull: {
                        platform_charges: {
                            platform_type: platform_type,
                            payment_mode: payment_mode,
                        },
                    },
                },
                { returnDocument: 'after' },
            );

            return res;
        } catch (err) {
            throw new Error(err);
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
            if (!trusteeSchool) throw new Error('Trustee school not found');

            let ranges = null;
            trusteeSchool.platform_charges.forEach((platformCharge) => {
                if (
                    platformCharge.platform_type === platform_type &&
                    platformCharge.payment_mode === payment_mode
                ) {
                    ranges = platformCharge.range_charge;
                }
            });

            if (!ranges) throw new Error('MDR not found');

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
                console.log((amount * platformCharge.charge) / 100);
            }

            return finalAmount.toFixed(2);
        } catch (err) {
            throw new Error(err);
        }
    }

    async getAllTrustee() {
        try {
            const trustees = await this.trusteeModel.find({}, { _id: 1, name: 1 });
            console.log(trustees);
            return { trustees: trustees };
        } catch (err) {
            throw new Error(err);
        }
    }

    async getAllTrusteeSchool(trusteeId: string) {
        try {
            const schools = await this.trusteeSchoolModel.find(
                { trustee_id: new Types.ObjectId(trusteeId) },
                { school_id: 1, school_name: 1, platform_charges: 1 },
            );
            console.log(schools);
            return { schools: schools };
        } catch (err) {
            throw new Error(err);
        }
    }
}
