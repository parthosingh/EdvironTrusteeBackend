import {
  Controller,
  Post,
  Get,
  Body,
  BadRequestException,
  ConflictException,
  Query,
  Req,
  UnauthorizedException,
  NotFoundException,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ErpService } from './erp.service';
import { JwtService } from '@nestjs/jwt';
import { ErpGuard } from './erp.guard';
import { InjectModel, Schema } from '@nestjs/mongoose';
import { TrusteeSchool } from '../schema/school.schema';
import mongoose, { Types } from 'mongoose';
import axios from 'axios';

@Controller('erp')
export class ErpController {
  constructor(
    private erpService: ErpService,
    private readonly jwtService: JwtService,
    @InjectModel(TrusteeSchool.name)
    private trusteeSchoolModel: mongoose.Model<TrusteeSchool>,
  ) {}

  @Get('payment-link')
  @UseGuards(ErpGuard)
  async genratePaymentLink(
    @Query('phone_number')
    phone_number: string,
  ) {
    try {
      const link = await this.erpService.genrateLink(phone_number);
      return link;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get('get-user')
  @UseGuards(ErpGuard)
  async validateApiKey(@Req() req): Promise<{
    name: string;
    email_id: string;
    phone_number: string;
  }> {
    try {
      const trusteeId = req.userTrustee.id;
      const trustee = await this.erpService.getUser(trusteeId);

      return trustee;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(error.message);
      } else {
        throw new UnauthorizedException(error.message);
      }
    }
  }

  @Post('create-section')
  @UseGuards(ErpGuard)
  async createSection(
    @Body()
    body: {
      school_id: string;
      data: { className: string; section: string };
    },
    @Req() req,
  ) {
    try {
      const trustee_id = req.userTrustee.id;
      const section = await this.erpService.createSection(
        body.school_id,
        body.data,
        trustee_id,
      );
      return section;
    } catch (error) {
      if (error.response && error.response.statusCode === 404) {
        throw new NotFoundException(error.message);
      } else if (error.response && error.response.statusCode === 409) {
        throw new ConflictException(error.message);
      }
      throw new BadRequestException(error.message);
    }
  }

  @Post('create-student')
  @UseGuards(ErpGuard)
  async createStudent(
    @Body()
    body,
    @Req() req,
  ) {
    try {
      const trustee_id = req.userTrustee.id;
      const student = await this.erpService.createStudent(
        body,
        body.school_id,
        trustee_id,
      );
      return student;
    } catch (error) {
      if (error instanceof ConflictException) {
        throw new ConflictException(error.message);
      } else if (error.response && error.response.statusCode === 404) {
        throw new NotFoundException(error.message);
      } else {
        throw new BadRequestException(error.message);
      }
    }
  }

  @Post('create-school')
  @UseGuards(ErpGuard)
  async createSchool(
    @Body()
    body: {
      name: string;
      phone_number: string;
      email: string;
      school_name: string;
    },

    @Req() req,
  ): Promise<any> {
    if (!body.name || !body.phone_number || !body.email || !body.school_name) {
      throw new BadRequestException('Fill all fields');
    }

    try {
      const school = await this.erpService.createSchool(
        body.phone_number,
        body.name,
        body.email,
        body.school_name,
        req.userTrustee.id,
      );

      return school;
    } catch (error) {
      if (error.response && error.response.statusCode === 409) {
        throw new ConflictException(error.message);
      }
      throw new BadRequestException(error.message);
    }
  }

  @Post('create-collect-request')
  @UseGuards(ErpGuard)
  async createCollectRequest(
    @Body()
    body: {
      school_id: string;
      amount: number;
      callback_url: string;
      sign: string;
      phone_no: string;
      mail_id: string;
      student_name: string;
      reason: string;
      webHookUrl?: string;
    },
    @Req() req,
  ) {
    try {
      const trustee_id = req.userTrustee.id;
      const { school_id, amount, callback_url, sign, webHookUrl } = body;
      if (!school_id) {
        throw new BadRequestException('School id is required');
      }
      if (!amount) {
        throw new BadRequestException('Amount is required');
      }
      if (!callback_url) {
        throw new BadRequestException('Callback url is required');
      }
      if (!sign) {
        throw new BadRequestException('sign is required');
      }
      if (body.phone_no || body.mail_id) {
        if (!body.student_name) {
          throw new BadRequestException('student name is required');
        }
        if (!body.reason) {
          throw new BadRequestException('reason is required');
        }
      }
      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });
      if (!school) {
        throw new NotFoundException('School not found');
      }

      if (school.trustee_id.toString() !== trustee_id.toString()) {
        throw new UnauthorizedException('Unauthorized');
      }
      if (!school.client_id || !school.client_secret || !school.pg_key) {
        throw new BadRequestException(
          'Edviron PG is not enabled for this school yet. Kindly contact us at tarun.k@edviron.com.',
        );
      }

      const decoded = this.jwtService.verify(sign, { secret: school.pg_key });

      if (
        decoded.amount != amount ||
        decoded.callback_url != callback_url ||
        decoded.school_id != school_id
      ) {
        throw new ForbiddenException('request forged');
      }

      const axios = require('axios');
      let data = JSON.stringify({
        amount,
        callbackUrl: callback_url,
        jwt: this.jwtService.sign(
          {
            amount,
            callbackUrl: callback_url,
            clientId: school.client_id,
            clientSecret: school.client_secret,
          },
          { noTimestamp: true, secret: process.env.PAYMENTS_SERVICE_SECRET },
        ),
        clientId: school.client_id,
        clientSecret: school.client_secret,
        webHook: webHookUrl || null,
        disabled_modes: school.disabled_modes,
        platform_charges: school.platform_charges
      });
      let config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/collect`,
        headers: {
          'Content-Type': 'application/json',
        },
        data: data,
      };
      const { data: paymentsServiceResp } = await axios.request(config);

      await this.erpService.sendPaymentLink({
        student_name: body.student_name,
        phone_no: body.phone_no,
        amount: body.amount,
        reason: body.reason,
        school_id: body.school_id,
        mail_id: body.mail_id,
        paymentURL: paymentsServiceResp.url,
      });

      return {
        collect_request_id: paymentsServiceResp.request._id,
        collect_request_url: paymentsServiceResp.url,
        sign: this.jwtService.sign(
          {
            collect_request_id: paymentsServiceResp.request._id,
            collect_request_url: paymentsServiceResp.url,
          },
          { noTimestamp: true, secret: school.pg_key },
        ),
      };
    } catch (error) {
      if (error.name === 'JsonWebTokenError')
        throw new BadRequestException('Invalid sign');
      console.log('error in create collect request', error);
      throw error;
    }
  }

  @Get('collect-request/:collect_request_id')
  @UseGuards(ErpGuard)
  async getCollectRequestStatus(@Req() req) {
    try {
      const trustee_id = req.userTrustee.id;
      const { collect_request_id } = req.params;
      const { school_id, sign } = req.query;
      if (!collect_request_id) {
        throw new BadRequestException('Collect request id is required');
      }
      if (!school_id) {
        throw new BadRequestException('School id is required');
      }
      if (!sign) {
        throw new BadRequestException('sign is required');
      }
      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });
      if (!school) {
        throw new NotFoundException('School not found');
      }

      if (school.trustee_id.toString() !== trustee_id.toString()) {
        throw new UnauthorizedException('Unauthorized');
      }

      if (!school.client_id || !school.client_secret || !school.pg_key) {
        throw new BadRequestException(
          'Edviron PG is not enabled for this school yet. Kindly contact us at tarun.k@edviron.com.',
        );
      }

      const decoded = this.jwtService.verify(sign, { secret: school.pg_key });

      if (
        decoded.collect_request_id != collect_request_id ||
        decoded.school_id != school_id
      ) {
        throw new ForbiddenException('request forged');
      }

      const axios = require('axios');

      let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: `${
          process.env.PAYMENTS_SERVICE_ENDPOINT
        }/check-status?transactionId=${collect_request_id}&jwt=${this.jwtService.sign(
          {
            transactionId: collect_request_id,
          },
          { noTimestamp: true, secret: process.env.PAYMENTS_SERVICE_SECRET },
        )}`,
        headers: {
          accept: 'application/json',
        },
      };

      const { data: paymentsServiceResp } = await axios.request(config);
      return paymentsServiceResp;
    } catch (error) {
      if (error.name === 'JsonWebTokenError')
        throw new BadRequestException('Invalid sign');
      console.log('error in collect request status check', error);
      throw error;
    }
  }

  @Post('sendPaymentLink')
  @UseGuards(ErpGuard)
  async sendPaymentLink(
    @Body()
    body: {
      student_name: string;
      phone_no: string;
      amount: number;
      reason: string;
      school_id: string;
      mail_id: string;
    },
    @Req() req,
  ) {
    try {
      if (!body.student_name)
        throw new NotFoundException('student name required');
      if (!body.amount) throw new NotFoundException('amount required');
      if (!body.reason) throw new NotFoundException('reason required');
      if (!body.student_name) throw new NotFoundException('school id required');
      if (!body.phone_no && !body.mail_id)
        throw new NotFoundException(
          'atleast one contact detail required from phone no or mail id',
        );

      const { student_name, phone_no, amount, reason, school_id, mail_id } =
        body;

      const authToken = req.headers['authorization'].substring(7);

      const payload = {
        school_id: body.school_id,
        amount: body.amount,
        callback_url: 'https://google.com',
      };

      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(body.school_id),
      });

      const token = this.jwtService.sign(payload, { secret: school.pg_key });
      const data = JSON.stringify({
        school_id: body.school_id,
        amount: body.amount,
        callback_url: 'https://google.com',
        sign: token,
      });

      const temp = await axios.request({
        method: 'post',
        maxBodyLength: Infinity,
        url: `https://vanilla.edviron.com/erp/create-collect-request`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        data: data,
      });

      const paymentURL = temp.data.collect_request_url;

      if (body.mail_id) {
        await this.erpService.sendPaymentLinkTOMail({
          student_name,
          amount,
          reason,
          school_id,
          mail_id,
          paymentURL,
        });

        console.log('mail sent');
      }

      if (body.phone_no) {
        await this.erpService.sendPaymentLinkToWhatsaap({
          student_name,
          phone_no,
          amount,
          reason,
          school_id,
          paymentURL,
        });

        console.log('whatsaap sent');
      }

      return 'Notification sent scuccessfully';
    } catch (err) {
      throw new Error(err.message);
    }
  }
}
