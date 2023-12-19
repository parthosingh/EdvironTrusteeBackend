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
}


// Define a type for the AuthResponse

@ObjectType()
class AuthResponse {
  @Field(() => String)
  token: string;
}


// {
//   "query": "mutation($email: String!, $password: String!) { loginTrustee(email: $email, password: $password) }",
//   "variables": {
//     "email": "testaccount@testgmail.com",
//     "password": "123"
//   }
// }