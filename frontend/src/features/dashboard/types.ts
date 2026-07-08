// Tipos del resumen del dashboard (alineados con /api/dashboard/resumen/).

export type Periodo = 'dia' | 'semana' | 'mes' | 'anio'

interface EstadoFinanciado {
  financiado: number
  no_financiado: number
}

interface EfectividadAccion {
  enviadas: number
  efectivas: number
  en_proceso: number
  error: number
}

export interface PuntoSerie {
  periodo: string
  inhabilitaciones: number
  habilitaciones: number
}

export interface EquipoActividad {
  serial: string
  mac: string
  inhabilitaciones: number
  habilitaciones: number
  total: number
}

export interface DashboardResumen {
  kpis: {
    televisores: number
    inhabilitados: number
    habilitados: number
    financiados: number
    pines_entregados: number
  }
  estatus_inhabilitacion: {
    inhabilitado: EstadoFinanciado
    habilitado: EstadoFinanciado
  }
  efectividad: {
    inhabilitacion: EfectividadAccion
    habilitacion: EfectividadAccion
  }
  serie_tiempo: {
    periodo: Periodo
    datos: PuntoSerie[]
  }
  actividad_por_equipo: EquipoActividad[]
  usuarios: {
    total: number
    activos: number
    inactivos: number
    staff: number
  }
}
