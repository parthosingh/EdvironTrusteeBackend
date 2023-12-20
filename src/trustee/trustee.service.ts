import { JwtService } from '@nestjs/jwt';
import mongoose, { Types, ObjectId } from 'mongoose';
import {
  ConflictException,
  Injectable,
  BadGatewayException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Body,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Trustee } from '../schema/trustee.schema';
import { TrusteeSchool } from '../schema/school.schema';
import axios from 'axios';
import * as bcrypt from 'bcrypt';

@Injectable()
export class TrusteeService {
  constructor(
    @InjectModel(Trustee.name)
    private trusteeModel: mongoose.Model<Trustee>,
    @InjectModel(TrusteeSchool.name)
    private trusteeSchoolModel: mongoose.Model<TrusteeSchool>,
    private jwtService: JwtService,
  ) {}

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

  async loginAndGenerateToken(
    emailId: string,
    passwordHash: string,
  ): Promise<{ token: string }> {
    try {
      const trustee = await this.trusteeModel.findOne({ email_id: emailId });

      if (!trustee) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const passwordMatch = await bcrypt.compare(
        passwordHash,
        trustee.password_hash,
      );

      if (!passwordMatch) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const payload = {
        id: trustee._id,
      };

      return {
        token: await this.jwtService.sign(payload, {secret: process.env.JWT_SECRET_FOR_TRUSTEE_AUTH, expiresIn: "30d"}),
      };
    } catch (error) {
      console.error('Error in login process:', error);
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  async validateTrustee(token: string): Promise<any> {
    try {
      const decodedPayload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET_FOR_TRUSTEE_AUTH,
      });

      const trustee = await this.trusteeModel.findById(
        decodedPayload.id,
      );

      if (!trustee) throw new NotFoundException('trustee not found');

      const userTrustee = {
        id: trustee._id,
        name: trustee.name,
        email: trustee.email_id,
      };

      return userTrustee;
    } catch (error) {
      throw new UnauthorizedException('Invalid API key');
    }
  }

  async getSchools(trusteeId: string, limit: number, offset: number) {
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
        .skip(offset)
        .limit(limit)
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

  async checkSchoolLimit(trustee_id) {
    const countDocs = await this.trusteeSchoolModel.countDocuments({
      trustee_id,
    });
    console.log(countDocs);
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

  async generateSchoolToken(
    schoolId: string,
    password: string,
    trusteeId: string,
  ) {
    try {
      // Parallel execution of database queries using Promise.all()
      const [school, trustee] = await Promise.all([
        this.trusteeSchoolModel.findOne({ school_id: schoolId }),
        this.trusteeModel.findById(trusteeId),
      ]);

      // Specific error handling using custom error classes
      if (!trustee) {
        throw new NotFoundException('Trustee not found');
      }

      if (!school) {
        throw new NotFoundException('School not found!');
      }

      // Password validation and JWT token generation
      const passwordMatch = await bcrypt.compare(
        password,
        trustee.password_hash,
      );
      if (!passwordMatch) {
        throw new UnauthorizedException();
      }

      const data = { schoolId: school.school_id };
      const token = this.jwtService.sign(data, {
        secret: process.env.PRIVATE_TRUSTEE_KEY,
      });

      // Making a POST request to an external endpoint
      const schoolToken = await axios.post(
        `${process.env.MAIN_SERVER_URL}/api/trustee/gen-school-token`,
        {
          token: token,
        },
      );

      return schoolToken.data;
    } catch (error) {
      // Structured error handling for different scenarios
      if (error.response) {
        throw error;
      } else if (error.request) {
        throw new BadRequestException('No response received from the server');
      } else {
        throw new BadRequestException('Request setup error');
      }
    }
  }  
}
