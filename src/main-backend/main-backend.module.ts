import { Module } from '@nestjs/common';
import { MainBackendService } from './main-backend.service';
import { MainBackendController } from './main-backend.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { TrusteeSchema } from '../schema/trustee.schema';
import { SchoolSchema } from '../schema/school.schema';
import { TrusteeService } from '../trustee/trustee.service';
import { TrusteeMemberSchema } from '../schema/partner.member.schema';
import { EmailService } from '../email/email.service';
import { RequestMDR, RequestMDRSchema } from '../schema/mdr.request.schema';
import { BaseMdr, BaseMdrSchema } from '../schema/base.mdr.schema';
import { SchoolMdr, SchoolMdrSchema } from 'src/schema/school_mdr.schema';

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
      { name: RequestMDR.name, schema: RequestMDRSchema },
    ]),
    MongooseModule.forFeature([{ name: BaseMdr.name, schema: BaseMdrSchema }]),
    MongooseModule.forFeature([
      { name: SchoolMdr.name, schema: SchoolMdrSchema },
    ]),
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET_FOR_INTRANET,
        signOptions: { expiresIn: '1h' },
      }),
    }),
  ],
  providers: [MainBackendService, TrusteeService, EmailService],
  controllers: [MainBackendController],
})
export class MainBackendModule {}
