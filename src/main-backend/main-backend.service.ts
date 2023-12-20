import { BadGatewayException, BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Types } from 'mongoose';
import { TrusteeSchool } from 'src/schema/school.schema';
import { Trustee } from 'src/schema/trustee.schema';

@Injectable()
export class MainBackendService {
  constructor(
    @InjectModel(Trustee.name)
    private trusteeModel: mongoose.Model<Trustee>,
    @InjectModel(TrusteeSchool.name)
    private trusteeSchoolModel: mongoose.Model<TrusteeSchool>,
  ) { }

  async createTrustee(info): Promise<Trustee> {
    const { name, email, password, school_limit } = info;
    try {
      const checkMail = await this.trusteeModel
        .findOne({ email_id: email })
        .exec();

      if (checkMail) {
        throw new ConflictException(`${email} already exist`);
      }

      const trustee = await new this.trusteeModel({
        name: name,
        email_id: email,
        password_hash: password,
        school_limit: school_limit,
      }).save();
      return trustee;
    } catch (error) {
      if (error.response.statusCode === 409) {
        throw new ConflictException(error.message);
      }
      throw new BadRequestException(error.message);
    }
  }

  async findTrustee(page, pageSize) {
    try {
      const totalItems = await this.trusteeModel.countDocuments();
      const totalPages = Math.ceil(totalItems / pageSize);

      const trustee = await this.trusteeModel
        .find()
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .exec();

      const pagination = {
        data: trustee,
        page,
        pageSize,
        totalPages,
        totalItems,
      };
      return pagination;
    } catch (err) {
      throw new NotFoundException(err.message);
    }
  }

  async findOneTrustee(trustee_id: Types.ObjectId) {
    try {
      const trustee = await this.trusteeModel.findOne(trustee_id);
      return trustee;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async checkSchoolLimit(trustee_id : Types.ObjectId) {
    const countDocs = await this.trusteeSchoolModel.countDocuments({
      trustee_id,
    });
    return countDocs;
  }

  async assignSchool(
    school_id: Types.ObjectId,
    trustee_id: Types.ObjectId,
    school_name: string,
  ) {
    try {
      const trustee = await this.trusteeModel.findOne(
        new Types.ObjectId(trustee_id),
      );
      const countSchool = await this.checkSchoolLimit(trustee_id);
      const check = await this.trusteeSchoolModel.find({
        trustee_id,
        school_id,
      });

      if (check.length > 0) {
        throw new ForbiddenException('alrady assigned');
      }
      if (countSchool === trustee.school_limit) {
        throw new ForbiddenException('You cannot add more school');
      }
      const school = await new this.trusteeSchoolModel({
        school_id,
        trustee_id,
        school_name,
      }).save();
      return school;
    } catch (error) {
      if (error.response.statusCode === 403) {
        throw new ForbiddenException(error.message);
      }

      throw new BadGatewayException(error.message);
    }
  }
}
