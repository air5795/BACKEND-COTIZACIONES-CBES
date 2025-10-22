import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets, In } from 'typeorm';
import { SolicitudesReembolso } from './entities/solicitudes_reembolso.entity';
import { DetallesReembolso } from './entities/detalles_reembolso.entity';
import { CreateSolicitudesReembolsoDto } from './dto/create-solicitudes_reembolso.dto';
import { UpdateSolicitudesReembolsoDto } from './dto/update-solicitudes_reembolso.dto';
import { EmpresasService } from '../../empresas/empresas.service';
import { ExternalApiService } from '../../api-client/service/external-api.service';
import { PlanillasAportesService } from '../../planillas_aportes/planillas_aportes.service';
import { join } from 'path';

@Injectable()
export class ReembolsosIncapacidadesService {
  constructor(
    @InjectRepository(SolicitudesReembolso)
    private readonly reembolsoRepo: Repository<SolicitudesReembolso>,
    private readonly empresasService: EmpresasService,
    @InjectRepository(DetallesReembolso)
    private readonly detalleRepo: Repository<DetallesReembolso>,
    private readonly externalApiService: ExternalApiService,
    private readonly planillasService: PlanillasAportesService,
  ) {}

  //1.- CREAR SOLICITUD MENSUAL DE REEMBOLSO ----------------------------------------------------------------------------------------
  async crearSolictudMensual(createDto: CreateSolicitudesReembolsoDto) {
    const { cod_patronal, mes, gestion, usuario_creacion, nombre_creacion } = createDto;

    // Validar empresa
    const empresa = await this.empresasService.findByCodPatronal(cod_patronal);
    if (!empresa) {
      throw new BadRequestException('No se encontró una empresa con el código patronal proporcionado');
    }

    // Validar tipo de empresa
    const tipoEmpresa = empresa.tipo?.toUpperCase();
    if (!tipoEmpresa) {
      throw new BadRequestException('No se pudo determinar el tipo de empresa');
    }
    if (!['PA', 'AP', 'AV', 'VA'].includes(tipoEmpresa)) {
      throw new BadRequestException(`Tipo de empresa no válido: ${tipoEmpresa}`);
    }

    // Crear fecha_planilla para validación de unicidad
    const fechaSolicitud = new Date(`${gestion}-${mes.padStart(2, '0')}-01`);

    // Validar que no exista una solicitud para el mismo mes/gestión
    const solicitudExistente = await this.reembolsoRepo.findOne({
      where: { cod_patronal, mes, gestion },
    });
    if (solicitudExistente) {
      throw new BadRequestException(`Ya existe una solicitud de reembolso para ${mes}/${gestion} con este código patronal`);
    }

    // Crear solicitud
    const nuevaSolicitud = this.reembolsoRepo.create({
      cod_patronal,
      id_empresa: empresa.id_empresa,
      mes,
      gestion,
      tipo_empresa: tipoEmpresa || 'FALLA EN REGISTRO',
      estado: 0, // BORRADOR
      fecha_solicitud: fechaSolicitud,
      usuario_creacion: usuario_creacion || 'FALLA EN REGISTRO',
      nombre_creacion: nombre_creacion || 'FALLA EN REGISTRO',
      total_reembolso: 0,
      total_trabajadores: 0,
    });

    const solicitudGuardada = await this.reembolsoRepo.save(nuevaSolicitud);

    console.log(`📊 Solicitud de reembolso creada:
    - ID: ${solicitudGuardada.id_solicitud_reembolso}
    - Código Patronal: ${cod_patronal}
    - Mes/Gestión: ${mes}/${gestion}
    - Tipo Empresa: ${tipoEmpresa}`);

    return {
      mensaje: '✅ Solicitud de reembolso guardada con éxito',
      id_solicitud: solicitudGuardada.id_solicitud_reembolso,
    };
  }
  //2.- OBTENER SOLICITUD POR ID ----------------------------------------------------------------------------------------------------
  async obtenerSolicitudPorId(id: number) {
    const solicitud = await this.reembolsoRepo.findOne({
      where: { id_solicitud_reembolso: id },
      relations: ['empresa'], // Para mostrar datos de empresa
    });
    if (!solicitud) throw new NotFoundException('Solicitud no encontrada');
    return solicitud;
  }
  //3.- OBTENER TODAS LAS SOLICITUDES POR CODIGO PATRONAL CON PAGINACIÓN Y FILTROS -------------------------------------------------------------------------
  async obtenerSolicitudesPorCodPatronal(cod_patronal: string,pagina: number = 1,limite: number = 10,busqueda: string = '',mes?: string,anio?: string) {
    try {
      // Validar parámetros
      if (pagina < 1 || limite < 1) {
        throw new BadRequestException('La página y el límite deben ser mayores que 0');
      }
      if (mes && (isNaN(Number(mes)) || Number(mes) < 1 || Number(mes) > 12)) {
        throw new BadRequestException('El mes debe ser un número entre 1 y 12');
      }
      if (anio && (isNaN(Number(anio)) || Number(anio) < 1900 || Number(anio) > 2100)) {
        throw new BadRequestException('El año debe ser un número válido (1900-2100)');
      }

      // Validar empresa
      const empresa = await this.empresasService.findByCodPatronal(cod_patronal);
      if (!empresa) {
        throw new BadRequestException('Empresa no encontrada');
      }

      const skip = (pagina - 1) * limite;

      const query = this.reembolsoRepo.createQueryBuilder('solicitud')
        .leftJoinAndSelect('solicitud.empresa', 'empresa')
        .where('TRIM(LOWER(solicitud.cod_patronal)) = TRIM(LOWER(:cod_patronal))', { cod_patronal })
        .orderBy('solicitud.fecha_creacion', 'DESC')
        .skip(skip)
        .take(limite);

      // Filtro por mes
      if (mes) {
        query.andWhere('CAST(solicitud.mes AS TEXT) = :mes', { mes });
      }

      // Filtro por año
      if (anio) {
        query.andWhere('CAST(solicitud.gestion AS TEXT) = :anio', { anio });
      }

      // Búsqueda en todos los campos
      if (busqueda) {
        query.andWhere(
          new Brackets(qb => {
            qb.where('CAST(solicitud.id_solicitud_reembolso AS TEXT) LIKE :busqueda')
              .orWhere('CAST(solicitud.mes AS TEXT) LIKE :busqueda')
              .orWhere('CAST(solicitud.gestion AS TEXT) LIKE :busqueda')
              .orWhere('solicitud.cod_patronal LIKE :busqueda')
              .orWhere('empresa.emp_nom LIKE :busqueda')
              .orWhere('solicitud.tipo_empresa LIKE :busqueda')
              .orWhere('CAST(solicitud.total_reembolso AS TEXT) LIKE :busqueda')
              .orWhere('CAST(solicitud.total_trabajadores AS TEXT) LIKE :busqueda')
              .orWhere('CAST(solicitud.estado AS TEXT) LIKE :busqueda')
              .orWhere('solicitud.usuario_creacion LIKE :busqueda')
              .orWhere('solicitud.nombre_creacion LIKE :busqueda');
          }),
          { busqueda: `%${busqueda}%` }
        );
      }

      // Obtener los resultados
      const [solicitudes, total] = await query.getManyAndCount();

      if (!solicitudes.length) {
        return {
          mensaje: 'No hay solicitudes de reembolso registradas para este código patronal',
          solicitudes: [],
          total: 0,
          pagina,
          limite,
        };
      }

      return {
        mensaje: 'Solicitudes de reembolso obtenidas con éxito',
        solicitudes,
        total,
        pagina,
        limite,
      };
    } catch (error) {
      throw new BadRequestException(`Error al obtener las solicitudes de reembolso: ${error.message}`);
    }
  }
    //4.- CREAR DETALLE DE REEMBOLSO ----------------------------------------------------------------------------------------
  async crearDetalle(createDetalleDto: any) {
    try {
      // Verificar que la solicitud existe y está en estado BORRADOR (0)
      const solicitud = await this.reembolsoRepo.findOne({
        where: { id_solicitud_reembolso: createDetalleDto.id_solicitud_reembolso }
      });

      if (!solicitud) {
        throw new NotFoundException('No se encontró la solicitud de reembolso');
      }

      if (solicitud.estado !== 0 && solicitud.estado !== 3) {
        throw new BadRequestException('Solo se pueden agregar detalles a solicitudes en estado BORRADOR u OBSERVADO');
      }

      // Crear el detalle
      const nuevoDetalle = this.detalleRepo.create({
        id_solicitud_reembolso: createDetalleDto.id_solicitud_reembolso,
        nro: createDetalleDto.nro,
        ci: createDetalleDto.ci,
        apellido_paterno: createDetalleDto.apellido_paterno,
        apellido_materno: createDetalleDto.apellido_materno,
        nombres: createDetalleDto.nombres,
        matricula: createDetalleDto.matricula,
        tipo_incapacidad: createDetalleDto.tipo_incapacidad,
        fecha_inicio_baja: new Date(createDetalleDto.fecha_inicio_baja),
        fecha_fin_baja: new Date(createDetalleDto.fecha_fin_baja),
        dias_incapacidad: createDetalleDto.dias_incapacidad,
        dias_reembolso: createDetalleDto.dias_reembolso,
        // Nuevos campos del cálculo detallado
        dias_baja_total: createDetalleDto.dias_totales_baja || createDetalleDto.dias_baja_total || createDetalleDto.dias_incapacidad,
        dias_mes_reembolso: createDetalleDto.correspondiente_al_mes?.dias_en_mes || createDetalleDto.dias_mes_reembolso || createDetalleDto.dias_incapacidad,
        fecha_inicio_mes_reembolso: createDetalleDto.correspondiente_al_mes?.fecha_inicio || createDetalleDto.fecha_inicio_mes_reembolso || createDetalleDto.fecha_inicio_baja,
        fecha_fin_mes_reembolso: createDetalleDto.correspondiente_al_mes?.fecha_fin || createDetalleDto.fecha_fin_mes_reembolso || createDetalleDto.fecha_fin_baja,
        salario: createDetalleDto.salario,
        monto_dia: createDetalleDto.monto_dia,
        monto_subtotal: createDetalleDto.monto_subtotal || (createDetalleDto.monto_dia * createDetalleDto.dias_reembolso),
        porcentaje_reembolso: createDetalleDto.porcentaje_reembolso,
        monto_reembolso: createDetalleDto.monto_reembolso,
        cotizaciones_previas_verificadas: createDetalleDto.cotizaciones_previas_verificadas || 0,
        observaciones_afiliacion: createDetalleDto.observaciones_afiliacion,
        observaciones: createDetalleDto.observaciones,
        usuario_creacion: createDetalleDto.usuario_creacion || 'SYSTEM'
      });

      const detalleGuardado = await this.detalleRepo.save(nuevoDetalle);

      // Actualizar los totales de la solicitud
      await this.recalcularTotalesSolicitud(createDetalleDto.id_solicitud_reembolso);

      return {
        mensaje: 'Detalle de reembolso creado exitosamente',
        id_detalle: detalleGuardado.id_detalle_reembolso,
        detalle: detalleGuardado
      };

    } catch (error) {
      console.error('Error al crear detalle de reembolso:', error);
      throw error;
    }
  }

  //5.- OBTENER DETALLES POR ID DE SOLICITUD ----------------------------------------------------------------------------------------
  async obtenerDetallesPorSolicitud(
    idSolicitud: number, 
    busqueda: string = '', 
    tipoIncapacidad?: string,
    pagina: number = 1,
    limite: number = 20
  ) {
    try {
      // Validar parámetros de paginación
      if (pagina < 1 || limite < 1) {
        throw new BadRequestException('La página y el límite deben ser mayores que 0');
      }

      const queryBuilder = this.detalleRepo.createQueryBuilder('detalle')
        .where('detalle.id_solicitud_reembolso = :idSolicitud', { idSolicitud })
        .orderBy('detalle.nro', 'ASC');

      // Aplicar filtro por tipo de incapacidad PRIMERO si se proporciona
      if (tipoIncapacidad && tipoIncapacidad.trim() !== '') {
        queryBuilder.andWhere('detalle.tipo_incapacidad = :tipoIncapacidad', { tipoIncapacidad });
      }

      // Aplicar filtro de búsqueda si se proporciona
      if (busqueda && busqueda.trim() !== '') {
        queryBuilder.andWhere(
          new Brackets(qb => {
            qb.where('detalle.ci ILIKE :busqueda', { busqueda: `%${busqueda}%` })
              .orWhere('detalle.apellido_paterno ILIKE :busqueda', { busqueda: `%${busqueda}%` })
              .orWhere('detalle.apellido_materno ILIKE :busqueda', { busqueda: `%${busqueda}%` })
              .orWhere('detalle.nombres ILIKE :busqueda', { busqueda: `%${busqueda}%` })
              .orWhere('detalle.matricula ILIKE :busqueda', { busqueda: `%${busqueda}%` })
              .orWhere('CONCAT(detalle.apellido_paterno, \' \', detalle.apellido_materno, \' \', detalle.nombres) ILIKE :busqueda', { busqueda: `%${busqueda}%` })
              .orWhere('CONCAT(detalle.nombres, \' \', detalle.apellido_paterno, \' \', detalle.apellido_materno) ILIKE :busqueda', { busqueda: `%${busqueda}%` });
          })
        );
      }

      // Obtener el total de registros antes de aplicar paginación
      const totalRegistros = await queryBuilder.getCount();

      // Aplicar paginación
      const offset = (pagina - 1) * limite;
      queryBuilder.skip(offset).take(limite);

      const detalles = await queryBuilder.getMany();

      // Calcular totales específicos para el tipo si se especifica
      let totalesEspecificos = null;
      if (tipoIncapacidad && tipoIncapacidad.trim() !== '') {
        const queryTotales = this.detalleRepo.createQueryBuilder('detalle')
          .select([
            'COUNT(*) as total_trabajadores',
            'SUM(detalle.monto_reembolso) as total_reembolso',
            'SUM(detalle.dias_reembolso) as total_dias'
          ])
          .where('detalle.id_solicitud_reembolso = :idSolicitud', { idSolicitud })
          .andWhere('detalle.tipo_incapacidad = :tipoIncapacidad', { tipoIncapacidad });

        if (busqueda && busqueda.trim() !== '') {
          queryTotales.andWhere(
            new Brackets(qb => {
              qb.where('detalle.ci ILIKE :busqueda', { busqueda: `%${busqueda}%` })
                .orWhere('detalle.apellido_paterno ILIKE :busqueda', { busqueda: `%${busqueda}%` })
                .orWhere('detalle.apellido_materno ILIKE :busqueda', { busqueda: `%${busqueda}%` })
                .orWhere('detalle.nombres ILIKE :busqueda', { busqueda: `%${busqueda}%` })
                .orWhere('detalle.matricula ILIKE :busqueda', { busqueda: `%${busqueda}%` })
                .orWhere('CONCAT(detalle.apellido_paterno, \' \', detalle.apellido_materno, \' \', detalle.nombres) ILIKE :busqueda', { busqueda: `%${busqueda}%` })
                .orWhere('CONCAT(detalle.nombres, \' \', detalle.apellido_paterno, \' \', detalle.apellido_materno) ILIKE :busqueda', { busqueda: `%${busqueda}%` });
            })
          );
        }

        const resultadoTotales = await queryTotales.getRawOne();
        totalesEspecificos = {
          total_trabajadores: parseInt(resultadoTotales.total_trabajadores) || 0,
          total_reembolso: parseFloat(resultadoTotales.total_reembolso) || 0,
          total_dias: parseInt(resultadoTotales.total_dias) || 0
        };
      }

      const response = {
        mensaje: 'Detalles obtenidos exitosamente',
        detalles: detalles,
        total: totalRegistros,
        pagina: pagina,
        limite: limite,
        totalPaginas: Math.ceil(totalRegistros / limite),
        tipoIncapacidad: tipoIncapacidad || null,
        busqueda: busqueda || null
      };

      // Agregar totales específicos si se calcularon
      if (totalesEspecificos) {
        response['totalesEspecificos'] = totalesEspecificos;
      }

      return response;

    } catch (error) {
      console.error('Error al obtener detalles:', error);
      throw new BadRequestException('Error al obtener los detalles de reembolso');
    }
  }

  //6.- ELIMINAR DETALLE ----------------------------------------------------------------------------------------
  async eliminarDetalle(idDetalle: number) {
    try {
      // Buscar el detalle
      const detalle = await this.detalleRepo.findOne({
        where: { id_detalle_reembolso: idDetalle },
        relations: ['solicitud_reembolso']
      });

      if (!detalle) {
        throw new NotFoundException('No se encontró el detalle de reembolso');
      }

      // Verificar que la solicitud esté en estado BORRADOR u OBSERVADO
      if (detalle.solicitud_reembolso.estado !== 0 && detalle.solicitud_reembolso.estado !== 3) {
        throw new BadRequestException('Solo se pueden eliminar detalles de solicitudes en estado BORRADOR u OBSERVADO');
      }

      const idSolicitud = detalle.id_solicitud_reembolso;

      // Eliminar archivo físico si existe
      if (detalle.ruta_file_denuncia) {
        try {
          const fs = require('fs');
          const path = require('path');
          const filePath = path.join(process.cwd(), detalle.ruta_file_denuncia);
          
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`🗑️ Archivo de denuncia eliminado: ${detalle.ruta_file_denuncia}`);
          }
        } catch (fileError) {
          console.error('⚠️ Error al eliminar archivo físico:', fileError);
          // No lanzar error, continuar con la eliminación del detalle
        }
      }

      // Eliminar el detalle
      await this.detalleRepo.remove(detalle);

      // Recalcular números correlativos
      await this.recalcularNumerosCorrelativos(idSolicitud);

      // Actualizar totales
      await this.recalcularTotalesSolicitud(idSolicitud);

      return {
        mensaje: 'Detalle eliminado exitosamente'
      };

    } catch (error) {
      console.error('Error al eliminar detalle:', error);
      throw error;
    }
  }

  //7.- ACTUALIZAR TOTALES DE SOLICITUD ----------------------------------------------------------------------------------------
  async actualizarTotales(idSolicitud: number, totales: any) {
    try {
      const solicitud = await this.reembolsoRepo.findOne({
        where: { id_solicitud_reembolso: idSolicitud }
      });

      if (!solicitud) {
        throw new NotFoundException('No se encontró la solicitud de reembolso');
      }

      // Actualizar totales
      solicitud.total_reembolso = totales.total_reembolso;
      solicitud.total_trabajadores = totales.total_trabajadores;
      solicitud.usuario_modificacion = totales.usuario_modificacion || 'SYSTEM';
      solicitud.fecha_modificacion = new Date();

      await this.reembolsoRepo.save(solicitud);

      return {
        mensaje: 'Totales actualizados exitosamente',
        solicitud: solicitud
      };

    } catch (error) {
      console.error('Error al actualizar totales:', error);
      throw error;
    }
  }

// TODO : CALCULO DE BAJAS 

//8.- CALCULAR REEMBOLSO CON DATOS REALES ----------------------------------------------------------------------------------------
 async calcularReembolsoConDatosReales(calcularDto: any) {
  try {
    const { matricula, cod_patronal, mes, gestion, baja_medica } = calcularDto;

    console.log('\n╔═══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║         INICIO DE CÁLCULO DE REEMBOLSO POR INCAPACIDAD                       ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════════╝\n');

    // 1. Buscar datos del trabajador en planillas de aportes usando el método correcto
    console.log('📋 PASO 1: BÚSQUEDA DE INFORMACIÓN EN PLANILLAS');
    console.log('─'.repeat(80));
    console.log(`   • Código Patronal: ${cod_patronal}`);
    console.log(`   • Mes: ${mes}`);
    console.log(`   • Gestión: ${gestion}`);
    console.log(`   • Matrícula buscada: ${matricula}`);
    console.log('');

    const detallesTrabajador = await this.planillasService.obtenerDetallesDeMes(
      cod_patronal, mes, gestion
    );

    console.log(`   ✓ Planilla encontrada con ${detallesTrabajador.length} trabajador(es)\n`);

    // 2. Buscar el trabajador específico por matrícula
    const trabajador = detallesTrabajador.find(
      (detalle: any) => detalle.matricula === matricula
    );

    if (!trabajador) {
      console.log(`   ✗ ERROR: No se encontró el trabajador con matrícula ${matricula}\n`);
      throw new NotFoundException(
        `No se encontró el trabajador con matrícula ${matricula} en la planilla de ${mes}/${gestion}`
      );
    }

    // 3. Extraer datos reales del trabajador
    const datosReales = {
      ci: trabajador.ci,
      apellido_paterno: trabajador.apellido_paterno,
      apellido_materno: trabajador.apellido_materno,
      nombres: trabajador.nombres,
      salario_total: Number(trabajador.salario),
      haber_basico: Number(trabajador.haber_basico || 0),
      bono_antiguedad: Number(trabajador.bono_antiguedad || 0),
      horas_extra: Number(trabajador.monto_horas_extra || 0),
      horas_extra_nocturnas: Number(trabajador.monto_horas_extra_nocturnas || 0),
      otros_bonos: Number(trabajador.otros_bonos_pagos || 0),
      dias_pagados: Number(trabajador.dias_pagados),
      cargo: trabajador.cargo,
      matricula: trabajador.matricula
    };

    console.log('👤 PASO 2: DATOS DEL TRABAJADOR ENCONTRADO');
    console.log('─'.repeat(80));
    console.log(`   • Nombre Completo: ${datosReales.apellido_paterno} ${datosReales.apellido_materno} ${datosReales.nombres}`);
    console.log(`   • CI: ${datosReales.ci}`);
    console.log(`   • Matrícula: ${datosReales.matricula}`);
    console.log(`   • Cargo: ${datosReales.cargo}`);
    console.log(`   • Días pagados en la planilla: ${datosReales.dias_pagados}`);
    console.log('');
    console.log('   💰 INFORMACIÓN SALARIAL:');
    console.log(`      ├─ Haber Básico: Bs. ${datosReales.haber_basico.toFixed(2)}`);
    console.log(`      ├─ Bono Antigüedad: Bs. ${datosReales.bono_antiguedad.toFixed(2)}`);
    console.log(`      ├─ Horas Extra: Bs. ${datosReales.horas_extra.toFixed(2)}`);
    console.log(`      ├─ Horas Extra Nocturnas: Bs. ${datosReales.horas_extra_nocturnas.toFixed(2)}`);
    console.log(`      ├─ Otros Bonos: Bs. ${datosReales.otros_bonos.toFixed(2)}`);
    console.log(`      └─ 💵 SALARIO TOTAL: Bs. ${datosReales.salario_total.toFixed(2)}`);
    console.log('');
    console.log('   📊 ORIGEN DE LOS DATOS:');
    console.log(`      └─ Planilla de ${mes}/${gestion} - Código Patronal: ${cod_patronal}\n`);

    // 4. Realizar cálculos según PDF (casos complejos)
    const calculoDetallado = await this.calcularSegunCasosPDF(baja_medica, datosReales, mes, gestion);

    console.log('╔═══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║         CÁLCULO DE REEMBOLSO FINALIZADO EXITOSAMENTE                         ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════════╝\n');

    return {
      mensaje: 'Cálculo realizado exitosamente',
      datos_trabajador: datosReales,
      baja_medica: baja_medica,
      calculo: calculoDetallado
    };

  } catch (error) {
    console.error('\n❌ ERROR EN EL CÁLCULO DE REEMBOLSO:', error.message);
    console.error('═'.repeat(80) + '\n');
    throw error;
  }
}

//10.- OBTENER SALARIO DE TRABAJADOR DESDE PLANILLAS ------------------------------------------------------------------------------------
async obtenerSalarioTrabajador(cod_patronal: string, mes: string, gestion: string, matricula: string) {
  try {
    console.log('\n🔍 CONSULTANDO SALARIO DE TRABAJADOR');
    console.log('─'.repeat(80));
    console.log(`   • Código Patronal: ${cod_patronal}`);
    console.log(`   • Mes: ${mes}`);
    console.log(`   • Gestión: ${gestion}`);
    console.log(`   • Matrícula: ${matricula}`);

    // Usar el mismo método que funciona en calcularReembolsoConDatosReales
    const detallesTrabajador = await this.planillasService.obtenerDetallesDeMes(
      cod_patronal, mes, gestion
    );

    console.log(`   ✓ Planilla encontrada con ${detallesTrabajador.length} trabajador(es)`);

    // Buscar el trabajador específico por matrícula
    const trabajador = detallesTrabajador.find(
      (detalle: any) => detalle.matricula === matricula
    );

    if (!trabajador) {
      console.log(`   ✗ No se encontró el trabajador con matrícula ${matricula}`);
      return {
        status: false,
        message: `No se encontró el trabajador con matrícula ${matricula} en la planilla de ${mes}/${gestion}`,
        data: null
      };
    }

    // Extraer datos salariales del trabajador (igual que en calcularReembolsoConDatosReales)
    const datosSalariales = {
      ci: trabajador.ci,
      apellido_paterno: trabajador.apellido_paterno,
      apellido_materno: trabajador.apellido_materno,
      nombres: trabajador.nombres,
      matricula: trabajador.matricula,
      salario_total: Number(trabajador.salario),
      haber_basico: Number(trabajador.haber_basico || 0),
      bono_antiguedad: Number(trabajador.bono_antiguedad || 0),
      horas_extra: Number(trabajador.monto_horas_extra || 0),
      horas_extra_nocturnas: Number(trabajador.monto_horas_extra_nocturnas || 0),
      otros_bonos: Number(trabajador.otros_bonos_pagos || 0),
      dias_pagados: Number(trabajador.dias_pagados ),
      cargo: trabajador.cargo
    };

    console.log(`   ✓ Trabajador encontrado: ${datosSalariales.apellido_paterno} ${datosSalariales.apellido_materno} ${datosSalariales.nombres}`);
    console.log(`   ✓ Salario Total: Bs. ${datosSalariales.salario_total.toFixed(2)}`);
    console.log(`   ✓ Días pagados: ${datosSalariales.dias_pagados} días`);

    return {
      status: true,
      message: 'Salario obtenido exitosamente',
      data: datosSalariales
    };

  } catch (error) {
    console.error('\n❌ ERROR AL CONSULTAR SALARIO:', error.message);
    return {
      status: false,
      message: `Error al consultar salario: ${error.message}`,
      data: null
    };
  }
}

//9.- CALCULAR REEMBOLSO EN MODO PRUEBA (Sin validar planilla) ----------------------------------------------------------------------------------------
async calcularReembolsoPrueba(calcularDto: any) {
  try {
    const { datos_trabajador, baja_medica, mes, gestion } = calcularDto;

    console.log('\n╔═══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║         🧪 MODO PRUEBA: CÁLCULO DE REEMBOLSO SIN VALIDAR PLANILLA           ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════════╝\n');

    console.log('👤 DATOS DEL TRABAJADOR (MODO PRUEBA):');
    console.log('─'.repeat(80));
    console.log(`   • Nombre Completo: ${datos_trabajador.apellido_paterno} ${datos_trabajador.apellido_materno} ${datos_trabajador.nombres}`);
    console.log(`   • CI: ${datos_trabajador.ci}`);
    console.log(`   • Matrícula: ${datos_trabajador.matricula}`);
    console.log(`   • Salario Total: Bs. ${datos_trabajador.salario.toFixed(2)}`);
    console.log('');

    console.log('📋 DATOS DE LA BAJA MÉDICA:');
    console.log('─'.repeat(80));
    console.log(`   • Tipo: ${baja_medica.tipo_baja}`);
    console.log(`   • Fecha Inicio: ${baja_medica.fecha_inicio}`);
    console.log(`   • Fecha Fin: ${baja_medica.fecha_fin}`);
    console.log(`   • Días de impedimento: ${baja_medica.dias_impedimento}`);
    console.log(`   • Mes/Gestión reembolso: ${mes}/${gestion}`);
    console.log('');

    // 🔥 CRÍTICO: Extraer dias_pagados directamente
    console.log('🔍 DEBUG EXTRACCIÓN DE DÍAS PAGADOS:');
    console.log(`   • datos_trabajador.dias_pagados (directo): ${datos_trabajador.dias_pagados}`);
    console.log(`   • Tipo: ${typeof datos_trabajador.dias_pagados}`);
    
    // Intentar múltiples formas de extraer el valor
    const diasPagados = Number(datos_trabajador.dias_pagados) || 
                        Number(datos_trabajador['dias_pagados']) || 
                        30;
    
    console.log(`   • Valor final extraído: ${diasPagados}`);
    console.log('');
    
    console.log(`📊 MODO PRUEBA - Días pagados recibidos: ${diasPagados}`);

    // Preparar datos en el formato que espera calcularSegunCasosPDF
    const datosWorkerFormateados = {
      ci: datos_trabajador.ci,
      apellido_paterno: datos_trabajador.apellido_paterno,
      apellido_materno: datos_trabajador.apellido_materno,
      nombres: datos_trabajador.nombres,
      salario_total: Number(datos_trabajador.salario),
      haber_basico: Number(datos_trabajador.salario),
      bono_antiguedad: 0,
      horas_extra: 0,
      horas_extra_nocturnas: 0,
      otros_bonos: 0,
      dias_pagados: diasPagados,
      cargo: 'TRABAJADOR PRUEBA',
      matricula: datos_trabajador.matricula
    };

    // Preparar baja médica en el formato esperado
    const bajaMedicaFormateada = {
      TIPO_BAJA: baja_medica.tipo_baja,
      DIA_DESDE: baja_medica.fecha_inicio,
      DIA_HASTA: baja_medica.fecha_fin,
      DIAS_IMPEDIMENTO: baja_medica.dias_impedimento,
      ESP_NOM: baja_medica.especialidad || 'MEDICINA GENERAL',
      MEDI_NOM: baja_medica.medico || 'DR. PRUEBA TESTING',
      COMPROBANTE: baja_medica.comprobante || 999999,
      ASE_MAT: datos_trabajador.matricula
    };

    // Usar el mismo método de cálculo que el modo real CON MES Y GESTIÓN
    const calculoDetallado = await this.calcularSegunCasosPDF(
      bajaMedicaFormateada, 
      datosWorkerFormateados, 
      mes, 
      gestion
    );

    console.log('╔═══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║         🧪 CÁLCULO DE PRUEBA FINALIZADO EXITOSAMENTE                        ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════════╝\n');

    return {
      mensaje: 'Cálculo de prueba realizado exitosamente',
      datos_trabajador: datosWorkerFormateados,
      baja_medica: bajaMedicaFormateada,
      calculo: calculoDetallado
    };

  } catch (error) {
    console.error('\n❌ ERROR EN EL CÁLCULO DE PRUEBA:', error.message);
    console.error('═'.repeat(80) + '\n');
    throw error;
  }
}


//MÉTODO AUXILIAR PARA CALCULAR INTERSECCIÓN DE FECHAS CON EL MES ----------------------------------------------------------------------------------------
private calcularDiasEnMes(fechaInicioBaja: Date, fechaFinBaja: Date, mesReembolso: string, gestionReembolso: string): {
  diasEnMes: number;
  fechaInicioEnMes: Date;
  fechaFinEnMes: Date;
} {
  const mesNum = parseInt(mesReembolso);
  const gestionNum = parseInt(gestionReembolso);
  
  const inicioMesReembolso = new Date(Date.UTC(gestionNum, mesNum - 1, 1));
  
  // 🔥 AJUSTE: Limitar a día 30 para meses comerciales (excepto febrero)
  let diaLimite = 30;
  if (mesNum === 2) {
    // Para febrero, usar el último día real (28 o 29)
    diaLimite = new Date(Date.UTC(gestionNum, mesNum, 0)).getUTCDate();
  }
  
  const finMesReembolso = new Date(Date.UTC(gestionNum, mesNum - 1, diaLimite));
  
  console.log(`   📆 MES DE REEMBOLSO: ${mesNum}/${gestionNum}`);
  console.log(`      ├─ Inicio del mes: ${inicioMesReembolso.toISOString().split('T')[0]}`);
  console.log(`      ├─ Fin del mes (día ${diaLimite}): ${finMesReembolso.toISOString().split('T')[0]}`);
  console.log(`      └─ Límite aplicado: Mes comercial de 30 días${mesNum === 2 ? ' (febrero: ' + diaLimite + ' días)' : ''}`);
  console.log('');

  const fechaInicioBajaUTC = new Date(Date.UTC(
    fechaInicioBaja.getFullYear(),
    fechaInicioBaja.getMonth(),
    fechaInicioBaja.getDate()
  ));
  
  const fechaFinBajaUTC = new Date(Date.UTC(
    fechaFinBaja.getFullYear(),
    fechaFinBaja.getMonth(),
    fechaFinBaja.getDate()
  ));

  const fechaInicioEnMes = fechaInicioBajaUTC > inicioMesReembolso ? fechaInicioBajaUTC : inicioMesReembolso;
  const fechaFinEnMes = fechaFinBajaUTC < finMesReembolso ? fechaFinBajaUTC : finMesReembolso;

  if (fechaInicioEnMes > fechaFinEnMes) {
    console.log('   ⚠️  LA BAJA NO TIENE DÍAS EN EL MES DE REEMBOLSO');
    return {
      diasEnMes: 0,
      fechaInicioEnMes,
      fechaFinEnMes
    };
  }

  const diffTime = fechaFinEnMes.getTime() - fechaInicioEnMes.getTime();
  let diasEnMes = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;

  console.log(`   🔢 CÁLCULO DE DÍAS REALES:`);
  console.log(`      ├─ Desde: ${fechaInicioEnMes.toISOString().split('T')[0]}`);
  console.log(`      ├─ Hasta: ${fechaFinEnMes.toISOString().split('T')[0]}`);
  console.log(`      └─ Días calculados: ${diasEnMes}`);

  // 🔥 AJUSTE ESPECIAL PARA FEBRERO
  if (mesNum === 2) {
    const mesBajaInicio = fechaInicioBajaUTC.getUTCMonth() + 1;
    const mesBajaFin = fechaFinBajaUTC.getUTCMonth() + 1;
    
    const bajaCruzaMeses = mesBajaInicio !== mesBajaFin || 
                           fechaInicioBajaUTC < inicioMesReembolso || 
                           fechaFinBajaUTC > finMesReembolso;
    
    if (bajaCruzaMeses) {
      const diasRealesFebrero = diasEnMes;
      diasEnMes = diasEnMes + 2;
      
      console.log('   🗓️  AJUSTE ESPECIAL PARA FEBRERO (BAJA CRUZA MESES):');
      console.log(`      ├─ Días reales en febrero: ${diasRealesFebrero}`);
      console.log(`      └─ Días ajustados (base 30): ${diasEnMes} días (+2)`);
      console.log('');
    } else {
      console.log('   ℹ️  BAJA COMPLETA DENTRO DE FEBRERO (SIN AJUSTE):');
      console.log(`      └─ Días: ${diasEnMes} (no se agrega +2 porque no cruza meses)`);
      console.log('');
    }
  }

  console.log('   📊 INTERSECCIÓN CON EL MES:');
  console.log(`      ├─ Correspondiente al mes: DE ${fechaInicioEnMes.toISOString().split('T')[0]} A ${fechaFinEnMes.toISOString().split('T')[0]}`);
  console.log(`      └─ Días en el mes: ${diasEnMes} días`);
  console.log('');

  return {
    diasEnMes,
    fechaInicioEnMes,
    fechaFinEnMes
  };
}



//MÉTODO AUXILIAR PARA CÁLCULOS SEGÚN PDF ----------------------------------------------------------------------------------------
 private async calcularSegunCasosPDF(bajaMedica: any, datosWorker: any, mesReembolso: string, gestionReembolso: string) {
  
  console.log('🔢 PASO 3: PROCESO DE CÁLCULO DE REEMBOLSO');
  console.log('─'.repeat(80));
  
  // Extraer fechas de la baja médica
  let fechaInicioBaja = new Date(bajaMedica.DIA_DESDE);
  const fechaFinBaja = new Date(bajaMedica.DIA_HASTA);
  
  // Guardar fechas originales para mostrar en "CORRESPONDIENTE AL MES"
  const fechaInicioOriginal = new Date(fechaInicioBaja);
  const fechaFinOriginal = new Date(fechaFinBaja);
  
  console.log('   📅 FECHAS DE LA BAJA MÉDICA COMPLETA:');
  console.log(`      ├─ Fecha Inicio: ${fechaInicioBaja.toLocaleDateString('es-BO')} (${bajaMedica.DIA_DESDE})`);
  console.log(`      └─ Fecha Fin: ${fechaFinBaja.toLocaleDateString('es-BO')} (${bajaMedica.DIA_HASTA})`);
  console.log('');

  // CALCULAR DÍAS TOTALES DE LA BAJA (REFERENCIA)
  const milisecondsDiffTotal = fechaFinBaja.getTime() - fechaInicioBaja.getTime();
  const diasTotalesBaja = Math.floor(milisecondsDiffTotal / (1000 * 60 * 60 * 24)) + 1;
  
  console.log('   📏 DÍAS TOTALES DE LA BAJA (REFERENCIA):');
  console.log(`      └─ Total: ${diasTotalesBaja} días`);
  console.log('');

  // CALCULAR SOLO LOS DÍAS QUE CAEN EN EL MES DE REEMBOLSO (con fechas originales)
  const { diasEnMes: diasTotalesIncapacidad, fechaInicioEnMes, fechaFinEnMes } = this.calcularDiasEnMes(
    fechaInicioOriginal, 
    fechaFinOriginal, 
    mesReembolso, 
    gestionReembolso
  );
  
  // Determinar tipo de incapacidad
  const tipoIncapacidad = bajaMedica.TIPO_BAJA.trim();
  
  // Porcentajes según tipo
  const porcentajes = {
    'ENFERMEDAD': 75,
    'MATERNIDAD': 90,
    'PROFESIONAL': 90
  };
  
  const porcentajeReembolso = porcentajes[tipoIncapacidad] || 75;
  
  console.log('   📋 TIPO DE INCAPACIDAD:');
  console.log(`      ├─ Tipo: ${tipoIncapacidad}`);
  console.log(`      └─ Porcentaje de reembolso: ${porcentajeReembolso}%`);
  console.log('');
  
  // Calcular días de reembolso según tipo
  let diasReembolso = 0;
  let explicacionCalculo = '';
  
  // Determinar si la baja empieza en el mes de reembolso o en un mes anterior
  const mesNum = parseInt(mesReembolso);
  const gestionNum = parseInt(gestionReembolso);
  const mesBajaInicio = fechaInicioBaja.getMonth() + 1; // getMonth() devuelve 0-11
  const gestionBajaInicio = fechaInicioBaja.getFullYear();
  
  const bajaEmpiezaEnMesAnterior = (gestionBajaInicio < gestionNum) || 
                                   (gestionBajaInicio === gestionNum && mesBajaInicio < mesNum);
  
  if (tipoIncapacidad === 'ENFERMEDAD') {
    // Para enfermedad común, los 3 días de carencia solo se descuentan en el PRIMER mes de la baja
    if (bajaEmpiezaEnMesAnterior) {
      // Si la baja empezó en un mes anterior, NO se descuentan los 3 días en este mes
      diasReembolso = diasTotalesIncapacidad;
      explicacionCalculo = `Enfermedad común (continúa de mes anterior): ${diasTotalesIncapacidad} días (sin descuento, ya se aplicó en el mes de inicio)`;
    } else {
      // Si la baja empieza en este mes, se descuentan los 3 días
      diasReembolso = Math.max(0, diasTotalesIncapacidad - 3);
      explicacionCalculo = `Enfermedad común (inicia en este mes): ${diasTotalesIncapacidad} días - 3 días de carencia = ${diasReembolso} días`;
    }
  } else if (tipoIncapacidad === 'MATERNIDAD') {
    // Para maternidad, todos los días del mes
    diasReembolso = diasTotalesIncapacidad;
    explicacionCalculo = `Maternidad: ${diasTotalesIncapacidad} días (sin descuento)`;
  } else if (tipoIncapacidad === 'PROFESIONAL' || tipoIncapacidad === 'ACCIDENTE DE TRABAJO' || tipoIncapacidad === 'ENFERMEDAD PROFESIONAL') {
    // Para riesgo profesional, validar fechas de vigencia según lugar de accidente
    const fechaAccidente = bajaMedica.fecha_accidente ? this.crearFechaSinZonaHoraria(bajaMedica.fecha_accidente) : null;
    const fechaVigencia = bajaMedica.fecha_vigencia ? this.crearFechaSinZonaHoraria(bajaMedica.fecha_vigencia) : null;
    const lugarAccidente = bajaMedica.lugar_accidente;
    
    if (fechaAccidente && fechaVigencia && lugarAccidente) {
      console.log('   🏥 VALIDACIÓN DE FECHAS DE VIGENCIA (RIESGO PROFESIONAL):');
      console.log(`      ├─ Fecha de Accidente: ${fechaAccidente.toLocaleDateString('es-BO')}`);
      console.log(`      ├─ Fecha de Vigencia: ${fechaVigencia.toLocaleDateString('es-BO')}`);
      console.log(`      └─ Lugar de Accidente: ${lugarAccidente}`);
      
      // Calcular días hábiles permitidos según lugar
      const diasPermitidos = lugarAccidente === 'RURAL' ? 10 : 5;
      console.log(`      └─ Días hábiles permitidos: ${diasPermitidos} días (${lugarAccidente})`);
      
      // Calcular días hábiles entre fecha de accidente y fecha de vigencia
      const diasHabilesTranscurridos = this.calcularDiasHabiles(fechaAccidente, fechaVigencia);
      console.log(`      └─ Días hábiles transcurridos: ${diasHabilesTranscurridos} días`);
      
      if (diasHabilesTranscurridos <= diasPermitidos) {
        // La fecha de vigencia está dentro del rango permitido - NO APLICAR AJUSTE
        // Recalcular días en el mes con las fechas originales
        const { diasEnMes: diasOriginalesEnMes, fechaInicioEnMes, fechaFinEnMes } = this.calcularDiasEnMes(
          fechaInicioBaja, 
          fechaFinBaja, 
          mesReembolso, 
          gestionReembolso
        );
        
        diasReembolso = diasOriginalesEnMes;
        explicacionCalculo = `Riesgo profesional: fecha de vigencia válida (${diasHabilesTranscurridos}/${diasPermitidos} días hábiles) = ${diasReembolso} días`;
        console.log(`      ✅ Fecha de vigencia VÁLIDA: ${diasHabilesTranscurridos} días hábiles ≤ ${diasPermitidos} días permitidos`);
        console.log(`      ✅ NO SE APLICA AJUSTE - Usar fechas originales`);
        console.log(`      📊 Días en el mes (originales): ${diasOriginalesEnMes} días`);
        console.log(`      📊 Período en el mes: ${fechaInicioEnMes.toLocaleDateString('es-BO')} → ${fechaFinEnMes.toLocaleDateString('es-BO')}`);
      } else {
        // La fecha de vigencia excede el rango permitido, ajustar fecha consolidada
        const fechaInicioAjustada = this.ajustarFechaInicioSegunVigencia(fechaInicioBaja, fechaVigencia, diasPermitidos);
        console.log(`      ⚠️  Fecha de vigencia EXCEDIDA: ${diasHabilesTranscurridos} días hábiles > ${diasPermitidos} días permitidos`);
        console.log(`      🔄 Fecha de inicio original: ${fechaInicioBaja.toLocaleDateString('es-BO')}`);
        console.log(`      🔄 Fecha de inicio ajustada: ${fechaInicioAjustada.toLocaleDateString('es-BO')}`);
        console.log(`      🔄 Fecha de fin: ${fechaFinBaja.toLocaleDateString('es-BO')}`);
        
        // Recalcular días en el mes con la fecha ajustada
        const { diasEnMes: diasAjustadosEnMes, fechaInicioEnMes, fechaFinEnMes } = this.calcularDiasEnMes(
          fechaInicioAjustada, 
          fechaFinBaja, 
          mesReembolso, 
          gestionReembolso
        );
        
        diasReembolso = diasAjustadosEnMes;
        explicacionCalculo = `Riesgo profesional: fecha de vigencia excedida (${diasHabilesTranscurridos}/${diasPermitidos} días hábiles), fecha ajustada = ${diasReembolso} días`;
        console.log(`      📊 Días ajustados en el mes: ${diasAjustadosEnMes} días`);
        console.log(`      📊 Período ajustado: ${fechaInicioEnMes.toLocaleDateString('es-BO')} → ${fechaFinEnMes.toLocaleDateString('es-BO')}`);
        
        // Actualizar las fechas para el cálculo final
        fechaInicioBaja = fechaInicioAjustada;
      }
    } else {
      // Si no hay datos de fecha de accidente/vigencia, usar lógica normal
      diasReembolso = diasTotalesIncapacidad;
      explicacionCalculo = `Riesgo profesional: todos los días sin carencia = ${diasReembolso} días`;
      console.log('      ⚠️  No se proporcionaron datos de fecha de accidente/vigencia, usando cálculo normal');
    }
  }
  
  console.log('   🔍 ANÁLISIS DE CARENCIA:');
  if (tipoIncapacidad === 'ENFERMEDAD') {
    console.log(`      ├─ Mes de inicio de la baja: ${mesBajaInicio}/${gestionBajaInicio}`);
    console.log(`      ├─ Mes de reembolso: ${mesNum}/${gestionNum}`);
    console.log(`      └─ ¿Baja empezó en mes anterior?: ${bajaEmpiezaEnMesAnterior ? 'SÍ (no se descuentan 3 días)' : 'NO (se descuentan 3 días)'}`);
  }
  console.log('');
  
  // APLICAR LÍMITE MÁXIMO DE 30 DÍAS PARA TODOS LOS TIPOS
  const diasAntesLimite = diasReembolso;
  if (diasReembolso > 30) {
    diasReembolso = 30;
    explicacionCalculo += ` → Se aplica límite máximo de 30 días = ${diasReembolso} días`;
  }
  
  console.log('   ⏱️  DÍAS A REEMBOLSAR:');
  console.log(`      ├─ Días en el mes de reembolso: ${diasTotalesIncapacidad} días`);
  console.log(`      ├─ Lógica aplicada: ${explicacionCalculo}`);
  if (diasAntesLimite > 30) {
    console.log(`      ├─ ⚠️  Se aplicó límite: ${diasAntesLimite} días → 30 días (máximo)`);
  }
  console.log(`      └─ 💚 Días de reembolso final: ${diasReembolso} días`);
  console.log('');
  
  // Cálculos financieros
  const salarioDiario = datosWorker.salario_total / datosWorker.dias_pagados; // Usar días pagados reales de la planilla
  const montoReembolso = (salarioDiario * diasReembolso * porcentajeReembolso) / 100;
  
  console.log('   💰 CÁLCULOS FINANCIEROS:');
  console.log(`      ├─ Salario mensual del trabajador: Bs. ${datosWorker.salario_total.toFixed(2)}`);
  console.log(`      ├─ Días pagados en la planilla: ${datosWorker.dias_pagados} días`);
  console.log(`      ├─ Salario diario (${datosWorker.salario_total.toFixed(2)} ÷ ${datosWorker.dias_pagados}): Bs. ${salarioDiario.toFixed(6)}`);
  console.log(`      ├─ Días de reembolso: ${diasReembolso} días`);
  console.log(`      ├─ Porcentaje de reembolso: ${porcentajeReembolso}%`);
  console.log(`      ├─ Fórmula: (Salario Diario × Días Reembolso × Porcentaje) / 100`);
  console.log(`      ├─ Cálculo paso a paso:`);
  console.log(`      │   ├─ Paso 1: ${salarioDiario.toFixed(6)} × ${diasReembolso} = ${(salarioDiario * diasReembolso).toFixed(2)}`);
  console.log(`      │   ├─ Paso 2: ${(salarioDiario * diasReembolso).toFixed(2)} × ${porcentajeReembolso}% = ${((salarioDiario * diasReembolso) * porcentajeReembolso / 100).toFixed(2)}`);
  console.log(`      │   └─ Resultado final: Bs. ${montoReembolso.toFixed(2)}`);
  console.log(`      └─ 💵 MONTO REEMBOLSO: Bs. ${montoReembolso.toFixed(2)}`);
  console.log('');
  
  console.log('   ✅ RESUMEN DEL CÁLCULO:');
  console.log('   ┌─────────────────────────────────────────────────────────┐');
  console.log(`   │ Tipo: ${tipoIncapacidad.padEnd(48)} │`);
  console.log(`   │ Días incapacidad: ${String(diasTotalesIncapacidad).padEnd(38)} │`);
  console.log(`   │ Días a reembolsar: ${String(diasReembolso).padEnd(37)} │`);
  console.log(`   │ Porcentaje: ${String(porcentajeReembolso + '%').padEnd(43)} │`);
  console.log(`   │ Monto total: Bs. ${String(montoReembolso.toFixed(2)).padEnd(37)} │`);
  console.log('   └─────────────────────────────────────────────────────────┘');
  console.log('');

  // Calcular subtotal (monto_dia × dias_en_mes) antes de aplicar porcentaje
  const montoSubtotal = salarioDiario * diasReembolso;

  // Calcular las fechas correctas para "CORRESPONDIENTE AL MES"
  const { fechaInicioEnMes: fechaInicioCorrespondiente, fechaFinEnMes: fechaFinCorrespondiente } = this.calcularDiasEnMes(
    fechaInicioBaja, 
    fechaFinBaja, 
    mesReembolso, 
    gestionReembolso
  );

  return {
    tipo_incapacidad: tipoIncapacidad,
    // BAJA MÉDICA: Mostrar las fechas originales (antes del ajuste)
    fecha_inicio_baja: fechaInicioOriginal.toISOString().split('T')[0],
    fecha_fin_baja: fechaFinOriginal.toISOString().split('T')[0],
    dias_incapacidad: diasTotalesIncapacidad, // Días en el mes
    dias_reembolso: diasReembolso,
    salario: datosWorker.salario_total,
    monto_dia: parseFloat(salarioDiario.toFixed(6)),
    monto_subtotal: parseFloat(montoSubtotal.toFixed(2)),
    porcentaje_reembolso: porcentajeReembolso,
    monto_reembolso: parseFloat(montoReembolso.toFixed(6)),
    // Información adicional para el reporte
    dias_totales_baja: diasTotalesBaja, // Total de días de la baja (referencia)
    // CORRESPONDIENTE AL MES: Mostrar las fechas calculadas para el mes específico
    correspondiente_al_mes: {
      mes: mesReembolso,
      gestion: gestionReembolso,
      fecha_inicio: fechaInicioCorrespondiente.toISOString().split('T')[0],
      fecha_fin: fechaFinCorrespondiente.toISOString().split('T')[0],
      dias_en_mes: diasReembolso
    },
    // Información sobre ajuste de fechas para riesgo profesional
    ajuste_fechas: (() => {
      const esProfesional = tipoIncapacidad === 'PROFESIONAL';
      const fechasDiferentes = fechaInicioBaja.getTime() !== fechaInicioOriginal.getTime();
      const aplicado = esProfesional && fechasDiferentes;
      
      console.log('🔍 DEBUG AJUSTE_FECHAS:');
      console.log(`   ├─ Tipo: ${tipoIncapacidad} (es PROFESIONAL: ${esProfesional})`);
      console.log(`   ├─ Fecha original: ${fechaInicioOriginal.toISOString()}`);
      console.log(`   ├─ Fecha ajustada: ${fechaInicioBaja.toISOString()}`);
      console.log(`   ├─ Fechas diferentes: ${fechasDiferentes}`);
      console.log(`   └─ Aplicado: ${aplicado}`);
      
      return {
        aplicado,
        fecha_original: fechaInicioOriginal.toISOString().split('T')[0],
        fecha_ajustada: fechaInicioBaja.toISOString().split('T')[0],
        motivo: aplicado 
          ? `Fecha de vigencia excedida - Reembolso desde ${fechaInicioBaja.toLocaleDateString('es-BO')}` 
          : esProfesional 
            ? `Fecha de vigencia válida - Reembolso desde ${fechaInicioOriginal.toLocaleDateString('es-BO')}`
            : 'Sin ajuste aplicado'
      };
    })(),
    desglose_salarial: {
      haber_basico: datosWorker.haber_basico,
      bono_antiguedad: datosWorker.bono_antiguedad,
      horas_extra: datosWorker.horas_extra,
      horas_extra_nocturnas: datosWorker.horas_extra_nocturnas,
      otros_bonos: datosWorker.otros_bonos
    }
  };
} 


  // NUEVO MÉTODO: Presentar solicitud de reembolso
  async presentarSolicitud(idSolicitud: number, nombreUsuario?: string) {
    console.log('=== DEBUGGING BACKEND ===');
    console.log('idSolicitud:', idSolicitud);
    console.log('nombreUsuario recibido:', nombreUsuario);
    console.log('tipo de nombreUsuario:', typeof nombreUsuario);
    console.log('=== FIN DEBUGGING BACKEND ===');
    try {
      // Buscar la solicitud
      const solicitud = await this.reembolsoRepo.findOne({
        where: { id_solicitud_reembolso: idSolicitud }
      });

      if (!solicitud) {
        throw new NotFoundException('Solicitud de reembolso no encontrada');
      }

      // Verificar que esté en estado BORRADOR
      if (solicitud.estado !== 0) {
        throw new BadRequestException('Solo se pueden presentar solicitudes en estado BORRADOR');
      }

      // Verificar que tenga detalles
      const detalles = await this.detalleRepo.find({
        where: { id_solicitud_reembolso: idSolicitud }
      });

      if (detalles.length === 0) {
        throw new BadRequestException('No se puede presentar una solicitud sin trabajadores');
      }

      // Verificar denuncias de riesgo profesional
      const detallesProfesional = detalles.filter(detalle => 
        detalle.tipo_incapacidad === 'PROFESIONAL' || detalle.tipo_incapacidad === 'RIESGO_PROFESIONAL'
      );

      const denunciasFaltantes = detallesProfesional.filter(detalle => 
        !detalle.ruta_file_denuncia || detalle.ruta_file_denuncia.trim() === ''
      );

      if (denunciasFaltantes.length > 0) {
        throw new BadRequestException(`Faltan ${denunciasFaltantes.length} denuncias de riesgo profesional`);
      }

      // Actualizar estado a PRESENTADO
      solicitud.estado = 1;
      solicitud.fecha_presentacion = new Date();
      solicitud.nombre_usuario = nombreUsuario || 'Usuario del Sistema';
      solicitud.fecha_modificacion = new Date();
      
      await this.reembolsoRepo.save(solicitud);

      console.log(`📋 Solicitud presentada:
      - ID: ${idSolicitud}
      - Estado: PRESENTADO (1)
      - Fecha: ${solicitud.fecha_modificacion}
      - Trabajadores: ${detalles.length}`);

      return {
        mensaje: '✅ Solicitud presentada exitosamente',
        id_solicitud: idSolicitud,
        estado: 1,
        fecha_presentacion: solicitud.fecha_modificacion
      };

    } catch (error) {
      console.error('Error al presentar solicitud:', error);
      throw error;
    }
  }

  // NUEVO MÉTODO: Subir archivo de denuncia para riesgo profesional
  async subirArchivoDenuncia(idDetalle: number, file: Express.Multer.File): Promise<DetallesReembolso> {
    // Verificar que el detalle existe
    const detalle = await this.detalleRepo.findOne({
      where: { id_detalle_reembolso: idDetalle }
    });

    if (!detalle) {
      throw new NotFoundException('Detalle de reembolso no encontrado');
    }

    // Verificar que es de tipo RIESGO_PROFESIONAL o PROFESIONAL
    if (detalle.tipo_incapacidad !== 'RIESGO_PROFESIONAL' && detalle.tipo_incapacidad !== 'PROFESIONAL') {
      throw new BadRequestException('Solo se pueden subir archivos de denuncia para incapacidades de riesgo profesional');
    }

    // Guardar la ruta del archivo en la base de datos
    const rutaArchivo = join('denuncias', file.filename);
    detalle.ruta_file_denuncia = rutaArchivo;
    detalle.fecha_modificacion = new Date();

    await this.detalleRepo.save(detalle);

    return detalle;
  }

  // NUEVO MÉTODO: Obtener información del archivo de denuncia
  async obtenerArchivoDenuncia(idDetalle: number) {
    const detalle = await this.detalleRepo.findOne({
      where: { id_detalle_reembolso: idDetalle },
      select: ['id_detalle_reembolso', 'ruta_file_denuncia', 'tipo_incapacidad']
    });

    if (!detalle) {
      throw new NotFoundException('Detalle de reembolso no encontrado');
    }

    return {
      id_detalle_reembolso: detalle.id_detalle_reembolso,
      ruta_file_denuncia: detalle.ruta_file_denuncia,
      tiene_archivo: !!detalle.ruta_file_denuncia
    };
  }

  //MÉTODOS AUXILIARES ----------------------------------------------------------------------------------------

  private async recalcularTotalesSolicitud(idSolicitud: number) {
    // Obtener todos los detalles de la solicitud
    const detalles = await this.detalleRepo.find({
      where: { id_solicitud_reembolso: idSolicitud }
    });

    // Calcular totales
    const totalReembolso = detalles.reduce((sum, detalle) => sum + Number(detalle.monto_reembolso), 0);
    const totalTrabajadores = detalles.length;

    // Actualizar la solicitud
    await this.reembolsoRepo.update(idSolicitud, {
      total_reembolso: totalReembolso,
      total_trabajadores: totalTrabajadores,
      fecha_modificacion: new Date()
    });
  }

  private async recalcularNumerosCorrelativos(idSolicitud: number) {
    const detalles = await this.detalleRepo.find({
      where: { id_solicitud_reembolso: idSolicitud },
      order: { fecha_creacion: 'ASC' }
    });

    // Actualizar números correlativos
    for (let i = 0; i < detalles.length; i++) {
      await this.detalleRepo.update(detalles[i].id_detalle_reembolso, {
        nro: i + 1
      });
    }
  }

  // MÉTODOS AUXILIARES PARA VALIDACIÓN DE FECHAS DE VIGENCIA
  
  /**
   * Calcula los días hábiles entre dos fechas (excluyendo sábados y domingos)
   */
  private calcularDiasHabiles(fechaInicio: Date, fechaFin: Date): number {
    let diasHabiles = 0;
    const fechaActual = new Date(fechaInicio);
    
    // Empezar desde el día siguiente al accidente
    fechaActual.setDate(fechaActual.getDate() + 1);
    
    while (fechaActual <= fechaFin) {
      const diaSemana = fechaActual.getDay();
      // Excluir sábados (6) y domingos (0)
      if (diaSemana !== 0 && diaSemana !== 6) {
        diasHabiles++;
      }
      fechaActual.setDate(fechaActual.getDate() + 1);
    }
    
    console.log(`🔍 DEBUG calcularDiasHabiles:`);
    console.log(`   ├─ Fecha inicio: ${fechaInicio.toLocaleDateString('es-BO')}`);
    console.log(`   ├─ Fecha fin: ${fechaFin.toLocaleDateString('es-BO')}`);
    console.log(`   └─ Días hábiles calculados: ${diasHabiles}`);
    
    return diasHabiles;
  }
  
  /**
   * Ajusta la fecha de inicio según la fecha de vigencia y los días permitidos
   * Lógica: Si se excede el plazo, la fecha de inicio se ajusta a la fecha de vigencia
   */
  private ajustarFechaInicioSegunVigencia(fechaInicioOriginal: Date, fechaVigencia: Date, diasPermitidos: number): Date {
    // Si se excede el plazo, la fecha de inicio se ajusta a la fecha de vigencia
    // Esto significa que solo se reembolsa desde la fecha de vigencia en adelante
    return new Date(fechaVigencia);
  }
  
  /**
   * Calcula los días entre dos fechas (inclusive)
   */
  private calcularDiasEntreFechas(fechaInicio: Date, fechaFin: Date): number {
    const milisecondsDiff = fechaFin.getTime() - fechaInicio.getTime();
    return Math.floor(milisecondsDiff / (1000 * 60 * 60 * 24)) + 1;
  }

  /**
   * Crea una fecha sin problemas de zona horaria
   */
  private crearFechaSinZonaHoraria(fechaString: string): Date {
    // Si viene en formato ISO con zona horaria, extraer solo la fecha
    if (fechaString.includes('T')) {
      const fechaParte = fechaString.split('T')[0];
      const [año, mes, dia] = fechaParte.split('-');
      return new Date(parseInt(año), parseInt(mes) - 1, parseInt(dia));
    }
    
    // Si viene en formato YYYY-MM-DD, crear fecha directamente
    const [año, mes, dia] = fechaString.split('-');
    return new Date(parseInt(año), parseInt(mes) - 1, parseInt(dia));
  }

  // ===== ENVIAR CORRECCIONES DE PLANILLA OBSERVADA =====
  async enviarCorrecciones(idSolicitud: number, usuarioCorreccion?: string) {
    try {
      console.log('📤 Enviando correcciones de planilla:', { idSolicitud, usuarioCorreccion });

      // Buscar la solicitud
      const solicitud = await this.reembolsoRepo.findOne({
        where: { id_solicitud_reembolso: idSolicitud }
      });

      if (!solicitud) {
        throw new NotFoundException('Solicitud de reembolso no encontrada');
      }

      // Verificar que esté en estado OBSERVADO (3)
      if (solicitud.estado !== 3) {
        throw new BadRequestException('Solo se pueden enviar correcciones de solicitudes en estado OBSERVADO');
      }

      // Obtener todos los detalles actuales
      const detalles = await this.detalleRepo.find({
        where: { id_solicitud_reembolso: idSolicitud }
      });

      // Recalcular totales basados en detalles no observados
      const detallesContabilizables = detalles.filter(d => d.estado_revision !== 'observado');
      const totalTrabajadores = detallesContabilizables.length;
      const totalReembolso = detallesContabilizables.reduce((sum, d) => 
        sum + parseFloat(d.monto_reembolso?.toString() || '0'), 0
      );

      // Actualizar la solicitud a estado PRESENTADO (1)
      await this.reembolsoRepo.update(idSolicitud, {
        estado: 1, // PRESENTADO
        total_trabajadores: totalTrabajadores,
        total_reembolso: totalReembolso,
        fecha_modificacion: new Date(),
        // Limpiar observaciones de la planilla
        observaciones: null
      });

      console.log('✅ Correcciones enviadas exitosamente:', {
        idSolicitud,
        totalTrabajadores,
        totalReembolso,
        detallesTotales: detalles.length,
        detallesContabilizables: detallesContabilizables.length,
        detallesObservados: detalles.length - detallesContabilizables.length
      });

      return {
        mensaje: 'Correcciones enviadas exitosamente',
        solicitud: {
          id: idSolicitud,
          estadoAnterior: 3,
          estadoNuevo: 1
        },
        resumen: {
          totalTrabajadores,
          totalReembolso,
          detallesTotales: detalles.length,
          detallesContabilizables: detallesContabilizables.length,
          detallesObservados: detalles.length - detallesContabilizables.length
        }
      };

    } catch (error) {
      console.error('❌ Error al enviar correcciones:', error);
      throw new BadRequestException(`Error al enviar correcciones: ${error.message}`);
    }
  }

  
}