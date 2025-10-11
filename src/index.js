import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'
import routes from './routes/index.js'
import { contextMiddleware } from './middlewares/requestContext.js'
import { CronService } from './services/cronService.js'

const app = express()
app.use(cors())
app.use(bodyParser.json())
app.set('trust proxy', '10.129.2.40');

CronService.run()

app.use(contextMiddleware)

app.use('/api', routes)

app.listen(process.env.PORT, () => {
  console.log(`Listening on http://localhost:${process.env.PORT}`)
})