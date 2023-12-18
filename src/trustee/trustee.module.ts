import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TrusteeController } from './trustee.controller';
import { TrusteeService } from './trustee.service';
import { TrusteeSchema } from './schema/trustee.schema';
import { JwtModule } from '@nestjs/jwt';
import { TrusteeResolver } from './trustee.resolver';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';

import { config } from 'dotenv';
import { SchoolSchema } from './schema/school.schema';
config();

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Trustee', schema: TrusteeSchema }]),
    MongooseModule.forFeature([{name:'TrusteeSchool',schema:SchoolSchema}]),
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
  controllers: [TrusteeController],
  providers: [TrusteeService, TrusteeResolver],
})
export class TrusteeModule {}