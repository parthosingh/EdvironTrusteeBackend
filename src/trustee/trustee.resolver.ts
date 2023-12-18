import { Resolver, Mutation, Args, Query } from '@nestjs/graphql';
import { TrusteeService } from './trustee.service';
import { UnauthorizedException, UseGuards } from '@nestjs/common';
import { ObjectType, Field } from '@nestjs/graphql';

@Resolver('Trustee')
export class TrusteeResolver {
  constructor(private readonly trusteeService: TrusteeService) {}

  @Query(() => String)
  async hello(): Promise<string> {
    return 'Hello, World!!!';
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
}


// Define a type for the AuthResponse
@ObjectType()
class AuthResponse {
  @Field(() => String)
  trusteeId: string;

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

  // Other fields related to school token response...
}