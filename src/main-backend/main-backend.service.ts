import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Types } from 'mongoose';
import { SchoolSchema, TrusteeSchool } from '../schema/school.schema';
import { Trustee } from '../schema/trustee.schema';

@Injectable()
export class MainBackendService {
  constructor(
    @InjectModel(Trustee.name)
    private trusteeModel: mongoose.Model<Trustee>,
    @InjectModel(TrusteeSchool.name)
    private trusteeSchoolModel: mongoose.Model<TrusteeSchool>,
  ) {}

  async createTrustee(info) {
    const { name, email, password, school_limit, phone_number } = info;
    try {
      const checkMail = await this.trusteeModel.findOne({ email_id: email });

      if (checkMail) {
        throw new ConflictException(`${email} already exist`);
      }

      const trustee = await this.trusteeModel.create({
        name: name,
        email_id: email,
        password_hash: password,
        school_limit: school_limit,
        phone_number: phone_number,
      });

      return trustee;
    } catch (error) {
      if (error.response && error.response.statusCode === 409) {
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
        .sort({ createdAt: -1 })
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

  async checkSchoolLimit(trustee_id: Types.ObjectId) {
    const countDocs = await this.trusteeSchoolModel.countDocuments({
      trustee_id,
    });
    return countDocs;
  }

  async generateKey() {
    const characters =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const keyLength = 10;

    let pgKey;
    let isUnique = false;

    while (!isUnique) {
      pgKey = '';

      for (let i = 0; i < keyLength; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        pgKey += characters.charAt(randomIndex);
      }

      // Check for the pg_key is present or not
      isUnique = await this.isKeyUnique(pgKey);
    }
    return pgKey;
  }

  async isKeyUnique(uniqueKey) {
    try {
      const checkKey = await this.trusteeSchoolModel.findOne({
        pg_key: uniqueKey,
      });
      return !checkKey;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async updateSchoolInfo(info: {
    school_id: string;
    trustee_id: string;
    client_id: string;
    merchantName: string;
    merchantEmail: string;
    merchantStatus: string;
    pgMinKYC: string;
    pgFullKYC: string;
  }) {
    try {
      const {
        school_id,
        trustee_id,
        client_id,
        merchantEmail,
        merchantName,
        merchantStatus,
        pgFullKYC,
        pgMinKYC,
      } = info;

      const trusteeId = new Types.ObjectId(trustee_id);
      const schoolId = new Types.ObjectId(school_id);

      const trusteeSchool = await this.trusteeSchoolModel.findOne({
        trustee_id: trusteeId,
        school_id: schoolId,
      });
      if (!trusteeSchool) {
        throw new NotFoundException(`School not found for Trustee`);
      }

      const update = {
        $set: {
          // school_name: merchantName,
          client_id,
          merchantEmail,
          merchantName,
          merchantStatus,
          pgFullKYC,
          pgMinKYC,
          trustee_id: trusteeId,
        },
      };

      const options = {
        new: true,
      };

      const updatedSchool = await this.trusteeSchoolModel.findOneAndUpdate(
        {
          school_id: schoolId,
        },
        update,
        options,
      );

      return { updatedSchool };
    } catch (error) {
      if (error.response && error.response.statusCode === 404) {
        throw new NotFoundException(error.response.message);
      } else if (error.response && error.response.statusCode === 409) {
        throw new ConflictException(error.response.message);
      }
      throw new BadRequestException(error.message);
    }
  }

  async assignSchool(info: {
    school_name: string;
    school_id: string;
    trustee_id: string;
    email: string;
  }) {
    try {
      const { school_name, school_id, trustee_id } = info;
      const trusteeId = new Types.ObjectId(trustee_id);
      const schoolId = new Types.ObjectId(school_id);
      const trustee = await this.trusteeModel.findById(trusteeId);
      if (!trustee) {
        throw new NotFoundException(`Trustee not found`);
      }
      // const pg_key = await this.generateKey()

      const school = await this.trusteeSchoolModel.create({
        school_name,
        school_id: schoolId,
        trustee_id: trusteeId,
        email: info.email,
        // pg_key,
      });
      return school;
    } catch (e) {
      throw new BadRequestException(e.message);
    }
  }

  async assignOnboarderToTrustee(erp_id: string, onboarder_id: string) {
    try {
      const res = this.trusteeModel.findOneAndUpdate(
        { _id: erp_id },
        { onboarder_id: onboarder_id },
        { returnDocument: 'after' },
      );

      return res;
    } catch (err) {
      throw new Error(err);
    }
  }

  async getAllErpOfOnboarder(onboarder_id: string, page) {
    try {
      const pageSize = 10;

      const count = await this.trusteeModel.countDocuments({
        onboarder_id: onboarder_id,
      });
      const res = await this.trusteeModel
        .find({ onboarder_id: onboarder_id })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .exec();

      return { trustee: res, page, total_pages: Math.ceil(count / pageSize) };
    } catch (err) {
      throw new Error(err);
    }
  }
}
