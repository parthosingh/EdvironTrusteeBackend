import { BadGatewayException, Body, Controller, Post } from '@nestjs/common';
import { CanteenService } from './canteen.service';

@Controller('canteen')
export class CanteenController {
    constructor(
        private readonly canteenService: CanteenService
    ) {}
     @Post('/student/login')
        async studentLogin(
            @Body() body: {
                student_id: string,
                password: string,
                school_id: string
            }
        ) {
            try {
               const { student_id, password, school_id } = body;
               const response =await this.canteenService.studentLogin(student_id, password, school_id);
               return response;
    
            } catch (error) {
                throw new BadGatewayException(error.message);
            }
        }
}
