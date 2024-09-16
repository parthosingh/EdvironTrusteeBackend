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
  Res,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MainBackendService } from './main-backend.service';
import { JwtPayload } from 'jsonwebtoken';
import { Trustee } from '../schema/trustee.schema';
import mongoose, { Types } from 'mongoose';
import { TrusteeService } from '../trustee/trustee.service';
import { InjectModel } from '@nestjs/mongoose';
import { RequestMDR } from 'src/schema/mdr.request.schema';
import { SchoolMdrInfo } from 'src/trustee/trustee.resolver';
import { TrusteeSchool } from 'src/schema/school.schema';
import { refund_status, RefundRequest } from 'src/schema/refund.schema';
import { Parser } from 'json2csv';
import { Response } from 'express';

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
    @InjectModel(TrusteeSchool.name)
    private trusteeSchoolModel: mongoose.Model<TrusteeSchool>,
    @InjectModel(RefundRequest.name)
    private refundRequestModel: mongoose.Model<RefundRequest>,
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

  @Post('update-merchant-status')
  async updateMerchantStatus(@Body() body: { token: string }) {
    try {
      const data: JwtPayload = await this.jwtService.verify(body.token, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
      });

      const info = {
        trustee_id: data.trustee_id,
        school_id: data.school_id,
        merchantStatus: data.merchantStatus,
      };

      const result = await this.mainBackendService.updateMerchantStatus(info);
      return result;
    } catch (error) {
      console.log(error);
      if (error.message) throw new Error(error?.message);
      else throw new Error(error?.response?.message);
    }
  }
  @Get('get-trustee-mdr-request')
  async getTrusteeMDRRequest(@Query('token') token: string) {
    try {
      const data = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
      });
      return await this.trusteeService.getTrusteeMdrRequest(data.trusteeId);
    } catch (error) {
      throw error;
    }
  }

  @Get('get-base-mdr')
  async trusteeBaseMdr(@Query('token') token: string) {
    const data = this.jwtService.verify(token, {
      secret: process.env.JWT_SECRET_FOR_INTRANET,
    });
    const mdr = await this.trusteeService.getTrusteeBaseMdr(data.trusteeId);

    const mdrToken = this.jwtService.sign(
      { mdr },
      {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
      },
    );
    return mdrToken;
  }

  @Post('reject-mdr')
  async rejectMdr(@Body('data') token: string) {
    const data = this.jwtService.verify(token, {
      secret: process.env.JWT_SECRET_FOR_INTRANET,
    });
    await this.trusteeService.rejectMdr(data.id, data.comment);
    return `MDR status Update`;
  }

  @Post('save-base-mdr')
  async savebaseMdr(@Body('data') token: string) {
    const data = this.jwtService.verify(token, {
      secret: process.env.JWT_SECRET_FOR_INTRANET,
    });
    return await this.trusteeService.saveBulkMdr(
      data.base_mdr.trustee_id,
      data.base_mdr.platform_charges,
    );
  }

  @Get('get-school-mdr')
  async schoolMdr(@Query('token') token: string) {
    const data = this.jwtService.verify(token, {
      secret: process.env.JWT_SECRET_FOR_INTRANET,
    });

    let school: SchoolMdrInfo = await this.trusteeSchoolModel.findOne({
      school_id: new Types.ObjectId(data?.schoolId),
    });

    const mdr = await this.trusteeService.getSchoolMdrInfo(
      data.schoolId,
      data.trusteeId,
    );
    school.platform_charges = mdr.info;
    const date = new Date(mdr.updated_at);
    school.requestUpdatedAt = date;

    const mdrToken = this.jwtService.sign(
      { school },
      {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
      },
    );
    return mdrToken;
  }

  @Get('get-refund-request')
  async getRefundRequest(
    @Query('trustee_id') trustee_id: string,
    @Query('school_id') school_id: string,
    @Query('status') status: refund_status,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 30,
  ) {
    const query: any = {};
    console.log(trustee_id);

    if (trustee_id) {
      query.trustee_id = new Types.ObjectId(trustee_id);
    }
    if (school_id) {
      query.school_id = new Types.ObjectId(school_id);
    }
    if (status) {
      query.status = status;
    }
    console.log(query, 'q');

    const refundRequests = await this.refundRequestModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();
    console.log(refundRequests);

    return refundRequests;
  }
  @Post('update-refund-request')
  async updateRefundRequest(@Body() body: { token: string }) {
    const decodedPayload = await this.jwtService.verify(body.token, {
      secret: process.env.JWT_SECRET_FOR_INTRANET,
    });

    const request = await this.refundRequestModel.findById(
      decodedPayload.refund_id,
    );

    if (request.status === refund_status.DELETED) {
      throw new BadRequestException('Refund request has been deleted by user');
    }

    if (request.status === refund_status.APPROVED) {
      throw new BadRequestException('Refund request is already approved');
    }

    if (!request) {
      throw new NotFoundException('Refund request not found');
    }
    request.status = decodedPayload.status;
    await request.save();

    return `Request updated to ${decodedPayload.status}`;
  }

  @Get('download-mdr-report')
  async downloadCsvs(
    @Res() res: Response,
    @Query('trustee_id') trustee_id: string,
  ) {
    // Fetch all schools linked to the trustee_id
    const trusteeSchools = await this.trusteeSchoolModel.find({
      trustee_id: new Types.ObjectId(trustee_id),
    });
    console.log(trusteeSchools);
    
    if (trusteeSchools.length === 0) {
      throw new NotFoundException('No schools found for the trustee');
    }

    // Initialize ZIP archive to store multiple CSVs
    const archiver = require('archiver');
    const zip = archiver('zip');
    zip.pipe(res);

    for (const trusteeSchool of trusteeSchools) {
      if (!trusteeSchool.pg_key) {
        continue; // Skip schools without a PG Key
      }

      const data = trusteeSchool.platform_charges;
      const csvData = [];

      data.forEach((item) => {
        item.range_charge.forEach((charge) => {
          csvData.push({
            'Platform Type': item.platform_type,
            'Payment Mode': item.payment_mode,
            Upto: charge.upto || 'infinity',
            Charge: `${charge.charge}${
              charge.charge_type === 'PERCENT' ? '%' : ''
            }`,
          });
        });
      });

      // CSV fields and creation
      const fields = ['Platform Type', 'Payment Mode', 'Upto', 'Charge'];
      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(csvData);

      // Append CSV to ZIP file
      zip.append(csv, {
        name: `${trusteeSchool.school_name}_platform_charges.csv`,
      });
    }

    // Finalize the ZIP archive
    zip.finalize();

    // Set headers for ZIP file download
    res.header('Content-Type', 'application/zip');
    res.header(
      'Content-Disposition',
      `attachment; filename=trustee_${trustee_id}_platform_charges.zip`,
    );
  }
}
