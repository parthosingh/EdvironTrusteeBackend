import {
    Controller,
    Post,
    Get,
    Body,
    BadRequestException,
    ConflictException,
    Query,
    Req,
    UnauthorizedException,
    NotFoundException,
    UseGuards,
} from '@nestjs/common';
import { ErpService } from './erp.service';
import { JwtService } from '@nestjs/jwt';
import { ErpGuard } from './erp.guard';
import { ObjectId } from 'mongoose';

@Controller('erp')
export class ErpController {
    constructor(
        private erpService: ErpService,
        private readonly jwtService: JwtService,
    ) { }

    @Get('payment-link')
    @UseGuards(ErpGuard)
    async genratePaymentLink(
        @Query('phone_number')
        phone_number: string,
    ) {
        
        const link = this.erpService.genrateLink(phone_number);
        return link;
    }

    @Get('get-user')
    @UseGuards(ErpGuard)
    async validateApiKey(@Req() req): Promise<{
        name: string;
        email_id: string;
        phone_number: number
    }> {
        try {
            
            const trusteeId = req.userTrustee.id;
            const trustee = await this.erpService.getUser(trusteeId);

            return trustee;
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw new NotFoundException(error.message);
            } else {
                throw new UnauthorizedException(error.message);
            }
        }
    }

    @Post('create-section')
    @UseGuards(ErpGuard)
    async createSection(
        @Body()
        body: {
            school_id: string;
            data: { className: string; section: string };
        },
        @Req() req
    ) {
        try {
            const trustee_id = req.userTrustee.id
            const section = await this.erpService.createSection(
                body.school_id,
                body.data,
                trustee_id
            );
            return section;
        } catch (error) {
            if(error.response && error.response.statusCode===404){
                throw new NotFoundException(error.message)
            }else if (error.response.statusCode === 409) {
                throw new ConflictException(error.message);
            }
            throw new BadRequestException(error.message);
        }
    }

    @Post('create-student')
    @UseGuards(ErpGuard)
    async createStudent(
        @Body()
        body,
        @Req() req
    ) {
        try {
            const trustee_id = req.userTrustee.id
            const student = await this.erpService.createStudent(body, body.school_id,trustee_id);
            return student;
        } catch (error) {
          
           if (error instanceof ConflictException) {
                throw new ConflictException(error.message);
            }else if(error.response && error.response.statusCode===404){
                throw new NotFoundException(error.message)
            }else{
                throw new BadRequestException(error.message);
            }
        }
    }

    @Post('create-school')
    @UseGuards(ErpGuard)
    async createSchool(
        @Body()
        body: {
            name: string;
            phone_number: string;
            email: string;
            school_name: string;
        },

        @Req() req,
    ): Promise<any> {
        if (!body.name || !body.phone_number || !body.email || !body.school_name) {
            throw new BadRequestException('Fill all fields');
        }

        try {
            const school = await this.erpService.createSchool(
                body.phone_number,
                body.name,
                body.email,
                body.school_name,
                req.userTrustee.id,
            );
            return school;
        } catch (error) {
            if (error.response.statusCode === 409) {
                throw new ConflictException(error.message);
            }
            throw new BadRequestException(error.message);
        }
    }
}