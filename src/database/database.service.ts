import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseMdr } from 'src/schema/base.mdr.schema';
import { Commission } from 'src/schema/commission.schema';
import { CommissionEarning } from 'src/schema/earnings.schema';
import { GatewayRates } from 'src/schema/gateways.rate.schema';
import { Reconciliation } from 'src/schema/Reconciliation.schema';
import { RefundRequest } from 'src/schema/refund.schema';
import { SchoolBaseMdr } from 'src/schema/school.base.mdr.schema';
import { TrusteeSchool } from 'src/schema/school.schema';
import { SettlementReport } from 'src/schema/settlement.schema';
import { StudentDetail } from 'src/schema/student.schema';
import { TempSettlementReport } from 'src/schema/tempSettlements.schema';

@Injectable()
export class DatabaseService {
    constructor(
        @InjectModel(StudentDetail.name)
        public readonly studentModel: Model<StudentDetail>,
        @InjectModel(TrusteeSchool.name)
        public readonly trusteeSchoolModel: Model<TrusteeSchool>,
        @InjectModel(TempSettlementReport.name)
        public TempSettlementReportModel: Model<TempSettlementReport>,
        @InjectModel(SettlementReport.name)
        public SettlementReportModel: Model<SettlementReport>,
        @InjectModel(RefundRequest.name)
        public refundModel: Model<RefundRequest>,
        @InjectModel(Reconciliation.name)
        public reconModel: Model<Reconciliation>,
        @InjectModel(GatewayRates.name)
        public gatewayRatesModel: Model<GatewayRates>,
        @InjectModel(Commission.name)
        public commissionModel: Model<Commission>,
        @InjectModel(BaseMdr.name)
        public baseMdrModel: Model<BaseMdr>,
        @InjectModel(SchoolBaseMdr.name)
        public schoolBaseMdrModel: Model<SchoolBaseMdr>,
            @InjectModel(CommissionEarning.name)
        public earningModel: Model<CommissionEarning>,
    ) { }

}
