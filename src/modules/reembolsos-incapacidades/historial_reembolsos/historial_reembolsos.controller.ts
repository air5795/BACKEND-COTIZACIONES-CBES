import { Controller, Get, Param, Query, ParseIntPipe, BadRequestException, Put, Body } from '@nestjs/common';
import { HistorialReembolsosService } from './historial_reembolsos.service';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';

@ApiTags('Historial de Reembolsos (Administrador)')
@Controller('historial-reembolsos')
export class HistorialReembolsosController {
  constructor(private readonly historialService: HistorialReembolsosService) {}

  //1.- OBTENER TODAS LAS SOLICITUDES PRESENTADAS -------------------------------------------------------------------------
  @Get()
  @ApiOperation({ summary: '1.- Obtener todas las solicitudes presentadas (solo administradores)' })
  @ApiQuery({ name: 'pagina', required: false, type: Number, description: 'Número de página' })
  @ApiQuery({ name: 'limite', required: false, type: Number, description: 'Límite de registros por página' })
  @ApiQuery({ name: 'busqueda', required: false, type: String, description: 'Término de búsqueda' })
  @ApiQuery({ name: 'mes', required: false, type: String, description: 'Filtrar por mes' })
  @ApiQuery({ name: 'anio', required: false, type: String, description: 'Filtrar por año' })
  @ApiQuery({ name: 'codPatronal', required: false, type: String, description: 'Filtrar por código patronal' })
  @ApiResponse({ status: 200, description: 'Lista de solicitudes presentadas obtenida exitosamente' })
  @ApiResponse({ status: 400, description: 'Error en los parámetros de consulta' })
  async obtenerSolicitudesPresentadas(
    @Query('pagina', new ParseIntPipe({ optional: true })) pagina: number = 1,
    @Query('limite', new ParseIntPipe({ optional: true })) limite: number = 10,
    @Query('busqueda') busqueda: string = '',
    @Query('mes') mes?: string,
    @Query('anio') anio?: string,
    @Query('codPatronal') codPatronal?: string
  ) {
    console.log('🎯 Controller recibió parámetros:', { pagina, limite, busqueda, mes, anio, codPatronal });
    return await this.historialService.obtenerSolicitudesPresentadas(pagina, limite, busqueda, mes, anio, codPatronal);
  }

  // MÉTODO DE PRUEBA SIMPLE
  @Get('test')
  @ApiOperation({ summary: 'Método de prueba simple' })
  async testSimple() {
    try {
      console.log('🧪 Ejecutando test simple...');
      const solicitudes = await this.historialService.reembolsoRepo.find({
        where: { estado: 1 },
        take: 5,
        order: { fecha_modificacion: 'DESC' }
      });
      console.log('✅ Test simple exitoso:', solicitudes.length, 'registros');
      return { 
        mensaje: 'Test exitoso', 
        cantidad: solicitudes.length,
        solicitudes: solicitudes.slice(0, 2) // Solo mostrar 2 para no sobrecargar
      };
    } catch (error) {
      console.error('❌ Error en test simple:', error);
      throw error;
    }
  }

  //2.- OBTENER ESTADÍSTICAS GENERALES -------------------------------------------------------------------------
  @Get('estadisticas')
  @ApiOperation({ summary: '2.- Obtener estadísticas generales del historial' })
  @ApiResponse({ status: 200, description: 'Estadísticas obtenidas exitosamente' })
  @ApiResponse({ status: 400, description: 'Error al obtener estadísticas' })
  async obtenerEstadisticasGenerales() {
    return await this.historialService.obtenerEstadisticasGenerales();
  }

  //3.- OBTENER DETALLES DE UNA SOLICITUD ESPECÍFICA -------------------------------------------------------------------------
  @Get('solicitud/:idSolicitud')
  @ApiOperation({ summary: '3.- Obtener detalles de una solicitud específica' })
  @ApiParam({ name: 'idSolicitud', description: 'ID de la solicitud de reembolso', type: Number })
  @ApiResponse({ status: 200, description: 'Detalles de la solicitud obtenidos exitosamente' })
  @ApiResponse({ status: 404, description: 'Solicitud no encontrada' })
  @ApiResponse({ status: 400, description: 'Error al obtener detalles' })
  async obtenerDetallesSolicitud(@Param('idSolicitud', ParseIntPipe) idSolicitud: number) {
    return await this.historialService.obtenerDetallesSolicitud(idSolicitud);
  }

  //4.- OBTENER ESTADÍSTICAS POR EMPRESA -------------------------------------------------------------------------
  @Get('empresa/:codPatronal')
  @ApiOperation({ summary: '4.- Obtener estadísticas de una empresa específica' })
  @ApiParam({ name: 'codPatronal', description: 'Código patronal de la empresa', type: String })
  @ApiResponse({ status: 200, description: 'Estadísticas de la empresa obtenidas exitosamente' })
  @ApiResponse({ status: 400, description: 'Error al obtener estadísticas de la empresa' })
  async obtenerEstadisticasPorEmpresa(@Param('codPatronal') codPatronal: string) {
    return await this.historialService.obtenerEstadisticasPorEmpresa(codPatronal);
  }

  //5.- APROBAR PLANILLA COMPLETA -------------------------------------------------------------------------
  @Put('solicitud/:idSolicitud/aprobar')
  @ApiOperation({ summary: '5.- Aprobar una planilla completa' })
  @ApiParam({ name: 'idSolicitud', description: 'ID de la solicitud de reembolso', type: Number })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        usuarioAprobacion: {
          type: 'string',
          description: 'Nombre del usuario que aprueba'
        }
      }
    }
  })
  @ApiResponse({ status: 200, description: 'Planilla aprobada exitosamente' })
  @ApiResponse({ status: 400, description: 'Error al aprobar la planilla' })
  @ApiResponse({ status: 404, description: 'Solicitud no encontrada' })
  async aprobarPlanilla(
    @Param('idSolicitud', ParseIntPipe) idSolicitud: number,
    @Body() body: { usuarioAprobacion?: string }
  ) {
    return await this.historialService.aprobarPlanilla(idSolicitud, body.usuarioAprobacion);
  }

  //6.- OBSERVAR PLANILLA COMPLETA -------------------------------------------------------------------------
  @Put('solicitud/:idSolicitud/observar')
  @ApiOperation({ summary: '6.- Observar una planilla completa' })
  @ApiParam({ name: 'idSolicitud', description: 'ID de la solicitud de reembolso', type: Number })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        observaciones: {
          type: 'string',
          description: 'Observaciones del administrador sobre la planilla'
        },
        usuarioObservacion: {
          type: 'string',
          description: 'Nombre del usuario que observa'
        }
      },
      required: ['observaciones']
    }
  })
  @ApiResponse({ status: 200, description: 'Planilla observada exitosamente' })
  @ApiResponse({ status: 400, description: 'Error al observar la planilla' })
  @ApiResponse({ status: 404, description: 'Solicitud no encontrada' })
  async observarPlanilla(
    @Param('idSolicitud', ParseIntPipe) idSolicitud: number,
    @Body() body: { observaciones: string; usuarioObservacion?: string }
  ) {
    return await this.historialService.observarPlanilla(idSolicitud, body.observaciones, body.usuarioObservacion);
  }

  //7.- ACTUALIZAR ESTADO DE REVISIÓN DE UN DETALLE -------------------------------------------------------------------------
  @Put('detalle/:idDetalle/revision')
  @ApiOperation({ summary: '7.- Actualizar estado de revisión de un detalle' })
  @ApiParam({ name: 'idDetalle', description: 'ID del detalle de reembolso', type: Number })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        estadoRevision: {
          type: 'string',
          enum: ['neutro', 'aprobado', 'observado'],
          description: 'Estado de revisión del detalle'
        },
        observaciones: {
          type: 'string',
          description: 'Observaciones del administrador (requerido si estado es observado)'
        }
      },
      required: ['estadoRevision']
    }
  })
  @ApiResponse({ status: 200, description: 'Estado de revisión actualizado exitosamente' })
  @ApiResponse({ status: 400, description: 'Error en los parámetros o al actualizar' })
  @ApiResponse({ status: 404, description: 'Detalle no encontrado' })
  async actualizarEstadoRevision(
    @Param('idDetalle', ParseIntPipe) idDetalle: number,
    @Body() body: { estadoRevision: 'neutro' | 'aprobado' | 'observado'; observaciones?: string }
  ) {
    return await this.historialService.actualizarEstadoRevision(
      idDetalle, 
      body.estadoRevision, 
      body.observaciones
    );
  }
}
