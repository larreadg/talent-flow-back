import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'
import routes from './routes/index.js'
import { contextMiddleware } from './middlewares/requestContext.js'

const app = express()
app.use(cors())
app.use(bodyParser.json())

app.use(contextMiddleware)

app.use(routes)

app.listen(process.env.PORT, () => {
  console.log(`Listening on http://localhost:${process.env.PORT}`)
})