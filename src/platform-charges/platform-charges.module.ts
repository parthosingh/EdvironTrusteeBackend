import { Module } from '@nestjs/common';
import { PlatformChargesController } from './platform-charges.controller';
import { PlatformChargeService } from './platform-charges.service';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { SchoolSchema } from '../schema/school.schema';
import { TrusteeSchema } from '../schema/trustee.schema';
import { MainBackendService } from '../main-backend/main-backend.service';
import { TrusteeMemberSchema } from '../schema/partner.member.schema';
import { SchoolMdr, SchoolMdrSchema } from '../schema/school_mdr.schema';
import { RequestMDR, RequestMDRSchema } from '../schema/mdr.request.schema';
import { BaseMdr, BaseMdrSchema } from '../schema/base.mdr.schema';
import {
  SettlementReport,
  SettlementSchema,
} from '../schema/settlement.schema';
@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Trustee', schema: TrusteeSchema }]),
    MongooseModule.forFeature([
      { name: 'TrusteeMember', schema: TrusteeMemberSchema },
    ]),
    MongooseModule.forFeature([
      { name: 'TrusteeSchool', schema: SchoolSchema },
    ]),
    MongooseModule.forFeature([
      { name: SchoolMdr.name, schema: SchoolMdrSchema },
    ]),
    MongooseModule.forFeature([
      { name: RequestMDR.name, schema: RequestMDRSchema },
    ]),
    MongooseModule.forFeature([{ name: BaseMdr.name, schema: BaseMdrSchema }]),
    MongooseModule.forFeature([
      { name: SettlementReport.name, schema: SettlementSchema },
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
