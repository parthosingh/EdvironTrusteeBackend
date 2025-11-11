import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StudentDetail, StudentDetailSchema } from 'src/schema/student.schema';
import { DatabaseService } from './database.service';
import { SchoolSchema, TrusteeSchool } from 'src/schema/school.schema';
import { Trustee, TrusteeSchema } from 'src/schema/trustee.schema';
import { SettlementReport, SettlementSchema } from 'src/schema/settlement.schema';
import { TempSettlementReport, TempSettlementReportSchema } from 'src/schema/tempSettlements.schema';
import { SchoolMdr, SchoolMdrSchema } from 'src/schema/school_mdr.schema';
import { BaseMdr, BaseMdrSchema } from 'src/schema/base.mdr.schema';
import { VirtualAccount, VirtualAccountSchema } from 'src/schema/virtual.account.schema';
import { PosMachine, PosMachineSchema } from 'src/schema/pos.machine.schema';
import { ErrorLogs, ErrorLogsSchema } from 'src/schema/error.log.schema';
import { MerchantMember, MerchantMemberSchema } from 'src/schema/merchant.member.schema';
import { RefundRequest, RefundRequestSchema } from 'src/schema/refund.schema';
import { Reconciliation, ReconciliationSchema } from 'src/schema/Reconciliation.schema';
import { Commission, CommissionSchema } from 'src/schema/commission.schema';
import { GatewayRates, GatewayRatesSchema } from 'src/schema/gateways.rate.schema';
import { SchoolBaseMdr, SchoolBaseMdrSchema } from 'src/schema/school.base.mdr.schema';

@Module({
    imports: [
        MongooseModule.forRoot(process.env.DB!),
        MongooseModule.forFeature([
            { name: StudentDetail.name, schema: StudentDetailSchema },
            { name: TrusteeSchool.name, schema: SchoolSchema },
            { name: SettlementReport.name, schema: SettlementSchema },
            { name: TempSettlementReport.name, schema: TempSettlementReportSchema },
            { name: Trustee.name, schema: TrusteeSchema },
            { name: SchoolMdr.name, schema: SchoolMdrSchema },
            { name: BaseMdr.name, schema: BaseMdrSchema },
            { name: VirtualAccount.name, schema: VirtualAccountSchema },
            { name: PosMachine.name, schema: PosMachineSchema },
            { name: ErrorLogs.name, schema: ErrorLogsSchema },
            { name: MerchantMember.name, schema: MerchantMemberSchema },
            { name: RefundRequest.name, schema: RefundRequestSchema },
            { name: Reconciliation.name, schema: ReconciliationSchema },
            { name: Commission.name, schema: CommissionSchema },
            { name: GatewayRates.name, schema: GatewayRatesSchema },
            { name: SchoolBaseMdr.name, schema: SchoolBaseMdrSchema },

        ]),

    ],
    providers: [DatabaseService],
    exports: [
        DatabaseService,
        MongooseModule.forFeature([
            { name: StudentDetail.name, schema: StudentDetailSchema },
            { name: TrusteeSchool.name, schema: SchoolSchema },
            { name: SettlementReport.name, schema: SettlementSchema },
            { name: TempSettlementReport.name, schema: TempSettlementReportSchema },
            { name: Trustee.name, schema: TrusteeSchema },
            { name: SchoolMdr.name, schema: SchoolMdrSchema },
            { name: BaseMdr.name, schema: BaseMdrSchema },
            { name: VirtualAccount.name, schema: VirtualAccountSchema },
            { name: PosMachine.name, schema: PosMachineSchema },
            { name: ErrorLogs.name, schema: ErrorLogsSchema },
            { name: MerchantMember.name, schema: MerchantMemberSchema },
            { name: RefundRequest.name, schema: RefundRequestSchema },
            { name: Reconciliation.name, schema: ReconciliationSchema },
            { name: Commission.name, schema: CommissionSchema },
            { name: GatewayRates.name, schema: GatewayRatesSchema },
            { name: SchoolBaseMdr.name, schema: SchoolBaseMdrSchema },
        ]),
    ]
})
export class DatabaseModule { }
