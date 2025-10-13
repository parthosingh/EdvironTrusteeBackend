import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TrusteeSchool } from 'src/schema/school.schema';
import { StudentDetail } from 'src/schema/student.schema';

@Injectable()
export class DatabaseService {
    constructor(
        @InjectModel(StudentDetail.name)
        public readonly studentModel: Model<StudentDetail>,
        @InjectModel(TrusteeSchool.name)
        public readonly trusteeSchoolModel: Model<TrusteeSchool>
    ) { }

}
