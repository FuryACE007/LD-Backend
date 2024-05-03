import { Controller, Get } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('app')
@Controller()
export class AppController {
  @Get()
  @ApiResponse({ status: 200, description: 'The API description.' })
  getHello(): string {
    return 'Hello World!';
  }

  @Get('/health')
  @ApiResponse({ status: 200, description: 'Health check.' })
  getHealth(): string {
    return 'Application is running';
  }
}
