// controllers/reporteController.js
import { ReporteService } from '../services/reporteService.js'

async function descargarReporteVacantes(req, res, next) {
  try {
    const { estados, departamentos, sedes, id } = req.query
    const { buffer, filename, mime } = await ReporteService.generarReporte({
        estados, departamentos, sedes, id
    })

    res.setHeader('Content-Type', mime)
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(Buffer.from(buffer))
  } catch (err) {
    next(err)
  }
}

export const ReporteController = {
    descargarReporteVacantes
}
  