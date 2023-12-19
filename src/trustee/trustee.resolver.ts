import { Resolver, Mutation, Args, Query, Int } from '@nestjs/graphql';
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
