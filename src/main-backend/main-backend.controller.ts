import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Post,
  Query,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MainBackendService } from './main-backend.service';
import { JwtPayload } from 'jsonwebtoken';
import { Trustee } from '../schema/trustee.schema';
import mongoose, { Types } from 'mongoose';
import { TrusteeService } from '../trustee/trustee.service';
import { InjectModel } from '@nestjs/mongoose';
import { RequestMDR } from 'src/schema/mdr.request.schema';

@Controller('main-backend')
export class MainBackendController {
  constructor(
    private mainBackendService: MainBackendService,
    private readonly jwtService: JwtService,
    private readonly trusteeService: TrusteeService,
    @InjectModel(Trustee.name)
    private readonly trusteeModel: mongoose.Model<Trustee>,
    @InjectModel(RequestMDR.name)
    private requestMDRModel: mongoose.Model<RequestMDR>,
  ) {}

  @Post('create-trustee')
  async createTrustee(
    @Body()
    body,
  ): Promise<string> {
    try {
      const info: JwtPayload = this.jwtService.verify(body.data, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
      });

      const trustee = await this.mainBackendService.createTrustee(info);

      const trusteeToken = this.jwtService.sign(
        { credential: trustee },
        {
          secret: process.env.JWT_SECRET_FOR_INTRANET,
        },
      );

      return trusteeToken;
    } catch (e) {
      if (e.response && e.response.statusCode === 409) {
        throw new ConflictException(e.message);
      }
      throw new BadRequestException(e.message);
    }
  }

  @Get('find-all-trustee')
  async findTrustee(@Query('token') token: string) {
    const paginationInfo: JwtPayload = this.jwtService.verify(token, {
      secret: process.env.JWT_SECRET_FOR_INTRANET,
    }) as JwtPayload;
    const trustee = this.jwtService.sign(
      await this.mainBackendService.findTrustee(
        paginationInfo.page,
        paginationInfo.pageSize,
      ),
      { secret: process.env.JWT_SECRET_FOR_INTRANET },
    );
    return trustee;
  }

  // use this for temp testing to genrate jwt that comes from edviron backend

  // @Post('get-jwt')
  // async getJwt(
  //   @Body()
  //   body: { school_name: string, school_id: string, trustee_id: string, client_id: string, client_secret: string, merchantId: string, merchantName: string, merchantEmail: string, merchantStatus: string, pgMinKYC: string, pgFullKYC: string }
  // ) {

  //   const token = this.jwtService.sign(body, { secret: process.env.JWT_SECRET_FOR_INTRANET })

  //   return token
  // }

  @Post('update-school')
  async updateSchool(@Body() body: { token: string }) {
    try {
      const data: JwtPayload = await this.jwtService.verify(body.token, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
      });

      const requiredFields = [
        'school_id',
        'trustee_id',
        'client_id',
        'merchantEmail',
        'merchantStatus',
        'pgMinKYC',
        'pgFullKYC',
        'merchantName',
      ];

      const missingFields = requiredFields.filter((field) => !data[field]);

      if (missingFields.length > 0) {
        throw new BadRequestException(
          `Missing fields: ${missingFields.join(', ')}`,
        );
      }

      const info = {
        school_id: data.school_id,
        trustee_id: data.trustee_id,
        client_id: data.client_id,
        merchantName: data.merchantName,
        merchantEmail: data.merchantEmail,
        merchantStatus: data.merchantStatus,
        pgMinKYC: data.pgMinKYC,
        pgFullKYC: data.pgFullKYC,
      };
      const school = await this.mainBackendService.updateSchoolInfo(info);
      const response = {
        school_id: school.updatedSchool.school_id,
        school_name: school.updatedSchool.school_name,
        msg: `${school.updatedSchool.school_name} is Updated`,
      };

      return response;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Post('assign-school')
  async onboarderAssignSchool(@Body() body: { data: string }) {
    try {
      const data: JwtPayload = await this.jwtService.verify(body.data, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
      });

      const requiredFields = ['name', 'school_id', 'trusteeId', 'email'];

      const missingFields = requiredFields.filter((field) => !data[field]);

      if (missingFields.length > 0) {
        throw new BadRequestException(
          `Missing fields: ${missingFields.join(', ')}`,
        );
      }
      const trusteeId = new Types.ObjectId(data.trusteeId);
      const trustee = await this.trusteeModel.findById(trusteeId);

      const info = {
        school_name: data.name,
        school_id: data.school_id,
        trustee_id: data.trusteeId,
        email: data.email,
      };
      const schoolInfo = await this.mainBackendService.assignSchool(info);

      const payload = {
        school_id: schoolInfo.school_id,
        trustee_id: schoolInfo.trustee_id,
        pg_key: schoolInfo.pg_key,
        trustee_name: trustee.name,
      };
      const responseToken = await this.jwtService.sign(payload, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
      });

      return responseToken;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
  @Get('trustee-schools')
  async getTrusteeSchool(@Query('token') token: string) {
    try {
      const trustee: JwtPayload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
      }) as JwtPayload;

      const schools = await this.trusteeService.getTrusteeSchools(
        trustee.id,
        trustee.page,
      );

      const schoolInfo = {
        schools: schools.schoolData,
        total_pages: schools.total_pages,
        page: trustee.page,
      };
      const responseToken = await this.jwtService.sign(schoolInfo, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
      });

      return responseToken;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Post('assignOnboarderToTrustee')
  async assignOnboarderToTrustee(
    @Body()
    token: {
      token: string;
    },
  ) {
    try {
      const ids = this.jwtService.verify(token.token, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
      });

      const val = await this.mainBackendService.assignOnboarderToTrustee(
        ids.erp_id,
        ids.onboarder_id,
      );

      const payload = {
        _id: val._id,
        name: val.name,
        email_id: val.email_id,
        password_hash: val.password_hash,
        school_limit: val.school_limit,
        IndexOfApiKey: val.IndexOfApiKey,
        phone_number: val.phone_number,
      };

      const res = this.jwtService.sign(payload, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
      });

      return res;
    } catch (err) {
      throw new Error(err);
    }
  }

  @Get('getAllErpOfOnboarder')
  async getAllErpOfOnboarder(@Query('token') token: string) {
    try {
      const data = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
      });
      const val = await this.mainBackendService.getAllErpOfOnboarder(
        data.onboarder_id,
        data.page,
      );

      const res = this.jwtService.sign(val, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
      });
      return res;
    } catch (err) {
      throw new Error(err);
    }
  }

  @Get('getTrusteeMDRRequest')
  async getTrusteeMDRRequest(@Query('trustee_id') trustee_id: string) {
    return await this.trusteeService.getTrusteeMdrRequest(trustee_id);
  }

  @Get('get-base-mdr')
  async trusteeBaseMdr(@Body() token:string){
    const data = this.jwtService.verify(token, {
      secret: process.env.JWT_SECRET_FOR_INTRANET,
    });
    const mdr= await this.trusteeService.getTrusteeBaseMdr(data.trusteeId)
    const mdrToken=this.jwtService.sign(mdr, {
      secret: process.env.JWT_SECRET_FOR_INTRANET,
    });
    return mdrToken
  }

  @Post('reject-mdt')
  async rejectMdr(@Body() body: { id: string; comment: string }) {
    await this.trusteeService.rejectMdr(body.id, body.comment);
    return `MDR status Update`;
  }

  @Post('save-base-mdr')
  async savebaseMdr(@Body() body:any){
    return await this.trusteeService.saveBulkMdr(body.trustee_id,body.base_mdr)
  }
}
