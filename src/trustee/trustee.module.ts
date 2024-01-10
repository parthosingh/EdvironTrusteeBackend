import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TrusteeService } from './trustee.service';
import { TrusteeSchema } from '../schema/trustee.schema';
import { JwtModule } from '@nestjs/jwt';
import { TrusteeResolver } from './trustee.resolver';
import { GraphQLModule } from '@nestjs/graphql';
import { SchoolSchema } from '../schema/school.schema';
import { ApolloDriver } from '@nestjs/apollo';
import { TrusteeGuard } from './trustee.guard';
import { config } from 'dotenv';
import { ErpService } from 'src/erp/erp.service';
config();

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Trustee', schema: TrusteeSchema }]),
    MongooseModule.forFeature([
      { name: 'TrusteeSchool', schema: SchoolSchema },
    ]),
    JwtModule.registerAsync({
      useFactory: () => ({
        signOptions: { expiresIn: '30d' },
      }),
    }),
    GraphQLModule.forRoot({
      driver: ApolloDriver,
      autoSchemaFile: true, // Generates schema.gql file
      // playground: true, // Enable GraphQL playground in development
      installSubscriptionHandlers: true, // Enable subscriptions if needed
      resolvers: [TrusteeResolver], // Your resolvers here
      playground: process.env.NODE_ENV === 'dev',
    }),
  ],
  controllers: [],
  providers: [ErpService, TrusteeService, TrusteeResolver, TrusteeGuard],
})
export class TrusteeModule {}
