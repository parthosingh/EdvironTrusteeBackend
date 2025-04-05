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
  Req,
  Res,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MainBackendService } from './main-backend.service';
import { JwtPayload } from 'jsonwebtoken';
import { Trustee } from '../schema/trustee.schema';
import mongoose, { Types } from 'mongoose';
import { TrusteeService } from '../trustee/trustee.service';
import { InjectModel } from '@nestjs/mongoose';
import { RequestMDR } from '../schema/mdr.request.schema';
import { SchoolMdrInfo } from '../trustee/trustee.resolver';
import { bank_Details, TrusteeSchool } from '../schema/school.schema';
import { refund_status, RefundRequest } from '../schema/refund.schema';
import { Parser } from 'json2csv';
import { Response } from 'express';
import axios from 'axios';
import { Invoice, invoice_status } from '../schema/invoice.schema';
import { Args } from '@nestjs/graphql';
import { EmailService } from '../email/email.service';
import { sendQueryErrortemplate } from '../email/templates/error.template';

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
    @InjectModel(Invoice.name)
    private readonly invoiceModel: mongoose.Model<Invoice>,
    private readonly emailService: EmailService,
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
        paginationInfo.search,
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

  @Post('enable-pg')
  async enablePgAndSendEmail(@Args('school_id') school_id: string) {
    const data = await this.mainBackendService.enablePgAndSendEmail(school_id);
    await this.emailService.sendEnablePgInfo(data);
    return data;
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

  @Get('/get-invoices')
  async getInvoices(
    @Query('trustee_id') trustee_id: string,
    @Query('token') token: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    const trustee = await this.trusteeModel.findById(trustee_id);
    if (!trustee) {
      throw new NotFoundException('Trustee not found');
    }
    const skip = (page - 1) * limit;
    const invoices = await this.invoiceModel
      .find({ trustee_id: trustee._id })
      .skip(skip)
      .limit(limit);

    const totalInvoices = await this.invoiceModel.countDocuments({
      trustee_id: trustee._id,
    });

    return {
      invoices,
      totalInvoices,
      currentPage: page,
      totalPages: Math.ceil(totalInvoices / limit),
    };
  }

  @Post('/update-invoice-status')
  async updateInvoice(
    @Query('token') token: string,
    @Query('invoice_id') invoice_id: string,
    @Query('status') status: invoice_status,
  ) {
    // const decodedPayload = await this.jwtService.verify(token, {
    //   secret: process.env.JWT_SECRET_FOR_INTRANET,
    // });
    // if (!decodedPayload) {
    //   throw new BadRequestException('Invalid token');
    // }

    console.log(invoice_id);

    const invoice = await this.invoiceModel.findById(invoice_id);
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    invoice.invoice_status = status;
    await invoice.save();
    return `Invoice status updated to ${status}`;
  }

  @Get('school-mdr-csv')
  async downloadCsv(
    @Res() res: Response,
    @Query('school_id') school_id: string,
  ) {
    console.log(school_id);

    const trusteeSchool = await this.trusteeSchoolModel.findOne({
      school_id: new Types.ObjectId(school_id),
    });
    if (!trusteeSchool) {
      throw new NotFoundException('Trustee School not found');
    }
    if (!trusteeSchool.pg_key) {
      throw new BadRequestException('PG Key not found');
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

    const fields = ['Platform Type', 'Payment Mode', 'Upto', 'Charge'];
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(csvData);

    res.header('Content-Type', 'text/csv');
    res.attachment(`${trusteeSchool.school_name}_platform_charges.csv`);
    return res.send(csv);
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

  @Get('get-school')
  async getSchool(@Query('token') token: string) {
    try {
      const decodedPayload = await this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
      });
      const school = await this.mainBackendService.getSchool(
        decodedPayload.school_id,
      );
      if (school) {
        return true;
      }
      return false;
    } catch (e) {
      console.log(e.message);
      return false;
    }
  }

  @Get('get-school-data')
  async getSchoolData(@Query('token') token: string) {
    try {
      const decodedPayload = await this.jwtService.verify(token, {
        secret: process.env.PAYMENTS_SERVICE_SECRET,
      });
      const school = await this.mainBackendService.getSchool(
        decodedPayload.school_id,
      );
      if (!school) {
        throw new NotFoundException('School not found');
      }
      return {
        email: school.email,
      };
    } catch (e) {
      console.log(e.message);
      throw new BadRequestException(e.message);
    }
  }

  @Post('update-refund-status')
  async updateRefundStatus(@Query('token') token: string) {
    const decodedPayload = await this.jwtService.verify(token, {
      secret: process.env.PAYMENTS_SERVICE_SECRET,
    });

    const refundId = decodedPayload.refund_id;
    const refundRequest = await this.refundRequestModel.findById(refundId);
    if (!refundRequest) {
      throw new NotFoundException('Refund Request not found');
    }
    refundRequest.status = refund_status.PROCESSING;
    refundRequest.save();
    return 'status updated successfully';
  }

  @Get('get-vendor-list')
  async getVendorList(
    @Query('token') token: string,
    @Query('page_number') page_number: number,
    @Query('page_size') page_size: number,
    @Query('trustee_id') trustee_id: string,
  ) {
    try {
      const decodedPayload = await this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
      });

      if (
        decodedPayload.trustee_id !== trustee_id ||
        decodedPayload.page_number !== Number(page_number) ||
        decodedPayload.page_size !== Number(page_size)
      ) {
        throw new BadRequestException('Invalid Token');
      }

      const vendors = await this.trusteeService.getAllVendors(
        trustee_id,
        page_number,
        page_size,
      );
      return vendors;
    } catch (e) {
      console.log(e.message);
      throw new BadRequestException(e.message);
    }
  }

  @Post('/approve-vendor')
  async approveVendor(
    @Body()
    body: {
      vendor_id: string;
      trustee_id: string;
      school_id: string;
      token: string;
    },
  ) {
    try {
      const decodedPayload = await this.jwtService.verify(body.token, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
      });

      if (
        decodedPayload.trustee_id !== body.trustee_id ||
        decodedPayload.school_id !== body.school_id
      ) {
        throw new BadRequestException('Invalid Token');
      }

      const vendors = await this.trusteeService.getVenodrInfo(
        body.vendor_id,
        body.school_id,
      );

      const vendor_info = {
        vendor_id: body.vendor_id,
        status: 'ACTIVE',
        name: vendors.name,
        email: vendors.email,
        phone: vendors.phone,
        verify_account: true,
        dashboard_access: true,
        schedule_option: vendors.schedule_option || 3,
        bank: {
          account_number: vendors.bank_details.account_number,
          account_holder: vendors.bank_details.account_holder,
          ifsc: vendors.bank_details.ifsc,
        },
        kyc_details: vendors.kyc_info,
      };

      return this.trusteeService.approveVendor(
        vendor_info,
        body.trustee_id,
        body.school_id,
      );
    } catch (e) {
      // console.log(e.message, 'error sending');
      throw new BadRequestException(e.message);
    }
  }

  @Post('initiate-auto-refund')
  async initiateAutoRefund(
    @Body()
    body: {
      refund_amount: number;
      collect_id: string;
      school_id: string;
      trustee_id: string;
      custom_id: string;
      gateway: string;
      reason: string;
    },
  ) {
    const {
      refund_amount,
      collect_id,
      school_id,
      trustee_id,
      custom_id,
      gateway,
      reason,
    } = body;
    try {
      const school = await this.trusteeSchoolModel.findOne({school_id:new Types.ObjectId(school_id)})
      if (!school) {
        throw new NotFoundException('School not found');
      }
      const checkrefund=await this.refundRequestModel.findOne({ order_id: new Types.ObjectId(collect_id)})
      if(checkrefund){
        throw new BadRequestException('Refund request already initiated for this order');
      }
      const refunds = await this.refundRequestModel.create({
        trustee_id: new Types.ObjectId(trustee_id),
        school_id: new Types.ObjectId(school_id),
        order_id: new Types.ObjectId(collect_id),
        status: refund_status.INITIATED,
        refund_amount,
        order_amount: refund_amount,
        transaction_amount: refund_amount,
        reason,
        gateway,
        custom_id,
        isAutoRedund:true,
      });
      // mail for autorefund
      this.emailService.sendAutoRefundInitiatedAlert(
        school.school_name,
        refunds._id.toString(),
        refund_amount,
        collect_id
      );
      return refunds;
    } catch (e) {
      throw new BadRequestException(e.message);
    }
  }

  @Get('get-refund-info')
  async getRefundInfo(
    @Query('refund_id') refund_id: string,
    @Query('token') token: string,
  ) {
    try {
      const refund = await this.refundRequestModel.findById(refund_id);
      if (!refund) {
        throw new NotFoundException('refund not found');
      }
      return refund;
    } catch (e) {}
  }

  @Post('get-settlement-reco')
  async getSettlementReco(
    @Body()
    body: {
      trustee_id: string;
      settlement_date: string;
      transaction_start_date: string;
      transaction_end_date: string;
    },
  ) {
    const {
      transaction_start_date,
      transaction_end_date,
      trustee_id,
      settlement_date,
    } = body;
    const schools = await this.trusteeSchoolModel.find({
      trustee_id: new Types.ObjectId(body.trustee_id),
    });

    let failure: any[] = [];
    let success: any[] = [];

    for (const school of schools) {
      if (school.pg_key) {
        const settlementRecon = await this.mainBackendService.settlementRecon(
          school.school_id.toString(),
          settlement_date,
          transaction_start_date,
          transaction_end_date,
          trustee_id,
          school.school_name,
        );

        if (settlementRecon.missMatched) {
          failure.push(settlementRecon);
        } else {
          success.push(settlementRecon);
        }
      }
    }
    return { success, failure };
  }

  @Post('get-settlement-reco2')
  async getSettlementReco2(
    @Body()
    body: {
      trustee_id: string;
      school_id: string;
      settlement_date: string;
      transaction_start_date: string;
      transaction_end_date: string;
    },
  ) {
    const {
      transaction_start_date,
      transaction_end_date,
      trustee_id,
      settlement_date,
      school_id,
    } = body;
    const school = await this.trusteeSchoolModel.find({
      school_id: new Types.ObjectId(school_id),
    });
    if (!school) {
      throw new BadRequestException('Invalid Trustee ID');
    }
    let failure: any[] = [];
    let success: any[] = [];

    const settlementRecon = await this.mainBackendService.settlementRecon(
      school_id,
      settlement_date,
      transaction_start_date,
      transaction_end_date,
      trustee_id,
      'school.',
    );

    if (settlementRecon.missMatched) {
      failure.push(settlementRecon);
    } else {
      success.push(settlementRecon);
    }

    return { success, failure };
  }

  @Post('get-vendors-transactions-settlement')
  async getVendorsTransactionsSettlement(@Body() body: { collect_id: string }) {
    return await this.trusteeService.vendorSettlementInfo(body.collect_id);
  }

  @Post('test-alram')
  async testAlarm(
    @Body()
    body: {
      trustee_id: string;
      school_id: string;
      token: string;
      startDate: string;
      endDate: string;
    },
  ) {
    const { startDate, endDate, token, trustee_id, school_id } = body;
    return this.mainBackendService.checkTransactionDataAlram(
      startDate,
      endDate,
      school_id,
      trustee_id,
    );
  }

  @Post('send-queryError-mail')
  async sendError(
    @Body()
    body: {
      queryName: string;
      error: string;
      message: string;
      timestamp: string;
      token?: string;
      merchantToken?: string;
    },
  ): Promise<any> {
    const { queryName, error, message, token, merchantToken, timestamp } = body;
    let trustee, merchant;
    if (token) {
      trustee = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET_FOR_TRUSTEE_AUTH,
      });
    }
    if (merchantToken) {
      merchant = this.jwtService.verify(merchantToken, {
        secret: process.env.JWT_SECRET_FOR_MERCHANT_AUTH,
      });
    }
    const user = merchant ? merchant : trustee;
 
    const debounceKey = `sendError-${queryName}-${user.id}`;
    const existingRequest =
      await this.mainBackendService.getDebounceRequest(debounceKey);

    if (existingRequest) {
      throw new BadRequestException(
        'Please wait before sending another request.',
      );
    }

    await this.mainBackendService.saveDebounceRequest(debounceKey, 15000);

    const mailSub = `Query Error: ${queryName}`;
    const mailTemp = sendQueryErrortemplate(
      queryName,
      error,
      message,
      timestamp,
      user,
    );
    this.emailService.sendErrorMail(mailSub, mailTemp);
    return `An alert email has been sent to developer team.`;
  }

  @Post('update-school-info')
  async updateSchoolInfo(
    @Body()
    body: { school_id: string; residence_state: string; bank_details: bank_Details; gstIn: string },
  ): Promise<any> {
    try {
     

      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(body.school_id),
      });

      if (!school) {
        throw new NotFoundException('School not found');
      }

      school.residence_state = body.residence_state;
      school.bank_details = body.bank_details;
      school.gstIn = body.gstIn;

      await school.save();

      return {
        message: 'School information updated successfully',
        school,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}
