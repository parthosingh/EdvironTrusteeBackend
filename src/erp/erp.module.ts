import { Module } from '@nestjs/common';
import { ErpService } from './erp.service';
import { ErpController } from './erp.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { TrusteeSchema } from '../schema/trustee.schema';
import { SchoolSchema } from '../schema/school.schema';
import { JwtModule } from '@nestjs/jwt';
import { SettlementSchema } from '../schema/settlement.schema';
import { BaseMdr, BaseMdrSchema } from 'src/schema/base.mdr.schema';
import { SchoolMdr, SchoolMdrSchema } from 'src/schema/school_mdr.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Trustee', schema: TrusteeSchema }]),
    MongooseModule.forFeature([
      { name: 'TrusteeSchool', schema: SchoolSchema },
    ]),
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET_FOR_API_KEY,
        signOptions: { expiresIn: '2h' },
      }),
    }),
    MongooseModule.forFeature([
      { name: 'SettlementReport', schema: SettlementSchema },
    ]),
    MongooseModule.forFeature([{ name: BaseMdr.name, schema: BaseMdrSchema }]),
    MongooseModule.forFeature([
      { name: SchoolMdr.name, schema: SchoolMdrSchema },
    ]),
  ],
  providers: [ErpService],
  controllers: [ErpController],
})
export class ErpModule {}
