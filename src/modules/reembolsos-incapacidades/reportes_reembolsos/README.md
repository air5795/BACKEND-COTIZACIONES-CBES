# Módulo de Reportes de Reembolsos

Este módulo proporciona funcionalidades para generar reportes de reembolsos por grupos (enfermedad, maternidad, profesional) en el sistema de cotizaciones.

## Estructura del Módulo

```
reportes_reembolsos/
├── reportes_reembolsos.controller.ts    # Controlador con endpoints
├── reportes_reembolsos.service.ts       # Lógica de negocio
├── reportes_reembolsos.module.ts        # Configuración del módulo
└── README.md                           # Documentación
```

## Endpoints Disponibles

### 1. Generar Reporte PDF
**GET** `/reportes-reembolsos/reporte-pdf`

**Parámetros de consulta:**
- `idSolicitud` (number, requerido): ID de la solicitud de reembolso

**Ejemplo:**
```
GET /reportes-reembolsos/reporte-pdf?idSolicitud=25
```

**Respuesta:** Archivo PDF descargable

### 2. Obtener Datos del Reporte (JSON)
**GET** `/reportes-reembolsos/datos`

**Parámetros de consulta:**
- `idSolicitud` (number, requerido): ID de la solicitud de reembolso

**Ejemplo:**
```
GET /reportes-reembolsos/datos?idSolicitud=25
```

**Respuesta JSON:**
```json
{
  "datos_empresa": {
    "cod_patronal": "11-730-0001",
    "nombre_empresa": "Nombre de la Empresa"
  },
  "solicitud": {
    "id_solicitud": 25,
    "mes": "ENERO",
    "gestion": "2025",
    "fecha_solicitud": "01/01/2025",
    "total_reembolso": 1500.00,
    "total_trabajadores": 1,
    "estado": "Presentado"
  },
  "grupos": [
    {
      "nombre": "Enfermedad",
      "detalles": [
        {
          "id_solicitud": 25,
          "fecha_solicitud": "01/01/2025",
          "trabajador": {
            "ci": "12345678",
            "nombre_completo": "PÉREZ GONZÁLEZ JUAN CARLOS",
            "apellido_paterno": "PÉREZ",
            "apellido_materno": "GONZÁLEZ",
            "nombres": "JUAN CARLOS",
            "matricula": "MAT001"
          },
          "tipo_incapacidad": "ENFERMEDAD COMÚN",
          "dias_incapacidad": 5,
          "dias_reembolso": 5,
          "dias_baja_total": 5,
          "dias_mes_reembolso": 5,
          "fecha_inicio_baja": "01/01/2025",
          "fecha_fin_baja": "05/01/2025",
          "fecha_inicio_mes_reembolso": "01/01/2025",
          "fecha_fin_mes_reembolso": "05/01/2025",
          "salario": 3000.00,
          "monto_dia": 100.00,
          "monto_subtotal": 500.00,
          "porcentaje_reembolso": 100.00,
          "monto_reembolso": 500.00,
          "lugar_accidente": null,
          "cotizaciones_previas_verificadas": true,
          "observaciones_afiliacion": null,
          "observaciones": null,
          "ruta_file_denuncia": null,
          "estado_revision": "PENDIENTE"
        }
      ],
      "total": 500.00
    },
    {
      "nombre": "Maternidad",
      "detalles": [],
      "total": 0
    },
    {
      "nombre": "Profesional",
      "detalles": [],
      "total": 0
    }
  ],
  "total_global": 500.00
}
```

## Estructura de Datos

### datos_empresa
- `cod_patronal`: Código patronal de la empresa
- `nombre_empresa`: Nombre de la empresa

### grupos
Array de objetos con la siguiente estructura:
- `nombre`: Nombre del grupo (Enfermedad, Maternidad, Profesional)
- `detalles`: Array de detalles de reembolsos
- `total`: Suma total del grupo

### detalles (dentro de cada grupo)
- `id_solicitud`: ID de la solicitud de reembolso
- `fecha_solicitud`: Fecha de la solicitud
- `trabajador`: Información del trabajador
  - `ci`: Cédula de identidad
  - `nombre`: Nombre del trabajador
  - `apellido`: Apellido del trabajador
- `tipo_incapacidad`: Tipo de incapacidad
- `dias_incapacidad`: Número de días de incapacidad
- `monto_reembolso`: Monto del reembolso
- `fecha_inicio`: Fecha de inicio de la incapacidad
- `fecha_fin`: Fecha de fin de la incapacidad

### total_global
Suma total de todos los reembolsos de todos los grupos.

## Plantilla de Reporte

El reporte PDF se genera usando una plantilla de Word ubicada en:
```
reports/reporte_reembolsos_grupos.docx
```

**Nota:** Debes crear esta plantilla manualmente usando Microsoft Word y las variables de Carbone especificadas en el archivo `plantilla_reporte_reembolsos.txt`.

## Dependencias

- `@nestjs/common`
- `@nestjs/typeorm`
- `typeorm`
- `carbone`
- `moment-timezone`
- `fs`
- `path`

## Configuración

El módulo está configurado en `app.module.ts` y utiliza:
- TypeORM para acceso a datos
- EmpresasModule para obtener información de empresas
- Entidades: SolicitudesReembolso, DetallesReembolso

## Estados de Solicitudes

El sistema maneja los siguientes estados para las solicitudes de reembolso:

- `0`: Borrador
- `1`: Presentado ✅ (se incluyen en el reporte)
- `2`: Aprobado ✅ (se incluyen en el reporte)
- `3`: Observado

## Uso

1. Asegúrate de que la plantilla `reporte_reembolsos_grupos.docx` existe en la carpeta `reports/`
2. Usa el ID de la solicitud de reembolso que quieres reportar
3. El sistema traerá todos los detalles de esa solicitud específica
4. No importa el estado de la solicitud, se incluyen todas
