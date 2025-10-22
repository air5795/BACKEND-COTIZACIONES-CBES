import { Controller, Get, Post, Body, Param, Put, ParseIntPipe, Query, Patch, Delete, UploadedFile, UseInterceptors, BadRequestException, StreamableFile, Res } from '@nestjs/common';
import { ReembolsosIncapacidadesService } from './solicitudes_reembolso.service';
import { CreateSolicitudesReembolsoDto } from './dto/create-solicitudes_reembolso.dto';
import { UpdateSolicitudesReembolsoDto } from './dto/update-solicitudes_reembolso.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import * as fs from 'fs';
import { join } from 'path';
import * as path from 'path';
import { multerConfig } from './multer.config';

@ApiTags('Reembolsos de Incapacidades')
@Controller('reembolsos-incapacidades')
export class ReembolsosIncapacidadesController {
  constructor(private readonly service: ReembolsosIncapacidadesService) {}

  //1.- CREAR SOLICITUD MENSUAL DE REEMBOLSO ----------------------------------------------------------------------------------------
  @Post()
  @ApiOperation({ summary: '1.- Crear una nueva solicitud de reembolso mensual' })
  @ApiResponse({ status: 201, description: 'Solicitud mensual creada con éxito' })
  @ApiResponse({ status: 400, description: 'Datos inválidos o empresa no encontrada' })
  async create(@Body() createDto: CreateSolicitudesReembolsoDto) {
    return this.service.crearSolictudMensual(createDto);
  }

  //2.- OBTENER SOLICITUD POR ID ----------------------------------------------------------------------------------------------------
  @Get(':id')
  @ApiOperation({ summary: '2.- Obtener una solicitud por id_solicitud_reembolso' })
  @ApiParam({ name: 'id', description: 'ID de la solicitud', type: Number })
  @ApiResponse({ status: 200, description: 'Solicitud encontrada' })
  @ApiResponse({ status: 404, description: 'Solicitud no encontrada' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.obtenerSolicitudPorId(id);
  }

  //3.- OBTENER TODAS LAS SOLICITUDES POR CODIGO PATRONAL CON PAGINACIÓN Y FILTROS -------------------------------------------------------------------------
  @Get('cod-patronal/:cod_patronal')
  @ApiOperation({ summary: '3.- Obtener todas las solicitudes por código patronal con paginación y filtros' })
  @ApiParam({ name: 'cod_patronal', description: 'Código patronal de la empresa', type: String })
  @ApiQuery({ name: 'pagina', required: false, description: 'Número de página (por defecto: 1)', type: Number })
  @ApiQuery({ name: 'limite', required: false, description: 'Límite de resultados por página (por defecto: 10)', type: Number })
  @ApiQuery({ name: 'busqueda', required: false, description: 'Término de búsqueda en todos los campos', type: String })
  @ApiQuery({ name: 'mes', required: false, description: 'Mes de la solicitud (1-12)', type: String })
  @ApiQuery({ name: 'anio', required: false, description: 'Año de la solicitud', type: String })
  @ApiResponse({ status: 200, description: 'Lista de solicitudes obtenida con éxito' })
  @ApiResponse({ status: 400, description: 'Empresa no encontrada o parámetros inválidos' })
  async findAllByCodPatronal(
    @Param('cod_patronal') cod_patronal: string,
    @Query('pagina') pagina: number = 1,
    @Query('limite') limite: number = 10,
    @Query('busqueda') busqueda: string = '',
    @Query('mes') mes?: string,
    @Query('anio') anio?: string,
  ) {
    return this.service.obtenerSolicitudesPorCodPatronal(
      cod_patronal,
      pagina,
      limite,
      busqueda,
      mes,
      anio
    );
  }

  //4.- CREAR DETALLE DE REEMBOLSO ----------------------------------------------------------------------------------------
@Post('detalles')
@ApiOperation({ summary: '4.- Crear un detalle de reembolso (trabajador)' })
@ApiResponse({ status: 201, description: 'Detalle creado con éxito' })
async crearDetalle(@Body() createDetalleDto: any) {
  return this.service.crearDetalle(createDetalleDto);
}

//5.- OBTENER DETALLES POR ID DE SOLICITUD ----------------------------------------------------------------------------------------
@Get(':id/detalles')
@ApiOperation({ summary: '5.- Obtener todos los detalles de una solicitud con búsqueda opcional' })
@ApiParam({ name: 'id', description: 'ID de la solicitud', type: Number })
@ApiQuery({ name: 'busqueda', required: false, description: 'Término de búsqueda en campos de trabajador', type: String })
@ApiQuery({ name: 'tipo_incapacidad', required: false, description: 'Filtrar por tipo de incapacidad', type: String })
@ApiQuery({ name: 'pagina', required: false, description: 'Número de página', type: Number })
@ApiQuery({ name: 'limite', required: false, description: 'Límite de resultados por página', type: Number })
async obtenerDetallesPorSolicitud(
  @Param('id', ParseIntPipe) id: number,
  @Query('busqueda') busqueda: string = '',
  @Query('tipo_incapacidad') tipoIncapacidad?: string,
  @Query('pagina') pagina?: number,
  @Query('limite') limite?: number
) {
  return this.service.obtenerDetallesPorSolicitud(
    id, 
    busqueda, 
    tipoIncapacidad,
    pagina || 1,
    limite || 20
  );
}

//6.- ELIMINAR DETALLE ----------------------------------------------------------------------------------------
@Delete('detalles/:idDetalle')
@ApiOperation({ summary: '6.- Eliminar un detalle de reembolso' })
@ApiParam({ name: 'idDetalle', description: 'ID del detalle', type: Number })
async eliminarDetalle(@Param('idDetalle', ParseIntPipe) idDetalle: number) {
  return this.service.eliminarDetalle(idDetalle);
}

//7.- ACTUALIZAR TOTALES DE SOLICITUD ----------------------------------------------------------------------------------------
@Patch(':id/totales')
@ApiOperation({ summary: '7.- Actualizar totales de una solicitud' })
@ApiParam({ name: 'id', description: 'ID de la solicitud', type: Number })
async actualizarTotales(@Param('id', ParseIntPipe) id: number, @Body() totales: any) {
  return this.service.actualizarTotales(id, totales);
}

//8.- CALCULAR REEMBOLSO CON DATOS REALES ----------------------------------------------------------------------------------------
@Post('calcular-reembolso')
@ApiOperation({ summary: '8.- Calcular reembolso con datos de planillas de aportes' })
@ApiResponse({ status: 200, description: 'Cálculo realizado exitosamente' })
async calcularReembolso(@Body() calcularDto: {
  matricula: string;
  cod_patronal: string;
  mes: string;
  gestion: string;
  baja_medica: any;
  usuario_calculo?: string;
}) {
  return this.service.calcularReembolsoConDatosReales(calcularDto);
}

//9.- CALCULAR REEMBOLSO MODO PRUEBA (Sin validar planilla) ----------------------------------------------------------------------------------------
@Post('calcular-reembolso-prueba')
@ApiOperation({ summary: '9.- Calcular reembolso en modo prueba (sin validar datos en planilla)' })
@ApiResponse({ status: 200, description: 'Cálculo de prueba realizado exitosamente' })
async calcularReembolsoPrueba(@Body() calcularDto: {
  datos_trabajador: {
    ci: string;
    apellido_paterno: string;
    apellido_materno: string;
    nombres: string;
    matricula: string;
    salario: number;
  };
  baja_medica: {
    tipo_baja: string;
    fecha_inicio: string;
    fecha_fin: string;
    dias_impedimento: number;
    especialidad?: string;
    medico?: string;
    comprobante?: number;
  };
  mes: string;
  gestion: string;
}) {
  return this.service.calcularReembolsoPrueba(calcularDto);
}

//10.- OBTENER SALARIO DE TRABAJADOR DESDE PLANILLAS ------------------------------------------------------------------------------------
@Get('obtener-salario-trabajador/:cod_patronal/:mes/:gestion/:matricula')
@ApiOperation({ summary: '10.- Obtener salario de trabajador desde planillas' })
@ApiResponse({ status: 200, description: 'Salario obtenido exitosamente' })
async obtenerSalarioTrabajador(
  @Param('cod_patronal') cod_patronal: string,
  @Param('mes') mes: string,
  @Param('gestion') gestion: string,
  @Param('matricula') matricula: string
) {
  // Convertir mes a string con padding de ceros si es necesario
  const mesFormateado = mes.padStart(2, '0');
  
  return this.service.obtenerSalarioTrabajador(
    cod_patronal,
    mesFormateado,
    gestion,
    matricula
  );
}

  //11.- SUBIR ARCHIVO DE DENUNCIA PARA RIESGO PROFESIONAL -------------------------------------------------------------------------
  @Post('detalles/:idDetalle/archivo-denuncia')
  @UseInterceptors(FileInterceptor('archivo_denuncia', multerConfig))
  @ApiOperation({ summary: '10.- Subir archivo de denuncia para riesgo profesional' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'idDetalle', description: 'ID del detalle de reembolso', type: Number })
  @ApiResponse({ status: 200, description: 'Archivo subido exitosamente' })
  @ApiResponse({ status: 400, description: 'Error en la subida del archivo' })
  async subirArchivoDenuncia(
    @Param('idDetalle', ParseIntPipe) idDetalle: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No se recibió ningún archivo');
    }
    
    console.log('Archivo de denuncia procesado:', file.filename);
    return await this.service.subirArchivoDenuncia(idDetalle, file);
  }

  //11.- OBTENER INFORMACIÓN DEL ARCHIVO DE DENUNCIA -------------------------------------------------------------------------
  @Get('detalles/:idDetalle/archivo-denuncia')
  @ApiOperation({ summary: '11.- Obtener información del archivo de denuncia' })
  @ApiParam({ name: 'idDetalle', description: 'ID del detalle de reembolso', type: Number })
  @ApiResponse({ status: 200, description: 'Información del archivo obtenida' })
  async obtenerArchivoDenuncia(@Param('idDetalle', ParseIntPipe) idDetalle: number) {
    return this.service.obtenerArchivoDenuncia(idDetalle);
  }

  //12.- PRESENTAR SOLICITUD DE REEMBOLSO -------------------------------------------------------------------------
  @Post(':idSolicitud/presentar')
  @ApiOperation({ summary: '12.- Presentar solicitud de reembolso' })
  @ApiParam({ name: 'idSolicitud', description: 'ID de la solicitud de reembolso', type: Number })
  @ApiResponse({ status: 200, description: 'Solicitud presentada exitosamente' })
  @ApiResponse({ status: 400, description: 'Error en la presentación de la solicitud' })
  async presentarSolicitud(
    @Param('idSolicitud', ParseIntPipe) idSolicitud: number,
    @Body() body: any
  ) {
    console.log('=== DEBUGGING CONTROLLER ===');
    console.log('idSolicitud:', idSolicitud);
    console.log('body completo:', body);
    console.log('body.nombreUsuario:', body?.nombreUsuario);
    console.log('=== FIN DEBUGGING CONTROLLER ===');
    
    const nombreUsuario = body?.nombreUsuario;
    return await this.service.presentarSolicitud(idSolicitud, nombreUsuario);
  }

  //13.- DESCARGAR ARCHIVO DE DENUNCIA -------------------------------------------------------------------------
  @Get('detalles/:idDetalle/descargar-denuncia')
  @ApiOperation({ summary: '13.- Descargar archivo de denuncia' })
  @ApiParam({ name: 'idDetalle', description: 'ID del detalle de reembolso', type: Number })
  @ApiResponse({ status: 200, description: 'Archivo descargado' })
  async descargarArchivoDenuncia(@Param('idDetalle', ParseIntPipe) idDetalle: number): Promise<StreamableFile> {
    const infoArchivo = await this.service.obtenerArchivoDenuncia(idDetalle);
    
    if (!infoArchivo.ruta_file_denuncia) {
      throw new BadRequestException('No hay archivo de denuncia para este detalle');
    }

    const rutaCompleta = join(process.cwd(), infoArchivo.ruta_file_denuncia);
    
    if (!fs.existsSync(rutaCompleta)) {
      throw new BadRequestException('El archivo no existe en el servidor');
    }

    const file = fs.createReadStream(rutaCompleta);
    return new StreamableFile(file);
  }

  //13.- VER ARCHIVO DE DENUNCIA (VISUALIZACIÓN SIN DESCARGA) -------------------------------------------------------------------------
  @Get('detalles/:idDetalle/ver-denuncia')
  @ApiOperation({ summary: '13.- Ver archivo de denuncia sin descarga' })
  @ApiParam({ name: 'idDetalle', description: 'ID del detalle de reembolso', type: Number })
  @ApiResponse({ status: 200, description: 'Archivo para visualización' })
  async verArchivoDenuncia(@Param('idDetalle', ParseIntPipe) idDetalle: number, @Res() res: Response): Promise<void> {
    const infoArchivo = await this.service.obtenerArchivoDenuncia(idDetalle);
    
    if (!infoArchivo.ruta_file_denuncia) {
      throw new BadRequestException('No hay archivo de denuncia para este detalle');
    }

    const rutaCompleta = join(process.cwd(), infoArchivo.ruta_file_denuncia);
    
    if (!fs.existsSync(rutaCompleta)) {
      throw new BadRequestException('El archivo no existe en el servidor');
    }

    // Obtener la extensión del archivo para determinar el tipo MIME
    const extension = path.extname(infoArchivo.ruta_file_denuncia).toLowerCase();
    let mimeType = 'application/octet-stream';
    
    switch (extension) {
      case '.pdf':
        mimeType = 'application/pdf';
        break;
      case '.jpg':
      case '.jpeg':
        mimeType = 'image/jpeg';
        break;
      case '.png':
        mimeType = 'image/png';
        break;
      case '.gif':
        mimeType = 'image/gif';
        break;
      case '.webp':
        mimeType = 'image/webp';
        break;
    }

    // Configurar headers para visualización en el navegador
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', 'inline');
    
    // Enviar el archivo
    const file = fs.createReadStream(rutaCompleta);
    file.pipe(res);
  }

  // ===== ENVIAR CORRECCIONES DE PLANILLA OBSERVADA =====
  @Put(':id/enviar-correcciones')
  @ApiOperation({ summary: 'Enviar correcciones de planilla observada' })
  @ApiParam({ name: 'id', description: 'ID de la solicitud', type: Number })
  @ApiResponse({ status: 200, description: 'Correcciones enviadas exitosamente' })
  @ApiResponse({ status: 400, description: 'Solicitud no está en estado OBSERVADO' })
  @ApiResponse({ status: 404, description: 'Solicitud no encontrada' })
  async enviarCorrecciones(@Param('id', ParseIntPipe) id: number) {
    return this.service.enviarCorrecciones(id);
  }
}