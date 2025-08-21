import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'
import 'dotenv/config'
import { contextMiddleware } from './middlewares/requestContext.js'

const app = express()
app.use(cors())
app.use(bodyParser.json())

app.use(contextMiddleware)

app.listen(process.env.PORT, () => {
  console.log(`Listening on http://localhost:${process.env.PORT}`)
})