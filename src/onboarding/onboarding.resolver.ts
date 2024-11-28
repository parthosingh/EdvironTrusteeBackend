import {
  Args,
  Context,
  Field,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { OnboardingGuard } from './onboarding.guard';
import { OnboarderERP } from 'src/schema/onboarder.schema';
import { OnboardingService } from './onboarding.service';
import { InjectModel } from '@nestjs/mongoose';
import { bankDetails, Trustee } from 'src/schema/trustee.schema';
import mongoose from 'mongoose';
import { BaseMdr } from 'src/schema/base.mdr.schema';

@Resolver()
export class OnboardingResolver {
  constructor(
    private readonly onboardingService: OnboardingService,
    @InjectModel(Trustee.name)
    private trusteeModel: mongoose.Model<Trustee>,
  ) {}
  @Query(() => OnboarderInfo)
  @UseGuards(OnboardingGuard)
  async getOnboarder(@Context() context: any) {
    const id = context.req.user.toString();
    return await this.onboardingService.getOnboarder(id);
  }

  @UseGuards(OnboardingGuard)
  @Mutation(() => String)
  async onboarderCreateTrustee(
    @Args('name') name: string,
    @Args('email') email: string,
    @Args('password') password: string,
    @Args('phone_number') phone_number: string,
    @Context() context: any,
  ) {
    const id = context.req.user;
    const info = {
      name,
      email,
      password,
      phone_number,
      onboarder: id.toString(),
    };
    return await this.onboardingService.createTrustee(info);
  }

  @Mutation(() => token)
  async loginOnboarder(
    @Args('email') email: string,
    @Args('password') password: string,
  ) {
    return await this.onboardingService.loginOnboarder(email, password);
  }

  @UseGuards(OnboardingGuard)
  @Query(() => [OnboarderTrusteeList])
  async getOnboarderTrustee(@Context() context: any) {
    const id = context.req.user.toString();
    return await this.onboardingService.getOnboardersTrustee(id);
  }
}

@ObjectType()
class OnboarderInfo {
  @Field({ nullable: true })
  name: string;

  @Field({ nullable: true })
  email_id: string;

  @Field({ nullable: true })
  phone_number: string;

  @Field({ nullable: true })
  head_trustee: string;

  @Field({ nullable: true })
  brand_name: string;

  @Field({ nullable: true })
  logo: string;

  @Field({ nullable: true })
  _id: string;
}

@ObjectType()
class OnboarderTrusteeList {
  @Field({ nullable: true })
  _id: string;
  @Field({ nullable: true })
  name: string;
  @Field({ nullable: true })
  email_id: string;
  @Field({ nullable: true })
  apiKey: string;
  @Field({ nullable: true })
  role: string;
  @Field({ nullable: true })
  phone_number: string;
  @Field({ nullable: true })
  trustee_id: string;
  @Field({ nullable: true })
  brand_name: string;
  @Field({ nullable: true })
  base_mdr: BaseMdr;
  @Field({ nullable: true })
  gstIn: string;
  @Field({ nullable: true })
  residence_state: string;
  @Field({ nullable: true })
  bank_details: bankDetails;
}

@ObjectType()
class token {
  @Field()
  token: string;
}
