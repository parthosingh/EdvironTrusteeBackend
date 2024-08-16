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
  Res,
} from '@nestjs/common';
import { ErpService } from './erp.service';
import { JwtService } from '@nestjs/jwt';
import { ErpGuard } from './erp.guard';
import { InjectModel, Schema } from '@nestjs/mongoose';
import { TrusteeSchool } from '../schema/school.schema';
import mongoose, { Types } from 'mongoose';
import axios from 'axios';
import {
  SettlementReport,
  SettlementSchema,
} from '../schema/settlement.schema';
import { Trustee } from 'src/schema/trustee.schema';
import { Commission } from 'src/schema/commission.schema';
import { Earnings } from 'src/schema/earnings.schema';
import { BaseMdr } from 'src/schema/base.mdr.schema';
// import cf_commision from 'src/utils/cashfree.commission'; // hardcoded cashfree charges change this according to cashfree

@Controller('erp')
export class ErpController {
  constructor(
    private erpService: ErpService,
    private readonly jwtService: JwtService,
    @InjectModel(TrusteeSchool.name)
    private trusteeSchoolModel: mongoose.Model<TrusteeSchool>,
    @InjectModel(SettlementReport.name)
    private settlementModel: mongoose.Model<SettlementReport>,
    @InjectModel(Trustee.name)
    private trusteeModel: mongoose.Model<Trustee>,
    @InjectModel(Commission.name)
    private commissionModel: mongoose.Model<Commission>,
    @InjectModel(Earnings.name)
    private earningsModel: mongoose.Model<Earnings>,
    @InjectModel(BaseMdr.name)
    private baseMdrModel: mongoose.Model<BaseMdr>,
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
      student_phone_no?: string;
      student_email?: string;
      student_name?: string;
      student_id?: string;
      receipt?: string;
      sendPaymentLink?: boolean;
      additional_data?: {};
      custom_order_id?: string;
      req_webhook_urls?: [string];
    },
    @Req() req,
  ) {
    console.log('collec');

    try {
      const trustee_id = req.userTrustee.id;
      const {
        school_id,
        amount,
        callback_url,
        sign,
        additional_data,
        student_id,
        student_email,
        student_name,
        student_phone_no,
        receipt,
        custom_order_id,
        req_webhook_urls,
      } = body;
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
      if (body.student_phone_no || body.student_email) {
        if (!body.student_name) {
          throw new BadRequestException('student name is required');
        }
        // if (!body.reason) {
        //   throw new BadRequestException('reason is required');
        // }
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
      console.log(school, 'schoool;');

      const decoded = this.jwtService.verify(sign, { secret: school.pg_key });

      if (
        decoded.amount != amount ||
        decoded.callback_url != callback_url ||
        decoded.school_id != school_id
      ) {
        throw new ForbiddenException('request forged');
      }

      const trusteeObjId = new mongoose.Types.ObjectId(trustee_id);
      const trustee = await this.trusteeModel.findById(trusteeObjId);
      let webHookUrl = null;
      if (trustee.webhook_urls.length || req_webhook_urls?.length) {
        webHookUrl = `${process.env.VANILLA_SERVICE}/erp/webhook`;
      }

      const additionalInfo = {
        student_details: {
          student_id: student_id,
          student_email: student_email,
          student_name: student_name,
          student_phone_no: student_phone_no,
          receipt: receipt,
        },
        additional_fields: {
          ...additional_data,
        },
      };

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
        school_id: school_id,
        trustee_id: trustee_id,
        webHook: webHookUrl || null,
        disabled_modes: school.disabled_modes,
        platform_charges: school.platform_charges,
        additional_data: additionalInfo || {},
        custom_order_id: custom_order_id || null,
        req_webhook_urls: req_webhook_urls || null,
        school_name: school.school_name || null,
        easebuzz_sub_merchant_id: school.easebuzz_id || null,
        ccavenue_access_code: school.ccavenue_access_code || null,
        ccavenue_merchant_id: school.ccavenue_merchant_id || null,
        ccavenue_working_key: school.ccavenue_working_key || null,
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

      let reason = 'fee payment';

      //set some variable here (user input [sendPaymentLink:true])
      // to send link to student
      if (body.student_phone_no || body.student_email) {
        if (body.sendPaymentLink) {
          await this.erpService.sendPaymentLink({
            student_name: body.student_name || ' ',
            phone_no: body.student_phone_no,
            amount: body.amount,
            reason: reason,
            school_id: body.school_id,
            mail_id: body.student_email,
            paymentURL: paymentsServiceResp.url,
          });
        }
      }

      return {
        collect_request_id: paymentsServiceResp.request._id,
        collect_request_url: paymentsServiceResp.url,
        sign: this.jwtService.sign(
          {
            collect_request_id: paymentsServiceResp.request._id,
            collect_request_url: paymentsServiceResp.url,
            custom_order_id: paymentsServiceResp.request?.custom_order_id,
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

      const config = {
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
      const responseWithoutSign = { ...paymentsServiceResp, sign: undefined };
      const responseWithSign = {
        ...paymentsServiceResp,
        sign: this.jwtService.sign(responseWithoutSign, {
          noTimestamp: true,
          secret: school.pg_key,
        }),
      };
      return responseWithSign;
    } catch (error) {
      if (error.name === 'JsonWebTokenError')
        throw new BadRequestException('Invalid sign');
      console.log('error in collect request status check', error);
      throw error;
    }
  }

  @Get('collect-request-status/:order_id')
  @UseGuards(ErpGuard)
  async getCollectRequest(@Req() req) {
    try {
      const trustee_id = req.userTrustee.id;
      const { order_id } = req.params;
      const { school_id, sign } = req.query;
      if (!order_id) {
        throw new BadRequestException('Order id is required');
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
      if (decoded.custom_order_id != order_id) {
        throw new ForbiddenException('request forged');
      }

      const config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: `${
          process.env.PAYMENTS_SERVICE_ENDPOINT
        }/check-status/custom-order?transactionId=${order_id}&jwt=${this.jwtService.sign(
          {
            transactionId: order_id,
            trusteeId: trustee_id,
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

  @Get('settlements')
  @UseGuards(ErpGuard)
  async getSettlements(@Req() req) {
    try {
      const trustee_id = req.userTrustee.id;
      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 10);

      //paginated query
      const settlements = await this.settlementModel
        .find(
          {
            trustee: trustee_id,
          },
          null,
          {
            skip: (page - 1) * limit,
            limit: limit,
          },
        )
        .select('-clientId -trustee');
      const count = await this.settlementModel.countDocuments({
        trustee: trustee_id,
      });
      const total_pages = Math.ceil(count / limit);
      return {
        page,
        limit,
        settlements,
        total_pages,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get('transactions/:school_id')
  @UseGuards(ErpGuard)
  async getTransactions(@Req() req) {
    try {
      const trustee_id = req.userTrustee.id;
      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(req.params.school_id),
        trustee_id: trustee_id,
      });
      if (!school) {
        throw new NotFoundException('School not found');
      }

      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 10);
      const status = req.query.status || null;
      const start_date = req.query.start_date || null;
      const end_date = req.query.end_date || null;
      const school_id = req.params.school_id;
      let token = this.jwtService.sign(
        {
          school_id: school_id,
        },
        {
          noTimestamp: true,
          secret: process.env.PAYMENTS_SERVICE_SECRET,
        },
      );

      let data = {
        school_id: school_id,
        token: token,
      };

      let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/transactions-report`,
        headers: {
          accept: 'application/json',
        },
        data: data,
        params: {
          status,
          startDate: start_date,
          endDate: end_date,
          page,
          limit,
        },
      };
      let transactions = [];
      const response = await axios.request(config);
      if (
        response.data?.transactions &&
        response.data !== 'No orders found for clientId'
      ) {
        const modifiedResponseData = response.data.transactions.map((item) => ({
          ...item,
          student_id:
            JSON.parse(item?.additional_data).student_details?.student_id || '',

          student_name:
            JSON.parse(item?.additional_data).student_details?.student_name ||
            '',

          student_email:
            JSON.parse(item?.additional_data).student_details?.student_email ||
            '',
          student_phone:
            JSON.parse(item?.additional_data).student_details
              ?.student_phone_no || '',
          receipt:
            JSON.parse(item?.additional_data).student_details?.receipt || '',
          additional_data:
            JSON.parse(item?.additional_data).additional_fields || '',

          merchant_name: school.school_name,
          school_id: school_id,
          school_name: school.school_name,
          currency: 'INR',
        }));
        transactions.push(...modifiedResponseData);
      }

      const total_pages = Math.ceil(response.data.totalTransactions / limit);
      return {
        page,
        limit,
        transactions,
        total_pages,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get('transactions')
  @UseGuards(ErpGuard)
  async getTransaction(@Req() req) {
    try {
      const trustee_id = req.userTrustee.id;

      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 10);
      const status = req.query.status || null;
      const start_date = req.query.start_date || null;
      const end_date = req.query.end_date || null;
      const merchants = await this.trusteeSchoolModel.find({
        trustee_id: trustee_id,
      });
      const merchant_ids_to_merchant_map = {};
      merchants.map((merchant: any) => {
        merchant_ids_to_merchant_map[merchant.school_id] = merchant;
      });

      let token = this.jwtService.sign(
        { trustee_id: trustee_id },
        { secret: process.env.PAYMENTS_SERVICE_SECRET },
      );
      let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/bulk-transactions-report`,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        data: { trustee_id: trustee_id, token },
        params: {
          status,
          startDate: start_date,
          endDate: end_date,
          page,
          limit,
        },
      };

      const response = await axios.request(config);

      const total_pages = Math.ceil(response.data.totalTransactions / limit);
      const transactions = response.data.transactions.map((item: any) => {
        return {
          ...item,
          merchant_name:
            merchant_ids_to_merchant_map[item.merchant_id].school_name,
          student_id:
            JSON.parse(item?.additional_data).student_details?.student_id || '',

          student_name:
            JSON.parse(item?.additional_data).student_details?.student_name ||
            '',

          student_email:
            JSON.parse(item?.additional_data).student_details?.student_email ||
            '',
          student_phone:
            JSON.parse(item?.additional_data).student_details
              ?.student_phone_no || '',
          receipt:
            JSON.parse(item?.additional_data).student_details?.receipt || '',
          additional_data:
            JSON.parse(item?.additional_data).additional_fields || '',
          currency: 'INR',
          school_id: item.merchant_id,
          school_name:
            merchant_ids_to_merchant_map[item.merchant_id].school_name,
        };
      });
      return {
        page,
        limit,
        transactions,
        total_pages,
      };
    } catch (error) {
      console.log(error);
      throw new Error(error.message);
    }
  }

  @Post('webhook')
  async webhook(@Body() body, @Res() res) {
    try {
      console.log('webhook called', body);

      const decrypted = this.jwtService.verify(body.jwt, {
        secret: process.env.PAYMENTS_SERVICE_SECRET,
      });

      const trustee_id = decrypted.trustee_id;
      const school_id = decrypted.school_id;
      const collect_id = decrypted.collect_id;
      const amount = decrypted.amount;
      const status = decrypted.status;
      const req_webhook_urls = decrypted.req_webhook_urls;
      const trustee = await this.trusteeModel.findById(trustee_id);
      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });
      if (!school) throw new NotFoundException('School not found');
      const pg_key = school.pg_key;
      // const trusteeId = school.trustee_id;
      // const trustee = await this.trusteeModel.findById(trusteeId);
      const trusteeWebHookUrls = trustee.webhook_urls;

      let webHooksUrls: string[] = req_webhook_urls
        ? [...req_webhook_urls]
        : [];
      if (trusteeWebHookUrls.length) {
        const urls = trusteeWebHookUrls.map((webhook) => webhook.url);
        webHooksUrls.unshift(...urls);
      }

      if (!trustee) {
        console.log('trustee not found while sending webhook');
        throw new NotFoundException('Trustee not found');
      }
      if (!pg_key) {
        throw new BadRequestException(
          'webhook:PG Key not found for this school',
        );
      }

      if (webHooksUrls.length) {
        const token = this.jwtService.sign(
          {
            collect_id,
            amount,
            status,
          },
          { noTimestamp: true, secret: pg_key },
        );

        const webHookData = {
          collect_id,
          amount,
          status,
          token,
        };
        const config = {
          method: 'post',
          maxBodyLength: Infinity,
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
          },
          data: webHookData,
        };
        const requests = webHooksUrls.map((webhook) => {
          let url = webhook;
          return axios.request({ ...config, url });
        });
        const responses = await Promise.allSettled(requests);

        responses.forEach((response, i) => {
          if (response.status === 'fulfilled') {
            console.log(`webhook sent to ${webHooksUrls[i]} `);
          } else {
            console.log(`webhook failed to ${webHooksUrls[i]} `);
          }
        });
      } else {
        console.log(
          `skipping webhook as no webhook url was set for trustee`,
          trustee.email_id,
        );
      }

      return res.status(200).send('OK');
    } catch (error) {
      console.log('error in sending-webhook', error);
      throw error;
    }
  }

  @Post('update-commission') //add collect req id/transaction id in schema
  async updateCommission(
    @Body()
    body: {
      token: string;
      school_id: string;
      trustee_id: string;
      commission_amount: number;
      payment_mode: string;
      earnings_amount: number;
      transaction_id: string;
    },
  ) {
    const decrypted = this.jwtService.verify(body.token, {
      secret: process.env.PAYMENTS_SERVICE_SECRET,
    });
    const {
      school_id,
      trustee_id,
      commission_amount,
      payment_mode,
      earnings_amount,
      transaction_id,
    } = body;
    try {
      if (
        decrypted.school_id != school_id ||
        decrypted.trustee_id != trustee_id ||
        decrypted.commission_amount != commission_amount ||
        decrypted.payment_mode != payment_mode ||
        decrypted.earnings_amount != earnings_amount
      ) {
        throw new ForbiddenException('request forged');
      }

      await new this.commissionModel({
        school_id: new Types.ObjectId(school_id),
        trustee_id: new Types.ObjectId(trustee_id),
        commission_amount,
        payment_mode,
        collect_id: new Types.ObjectId(transaction_id),
      }).save(); // ERP Commission

      await new this.earningsModel({
        school_id: new Types.ObjectId(school_id),
        trustee_id: new Types.ObjectId(trustee_id),
        payment_mode,
        earnings_amount,
        collect_id: new Types.ObjectId(transaction_id),
      }).save(); //edviron Earnings

      return {
        status: 'successful',
        msg: 'Commission and Earnings are Updated Successfully',
      };
    } catch (err) {
      throw new Error(err.message);
    }
  }

  @Post('add-commission')
  async addCommission(
    @Body()
    body: {
      token: string;
      school_id: string;
      trustee_id: string;
      order_amount: number;
      transaction_amount: number;
      payment_mode: string;
      platform_type: string;
      collect_id: string;
    },
  ) {
    const {
      payment_mode,
      platform_type,
      order_amount,
      token,
      school_id,
      trustee_id,
      collect_id,
    } = body;
    try {
      const decrypted = this.jwtService.verify(token, {
        secret: process.env.PAYMENTS_SERVICE_SECRET,
      });

      if (
        decrypted.school_id != school_id ||
        decrypted.trustee_id != trustee_id ||
        decrypted.order_amount != order_amount ||
        decrypted.payment_mode != payment_mode ||
        decrypted.platform_type != platform_type ||
        decrypted.collect_id != collect_id
      ) {
        throw new ForbiddenException('request forged');
      }

      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });
      if (!school) {
        throw new NotFoundException(`School not found for ${school_id}`);
      }
      const trustee = await this.trusteeModel.findById(trustee_id);

      if (!trustee) {
        throw new NotFoundException(`Trustee not found for ${trustee_id}`);
      }
      const baseMdr = await this.baseMdrModel.findOne({
        trustee_id: trustee._id,
      });
      if (!baseMdr) {
        throw new ConflictException('Trustee has no Base MDR set ');
      }

      const school_platform_charges = school.platform_charges; //MDR 2 charges
      const trustee_platform_charges = baseMdr.platform_charges; //Trustee base rate charges
      let paymentMode = payment_mode;
      if (
        platform_type === 'CreditCard' ||
        platform_type === 'DebitCard' ||
        platform_type === 'CORPORATE CARDS'
      ) {
        paymentMode = payment_mode.split(' ')[0];
      }

      const school_commission = await this.erpService.calculateCommissions(
        school_platform_charges,
        paymentMode,
        platform_type,
        order_amount,
      ); //MDR2 amount
      const trustee_base = await this.erpService.calculateCommissions(
        trustee_platform_charges,
        paymentMode,
        platform_type,
        order_amount,
      ); // trustee base rate amount

      const erpCommission = school_commission - trustee_base; // ERP/Trustee commission(MDR2-Trustee Base rate)
      // const edvCommission = trustee_base - cashfree_commission; // Edviron Earnings (Trustee base rate - cashfree Commission)
      const erpCommissionWithGST = erpCommission + erpCommission * 0.18;

      await new this.commissionModel({
        school_id,
        trustee_id,
        commission_amount: erpCommissionWithGST,
        payment_mode,
        platform_type,
        collect_id: new Types.ObjectId(collect_id),
      }).save(); // ERP Commission

      return {
        status: 'successful',
        msg: 'Commission and Earnings are Updated Successfully',
      };
    } catch (err) {
      throw new Error(err.message);
    }
  }

  @Get('school-info')
  async getSchoolInfo(@Body() body: { school_id: string; token: string }) {
    const { school_id, token } = body;
    const decrypted = this.jwtService.verify(token, {
      secret: process.env.PAYMENTS_SERVICE_SECRET,
    });
    if (decrypted.school_id !== school_id) {
      throw new UnauthorizedException('token forged');
    }

    const school = await this.trusteeSchoolModel.findOne({
      school_id: new Types.ObjectId(school_id),
    });

    return { school_name: school.school_name };
  }

  @Get('trustee-logo')
  async getTrusteeLogo(
    @Body() body: { token: string },
    @Query('trustee_id') trustee_id: string,
  ) {
    try {
      const trustee = await this.trusteeModel.findById(trustee_id);
      const decrypted = await this.jwtService.verify(body.token, {
        secret: process.env.PAYMENTS_SERVICE_SECRET,
      });
      if (decrypted.trustee_id !== trustee_id) {
        throw new UnauthorizedException('Unauthorized User');
      }
      if (!trustee) {
        throw new NotFoundException('trustee not found');
      }
      if (trustee.logo) {
        return { status: 'success', logo: trustee.logo };
      }

      return { status: 'failed' };
    } catch (e) {
      throw new Error(e.message);
    }
  }

  @Get('/test-corn')
  async checkSettlement(
  ){ const data = await this.erpService.easebuzzSettlements()

  }
}
