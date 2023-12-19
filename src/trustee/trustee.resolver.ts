import { Resolver, Mutation, Args, Query, Int, ObjectType, Field  } from '@nestjs/graphql';
import { TrusteeService } from './trustee.service';
import { UnauthorizedException,ConflictException, BadRequestException, UseGuards } from '@nestjs/common';
import { ObjectType, Field } from '@nestjs/graphql';
import { TrusteeSchool } from './schema/school.schema';

@Resolver('Trustee')
export class TrusteeResolver {
  constructor(private readonly trusteeService: TrusteeService) {}

  @Query(() => String)
  async hello(): Promise<string> {
    return 'Hello, World!!!';
  }

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
  async generateSchoolToken(
    @Args('schoolId') schoolId: string,
    @Args('password') password: string
  ): Promise<SchoolTokenResponse> {
    try {
      const userId = '657c8eb0de948adeb738b0f5'; // For testing purposes
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
  async getSchoolQuery(
    @Args('trustee_id') id: string,
    @Args('limit', { type: () => Int, defaultValue: 5 }) limit: number,
    @Args('offset', { type: () => Int, defaultValue: 0 }) offset: number,
  ): Promise<any[]> {
    try {
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





// Define a type for the AuthResponse

@ObjectType()
class AuthResponse {
  @Field(() => String)
  token: string;
}
