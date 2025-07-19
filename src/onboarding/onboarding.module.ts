import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { OnboardingResolver } from './onboarding.resolver';
import { Trustee, TrusteeSchema } from '../schema/trustee.schema';
import {
  TrusteeMember,
  TrusteeMemberSchema,
} from '../schema/partner.member.schema';
import { OnboarderERP, OnboarderERPSchema } from '../schema/onboarder.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OnboarderERP.name, schema: OnboarderERPSchema },
    ]),
    MongooseModule.forFeature([{ name: Trustee.name, schema: TrusteeSchema }]),
    MongooseModule.forFeature([
      { name: TrusteeMember.name, schema: TrusteeMemberSchema },
    ]),
  ],
  controllers: [OnboardingController],
  providers: [OnboardingService, OnboardingResolver],
})
export class OnboardingModule {}
