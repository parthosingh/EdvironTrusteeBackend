import { Module } from "@nestjs/common";
import { PlatformChargesController } from "./platform-charges.controller";
import { PlatformChargeService } from "./platform-charges.service";
import { MongooseModule } from "@nestjs/mongoose";
import { JwtModule } from "@nestjs/jwt";
import { SchoolSchema } from "src/schema/school.schema";
import { TrusteeSchema } from "src/schema/trustee.schema";
import { MainBackendService } from "src/main-backend/main-backend.service";

@Module({
    imports: [
        MongooseModule.forFeature([{ name: 'Trustee', schema: TrusteeSchema }]),
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
    providers: [PlatformChargeService, MainBackendService],
    controllers: [PlatformChargesController]
})

export class PlatformChargesModule { };