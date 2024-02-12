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
  ) { }

  async createTrustee(info) {
    const { name, email, password, school_limit, phone_number } = info;
    try {
      const checkMail = await this.trusteeModel
        .findOne({ email_id: email })

      if (checkMail) {

        throw new ConflictException(`${email} already exist`);
      }

      const trustee = await this.trusteeModel.create({
        name: name,
        email_id: email,
        password_hash: password,
        school_limit: school_limit,
        phone_number: phone_number,
      })



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
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
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
      const checkKey = await this.trusteeSchoolModel.findOne({ pg_key: uniqueKey });
      return !checkKey;
    } catch (error) {
      throw new BadRequestException(error.message)
    }
  }


  async updateSchoolInfo(info: {
    school_name: string,
    school_id: string,
    trustee_id: string,
    client_id: string,
    client_secret: string,
    merchantId: string,
    merchantName: string,
    merchantEmail: string,
    merchantStatus: string,
    pgMinKYC: string,
    pgFullKYC: string
  }) {
    try {
      const {
        school_name,
        school_id,
        trustee_id,
        client_id,
        client_secret,
        merchantId,
        merchantEmail,
        merchantName,
        merchantStatus,
        pgFullKYC,
        pgMinKYC
      } = info



      const trusteeId = new Types.ObjectId(trustee_id)
      const schoolId = new Types.ObjectId(school_id)
      const pg_key = await this.generateKey()

      const trustee = await this.trusteeModel.findById(trusteeId)
      if (!trustee) {
        throw new NotFoundException(`Trustee not found`)
      }
      console.log(trusteeId);

      const update = {
        $set: {
          school_name:merchantName,
          client_id,
          client_secret,
          pg_key,
          merchantId,
          merchantEmail,
          merchantName,
          merchantStatus,
          pgFullKYC,
          pgMinKYC,
          trustee_id: trusteeId
        },
      };

      const options = {
        upsert: true,
        new: true,
      };

      console.log(await this.trusteeModel.findOne({merchantEmail}));
      

      const updatedSchool = await this.trusteeSchoolModel.findOneAndUpdate(
        {
          school_id:schoolId
        },
        update,
        options
      );
        
      return { updatedSchool, trustee };
    } catch (error) {
      if (error.response && error.response.statusCode === 404) {
        throw new NotFoundException(error.response.message);
      } else if (error.response && error.response.statusCode === 409) {
        throw new ConflictException(error.response.message)
      }
      throw new BadRequestException(error.message);
    }
  }


}
