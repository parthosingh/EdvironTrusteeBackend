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
import { Commission, CommissionSchema } from 'src/schema/commission.schema';
import { Earnings, EarningsSchema } from 'src/schema/earnings.schema';
import { CashfreeModule } from '../cashfree/cashfree.module';
import { CashfreeService } from '../cashfree/cashfree.service';

@Module({
  imports: [
    CashfreeModule,
    MongooseModule.forFeature([{ name: 'Trustee', schema: TrusteeSchema }]),
    MongooseModule.forFeature([
      { name: 'TrusteeSchool', schema: SchoolSchema },
    ]),
    MongooseModule.forFeature([
      { name: Commission.name, schema: CommissionSchema },
    ]),
    MongooseModule.forFeature([
      { name: Earnings.name, schema: EarningsSchema },
    ]),
    MongooseModule.forFeature([
      { name: BaseMdr.name, schema: BaseMdrSchema },
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
  providers: [ErpService, CashfreeService],
  controllers: [ErpController],
})
export class ErpModule {}
