-- ===================================================================
-- SCRIPTS SQL PARA PRUEBAS DE DETECCIÓN DE SOLAPES DE BAJAS
-- ===================================================================
-- Este script crea casos de prueba con bajas traslapadas para validar
-- la funcionalidad de detección de conflictos en el frontend.
--
-- IMPORTANTE: Ajusta los valores según tu base de datos:
-- 1. Revisa que exista una empresa con id_empresa válido
-- 2. Ajusta las fechas según necesites
-- 3. Verifica que el cod_patronal sea válido
-- ===================================================================

-- PASO 1: Verificar/Crear empresa de prueba (ajusta según tu caso)
-- Si ya tienes una empresa, usa su id_empresa y cod_patronal
-- Si no, descomenta y ajusta el siguiente INSERT:
/*
INSERT INTO transversales.empresas (id_empresa, cod_patronal, emp_nom, ...)
VALUES (999, 'TEST001', 'Empresa de Prueba', ...);
*/

-- PASO 2: Crear solicitud de reembolso de prueba
-- Ajusta: id_empresa, cod_patronal según tu base de datos
INSERT INTO transversales.solicitudes_reembolso (
    id_empresa,
    cod_patronal,
    mes,
    gestion,
    total_reembolso,
    total_trabajadores,
    estado,
    usuario_creacion,
    nombre_creacion,
    fecha_creacion,
    tipo_empresa,
    fecha_presentacion,
    nombre_usuario
) VALUES (
    1,  -- ⚠️ AJUSTA: id_empresa válido de tu base de datos
    'TEST001',  -- ⚠️ AJUSTA: cod_patronal válido
    '01',  -- Enero
    '2025',
    0,  -- Se recalculará con los detalles
    0,  -- Se recalculará con los detalles
    1,  -- Estado: 1 = PRESENTADO (para que aparezca en la vista del admin)
    'admin',
    'Administrador de Prueba',
    CURRENT_TIMESTAMP,
    'PRIVADA',
    CURRENT_TIMESTAMP,
    'admin@test.com'
)
RETURNING id_solicitud_reembolso;

-- Guarda el id_solicitud_reembolso retornado para usarlo en los siguientes INSERTs
-- Por ejemplo, si retorna 100, usa ese valor en los siguientes scripts

-- ===================================================================
-- CASO DE PRUEBA 1: SOLAPE COMPLETO (Maternidad cubre Enfermedad)
-- ===================================================================
-- Trabajador: Juan Pérez
-- - Enfermedad: 01/01/2025 al 13/01/2025 (13 días)
-- - Maternidad: 20/12/2024 al 02/02/2025 (cubre todo el período de enfermedad)
-- Resultado esperado: Debe detectar solape, admin debe decidir cuál mantener

-- Detalle 1: Enfermedad (será cubierta por maternidad)
INSERT INTO transversales.detalles_reembolso (
    id_solicitud_reembolso,
    nro,
    ci,
    apellido_paterno,
    apellido_materno,
    nombres,
    matricula,
    tipo_incapacidad,
    fecha_inicio_baja,
    fecha_fin_baja,
    dias_incapacidad,
    dias_reembolso,
    dias_baja_total,
    dias_mes_reembolso,
    fecha_inicio_mes_reembolso,
    fecha_fin_mes_reembolso,
    salario,
    monto_dia,
    monto_subtotal,
    porcentaje_reembolso,
    monto_reembolso,
    cotizaciones_previas_verificadas,
    estado_revision,
    usuario_creacion,
    fecha_creacion
) VALUES (
    100,  -- ⚠️ AJUSTA: id_solicitud_reembolso del INSERT anterior
    1,
    '12345678',
    'Pérez',
    'García',
    'Juan',
    'MAT001',
    'ENFERMEDAD',  -- Tipo: Enfermedad
    '2025-01-01',  -- Inicio: 01/01/2025
    '2025-01-13',  -- Fin: 13/01/2025
    13,  -- Días totales
    10,  -- Días reembolso (descontando 3 días de carencia)
    13,
    10,
    '2025-01-01',
    '2025-01-13',
    3000.00,  -- Salario mensual
    100.00,   -- Salario por día (3000/30)
    1000.00,  -- Subtotal (100 * 10)
    75.00,    -- Porcentaje 75%
    750.00,   -- Monto reembolso (1000 * 0.75)
    2,        -- Cotizaciones previas verificadas
    NULL,     -- Estado revisión: NULL = neutro (sin revisar)
    'admin',
    CURRENT_TIMESTAMP
);

-- Detalle 2: Maternidad (cubre el período de enfermedad)
INSERT INTO transversales.detalles_reembolso (
    id_solicitud_reembolso,
    nro,
    ci,
    apellido_paterno,
    apellido_materno,
    nombres,
    matricula,
    tipo_incapacidad,
    fecha_inicio_baja,
    fecha_fin_baja,
    dias_incapacidad,
    dias_reembolso,
    dias_baja_total,
    dias_mes_reembolso,
    fecha_inicio_mes_reembolso,
    fecha_fin_mes_reembolso,
    salario,
    monto_dia,
    monto_subtotal,
    porcentaje_reembolso,
    monto_reembolso,
    cotizaciones_previas_verificadas,
    estado_revision,
    usuario_creacion,
    fecha_creacion
) VALUES (
    100,  -- ⚠️ AJUSTA: mismo id_solicitud_reembolso
    2,
    '12345678',  -- ⚠️ MISMO CI: mismo trabajador
    'Pérez',
    'García',
    'Juan',
    'MAT001',  -- ⚠️ MISMA MATRÍCULA
    'MATERNIDAD',  -- Tipo: Maternidad
    '2024-12-20',  -- Inicio: 20/12/2024 (ANTES de la enfermedad)
    '2025-02-02',  -- Fin: 02/02/2025 (DESPUÉS de la enfermedad)
    45,  -- Días totales
    45,  -- Días reembolso (sin carencia)
    45,
    45,
    '2024-12-20',
    '2025-02-02',
    3000.00,
    100.00,
    4500.00,  -- Subtotal (100 * 45)
    90.00,    -- Porcentaje 90%
    4050.00,  -- Monto reembolso (4500 * 0.90)
    4,        -- Cotizaciones previas verificadas
    NULL,     -- Estado revisión: NULL = neutro
    'admin',
    CURRENT_TIMESTAMP
);

-- ===================================================================
-- CASO DE PRUEBA 2: SOLAPE PARCIAL (Dos enfermedades que se solapan)
-- ===================================================================
-- Trabajador: María López
-- - Enfermedad 1: 05/01/2025 al 15/01/2025
-- - Enfermedad 2: 10/01/2025 al 20/01/2025
-- Resultado esperado: Debe detectar solape entre ambas

-- Detalle 3: Enfermedad 1
INSERT INTO transversales.detalles_reembolso (
    id_solicitud_reembolso,
    nro,
    ci,
    apellido_paterno,
    apellido_materno,
    nombres,
    matricula,
    tipo_incapacidad,
    fecha_inicio_baja,
    fecha_fin_baja,
    dias_incapacidad,
    dias_reembolso,
    dias_baja_total,
    dias_mes_reembolso,
    fecha_inicio_mes_reembolso,
    fecha_fin_mes_reembolso,
    salario,
    monto_dia,
    monto_subtotal,
    porcentaje_reembolso,
    monto_reembolso,
    cotizaciones_previas_verificadas,
    estado_revision,
    usuario_creacion,
    fecha_creacion
) VALUES (
    100,  -- ⚠️ AJUSTA: mismo id_solicitud_reembolso
    3,
    '87654321',
    'López',
    'Martínez',
    'María',
    'MAT002',
    'ENFERMEDAD',
    '2025-01-05',
    '2025-01-15',
    11,
    8,  -- 11 - 3 días carencia
    11,
    8,
    '2025-01-05',
    '2025-01-15',
    3500.00,
    116.67,
    933.36,
    75.00,
    700.02,
    2,
    NULL,
    'admin',
    CURRENT_TIMESTAMP
);

-- Detalle 4: Enfermedad 2 (se solapa con la anterior)
INSERT INTO transversales.detalles_reembolso (
    id_solicitud_reembolso,
    nro,
    ci,
    apellido_paterno,
    apellido_materno,
    nombres,
    matricula,
    tipo_incapacidad,
    fecha_inicio_baja,
    fecha_fin_baja,
    dias_incapacidad,
    dias_reembolso,
    dias_baja_total,
    dias_mes_reembolso,
    fecha_inicio_mes_reembolso,
    fecha_fin_mes_reembolso,
    salario,
    monto_dia,
    monto_subtotal,
    porcentaje_reembolso,
    monto_reembolso,
    cotizaciones_previas_verificadas,
    estado_revision,
    usuario_creacion,
    fecha_creacion
) VALUES (
    100,  -- ⚠️ AJUSTA: mismo id_solicitud_reembolso
    4,
    '87654321',  -- ⚠️ MISMO CI: mismo trabajador
    'López',
    'Martínez',
    'María',
    'MAT002',  -- ⚠️ MISMA MATRÍCULA
    'ENFERMEDAD',
    '2025-01-10',  -- Se solapa con la anterior (10/01 está dentro de 05/01-15/01)
    '2025-01-20',
    11,
    8,
    11,
    8,
    '2025-01-10',
    '2025-01-20',
    3500.00,
    116.67,
    933.36,
    75.00,
    700.02,
    2,
    NULL,
    'admin',
    CURRENT_TIMESTAMP
);

-- ===================================================================
-- CASO DE PRUEBA 3: SOLAPE ENTRE DIFERENTES TIPOS (Enfermedad y Riesgo Profesional)
-- ===================================================================
-- Trabajador: Carlos Rodríguez
-- - Enfermedad: 15/01/2025 al 25/01/2025
-- - Riesgo Profesional: 20/01/2025 al 30/01/2025
-- Resultado esperado: Debe detectar solape entre ambos tipos

-- Detalle 5: Enfermedad
INSERT INTO transversales.detalles_reembolso (
    id_solicitud_reembolso,
    nro,
    ci,
    apellido_paterno,
    apellido_materno,
    nombres,
    matricula,
    tipo_incapacidad,
    fecha_inicio_baja,
    fecha_fin_baja,
    dias_incapacidad,
    dias_reembolso,
    dias_baja_total,
    dias_mes_reembolso,
    fecha_inicio_mes_reembolso,
    fecha_fin_mes_reembolso,
    salario,
    monto_dia,
    monto_subtotal,
    porcentaje_reembolso,
    monto_reembolso,
    cotizaciones_previas_verificadas,
    estado_revision,
    usuario_creacion,
    fecha_creacion
) VALUES (
    100,  -- ⚠️ AJUSTA: mismo id_solicitud_reembolso
    5,
    '11223344',
    'Rodríguez',
    'Sánchez',
    'Carlos',
    'MAT003',
    'ENFERMEDAD',
    '2025-01-15',
    '2025-01-25',
    11,
    8,
    11,
    8,
    '2025-01-15',
    '2025-01-25',
    4000.00,
    133.33,
    1066.64,
    75.00,
    800.00,
    2,
    NULL,
    'admin',
    CURRENT_TIMESTAMP
);

-- Detalle 6: Riesgo Profesional (se solapa con la enfermedad)
INSERT INTO transversales.detalles_reembolso (
    id_solicitud_reembolso,
    nro,
    ci,
    apellido_paterno,
    apellido_materno,
    nombres,
    matricula,
    tipo_incapacidad,
    fecha_inicio_baja,
    fecha_fin_baja,
    dias_incapacidad,
    dias_reembolso,
    dias_baja_total,
    dias_mes_reembolso,
    fecha_inicio_mes_reembolso,
    fecha_fin_mes_reembolso,
    salario,
    monto_dia,
    monto_subtotal,
    porcentaje_reembolso,
    monto_reembolso,
    cotizaciones_previas_verificadas,
    estado_revision,
    fecha_accidente,
    lugar_accidente,
    usuario_creacion,
    fecha_creacion
) VALUES (
    100,  -- ⚠️ AJUSTA: mismo id_solicitud_reembolso
    6,
    '11223344',  -- ⚠️ MISMO CI: mismo trabajador
    'Rodríguez',
    'Sánchez',
    'Carlos',
    'MAT003',  -- ⚠️ MISMA MATRÍCULA
    'PROFESIONAL',  -- Tipo: Riesgo Profesional
    '2025-01-20',  -- Se solapa con la enfermedad (20/01 está dentro de 15/01-25/01)
    '2025-01-30',
    11,
    11,  -- Sin carencia
    11,
    11,
    '2025-01-20',
    '2025-01-30',
    4000.00,
    133.33,
    1466.63,
    90.00,
    1320.00,
    2,
    NULL,
    '2025-01-20',  -- Fecha del accidente
    'URBANO',  -- Lugar del accidente
    'admin',
    CURRENT_TIMESTAMP
);

-- ===================================================================
-- CASO DE PRUEBA 4: TRABAJADOR SIN SOLAPES (Control negativo)
-- ===================================================================
-- Trabajador: Ana Torres
-- - Enfermedad: 01/02/2025 al 10/02/2025
-- Resultado esperado: NO debe detectar solape (fechas no se solapan con otros)

-- Detalle 7: Enfermedad sin solape
INSERT INTO transversales.detalles_reembolso (
    id_solicitud_reembolso,
    nro,
    ci,
    apellido_paterno,
    apellido_materno,
    nombres,
    matricula,
    tipo_incapacidad,
    fecha_inicio_baja,
    fecha_fin_baja,
    dias_incapacidad,
    dias_reembolso,
    dias_baja_total,
    dias_mes_reembolso,
    fecha_inicio_mes_reembolso,
    fecha_fin_mes_reembolso,
    salario,
    monto_dia,
    monto_subtotal,
    porcentaje_reembolso,
    monto_reembolso,
    cotizaciones_previas_verificadas,
    estado_revision,
    usuario_creacion,
    fecha_creacion
) VALUES (
    100,  -- ⚠️ AJUSTA: mismo id_solicitud_reembolso
    7,
    '99887766',
    'Torres',
    'Vargas',
    'Ana',
    'MAT004',
    'ENFERMEDAD',
    '2025-02-01',  -- Fechas diferentes, no se solapa con otros
    '2025-02-10',
    10,
    7,
    10,
    7,
    '2025-02-01',
    '2025-02-10',
    3200.00,
    106.67,
    746.69,
    75.00,
    560.02,
    2,
    NULL,
    'admin',
    CURRENT_TIMESTAMP
);

-- ===================================================================
-- PASO 3: Actualizar totales de la solicitud
-- ===================================================================
-- Recalcula los totales de la solicitud basándose en los detalles insertados

UPDATE transversales.solicitudes_reembolso
SET 
    total_trabajadores = (
        SELECT COUNT(DISTINCT ci) 
        FROM transversales.detalles_reembolso 
        WHERE id_solicitud_reembolso = 100  -- ⚠️ AJUSTA: mismo id_solicitud_reembolso
    ),
    total_reembolso = (
        SELECT COALESCE(SUM(monto_reembolso), 0)
        FROM transversales.detalles_reembolso 
        WHERE id_solicitud_reembolso = 100  -- ⚠️ AJUSTA: mismo id_solicitud_reembolso
    )
WHERE id_solicitud_reembolso = 100;  -- ⚠️ AJUSTA: mismo id_solicitud_reembolso

-- ===================================================================
-- VERIFICACIÓN
-- ===================================================================
-- Ejecuta estas consultas para verificar los datos insertados:

-- Ver la solicitud creada:
SELECT * FROM transversales.solicitudes_reembolso 
WHERE id_solicitud_reembolso = 100;  -- ⚠️ AJUSTA

-- Ver todos los detalles:
SELECT 
    id_detalle_reembolso,
    nro,
    ci,
    nombres || ' ' || apellido_paterno || ' ' || apellido_materno AS nombre_completo,
    tipo_incapacidad,
    fecha_inicio_baja,
    fecha_fin_baja,
    dias_incapacidad,
    monto_reembolso,
    estado_revision
FROM transversales.detalles_reembolso
WHERE id_solicitud_reembolso = 100  -- ⚠️ AJUSTA
ORDER BY ci, fecha_inicio_baja;

-- Verificar solapes esperados:
-- 1. CI 12345678 (Juan Pérez): 2 detalles (Enfermedad y Maternidad) - DEBE SOLAPAR
-- 2. CI 87654321 (María López): 2 detalles (Enfermedad y Enfermedad) - DEBE SOLAPAR
-- 3. CI 11223344 (Carlos Rodríguez): 2 detalles (Enfermedad y Profesional) - DEBE SOLAPAR
-- 4. CI 99887766 (Ana Torres): 1 detalle (Enfermedad) - NO DEBE SOLAPAR

-- ===================================================================
-- NOTAS IMPORTANTES:
-- ===================================================================
-- 1. Ajusta todos los valores marcados con ⚠️ según tu base de datos
-- 2. El id_solicitud_reembolso se genera automáticamente, guárdalo
-- 3. Los estados de revisión están en NULL (neutro) para que el admin los revise
-- 4. Las fechas están diseñadas para crear solapes específicos
-- 5. Una vez insertados, ve al frontend y verifica que se detecten los conflictos
-- ===================================================================

