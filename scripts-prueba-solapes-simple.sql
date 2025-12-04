-- ===================================================================
-- SCRIPT SIMPLIFICADO PARA PRUEBAS DE SOLAPES
-- ===================================================================
-- Este script obtiene automáticamente una empresa existente y crea
-- los casos de prueba. Solo necesitas ajustar el cod_patronal si es necesario.
-- ===================================================================

-- Obtener la primera empresa disponible (ajusta si necesitas otra)
DO $$
DECLARE
    v_id_empresa INTEGER;
    v_cod_patronal VARCHAR(200);
    v_id_solicitud INTEGER;
BEGIN
    -- Obtener empresa (ajusta la condición WHERE si necesitas una específica)
    SELECT id_empresa, cod_patronal 
    INTO v_id_empresa, v_cod_patronal
    FROM transversales.empresas 
    WHERE id_empresa IS NOT NULL 
    LIMIT 1;
    
    -- Si no hay empresa, crear una de prueba
    IF v_id_empresa IS NULL THEN
        INSERT INTO transversales.empresas (cod_patronal, emp_nom, ...)
        VALUES ('TEST001', 'Empresa de Prueba', ...)
        RETURNING id_empresa, cod_patronal INTO v_id_empresa, v_cod_patronal;
    END IF;
    
    RAISE NOTICE 'Usando empresa: ID=%, Cod_Patronal=%', v_id_empresa, v_cod_patronal;
    
    -- Crear solicitud de reembolso
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
        v_id_empresa,
        v_cod_patronal,
        '01',
        '2025',
        0,
        0,
        1,  -- PRESENTADO
        'admin',
        'Administrador de Prueba',
        CURRENT_TIMESTAMP,
        'PRIVADA',
        CURRENT_TIMESTAMP,
        'admin@test.com'
    )
    RETURNING id_solicitud_reembolso INTO v_id_solicitud;
    
    RAISE NOTICE 'Solicitud creada: ID=%', v_id_solicitud;
    
    -- ===================================================================
    -- CASO 1: Maternidad cubre Enfermedad (Juan Pérez)
    -- ===================================================================
    
    INSERT INTO transversales.detalles_reembolso (
        id_solicitud_reembolso, nro, ci, apellido_paterno, apellido_materno, nombres, matricula,
        tipo_incapacidad, fecha_inicio_baja, fecha_fin_baja, dias_incapacidad, dias_reembolso,
        dias_baja_total, dias_mes_reembolso, fecha_inicio_mes_reembolso, fecha_fin_mes_reembolso,
        salario, monto_dia, monto_subtotal, porcentaje_reembolso, monto_reembolso,
        cotizaciones_previas_verificadas, estado_revision, usuario_creacion, fecha_creacion
    ) VALUES 
    -- Enfermedad: 01/01/2025 - 13/01/2025
    (v_id_solicitud, 1, '12345678', 'Pérez', 'García', 'Juan', 'MAT001',
     'ENFERMEDAD', '2025-01-01', '2025-01-13', 13, 10, 13, 10, '2025-01-01', '2025-01-13',
     3000.00, 100.00, 1000.00, 75.00, 750.00, 2, NULL, 'admin', CURRENT_TIMESTAMP),
    -- Maternidad: 20/12/2024 - 02/02/2025 (cubre la enfermedad)
    (v_id_solicitud, 2, '12345678', 'Pérez', 'García', 'Juan', 'MAT001',
     'MATERNIDAD', '2024-12-20', '2025-02-02', 45, 45, 45, 45, '2024-12-20', '2025-02-02',
     3000.00, 100.00, 4500.00, 90.00, 4050.00, 4, NULL, 'admin', CURRENT_TIMESTAMP);
    
    -- ===================================================================
    -- CASO 2: Dos enfermedades solapadas (María López)
    -- ===================================================================
    
    INSERT INTO transversales.detalles_reembolso (
        id_solicitud_reembolso, nro, ci, apellido_paterno, apellido_materno, nombres, matricula,
        tipo_incapacidad, fecha_inicio_baja, fecha_fin_baja, dias_incapacidad, dias_reembolso,
        dias_baja_total, dias_mes_reembolso, fecha_inicio_mes_reembolso, fecha_fin_mes_reembolso,
        salario, monto_dia, monto_subtotal, porcentaje_reembolso, monto_reembolso,
        cotizaciones_previas_verificadas, estado_revision, usuario_creacion, fecha_creacion
    ) VALUES 
    -- Enfermedad 1: 05/01/2025 - 15/01/2025
    (v_id_solicitud, 3, '87654321', 'López', 'Martínez', 'María', 'MAT002',
     'ENFERMEDAD', '2025-01-05', '2025-01-15', 11, 8, 11, 8, '2025-01-05', '2025-01-15',
     3500.00, 116.67, 933.36, 75.00, 700.02, 2, NULL, 'admin', CURRENT_TIMESTAMP),
    -- Enfermedad 2: 10/01/2025 - 20/01/2025 (se solapa)
    (v_id_solicitud, 4, '87654321', 'López', 'Martínez', 'María', 'MAT002',
     'ENFERMEDAD', '2025-01-10', '2025-01-20', 11, 8, 11, 8, '2025-01-10', '2025-01-20',
     3500.00, 116.67, 933.36, 75.00, 700.02, 2, NULL, 'admin', CURRENT_TIMESTAMP);
    
    -- ===================================================================
    -- CASO 3: Enfermedad y Riesgo Profesional solapados (Carlos Rodríguez)
    -- ===================================================================
    
    INSERT INTO transversales.detalles_reembolso (
        id_solicitud_reembolso, nro, ci, apellido_paterno, apellido_materno, nombres, matricula,
        tipo_incapacidad, fecha_inicio_baja, fecha_fin_baja, dias_incapacidad, dias_reembolso,
        dias_baja_total, dias_mes_reembolso, fecha_inicio_mes_reembolso, fecha_fin_mes_reembolso,
        salario, monto_dia, monto_subtotal, porcentaje_reembolso, monto_reembolso,
        cotizaciones_previas_verificadas, estado_revision, fecha_accidente, lugar_accidente,
        usuario_creacion, fecha_creacion
    ) VALUES 
    -- Enfermedad: 15/01/2025 - 25/01/2025
    (v_id_solicitud, 5, '11223344', 'Rodríguez', 'Sánchez', 'Carlos', 'MAT003',
     'ENFERMEDAD', '2025-01-15', '2025-01-25', 11, 8, 11, 8, '2025-01-15', '2025-01-25',
     4000.00, 133.33, 1066.64, 75.00, 800.00, 2, NULL, NULL, NULL,
     'admin', CURRENT_TIMESTAMP),
    -- Riesgo Profesional: 20/01/2025 - 30/01/2025 (se solapa)
    (v_id_solicitud, 6, '11223344', 'Rodríguez', 'Sánchez', 'Carlos', 'MAT003',
     'PROFESIONAL', '2025-01-20', '2025-01-30', 11, 11, 11, 11, '2025-01-20', '2025-01-30',
     4000.00, 133.33, 1466.63, 90.00, 1320.00, 2, NULL, '2025-01-20', 'URBANO',
     'admin', CURRENT_TIMESTAMP);
    
    -- ===================================================================
    -- CASO 4: Sin solape (Ana Torres) - Control negativo
    -- ===================================================================
    
    INSERT INTO transversales.detalles_reembolso (
        id_solicitud_reembolso, nro, ci, apellido_paterno, apellido_materno, nombres, matricula,
        tipo_incapacidad, fecha_inicio_baja, fecha_fin_baja, dias_incapacidad, dias_reembolso,
        dias_baja_total, dias_mes_reembolso, fecha_inicio_mes_reembolso, fecha_fin_mes_reembolso,
        salario, monto_dia, monto_subtotal, porcentaje_reembolso, monto_reembolso,
        cotizaciones_previas_verificadas, estado_revision, usuario_creacion, fecha_creacion
    ) VALUES 
    -- Enfermedad: 01/02/2025 - 10/02/2025 (no se solapa con otros)
    (v_id_solicitud, 7, '99887766', 'Torres', 'Vargas', 'Ana', 'MAT004',
     'ENFERMEDAD', '2025-02-01', '2025-02-10', 10, 7, 10, 7, '2025-02-01', '2025-02-10',
     3200.00, 106.67, 746.69, 75.00, 560.02, 2, NULL, 'admin', CURRENT_TIMESTAMP);
    
    -- Actualizar totales
    UPDATE transversales.solicitudes_reembolso
    SET 
        total_trabajadores = (
            SELECT COUNT(DISTINCT ci) 
            FROM transversales.detalles_reembolso 
            WHERE id_solicitud_reembolso = v_id_solicitud
        ),
        total_reembolso = (
            SELECT COALESCE(SUM(monto_reembolso), 0)
            FROM transversales.detalles_reembolso 
            WHERE id_solicitud_reembolso = v_id_solicitud
        )
    WHERE id_solicitud_reembolso = v_id_solicitud;
    
    RAISE NOTICE '✅ Script completado. Solicitud ID: %', v_id_solicitud;
    RAISE NOTICE '📋 Revisa la solicitud en el frontend para ver los conflictos detectados';
    
END $$;

-- Verificar los datos insertados
SELECT 
    'Solicitud' AS tipo,
    id_solicitud_reembolso::TEXT AS id,
    cod_patronal,
    mes || '/' || gestion AS periodo,
    total_trabajadores::TEXT AS trabajadores,
    total_reembolso::TEXT AS monto_total
FROM transversales.solicitudes_reembolso
WHERE id_solicitud_reembolso = (
    SELECT MAX(id_solicitud_reembolso) 
    FROM transversales.solicitudes_reembolso
)
UNION ALL
SELECT 
    'Detalle' AS tipo,
    id_detalle_reembolso::TEXT AS id,
    ci,
    tipo_incapacidad,
    fecha_inicio_baja::TEXT || ' - ' || fecha_fin_baja::TEXT AS periodo,
    monto_reembolso::TEXT AS monto_total
FROM transversales.detalles_reembolso
WHERE id_solicitud_reembolso = (
    SELECT MAX(id_solicitud_reembolso) 
    FROM transversales.solicitudes_reembolso
)
ORDER BY tipo, id;

