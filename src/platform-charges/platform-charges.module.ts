import { Module } from "@nestjs/common";
import { PlatformChargesController } from "./platform-charges.controller";
import { PlatformChargeService } from "./platform-charges.service";
import { MongooseModule } from "@nestjs/mongoose";
import { JwtModule } from "@nestjs/jwt";
import { SchoolSchema } from "src/schema/school.schema";

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: 'TrusteeSchool', schema: SchoolSchema },
        ]),
        JwtModule.registerAsync({
            useFactory: () => ({
                secret: process.env.JWT_SECRET_FOR_INTRANET,
                signOptions: { expiresIn: '1h' },
            }),
        })
    ],
    providers: [PlatformChargeService],
    controllers: [PlatformChargesController]
})

export class PlatformChargesModule { };