import { Module } from '@nestjs/common';
import { PlatformChargesController } from './platform-charges.controller';
import { PlatformChargeService } from './platform-charges.service';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { SchoolSchema } from '../schema/school.schema';
import { TrusteeSchema } from '../schema/trustee.schema';
import { MainBackendService } from '../main-backend/main-backend.service';
import { TrusteeMemberSchema } from '../schema/partner.member.schema';
@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Trustee', schema: TrusteeSchema }]),
    MongooseModule.forFeature([
      { name: 'TrusteeMember', schema: TrusteeMemberSchema },
    ]),
    MongooseModule.forFeature([
      { name: 'TrusteeSchool', schema: SchoolSchema },
    ]),
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET_FOR_INTRANET,
        signOptions: { expiresIn: '1h' },
      }),
    }),
  ],
  providers: [PlatformChargeService, MainBackendService],
  controllers: [PlatformChargesController],
})
export class PlatformChargesModule {}
