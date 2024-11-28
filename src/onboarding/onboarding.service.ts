import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Mutation } from '@nestjs/graphql';
import { InjectModel } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { Types } from 'mongoose';
import { OnboarderERP } from 'src/schema/onboarder.schema';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { Trustee } from 'src/schema/trustee.schema';
import { TrusteeMember } from 'src/schema/partner.member.schema';
@Injectable()
export class OnboardingService {
  constructor(
    @InjectModel(OnboarderERP.name)
    private onboarderERPModel: mongoose.Model<OnboarderERP>,
    @InjectModel(Trustee.name)
    private trusteeModel: mongoose.Model<Trustee>,
    @InjectModel(TrusteeMember.name)
    private trusteeMemberModel: mongoose.Model<TrusteeMember>,
  ) {}

  async CreateOnboarder(
    email: string,
    password: string,
    name: string,
    phone: string,
    trustee_id: string,
    brand_name: string,
  ): Promise<{ message: string }> {
    try {
      const checkEmail = await this.onboarderERPModel.findOne({
        email_id: email,
      });
      if (checkEmail) {
        throw new Error('Email already exists');
      }
      const checkNumber = await this.onboarderERPModel.findOne({
        phone_number: phone,
      });
      if (checkNumber) {
        throw new Error('Phone number already exists');
      }

      const checkTrustee = await this.trusteeModel.findById(trustee_id);
      if (!checkTrustee) {
        throw new Error('Trustee not found');
      }

      await new this.onboarderERPModel({
        email_id: email,
        password_hash: password,
        name,
        phone_number: phone,
        head_trustee: new Types.ObjectId(trustee_id),
        brand_name,
      }).save();
      return { message: 'Onboarder created successfully' };
    } catch (e) {
      throw new BadRequestException(e.message);
    }
  }

  async loginOnboarder(
    email: string,
    password: string,
  ): Promise<{ token: string }> {
    try {
      const onboarder = await this.onboarderERPModel.findOne({
        email_id: email,
      });
      if (!onboarder) {
        throw new UnauthorizedException('Invalid email or password');
      }
      const passwordMatch = await bcrypt.compare(
        password,
        onboarder.password_hash,
      );

      if (!passwordMatch) {
        throw new UnauthorizedException('Invalid email or password');
      }

      const payload = {
        id: onboarder._id,
        trustee_id: onboarder.head_trustee,
      };
      const token = jwt.sign(payload, process.env.JWT_SECRET_FOR_ONBOARDER_ERP);
      return { token };
    } catch (e) {
      throw new BadRequestException(e.message);
    }
  }

  async validateOnboarder(token: string): Promise<OnboarderERP> {
    try {
      const decodedPayload = jwt.verify(
        token,
        process.env.JWT_SECRET_FOR_ONBOARDER_ERP,
      ) as jwt.JwtPayload;
      const onboarder = await this.onboarderERPModel.findById(
        decodedPayload.id,
      );
      if (!onboarder) {
        throw new UnauthorizedException('Invalid token');
      }

      return onboarder;
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  async getOnboarder(id: string): Promise<OnboarderERP> {
    try {
      return await this.onboarderERPModel.findById(id).select('-password_hash');
    } catch (e) {
      throw new BadRequestException(e.message);
    }
  }

  async createTrustee(info: {
    name: string;
    email: string;
    password: string;
    phone_number: string;
    onboarder: string;
  }) {
    const { name, email, password, phone_number, onboarder } = info;
    try {
      const checkMail = await this.trusteeModel.findOne({ email_id: email });

      if (checkMail) {
        throw new ConflictException(`${email} already exist`);
      }
      const checkMember = await this.trusteeMemberModel.findOne({ email });
      if (checkMember) {
        throw new ConflictException(`member already exist with same email`);
      }

      const trustee = await this.trusteeModel.create({
        name: name,
        email_id: email,
        password_hash: password,
        school_limit: 9999,
        phone_number: phone_number,
        onboarder: new Types.ObjectId(onboarder),
        partneredTrustee: true,
      });

      return `User Created Successfully`;
    } catch (e) {
      throw new BadRequestException(e.message);
    }
  }

  async getOnboardersTrustee(onboarder_id: string) {
    try {
      const onboarder = await this.onboarderERPModel
        .findById(onboarder_id)
        .select('-password_hash');
      if (!onboarder) {
        throw new NotFoundException('Onboarder not found');
      }
      const trustee = await this.trusteeModel
        .find({ onboarder: onboarder._id })
        .select('-password_hash');

      return trustee;
    } catch (e) {
      throw new BadRequestException(e.message);
    }
  }

  async generateTrusteeToken(trustee_id: string) {
    const payload = {
      id: trustee_id,
      role: 'owner',
    };
    return {
      token: jwt.sign(payload, process.env.JWT_SECRET_FOR_TRUSTEE_AUTH, {
        expiresIn: '30d',
      }),
    };
  }
}
