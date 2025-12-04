import { Controller, Get, Query, BadRequestException, Res , StreamableFile } from '@nestjs/common';
import { Response } from 'express';
import { ReportesReembolsosService } from './reportes_reembolsos.service';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';


@ApiTags('REPORTES (Reembolsos de Incapacidades)')
@ApiBearerAuth('JWT-auth') 
@Controller('reportes-reembolsos')
export class ReportesReembolsosController {
  constructor(private readonly reportesService: ReportesReembolsosService) {}

  /**
   * Genera reporte PDF de reembolsos por grupos
   * GET /reportes-reembolsos/reporte-pdf?idSolicitud=123
   */
  @Get('reporte-pdf') 
  @ApiOperation({ summary: 'Genera reporte PDF de reembolsos por grupos' })
  @ApiResponse({ status: 200, description: 'Reporte PDF generado correctamente' })
  @ApiResponse({ status: 400, description: 'Error al generar el reporte PDF' })
  async generarReportePDF(
    @Query('idSolicitud') idSolicitud: number,
    @Res() res: Response,
  ) {
    try {
      if (!idSolicitud || idSolicitud < 1) {
        throw new BadRequestException('El parámetro idSolicitud es obligatorio y debe ser un número válido');
      }

      const reporte = await this.reportesService.generarReporteReembolsosPorGrupos(idSolicitud);

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=reporte_reembolsos_${idSolicitud}.pdf`,
      });

      reporte.getStream().pipe(res);
    } catch (error) {
      throw new BadRequestException(`Error al generar el reporte PDF: ${error.message}`);
    }
  }

  /**
   * Obtiene los datos del reporte en formato JSON
   * GET /reportes-reembolsos/datos?idSolicitud=123
   */
  @Get('datos')
  @ApiOperation({ summary: 'Obtiene los datos del reporte en formato JSON' })
  @ApiResponse({ status: 200, description: 'Datos del reporte obtenidos correctamente' })
  @ApiResponse({ status: 400, description: 'Error al obtener los datos del reporte' })
  async obtenerDatosReporte(
    @Query('idSolicitud') idSolicitud: number,
  ) {
    try {
      if (!idSolicitud || idSolicitud < 1) {
        throw new BadRequestException('El parámetro idSolicitud es obligatorio y debe ser un número válido');
      }

      return await this.reportesService.obtenerDatosReporteReembolsos(idSolicitud);
    } catch (error) {
      throw new BadRequestException(`Error al obtener los datos del reporte: ${error.message}`);
    }
  }


/**
 * Genera reporte mensual consolidado de reembolsos
 * GET /reportes-reembolsos/reporte-mensual?mes=2&gestion=2025
 */


@Get('reporte-mensual')
async generarReporteMensual(
  @Query('mes') mes: string,
  @Query('gestion') gestion: string,
): Promise<StreamableFile> {
  console.log('=== ENDPOINT: generarReporteMensual ===');
  console.log('Query params:', { mes, gestion });

  // Validar que los parámetros estén presentes
  if (!mes || !gestion) {
    throw new BadRequestException('Los parámetros mes y gestion son obligatorios');
  }

  // Convertir a números
  const mesNum = parseInt(mes, 10);
  const gestionNum = parseInt(gestion, 10);

  // Validar que sean números válidos
  if (isNaN(mesNum) || isNaN(gestionNum)) {
    throw new BadRequestException('Los parámetros mes y gestion deben ser números válidos');
  }

  return this.reportesService.generarReporteMensualReembolsos(mesNum, gestionNum);
}
}
