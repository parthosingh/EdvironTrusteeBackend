import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Reconciliation } from 'src/schema/Reconciliation.schema';
import { RefundRequest } from 'src/schema/refund.schema';
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
    ) { }

}
