import { Test, TestingModule } from '@nestjs/testing';
import { ReembolsosIncapacidadesService } from './solicitudes_reembolso.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SolicitudesReembolso } from './entities/solicitudes_reembolso.entity';
import { DetallesReembolso } from './entities/detalles_reembolso.entity';
import { EmpresasService } from '../../empresas/empresas.service';
import { ExternalApiService } from '../../api-client/service/external-api.service';
import { PlanillasAportesService } from '../../planillas_aportes/planillas_aportes.service';

describe('ReembolsosIncapacidadesService - Cálculos', () => {
  let service: ReembolsosIncapacidadesService;

  // Mock repositories y servicios
  const mockReembolsoRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockDetalleRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    remove: jest.fn(),
  };

  const mockEmpresasService = {
    findByCodPatronal: jest.fn(),
  };

  const mockExternalApiService = {};
  const mockPlanillasService = {
    obtenerDetallesDeMes: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReembolsosIncapacidadesService,
        {
          provide: getRepositoryToken(SolicitudesReembolso),
          useValue: mockReembolsoRepo,
        },
        {
          provide: getRepositoryToken(DetallesReembolso),
          useValue: mockDetalleRepo,
        },
        {
          provide: EmpresasService,
          useValue: mockEmpresasService,
        },
        {
          provide: ExternalApiService,
          useValue: mockExternalApiService,
        },
        {
          provide: PlanillasAportesService,
          useValue: mockPlanillasService,
        },
      ],
    }).compile();

    service = module.get<ReembolsosIncapacidadesService>(ReembolsosIncapacidadesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Cálculos de Enfermedad Común', () => {
    const datosWorker = {
      ci: '12345678',
      apellido_paterno: 'PRUEBA',
      apellido_materno: 'TEST',
      nombres: 'JUAN CARLOS',
      salario_total: 4322.00,
      haber_basico: 4322.00,
      bono_antiguedad: 0,
      horas_extra: 0,
      horas_extra_nocturnas: 0,
      otros_bonos: 0,
      dias_pagados: 30,
      cargo: 'TRABAJADOR',
      matricula: '99-9999 XXX'
    };

    it('Caso 1: Baja que cruza de febrero a marzo (10/02 al 07/03)', async () => {
      const bajaMedica = {
        TIPO_BAJA: 'ENFERMEDAD',
        DIA_DESDE: '2025-02-10',
        DIA_HASTA: '2025-03-07',
        DIAS_IMPEDIMENTO: 26,
        ESP_NOM: 'MEDICINA GENERAL',
        MEDI_NOM: 'DR. PRUEBA',
        COMPROBANTE: 999999,
        ASE_MAT: '99-9999 XXX'
      };

      const resultado = await service.calcularReembolsoPrueba({
        datos_trabajador: {
          ci: datosWorker.ci,
          apellido_paterno: datosWorker.apellido_paterno,
          apellido_materno: datosWorker.apellido_materno,
          nombres: datosWorker.nombres,
          matricula: datosWorker.matricula,
          salario: datosWorker.salario_total
        },
        baja_medica: {
          tipo_baja: bajaMedica.TIPO_BAJA,
          fecha_inicio: bajaMedica.DIA_DESDE,
          fecha_fin: bajaMedica.DIA_HASTA,
          dias_impedimento: bajaMedica.DIAS_IMPEDIMENTO
        },
        mes: '02',
        gestion: '2025'
      });

      // Verificaciones
      expect(resultado.calculo.dias_totales_baja).toBe(26); // Total de la baja
      expect(resultado.calculo.correspondiente_al_mes.dias_en_mes).toBe(19); // Días reales en febrero
      expect(resultado.calculo.dias_reembolso).toBe(18); // 21 (con ajuste) - 3 carencia
      expect(resultado.calculo.monto_dia).toBeCloseTo(144.07, 2);
      expect(resultado.calculo.monto_subtotal).toBeCloseTo(2593.26, 2); // 144.07 × 18
      expect(resultado.calculo.monto_reembolso).toBeCloseTo(1944.95, 2); // 75%
      expect(resultado.calculo.porcentaje_reembolso).toBe(75);
    });

    it('Caso 2: Baja completa dentro de febrero (03/02 al 08/02)', async () => {
      const bajaMedica = {
        TIPO_BAJA: 'ENFERMEDAD',
        DIA_DESDE: '2025-02-03',
        DIA_HASTA: '2025-02-08',
        DIAS_IMPEDIMENTO: 6
      };

      const resultado = await service.calcularReembolsoPrueba({
        datos_trabajador: {
          ci: datosWorker.ci,
          apellido_paterno: datosWorker.apellido_paterno,
          apellido_materno: datosWorker.apellido_materno,
          nombres: datosWorker.nombres,
          matricula: datosWorker.matricula,
          salario: 6639.00
        },
        baja_medica: {
          tipo_baja: bajaMedica.TIPO_BAJA,
          fecha_inicio: bajaMedica.DIA_DESDE,
          fecha_fin: bajaMedica.DIA_HASTA,
          dias_impedimento: bajaMedica.DIAS_IMPEDIMENTO
        },
        mes: '02',
        gestion: '2025'
      });

      // NO debe aplicar ajuste +2 porque está dentro de febrero
      expect(resultado.calculo.dias_totales_baja).toBe(6);
      expect(resultado.calculo.correspondiente_al_mes.dias_en_mes).toBe(6); // Sin ajuste
      expect(resultado.calculo.dias_reembolso).toBe(3); // 6 - 3 carencia
      expect(resultado.calculo.monto_dia).toBeCloseTo(221.30, 2);
      expect(resultado.calculo.monto_subtotal).toBeCloseTo(663.90, 2); // 221.30 × 3
      expect(resultado.calculo.monto_reembolso).toBeCloseTo(497.93, 2);
    });

    it('Caso 3: Baja que empieza en enero y continúa en febrero', async () => {
      const bajaMedica = {
        TIPO_BAJA: 'ENFERMEDAD',
        DIA_DESDE: '2025-01-28',
        DIA_HASTA: '2025-02-10',
        DIAS_IMPEDIMENTO: 14
      };

      const resultado = await service.calcularReembolsoPrueba({
        datos_trabajador: {
          ci: datosWorker.ci,
          apellido_paterno: datosWorker.apellido_paterno,
          apellido_materno: datosWorker.apellido_materno,
          nombres: datosWorker.nombres,
          matricula: datosWorker.matricula,
          salario: 5000.00
        },
        baja_medica: {
          tipo_baja: bajaMedica.TIPO_BAJA,
          fecha_inicio: bajaMedica.DIA_DESDE,
          fecha_fin: bajaMedica.DIA_HASTA,
          dias_impedimento: bajaMedica.DIAS_IMPEDIMENTO
        },
        mes: '02',
        gestion: '2025'
      });

      // Cruza meses: debe aplicar +2
      // Del 01/02 al 10/02 = 10 días reales → 12 días con ajuste
      // Como viene de mes anterior, NO se descuenta carencia
      expect(resultado.calculo.correspondiente_al_mes.dias_en_mes).toBe(10); // Días reales
      expect(resultado.calculo.dias_reembolso).toBe(12); // Con ajuste, sin carencia
    });

    it('Caso 4: Baja en mes normal (no febrero) con carencia', async () => {
      const bajaMedica = {
        TIPO_BAJA: 'ENFERMEDAD',
        DIA_DESDE: '2025-01-07',
        DIA_HASTA: '2025-01-31',
        DIAS_IMPEDIMENTO: 25
      };

      const resultado = await service.calcularReembolsoPrueba({
        datos_trabajador: {
          ci: datosWorker.ci,
          apellido_paterno: datosWorker.apellido_paterno,
          apellido_materno: datosWorker.apellido_materno,
          nombres: datosWorker.nombres,
          matricula: datosWorker.matricula,
          salario: 13489.00
        },
        baja_medica: {
          tipo_baja: bajaMedica.TIPO_BAJA,
          fecha_inicio: bajaMedica.DIA_DESDE,
          fecha_fin: bajaMedica.DIA_HASTA,
          dias_impedimento: bajaMedica.DIAS_IMPEDIMENTO
        },
        mes: '01',
        gestion: '2025'
      });

      // Enero normal: 25 días, - 3 carencia = 22 días
      expect(resultado.calculo.dias_reembolso).toBe(22);
      expect(resultado.calculo.monto_dia).toBeCloseTo(449.63, 2);
      expect(resultado.calculo.monto_subtotal).toBeCloseTo(9891.86, 2); // 449.63 × 22
    });
  });

  describe('Cálculos de Maternidad', () => {
    it('Caso 1: Maternidad en febrero (cruza meses)', async () => {
      const resultado = await service.calcularReembolsoPrueba({
        datos_trabajador: {
          ci: '12345678',
          apellido_paterno: 'MONTAÑO',
          apellido_materno: 'HURTADO',
          nombres: 'JHOSELINE',
          matricula: '99-9999 XXX',
          salario: 8268.00
        },
        baja_medica: {
          tipo_baja: 'MATERNIDAD',
          fecha_inicio: '2024-12-13',
          fecha_fin: '2025-03-12',
          dias_impedimento: 90
        },
        mes: '02',
        gestion: '2025'
      });

      // Maternidad: sin carencia, porcentaje 90%
      // Febrero completo con ajuste: 28 + 2 = 30 días
      expect(resultado.calculo.dias_reembolso).toBe(30);
      expect(resultado.calculo.porcentaje_reembolso).toBe(90);
      expect(resultado.calculo.monto_dia).toBeCloseTo(275.60, 2);
      expect(resultado.calculo.monto_reembolso).toBeCloseTo(7441.20, 2); // (275.60 × 30) × 0.90
    });

    it('Caso 2: Maternidad en mes normal', async () => {
      const resultado = await service.calcularReembolsoPrueba({
        datos_trabajador: {
          ci: '12345678',
          apellido_paterno: 'MONTAÑO',
          apellido_materno: 'HURTADO',
          nombres: 'JHOSELINE',
          matricula: '99-9999 XXX',
          salario: 8268.00
        },
        baja_medica: {
          tipo_baja: 'MATERNIDAD',
          fecha_inicio: '2024-12-13',
          fecha_fin: '2025-03-12',
          dias_impedimento: 90
        },
        mes: '01',
        gestion: '2025'
      });

      // Enero completo: 30 días, sin carencia
      expect(resultado.calculo.dias_reembolso).toBe(30);
      expect(resultado.calculo.porcentaje_reembolso).toBe(90);
    });
  });

  describe('Cálculos de Riesgo Profesional', () => {
    it('Caso 1: Riesgo profesional en febrero', async () => {
      const resultado = await service.calcularReembolsoPrueba({
        datos_trabajador: {
          ci: '12345678',
          apellido_paterno: 'TRABAJADOR',
          apellido_materno: 'ACCIDENTE',
          nombres: 'PROFESIONAL',
          matricula: '99-9999 XXX',
          salario: 7500.00
        },
        baja_medica: {
          tipo_baja: 'PROFESIONAL',
          fecha_inicio: '2025-02-15',
          fecha_fin: '2025-03-05',
          dias_impedimento: 19
        },
        mes: '02',
        gestion: '2025'
      });

      // Riesgo profesional: sin carencia, 90%
      // Del 15/02 al 28/02 = 14 días reales → 16 días con ajuste
      expect(resultado.calculo.porcentaje_reembolso).toBe(90);
      expect(resultado.calculo.correspondiente_al_mes.dias_en_mes).toBe(14); // Días reales
      expect(resultado.calculo.dias_reembolso).toBe(16); // Con ajuste, sin carencia
    });
  });

  describe('Casos Edge y Validaciones', () => {
    it('Debe rechazar baja con días negativos', async () => {
      await expect(
        service.calcularReembolsoPrueba({
          datos_trabajador: {
            ci: '12345678',
            apellido_paterno: 'TEST',
            apellido_materno: 'ERROR',
            nombres: 'CASO',
            matricula: '99-9999 XXX',
            salario: 5000.00
          },
          baja_medica: {
            tipo_baja: 'ENFERMEDAD',
            fecha_inicio: '2025-02-10',
            fecha_fin: '2025-02-05', // Fecha fin antes que inicio
            dias_impedimento: -5
          },
          mes: '02',
          gestion: '2025'
        })
      ).rejects.toThrow();
    });

    it('Debe aplicar límite máximo de 30 días para enfermedad', async () => {
      const resultado = await service.calcularReembolsoPrueba({
        datos_trabajador: {
          ci: '12345678',
          apellido_paterno: 'TEST',
          apellido_materno: 'LIMITE',
          nombres: 'MAXIMO',
          matricula: '99-9999 XXX',
          salario: 5000.00
        },
        baja_medica: {
          tipo_baja: 'ENFERMEDAD',
          fecha_inicio: '2025-01-01',
          fecha_fin: '2025-01-31',
          dias_impedimento: 31
        },
        mes: '01',
        gestion: '2025'
      });

      // 31 - 3 = 28, pero con límite de 30 (no aplica en este caso)
      // Si fuera 33 días: 33 - 3 = 30 (límite)
      expect(resultado.calculo.dias_reembolso).toBeLessThanOrEqual(30);
    });
  });
});