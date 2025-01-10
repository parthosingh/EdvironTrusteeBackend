import { Module } from '@nestjs/common';
// import { MerchantResolver } from './merchant.resolver';
import { MongooseModule } from '@nestjs/mongoose';
import { SchoolSchema } from 'src/schema/school.schema';
import { JwtModule } from '@nestjs/jwt';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver } from '@nestjs/apollo';
import { SettlementSchema } from 'src/schema/settlement.schema';
// import { MerchantService } from './merchant.service';
import { TrusteeService } from 'src/trustee/trustee.service';
import { TrusteeSchema } from 'src/schema/trustee.schema';
import { MerchantGuard } from './merchant.guard';
import { MerchantResolver } from './merchant.resolver';
import { MerchantService } from './merchant.service';
import { MerchantMemberSchema } from 'src/schema/merchant.member.schema';
import { EmailService } from 'src/email/email.service';
import { TrusteeMemberSchema } from 'src/schema/partner.member.schema';
import { TransactionInfoSchema } from 'src/schema/transaction.info.schema';
import { RequestMDR, RequestMDRSchema } from 'src/schema/mdr.request.schema';
import { SchoolMdr, SchoolMdrSchema } from 'src/schema/school_mdr.schema';
import { BaseMdr, BaseMdrSchema } from 'src/schema/base.mdr.schema';
import { RefundRequest, RefundRequestSchema } from 'src/schema/refund.schema';
import { Vendors, VendorsSchema } from 'src/schema/vendors.schema';
import { AwsS3Service } from 'src/aws.s3/aws.s3.service';
import { VendorsSettlement, VendorsSettlementSchema } from 'src/schema/vendor.settlements.schema';
import { Disputes, DisputesSchema } from 'src/schema/disputes.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'TrusteeSchool', schema: SchoolSchema },
    ]),
    MongooseModule.forFeature([{ name: 'Trustee', schema: TrusteeSchema }]),
    MongooseModule.forFeature([
      { name: 'MerchantMember', schema: MerchantMemberSchema },
    ]),
    MongooseModule.forFeature([
      { name: 'TrusteeMember', schema: TrusteeMemberSchema },
    ]),
    MongooseModule.forFeature([
      { name: 'TransactionInfo', schema: TransactionInfoSchema },
      { name: RequestMDR.name, schema: RequestMDRSchema },
    ]),
    MongooseModule.forFeature([{ name: BaseMdr.name, schema: BaseMdrSchema }]),
    MongooseModule.forFeature([
      { name: SchoolMdr.name, schema: SchoolMdrSchema },
    ]),
    MongooseModule.forFeature([
      { name: RefundRequest.name, schema: RefundRequestSchema },
    ]),
    MongooseModule.forFeature([
      { name: VendorsSettlement.name, schema: VendorsSettlementSchema },
    ]),
    MongooseModule.forFeature([{ name: Vendors.name, schema: VendorsSchema }]),
     MongooseModule.forFeature([
          { name: Disputes.name, schema: DisputesSchema },
        ]),
    JwtModule.registerAsync({
      useFactory: () => ({
        signOptions: { expiresIn: '30d' },
      }),
    }),
    // GraphQLModule.forRoot({
    //   driver: ApolloDriver,
    //   autoSchemaFile: true,
    //   // playground: true, // Enable GraphQL playground in development
    //   installSubscriptionHandlers: true, // Enable subscriptions if needed
    //   // resolvers: [MerchantResolver], // Your resolvers here
    //   playground: process.env.NODE_ENV === 'dev',
    // }),
    MongooseModule.forFeature([
      { name: 'SettlementReport', schema: SettlementSchema },
    ]),
  ],
  controllers: [],
  providers: [
    TrusteeService,
    MerchantGuard,
    MerchantResolver,
    MerchantService,
    EmailService,
    AwsS3Service
  ],
  exports:[MerchantService]
})
export class MerchantModule {}
