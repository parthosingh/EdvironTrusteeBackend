import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Trustee } from './schema/trustee.schema';
import * as mongoose from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { Types } from 'mongoose';

@Injectable()
export class TrusteeService {
  constructor(
    @InjectModel(Trustee.name)
    private trusteeModel: mongoose.Model<Trustee>,
    private jwtService: JwtService,
  ) {}

  async findTrustee(): Promise<Trustee[]> {
    const trustee = await this.trusteeModel.find();
    return trustee;
  }

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
  async createApiKey(trusteeId: string): Promise<string> {
    try {
      if (!Types.ObjectId.isValid(trusteeId)) {
        throw new BadRequestException('Invalid trusteeId input');
      }
      const trustee = await this.trusteeModel.findById(trusteeId, {
        password_hash: 0,
      });

      if (!trustee) {
        throw new NotFoundException('Trustee not found');
      }

      trustee.IndexOfApiKey++;
      const updatedTrustee = await trustee.save();
      const payload = {
        trusteeId: updatedTrustee._id,
        IdexOfApiKey: updatedTrustee.IndexOfApiKey,
      };
      const apiKey = this.jwtService.sign(payload, {
        secret: process.env.JWT_FOR_TRUSTEE_AUTH,
      });

      return apiKey;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(error.message);
      }
      throw new BadRequestException(error.message);
    }
  }
}
