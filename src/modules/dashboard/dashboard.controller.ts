import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { ResponseUtil } from '../../core/utility/response-util';

@ApiTags('Dashboard Admin')
@Controller('dashboard/admin')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('resumen')
  @ApiOperation({ summary: 'Resumen de tarjetas para dashboard admin' })
  @ApiResponse({ status: 200, description: 'Resumen obtenido' })
  async getResumen() {
    try {
      const data = await this.dashboardService.getAdminSummary();
      return ResponseUtil.success(data, 'Resumen obtenido exitosamente');
    } catch (error) {
      return ResponseUtil.error('Error al obtener el resumen del dashboard');
    }
  }

  @Get('ultimas-planillas')
  @ApiOperation({ summary: 'Últimas planillas declaradas' })
  @ApiQuery({ name: 'limit', required: false, example: 6 })
  @ApiResponse({ status: 200, description: 'Listado obtenido' })
  async getUltimasPlanillas(@Query('limit') limit?: string) {
    try {
      const parsedLimit = limit ? parseInt(limit, 10) : 6;
      const data = await this.dashboardService.getUltimasPlanillas(parsedLimit);
      return ResponseUtil.success(data, 'Últimas planillas obtenidas');
    } catch (error) {
      return ResponseUtil.error('Error al obtener las últimas planillas');
    }
  }

  @Get('ultimas-reembolsos')
  @ApiOperation({ summary: 'Últimas solicitudes de reembolso' })
  @ApiQuery({ name: 'limit', required: false, example: 6 })
  @ApiResponse({ status: 200, description: 'Listado obtenido' })
  async getUltimasReembolsos(@Query('limit') limit?: string) {
    try {
      const parsedLimit = limit ? parseInt(limit, 10) : 6;
      const data = await this.dashboardService.getUltimasReembolsos(parsedLimit);
      return ResponseUtil.success(data, 'Últimas solicitudes obtenidas');
    } catch (error) {
      return ResponseUtil.error('Error al obtener las últimas solicitudes de reembolso');
    }
  }
}

