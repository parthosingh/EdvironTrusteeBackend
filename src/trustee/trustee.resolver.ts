import { Resolver, Mutation, Args, Query, Int, Context, InputType } from '@nestjs/graphql';
import { TrusteeService } from './trustee.service';
import {
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ObjectType, Field } from '@nestjs/graphql';
import { TrusteeSchool } from '../schema/school.schema';
import { TrusteeGuard } from './trustee.guard';
import { ErpService } from '../erp/erp.service';
import mongoose, { Types } from 'mongoose';
import { MainBackendService } from '../main-backend/main-backend.service';
import { InjectModel } from '@nestjs/mongoose';
import { SettlementReport } from '../schema/settlement.schema';
import { JwtService } from '@nestjs/jwt';
import axios from 'axios';

@Resolver('Trustee')
export class TrusteeResolver {
  constructor(
    private readonly trusteeService: TrusteeService,
    private readonly erpService: ErpService,
    private mainBackendService: MainBackendService,
    private readonly jwtService: JwtService,
    @InjectModel(TrusteeSchool.name)
    private trusteeSchoolModel: mongoose.Model<TrusteeSchool>,
    @InjectModel(SettlementReport.name)
    private settlementReportModel: mongoose.Model<SettlementReport>,
    

  ) {}

  @Mutation(() => AuthResponse) // Use the AuthResponse type
  async loginTrustee(
    @Args('email') email_id: string,
    @Args('password') password_hash: string,
  ): Promise<AuthResponse> {
    try {
      const { token } = await this.trusteeService.loginAndGenerateToken(
        email_id,
        password_hash,
      );

      return { token };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw new Error('Invalid email or password');
      } else {
        throw new Error('An error occurred during login');
      }
    }
  }

  @Mutation(() => SchoolTokenResponse)
  @UseGuards(TrusteeGuard)
  async generateSchoolToken(
    @Args('schoolId') schoolId: string,
    @Args('password') password: string,
    @Context() context,
  ): Promise<SchoolTokenResponse> {
    try {
      const userId = context.req.trustee;
      const { token, user } = await this.trusteeService.generateSchoolToken(
        schoolId,
        password,
        userId,
      );
      return { token, user };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw new Error('Invalid password');
      } else if (error instanceof NotFoundException) {
        throw error;
      } else {
        throw new Error('Error generating school token');
      }
    }
  }

  @Query(() => getSchool)
  @UseGuards(TrusteeGuard)
  async getSchoolQuery(
    @Args('page', { type: () => Int, defaultValue: 1 }) page: number,
    @Context() context,
  ): Promise<any> {
    try {
      const id = context.req.trustee;
      const schools = await this.trusteeService.getSchools(id, page);
      return {
        schools: schools.schoolData,
        total_pages: schools.total_pages,
        page: page,
      };
    } catch (error) {
      const customError = {
        message: error.message,
        statusCode: error.status,
      };
      if (error instanceof ConflictException) {
        throw new ConflictException(customError);
      } else {
        throw new BadRequestException(customError);
      }
    }
  }
  @Mutation(() => ApiKey)
  @UseGuards(TrusteeGuard)
  async createApiKey(@Context() context): Promise<ApiKey> {
    try {
      const id = context.req.trustee;
      const apiKey = await this.erpService.createApiKey(id);
      return { key: apiKey };
    } catch (error) {
      const customError = {
        message: error.message,
        statusCode: error.status,
      };
      if (error instanceof NotFoundException) {
        throw new NotFoundException(customError);
      } else {
        throw new BadRequestException(customError);
      }
    }
  }

  @Query(() => TrusteeUser)
  async getUserQuery(@Context() context): Promise<TrusteeUser> {
    try {
      const token = context.req.headers.authorization.split(' ')[1]; // Extract the token from the authorization header
      const userTrustee = await this.trusteeService.validateTrustee(token);
      // Map the trustee data to the User type
      const user: TrusteeUser = {
        _id: userTrustee.id,
        name: userTrustee.name,
        email_id: userTrustee.email,
        apiKey: userTrustee.apiKey,
      };
      return user;
    } catch (error) {
      const customError = {
        message: error.message,
        statusCode: error.status,
      };
      if (error instanceof ConflictException) {
        throw new ConflictException(customError);
      } else {
        throw new BadRequestException(customError);
      }
    }
  }

  @Mutation(() => pg_key)
  @UseGuards(TrusteeGuard)
  async resetKey(@Context() context, @Args('school_id') school_id: string) {
    const trusteeId = context.req.trustee;
    const schoolId = new Types.ObjectId(school_id);
    const school = await this.trusteeSchoolModel.findOne({
      trustee_id: trusteeId,
      school_id: schoolId,
    });
    const pg_key = await this.mainBackendService.generateKey();
    school.pg_key = pg_key;
    await school.save();
    return { pg_key };
  }


  @Mutation(() => String)
  async sentKycInvite(
    @Args('school_name') school_name: string,
    @Args('school_id') school_id: string,
  ) {
    const payload = {
      school_name,
      school_id,
    };

    const token = await this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET_FOR_INTRANET,
    });
    await axios.post(
      `${process.env.MAIN_BACKEND_URL}/api/trustee/sentkycinvite`,
      {
        token: token,
      },
    );
    return 'kyc invite sent';
  }

  @Query(() => [SettlementReport])
  @UseGuards(TrusteeGuard)
  async getSettlementReports( @Context() context) {
    let settlementReports = [];
    settlementReports = await this.settlementReportModel.find({trustee:new Types.ObjectId(context.req.trustee)});
    return settlementReports;
  }
  
  @Query(()=>[TransactionReport])
  @UseGuards(TrusteeGuard)
  async getTransactionReport(@Context() context) {
    try {
      const merchants = await this.trusteeSchoolModel.find({ trustee_id: new Types.ObjectId(context.req.trustee) });
      let transactionReport = [];
  
      for (const merchant of merchants) {
        if (!merchant.client_id) continue;
        
        console.log(`Getting report for ${merchant.merchantName}(${merchant.client_id})`);
  
        const axios = require('axios');
        let token = this.jwtService.sign({ client_id: merchant.client_id }, { secret: process.env.PAYMENTS_SERVICE_SECRET });
        
        let config = {
          method: 'post',
          maxBodyLength: Infinity,
          url: 'http://localhost:4001/edviron-pg/transactions-report',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
          },
          data: { client_id: merchant.client_id, token },
        };
  
        const response = await axios.request(config);
        
        if (response.data.length > 0 && response.data !== 'No orders found for clientId') {
          const modifiedResponseData = response.data.map(item => ({
            ...item,
            school_name: merchant.school_name,
            school_id:merchant.school_id
          }));
          transactionReport.push(...modifiedResponseData);
        }
      }
      
      return transactionReport;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }
  

  @Query(()=>[School])
  @UseGuards(TrusteeGuard)
  async getAllSchoolQuery(
    @Context() context,
  ): Promise<any> {
    try {
      const id = context.req.trustee;
      return await this.trusteeSchoolModel.find({trustee_id:context.req.trustee})
    } catch (error) {
     throw error
    }
  }

  @Mutation(()=>verifyRes)
  async resetMails(@Args('email') email:string){
    await this.trusteeService.sentResetMail(email)
    return {active:true}
  }
 
  @Mutation(()=>resetPassResponse)
  async resetPassword(
    @Args('email') email:string,
    @Args('password') password:string
    
    ){
    await this.trusteeService.restetPassword(email,password)
    return {msg:`Password Change`}
  }

  @Query(()=>verifyRes)
  async verifyToken(
    @Args('token') token:string
  ){
    const res=await this.trusteeService.verifyresetToken(token)
    return {active:res}
  }

  

}



// Define a type for the AuthResponse
@ObjectType()
class AuthResponse {
  @Field(() => String)
  token: string;
}

@ObjectType()
class resetPassResponse{
  @Field()
  msg:string
}
@ObjectType()
class verifyRes{
  @Field()
  active:boolean
}

// Define a type for school token response
@ObjectType()
class User {
  @Field()
  _id: string;
  @Field()
  name: string;
  @Field()
  phone_number: string;
  @Field()
  email_id: string;
  @Field()
  access: string;
  @Field()
  school_id: string;
}

@ObjectType()
class SchoolTokenResponse {
  @Field()
  token: string;

  @Field(() => User)
  user: User;
}

// Define a type for the User
@ObjectType()
class TrusteeUser {
  @Field()
  _id: string;
  @Field()
  name: string;
  @Field()
  email_id: string;
  @Field({ nullable: true })
  apiKey: string;
}

@ObjectType()
class pg_key {
  @Field()
  pg_key: string;
}

@ObjectType()
class ApiKey {
  @Field()
  key: string;
}

@ObjectType()
class School {
  @Field()
  school_name: string;

  @Field()
  school_id: string;

  @Field(() => String, { nullable: true })
  pg_key: string;
}

@ObjectType()
class getSchool {
  @Field(() => [School])
  schools: [School];
  @Field()
  total_pages: number;
  @Field()
  page: number;
}

@ObjectType()
class TransactionReport{
  @Field({nullable:true})
  collect_id: string;
  @Field({nullable:true})
  updatedAt: string;
  @Field({nullable:true})
  order_amount: number;
  @Field({nullable:true})
  transaction_amount: number;
  @Field({nullable:true})
  payment_method: string
  @Field({nullable:true})
  school_name: string
  @Field({nullable:true})
  school_id:string
  @Field({nullable:true})
  status:string
}