import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Post,
  Query,
} from '@nestjs/common';
import { PlatformChargeService } from './platform-charges.service';
import { InjectModel } from '@nestjs/mongoose';
import { TrusteeSchool } from '../schema/school.schema';
import mongoose from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { Trustee } from '../schema/trustee.schema';

@Controller('platform-charges')
export class PlatformChargesController {
  constructor(
    private readonly jwtService: JwtService,
    private readonly platformChargeService: PlatformChargeService,
    @InjectModel(Trustee.name)
    private trusteeModel: mongoose.Model<Trustee>,
    @InjectModel(TrusteeSchool.name)
    private readonly trusteeSchool: mongoose.Model<TrusteeSchool>,
  ) {}

  @Post('add-platform-charges')
  async AddPlatformCharge(
    @Body()
    token: {
      token: string;
    },
  ) {
    try {
      const body = this.jwtService.verify(token.token, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
      });
      const { trusteeSchoolId, platform_type, payment_mode, range_charge } =
        body;

      if (!trusteeSchoolId)
        throw new BadRequestException('Trustee school ID Required');
      if (!platform_type)
        throw new BadRequestException('Platform type Required');
      if (!payment_mode) throw new BadRequestException('Payment mode Required');
      if (!range_charge) throw new BadRequestException('Charges Required');

      const val = await this.platformChargeService.AddPlatformCharge(
        trusteeSchoolId,
        platform_type,
        payment_mode,
        range_charge,
      );

      const payload = {
        platform_charges: val.platform_charges,
      };

      const res = this.jwtService.sign(payload, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
      });
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

  @Post('delete-platform-charges')
  async deletePlatformCharge(
    @Body()
    token: {
      token: string;
    },
  ) {
    try {
      const body = this.jwtService.verify(token.token, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
      });
      const { trusteeSchoolId, platform_type, payment_mode } = body;

      if (!trusteeSchoolId)
        throw new BadRequestException('Trustee school ID Required');
      if (!platform_type)
        throw new BadRequestException('Platform type Required');
      if (!payment_mode) throw new BadRequestException('Payment mode Required');
      if (payment_mode === 'Others')
        throw new BadRequestException('Cannot delete Other MDR');

      const val = await this.platformChargeService.deletePlatformCharge(
        trusteeSchoolId,
        platform_type,
        payment_mode,
      );

      const payload = {
        platform_charges: val.platform_charges,
      };

      const res = this.jwtService.sign(payload, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
      });
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

  @Get('final-amount-with-MDR')
  async finalAmountWithMDR(
    @Body()
    body,
  ) {
    try {
      const { trusteeSchoolId, platform_type, payment_mode, amount } = body;

      if (!trusteeSchoolId)
        throw new BadRequestException('Trustee school ID Required');
      if (!platform_type)
        throw new BadRequestException('Platform type Required');
      if (!payment_mode) throw new BadRequestException('Payment mode Required');
      if (!amount) throw new BadRequestException('Amount Required');

      return await this.platformChargeService.finalAmountWithMDR(
        trusteeSchoolId,
        platform_type,
        payment_mode,
        amount,
      );
    } catch (err) {
      if (err.response?.statusCode === 400) {
        throw new BadRequestException(err.message);
      } else if (err.response?.statusCode === 404) {
        throw new NotFoundException(err.message);
      }
      throw new Error(err.message);
    }
  }

  @Get('alltrustee')
  async getAllTrusteeInSiglePage() {
    try {
      const data = await this.platformChargeService.getAllTrustee();
      const res = this.jwtService.sign(data, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
      });
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

  @Get('alltrusteeschool')
  async getAllTrusteeSchool(@Query('token') token: string) {
    try {
      const { trusteeId } = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
      });

      if (!trusteeId) throw new Error('Trustee ID Required');

      const val =
        await this.platformChargeService.getAllTrusteeSchool(trusteeId);
      const res = this.jwtService.sign(val, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
      });
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

  @Post('update-platform-charges')
  async updatePlatformCharge(
    @Body()
    token: {
      token: string;
    },
  ) {
    try {
      const body = this.jwtService.verify(token.token, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
      });
      const { trusteeSchoolId, platform_type, payment_mode, range_charge } =
        body;

      if (!trusteeSchoolId)
        throw new BadRequestException('Trustee school ID Required');
      if (!platform_type)
        throw new BadRequestException('Platform type Required');
      if (!payment_mode) throw new BadRequestException('Payment mode Required');
      if (!range_charge) throw new BadRequestException('Charges Required');

      const val = await this.platformChargeService.updatePlatformCharge(
        trusteeSchoolId,
        platform_type,
        payment_mode,
        range_charge,
      );

      const payload = {
        platform_charges: val.platform_charges,
      };

      const res = this.jwtService.sign(payload, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
      });
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
}
