// controllers/reporteController.js
import { validationResult } from 'express-validator'
import { ReporteService } from '../services/reporteService.js'
import { TalentFlowError } from '../utils/error.js'
import { Response } from '../utils/response.js'

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

/**
 * Vacantes dentro y fuera del sla
 *
 * @param {Request} req - Express request
 * @param {ExpressResponse} res - Express response.
 * @returns {Promise<void>}
 */
async function getSLAResumenMaximo(req, res) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).send(new Response('error', 400, null, errors.array()))
    }

    const result = await ReporteService.getSLAResumenMaximo()
    return res
      .status(200)
      .send(new Response('success', 200, result, 'Resumen cumplimiento SLA maximo obtenido'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * Top fallutos :v
 *
 * @param {Request} req - Express request
 * @param {ExpressResponse} res - Express response.
 * @returns {Promise<void>}
 */
async function getTopDepartamentosIncumplimientoEtapas(req, res) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).send(new Response('error', 400, null, errors.array()))
    }
    const { limit } = req.params
    const result = await ReporteService.getTopDepartamentosIncumplimientoEtapas({ limit })
    return res
      .status(200)
      .send(new Response('success', 200, result, 'Resumen top 5 incumplimiento'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * Resumen 12 meses
 *
 * @param {Request} req - Express request
 * @param {ExpressResponse} res - Express response.
 * @returns {Promise<void>}
 */
async function getResumenVacantesMensualUltimos12Meses(req, res) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).send(new Response('error', 400, null, errors.array()))
    }
    const result = await ReporteService.getResumenVacantesMensualUltimos12Meses()
    return res
      .status(200)
      .send(new Response('success', 200, result, 'Resumen 12 meses'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

export const ReporteController = {
  descargarReporteVacantes,
  getSLAResumenMaximo,
  getTopDepartamentosIncumplimientoEtapas,
  getResumenVacantesMensualUltimos12Meses
}
  