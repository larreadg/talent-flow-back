import { validationResult } from 'express-validator'
import { CaptchaService } from '../services/captchaService.js'
import { TalentFlowError } from '../utils/error.js'
import { Response } from '../utils/response.js'

/** @typedef {import('express').Request} Request */
/** @typedef {import('express').Response} ExpressResponse */

/**
 * Lista empresas con paginación/búsqueda/ordenamiento.
 *
 * @param {Request} req - Request de Express (usa query: page, pageSize, q, orderBy, order).
 * @param {ExpressResponse} res - Response de Express.
 * @returns {Promise<unknown>}
 */
async function get(req, res) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).send(new Response('error', 400, null, errors.array()))
    }

    const captcha = await CaptchaService.generarCaptcha({ ip: req.ip })
    res.type('svg')
    res.status(200).send(captcha)

  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

export const CaptchaController = {
    get,
}
  