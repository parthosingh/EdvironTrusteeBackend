import { BadRequestException, Controller, Get, Req } from '@nestjs/common';
import { ReconcilationService } from './reconcilation.service';

@Controller('reconcilation')
export class ReconcilationController {
    constructor(
        private reconService: ReconcilationService
    ) { }


    @Get()
    async testRecon(@Req() req:any) {
        try {
            const {
                date
            }=req.query
            const settlementDate=new Date(date)
            return await this.reconService.easebuzzSettlements(settlementDate)
        } catch (e) {
            throw new BadRequestException(e.message)
        }
    }
}
