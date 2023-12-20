import { Resolver, Mutation, Args, Query, Int, Context } from '@nestjs/graphql';
import { TrusteeService } from './trustee.service';
import { UnauthorizedException, ConflictException, BadRequestException, UseGuards } from '@nestjs/common';
import { ObjectType, Field } from '@nestjs/graphql';
import { TrusteeSchool } from '../schema/school.schema';
import { TrusteeGuard } from './trustee.guard';


@Resolver('Trustee')
export class TrusteeResolver {
  constructor(private readonly trusteeService: TrusteeService) { }

  @Mutation(() => AuthResponse) // Use the AuthResponse type
  async loginTrustee(
    @Args('email') email_id: string,
    @Args('password') password_hash: string
  ): Promise<AuthResponse> {
    try {
      const { token } = await this.trusteeService.loginAndGenerateToken(email_id, password_hash);
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
    @Context() context
  ): Promise<SchoolTokenResponse> {
    try {
      const userId = context.req.trustee;
      const { token, user } = await this.trusteeService.generateSchoolToken(schoolId, password, userId);
      return { token, user };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw new Error('Invalid email or password');
      } else {
        throw new Error('Error generating school token');
      }
    }
  }

  @Query(() => [TrusteeSchool])
  @UseGuards(TrusteeGuard)
  async getSchoolQuery(
    @Args('limit', { type: () => Int, defaultValue: 5 }) limit: number,
    @Args('offset', { type: () => Int, defaultValue: 0 }) offset: number,
    @Context() context
  ): Promise<any[]> {
    try {
      const id = context.req.trustee;
      const schools = await this.trusteeService.getSchools(id, limit, offset);

      return schools;
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