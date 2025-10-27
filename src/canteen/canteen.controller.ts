import { BadGatewayException, BadRequestException, Body, Controller, Get, Post, Req } from '@nestjs/common';
import { CanteenService } from './canteen.service';

@Controller('canteen')
export class CanteenController {
    constructor(
        private readonly canteenService: CanteenService
    ) { }
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
            const response = await this.canteenService.studentLogin(student_id, password, school_id);
            return response;

        } catch (error) {
            throw new BadGatewayException(error.message);
        }
    }

    @Post('/student/register')
    async createStudent(
        @Body() body: {
            sign: string,
            school_id: string,
            student_name: string,
            student_number: string,

        }
    ) {
        try {

        } catch (e) {
            throw new BadRequestException(e.message)
        }
    }

    @Get('/auth/school')
    async authSchool(
        @Req() req:any
    ) {
        console.log('something');
        
        const { school_id, sign } = req.query
        try {
            if (!school_id || !sign) {
                throw new BadRequestException(`Required parameter missing`)
            }
            const school_info = await this.canteenService.authSchool(school_id, sign)
            return school_info

        } catch (e) {
            throw new BadRequestException(e.message)
        }
    }
}
