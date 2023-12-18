import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Types } from 'mongoose';
import { TrusteeSchool } from './schema/school.schema';
import { Trustee } from './schema/trustee.schema';

@Injectable()
export class TrusteeService {
  constructor(
    @InjectModel(Trustee.name)
    private trusteeModel: mongoose.Model<Trustee>,
    @InjectModel(TrusteeSchool.name)
    private trusteeSchoolModel: mongoose.Model<TrusteeSchool>,
  ) {}
  async getSchools(trusteeId: string) {
    try {
      if (!Types.ObjectId.isValid(trusteeId)) {
        throw new BadRequestException('Invalid trusteeID format');
      }
      const trustee = await this.trusteeModel.findById(trusteeId);

      if (!trustee) {
        throw new ConflictException(`no trustee found`);
      }
      const schools = await this.trusteeSchoolModel
        .find(
          { trustee_id: trusteeId },
          { school_id: 1, school_name: 1, _id: 0 },
        )
        .exec();
      return schools;
    } catch (error) {
      if (error instanceof ConflictException) {
        throw new ConflictException(error.message);
      } else {
        throw new BadRequestException(error.message);
      }
    }
  }
}
