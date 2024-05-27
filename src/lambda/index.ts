import 'source-map-support/register'
import 'reflect-metadata'
import { Container } from 'typedi'
import { QuizGenerator } from '../business/quiz-generator'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'

const client = new DynamoDBClient({})
const docClient = DynamoDBDocumentClient.from(client)

Container.set('DYNAMODB_CLIENT', docClient)

async function handler(event: any, context: any) {
  console.log(`Started processing...\nPayload: ${JSON.stringify({ event, context }, null, 2)}`)

  Container.set('GOOGLE_AI_CLIENT', new GoogleGenerativeAI(process.env.GOOGLE_API_KEY as string))

  const quizGenerator = Container.get(QuizGenerator)
  await quizGenerator.generate()

  return {
    statusCode: 200,
    body: 'OK',
  }
}

export { handler }
