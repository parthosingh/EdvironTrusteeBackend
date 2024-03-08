import { Resolver, Mutation, Args, Query, Int, Context } from '@nestjs/graphql';
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
import { SettlementReport } from 'src/schema/settlement.schema';

@Resolver('Trustee')
export class TrusteeResolver {
  constructor(
    private readonly trusteeService: TrusteeService,
    private readonly erpService: ErpService,
    private mainBackendService: MainBackendService,
    @InjectModel(TrusteeSchool.name)
    private trusteeSchoolModel: mongoose.Model<TrusteeSchool>,
    @InjectModel(SettlementReport.name)
    private settlementReportModel: mongoose.Model<SettlementReport>
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

  @Mutation(()=>pg_key)
  @UseGuards(TrusteeGuard)
  async resetKey(
    @Context() context,
    @Args('school_id') school_id: string
    ){
      const trusteeId = context.req.trustee
      const schoolId=new Types.ObjectId(school_id)
      const school = await this.trusteeSchoolModel.findOne({
        trustee_id:trusteeId,
        school_id:schoolId
      })
      const pg_key=await this.mainBackendService.generateKey()
      school.pg_key=pg_key
      await school.save()
      return {pg_key} 
      
  }

  @Query(() => [SettlementReport])
  @UseGuards(TrusteeGuard)
  async getSettlementReports( @Context() context,@Args('schoolId') schoolId: string) {

    const merchant = await this.trusteeSchoolModel.findOne({ school_id: new Types.ObjectId(schoolId)});
    
    const client_id = merchant?.client_id;
    if (!client_id) {
      throw new Error('PG not enabled for this school');
    }
    let settlementReports = [];
    settlementReports = await this.settlementReportModel.find({trustee:new Types.ObjectId(context.req.trustee)});
    return settlementReports;
  }
}

// Define a type for the AuthResponse
@ObjectType()
class AuthResponse {
  @Field(() => String)
  token: string;
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
class pg_key{
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
