import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Post,
  Query,
} from '@nestjs/common';
import { PlatformChargeService } from './platform-charges.service';
import { InjectModel } from '@nestjs/mongoose';
import { TrusteeSchool } from '../schema/school.schema';
import mongoose, { Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { Trustee } from '../schema/trustee.schema';
import { SchoolMdr } from '../schema/school_mdr.schema';
import { RequestMDR } from '../schema/mdr.request.schema';
import axios from 'axios';
// import pMap from 'p-map';
@Controller('platform-charges')
export class PlatformChargesController {
  constructor(
    private readonly jwtService: JwtService,
    private readonly platformChargeService: PlatformChargeService,
    @InjectModel(Trustee.name)
    private trusteeModel: mongoose.Model<Trustee>,
    @InjectModel(TrusteeSchool.name)
    private readonly trusteeSchool: mongoose.Model<TrusteeSchool>,
    @InjectModel(SchoolMdr.name)
    private readonly schoolMdr: mongoose.Model<SchoolMdr>,
    @InjectModel(RequestMDR.name)
    private mdrRequestModel: mongoose.Model<RequestMDR>,
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
        platform_charges: val.mdr2,
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

  @Post('bulk-add-platform-charges')
  async BulkAddPlatformCharge(
    @Body()
    token: {
      token: string;
    },
  ) {
    try {
      const body = this.jwtService.verify(token.token, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
      });
      const { trusteeSchoolId, platform_charges } = body;

      if (!trusteeSchoolId)
        throw new BadRequestException('Trustee school ID Required');
      if (!platform_charges)
        throw new BadRequestException('platform charges Required');

      const data = [];
      for (let i = 0; i < platform_charges.length; i++) {
        try {
          await this.platformChargeService.AddPlatformCharge(
            trusteeSchoolId,
            platform_charges[i].platform_type,
            platform_charges[i].payment_mode,
            platform_charges[i].range_charge,
          );

          data.push({ error: null });
        } catch (err) {
          data.push({ error: err.message });
        }
      }

      const payload = {
        data: data,
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

  @Post('delete-school-mdr')
  async deleteSchoolMdr(
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
        platform_charges: val.mdr2,
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

  //for creating/updating/deleting total mdr(mdr2) of school
  //call this after request approval
  @Post('add-school-mdr')
  async bulkAddSchoolMdr(
    @Body()
    token: {
      token: string;
    },
  ) {
    try {
      const body = this.jwtService.verify(token.token, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
      });
      const { mdr_request_id } = body;
      const mdrReq = await this.mdrRequestModel.findById(mdr_request_id);
      if (!mdrReq) throw new NotFoundException('MDR Request not found');

      const trusteeSchoolIds = mdrReq?.school_id;
      if (!trusteeSchoolIds)
        throw new BadRequestException('Trustee school ID Required');
      if (!mdr_request_id)
        throw new BadRequestException('MDR Request Required');

      let mdr_id = new mongoose.Types.ObjectId(mdr_request_id);
      const mdrRequest = await this.mdrRequestModel.findOne({ _id: mdr_id });
      await this.platformChargeService.acceptMDRRequest(mdrRequest);

      let mdr2 = [];
      const data = [];
      for (let i = 0; i < mdrRequest.platform_charges.length; i++) {
        mdr2.push({
          platform_type: mdrRequest.platform_charges[i].platform_type,
          payment_mode: mdrRequest.platform_charges[i].payment_mode,
          range_charge: mdrRequest.platform_charges[i].range_charge,
        });
      }
      trusteeSchoolIds.map(async (id) => {
        const schools = await this.trusteeSchool.findOneAndUpdate(
          { school_id: new Types.ObjectId(id) },
          {
            $set: { platform_charges: mdrRequest.platform_charges },
          },
          { new: true },
        );

        const config = {
          method: 'post',
          maxBodyLength: Infinity,
          url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/update-school-mdr`,
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
          },
          data: {
            token: '',
            trustee_id: schools.trustee_id,
            school_id: schools.school_id,
            platform_charges: schools.platform_charges,
          },
        };
        try {
          await axios.request(config);
        } catch (e) {
          console.log(e, 'update error');
          throw new BadRequestException(e.message);
        }
      });

      await this.platformChargeService.createUpdateSchoolMdr(
        trusteeSchoolIds,
        mdr2,
      );
      const payload = {
        data: data,
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

  //function for getting total mdr and commission of a school
  @Get('final-school-mdr')
  async finalSchoolMdr(
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

      return await this.platformChargeService.finalMdr(
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

  @Post('save-school-mdr')
  async saveSchoolMdr(@Body('data') token: string) {
    try {
      const data = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
      });
      const response = await this.platformChargeService.createUpdateSchoolMdr(
        data.school_id,
        data.mdr2,
      );
      const mdrToken = this.jwtService.sign(response, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
      });

      return mdrToken;
    } catch (error) {
      throw new Error(error.message);
    }
  }

  // @Post('update-mdr-bulk')
  // async updateMdrBulk() {
  //   const schoolList = await this.trusteeSchool.find({ pg_key: { $ne: null } });

  //   const batchSize = 10; // Same as concurrency

  //   let processedCount = 0;

  //   await pMap(
  //     schoolList,
  //     async (school: any, index: number) => {
  //       await this.platformChargeService.updatePlatformChargesInPg(
  //         school.school_id.toString(),
  //       );

  //       // Log progress after every batch
  //       processedCount++;
  //       if (
  //         processedCount % batchSize === 0 ||
  //         processedCount === schoolList.length
  //       ) {
  //         console.log(
  //           `Processed ${processedCount}/${schoolList.length} schools`,
  //         );
  //       }
  //     },
  //     { concurrency: batchSize }, // Adjust concurrency as needed
  //   );

  //   return { message: `Successfully updated ${schoolList.length} schools.` };
  // }
}
