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
    async validateApiKey(@Req() req): Promise<{
        id: ObjectId;
        name: string;
        email: string;
    }> {
        try {
            // If the request reaches here, the token is valid
            const authorizationHeader = req.headers.authorization;
            const token = authorizationHeader.split(' ')[1];

            const trustee = await this.erpService.validateApiKey(token);

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
    ) {
        try {
            const section = await this.erpService.createSection(
                body.school_id,
                body.data,
            );
            return section;
        } catch (error) {
            if (error.response.statusCode === 409) {
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
    ) {
        try {
            const student = await this.erpService.createStudent(body, body.schoolId);
            return student;
        } catch (error) {
            if (error instanceof ConflictException) {
                throw new ConflictException(error.message);
            }
            throw new BadRequestException(error.message);
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
                req.userTrustee,
            );
            return school;
        } catch (error) {
            console.log(error.response);
            if (error.response.statusCode === 409) {
                throw new ConflictException(error.message);
            }
            throw new BadRequestException(error.message);
        }
    }
}