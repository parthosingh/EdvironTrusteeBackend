import { Module } from '@nestjs/common';
import { SubTrusteeResolver } from './sub-trustee.resolver';
import { SubTrusteeService } from './sub-trustee.service';
import { SubTrusteeGuard } from './sub-trustee.guard';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { SubTrustee, SubTrusteeSchema } from 'src/schema/subTrustee.schema';
import { Trustee, TrusteeSchema } from 'src/schema/trustee.schema';
import { SettlementReport } from 'src/schema/settlement.schema';
import { TrusteeSchool } from 'src/schema/school.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SubTrustee.name, schema: SubTrusteeSchema },
    ]),
    MongooseModule.forFeature([
      { name: Trustee.name, schema: TrusteeSchema },
    ]),
    MongooseModule.forFeature([
      { name: SettlementReport.name, schema: SettlementReport },
    ]),
    MongooseModule.forFeature([
      { name: TrusteeSchool.name, schema: TrusteeSchool },
    ]),
     MongooseModule.forFeature([
      { name: SubTrustee.name, schema: SubTrusteeSchema },
    ]),
    JwtModule.registerAsync({
      useFactory: () => ({
        signOptions: { expiresIn: '30d' },
      }),
    }),
  ],
  providers: [SubTrusteeService, SubTrusteeResolver, SubTrusteeGuard, ],
  controllers: [],
})
export class SubTrusteeModule { }